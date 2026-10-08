import base64
import os
import random
import re
import string
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from .catalog import admin_required
from .extensions import db
from .models import CartItem, Order, OrderItem, Payment, Product

orders_bp = Blueprint("orders", __name__, url_prefix="/api")

ZONES = {
    "batam":   {"name": "Batam", "rate": 150000, "free_min": 5000000},
    "sumatra": {"name": "Sumatra & Kepri lainnya", "rate": 350000, "free_min": 10000000},
    "jawa":    {"name": "Jawa", "rate": 500000, "free_min": None},
    "kalsul":  {"name": "Kalimantan & Sulawesi", "rate": 750000, "free_min": None},
    "timur":   {"name": "Bali, NTB/NTT, Maluku & Papua", "rate": 1000000, "free_min": None},
}
SIZE_UNITS = {"Sofa": 3, "Lemari": 3, "Meja": 2, "Kursi": 1}

STATUS_LABELS = {
    "menunggu_pembayaran": "Menunggu Pembayaran",
    "menunggu_verifikasi": "Menunggu Verifikasi",
    "diproses": "Diproses",
    "dikirim": "Dikirim",
    "selesai": "Selesai",
    "ditolak": "Ditolak",
    "dibatalkan": "Dibatalkan",
}
BULAN_ID = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
            "Agustus", "September", "Oktober", "November", "Desember"]


def format_tanggal_id(dt):
    if not dt:
        return ""
    return f"{dt.day} {BULAN_ID[dt.month]} {dt.year}"


def calc_shipping(items_with_products, zone_key):
    zone = ZONES.get(zone_key, ZONES["batam"])
    subtotal = sum(float(p.price) * qty for p, qty in items_with_products)
    units = sum(SIZE_UNITS.get(p.category.name if p.category else "", 1) * qty for p, qty in items_with_products)
    if units == 0:
        return zone, 0
    if zone["free_min"] and subtotal >= zone["free_min"]:
        return zone, 0
    mult = min(3, 1 + 0.5 * (units - 1))
    fee = round(zone["rate"] * mult / 1000) * 1000
    return zone, fee


def gen_order_code():
    for _ in range(20):
        code = "HW" + datetime.utcnow().strftime("%y%m%d") + "-" + "".join(random.choices(string.digits, k=4))
        if not Order.query.filter_by(order_code=code).first():
            return code
    raise RuntimeError("Gagal membuat kode pesanan unik, coba lagi.")


def save_payment_proof(data_url, order_code):
    m = re.match(r"^data:image/(\w+);base64,(.+)$", data_url or "")
    if not m:
        return None
    ext, b64 = m.groups()
    ext = "jpg" if ext in ("jpeg", "jpg") else ext
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return None
    folder = os.path.join(current_app.config["UPLOAD_ROOT"], "payment_proofs")
    os.makedirs(folder, exist_ok=True)
    filename = f"{order_code}.{ext}"
    with open(os.path.join(folder, filename), "wb") as f:
        f.write(raw)
    return f"payment_proofs/{filename}"


def order_to_dict(order):
    subtotal = sum(float(i.subtotal) for i in order.items)
    shipping = float(order.total_amount) - subtotal
    proof_url = f"/uploads/{order.payment.proof_path}" if order.payment and order.payment.proof_path else None
    reviewed_ids = {r.product_id for r in order.reviews}
    return {
        "id": order.order_code,
        "userId": order.user_id,
        "items": [
            {"productId": i.product_id, "name": i.product_name, "qty": i.quantity,
             "price": float(i.unit_price), "reviewed": i.product_id in reviewed_ids}
            for i in order.items
        ],
        "subtotal": subtotal,
        "shipping": shipping,
        "total": float(order.total_amount),
        "payment": order.payment_label,
        "proof": proof_url,
        "status": STATUS_LABELS.get(order.status, order.status),
        "date": format_tanggal_id(order.created_at),
        "recipient": {
            "name": order.recipient_name or (order.user.full_name if order.user else ""),
            "phone": order.recipient_phone or (order.user.phone if order.user else "") or "",
            "address": order.shipping_address,
        },
    }


@orders_bp.route("/orders", methods=["GET"])
@login_required
def list_orders():
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [order_to_dict(o) for o in orders]})


@orders_bp.route("/orders/<order_code>/confirm-arrived", methods=["POST"])
@login_required
def confirm_arrived(order_code):
    order = Order.query.filter_by(order_code=order_code, user_id=current_user.id).first_or_404()
    if order.status != "dikirim":
        return jsonify({"error": f"Order berstatus '{STATUS_LABELS.get(order.status, order.status)}', belum bisa dikonfirmasi."}), 400
    order.status = "selesai"
    db.session.commit()
    return jsonify({"order": order_to_dict(order)})


@orders_bp.route("/orders", methods=["POST"])
@login_required
def create_order():
    data = request.get_json(silent=True) or {}
    items_in = data.get("items") or []
    zone_key = data.get("zone") or "batam"
    payment_method = data.get("payment_method") or ""
    payment_label = (data.get("payment_label") or payment_method or "").strip()
    payment_proof = data.get("payment_proof")

    if not items_in:
        return jsonify({"error": "Keranjang kosong."}), 400
    if zone_key not in ZONES:
        return jsonify({"error": "Wilayah pengiriman tidak dikenali."}), 400

    is_cod = payment_method == "Bayar di Tempat (COD)"
    is_qris = payment_method == "QRIS"   # QRIS dinamis Midtrans: bukti diunggah setelah QR muncul
    if not is_cod and not is_qris and not payment_proof:
        return jsonify({"error": "Lampirkan bukti pembayaran dulu untuk Transfer/QRIS."}), 400

    resolved = []
    for it in items_in:
        try:
            pid = int(it.get("productId"))
            qty = int(it.get("qty"))
        except (TypeError, ValueError):
            continue
        if qty <= 0:
            continue
        product = Product.query.filter_by(id=pid, is_active=True).first()
        if not product:
            return jsonify({"error": f"Salah satu produk di keranjang sudah tidak tersedia."}), 400
        if product.stock < qty:
            return jsonify({"error": f"Stok '{product.name}' tidak cukup (tersisa {product.stock})."}), 400
        resolved.append((product, qty))

    if not resolved:
        return jsonify({"error": "Keranjang kosong."}), 400

    zone, shipping_fee = calc_shipping(resolved, zone_key)
    subtotal = sum(float(p.price) * qty for p, qty in resolved)
    total = subtotal + shipping_fee

    order = Order(
        order_code=gen_order_code(),
        user_id=current_user.id,
        total_amount=total,
        shipping_address=current_user.address or "-",
        recipient_name=current_user.full_name,    # nama lengkap untuk label pengiriman
        recipient_phone=current_user.phone,
        payment_label=payment_label,
        status="diproses" if is_cod else ("menunggu_pembayaran" if is_qris else "menunggu_verifikasi"),
    )
    db.session.add(order)
    db.session.flush()

    for product, qty in resolved:
        db.session.add(OrderItem(
            order_id=order.id, product_id=product.id, product_name=product.name,
            unit_price=product.price, quantity=qty, subtotal=float(product.price) * qty,
        ))
        product.stock -= qty

    if not is_cod and not is_qris:
        proof_path = save_payment_proof(payment_proof, order.order_code)
        if not proof_path:
            db.session.rollback()
            return jsonify({"error": "Format bukti pembayaran tidak valid."}), 400
        db.session.add(Payment(order_id=order.id, proof_path=proof_path, status="pending"))

    CartItem.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({"order": order_to_dict(order)}), 201

# utk admin bisa lihat order, verifikasi bayar, dan kirim

def admin_order_to_dict(order):
    d = order_to_dict(order)
    buyer = order.user
    d["buyer"] = {"id": buyer.id, "name": buyer.full_name, "username": buyer.username, "email": buyer.email} if buyer else None
    return d


@orders_bp.route("/admin/orders", methods=["GET"])
@admin_required
def admin_list_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [admin_order_to_dict(o) for o in orders]})


@orders_bp.route("/admin/orders/<order_code>/verify", methods=["POST"])
@admin_required
def admin_verify_payment(order_code):
    order = Order.query.filter_by(order_code=order_code).first_or_404()
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    if action not in ("approve", "reject"):
        return jsonify({"error": "action harus 'approve' atau 'reject'."}), 400
    if order.status != "menunggu_verifikasi":
        return jsonify({"error": f"Order berstatus '{STATUS_LABELS.get(order.status, order.status)}', tidak bisa diverifikasi lagi."}), 400

    payment = order.payment
    if action == "approve":
        order.status = "diproses"
        if payment:
            payment.status = "approved"
    else:
        order.status = "ditolak"
        if payment:
            payment.status = "rejected"
            payment.admin_note = (data.get("note") or "").strip() or None
        for item in order.items:
            if item.product:
                item.product.stock += item.quantity

    if payment:
        payment.verified_by = current_user.id
        payment.verified_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"order": admin_order_to_dict(order)})


@orders_bp.route("/admin/orders/<order_code>/ship", methods=["POST"])
@admin_required
def admin_ship_order(order_code):
    order = Order.query.filter_by(order_code=order_code).first_or_404()
    if order.status != "diproses":
        return jsonify({"error": f"Order berstatus '{STATUS_LABELS.get(order.status, order.status)}', belum bisa dikirim."}), 400
    order.status = "dikirim"
    db.session.commit()
    return jsonify({"order": admin_order_to_dict(order)})