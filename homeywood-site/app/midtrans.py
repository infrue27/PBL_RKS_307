"""QRIS dinamis lewat Midtrans (Sandbox).

Alur:
  1. Pembeli klik "Buat Pesanan" -> order dibuat berstatus menunggu_pembayaran.
  2. POST /api/orders/<kode>/qris        -> backend minta QR ke Midtrans.
  3. Frontend menampilkan QR dan memanggil GET /api/orders/<kode>/qris-status tiap 3 detik.
  4. POST /api/orders/<kode>/proof       -> pembeli unggah bukti bayar (wajib).
  5. Kalau Midtrans = settlement DAN bukti sudah ada -> status menunggu_verifikasi,
     lalu admin approve/reject seperti biasa.
  6. POST /api/midtrans/notification     -> webhook (opsional untuk simulasi lokal).
"""
import hashlib
from datetime import datetime, timedelta

import requests
from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from .extensions import db
from .models import Order, Payment
from .orders import save_payment_proof

midtrans_bp = Blueprint("midtrans", __name__, url_prefix="/api")


def _auth():
    return (current_app.config["MIDTRANS_SERVER_KEY"], "")


def _base():
    return current_app.config["MIDTRANS_BASE_URL"]


def _parse_expiry(text):
    """expiry_time dari Midtrans memakai WIB (UTC+7). Kita simpan sebagai UTC."""
    try:
        return datetime.strptime(text, "%Y-%m-%d %H:%M:%S") - timedelta(hours=7)
    except (TypeError, ValueError):
        return datetime.utcnow() + timedelta(minutes=14)


def advance(order):
    """Pindah ke antrean admin kalau Midtrans settlement DAN bukti sudah diunggah."""
    pay = order.payment
    if (order.status == "menunggu_pembayaran" and pay
            and pay.midtrans_status == "settlement" and pay.proof_path):
        order.status = "menunggu_verifikasi"
        pay.status = "pending"


def apply_status(order, data):
    """Satu-satunya tempat status order diubah berdasarkan info dari Midtrans."""
    ts = data.get("transaction_status")
    if not ts:
        return
    pay = order.payment
    if pay:
        pay.midtrans_status = ts
    if order.status != "menunggu_pembayaran":
        return
    if ts == "settlement":
        advance(order)
    elif ts in ("expire", "cancel", "deny"):
        order.status = "dibatalkan"
        if pay:
            pay.status = "rejected"
        for item in order.items:          # kembalikan stok
            if item.product:
                item.product.stock += item.quantity


def _get_order(order_code):
    return Order.query.filter_by(order_code=order_code, user_id=current_user.id).first_or_404()


@midtrans_bp.route("/orders/<order_code>/qris", methods=["POST"])
@login_required
def create_qris(order_code):
    order = _get_order(order_code)
    if order.status != "menunggu_pembayaran":
        return jsonify({"error": "Pesanan ini tidak sedang menunggu pembayaran."}), 400
    if not current_app.config["MIDTRANS_SERVER_KEY"].startswith("SB-"):
        return jsonify({"error": "MIDTRANS_SERVER_KEY di .env belum diisi dengan key sandbox (SB-Mid-server-...)."}), 500

    # QR yang sama dipakai lagi kalau belum kedaluwarsa (Midtrans menolak order_id ganda)
    pay = order.payment
    if pay and pay.qr_url and pay.qr_expires_at and pay.qr_expires_at > datetime.utcnow():
        return jsonify({"qr_url": pay.qr_url, "amount": float(order.total_amount)})

    payload = {
        "payment_type": "qris",
        "transaction_details": {"order_id": order.order_code, "gross_amount": int(order.total_amount)},
        "qris": {"acquirer": "gopay"},
    }
    try:
        r = requests.post(f"{_base()}/v2/charge", json=payload, auth=_auth(), timeout=20)
        data = r.json()
    except (requests.RequestException, ValueError):
        return jsonify({"error": "Tidak bisa menghubungi Midtrans. Coba lagi sebentar."}), 502

    if data.get("status_code") not in ("200", "201"):
        print("MIDTRANS ERROR:", r.status_code, r.text)
        return jsonify({"error": str(data.get("status_message") or "Gagal membuat QRIS.")}), 502

    qr_url = next((a["url"] for a in data.get("actions", [])
                   if a["name"].startswith("generate-qr-code")), None)
    if not qr_url:
        return jsonify({"error": "Midtrans tidak mengembalikan URL QR."}), 502

    if not pay:
        pay = Payment(order_id=order.id, proof_path=None, status="pending")
        db.session.add(pay)
    pay.qr_url = qr_url
    pay.qr_expires_at = _parse_expiry(data.get("expiry_time"))
    pay.midtrans_status = "pending"
    db.session.commit()
    return jsonify({"qr_url": qr_url, "amount": float(order.total_amount)})


@midtrans_bp.route("/orders/<order_code>/qris-status", methods=["GET"])
@login_required
def qris_status(order_code):
    order = _get_order(order_code)
    if order.status == "menunggu_pembayaran" and order.payment and order.payment.qr_url:
        try:
            r = requests.get(f"{_base()}/v2/{order.order_code}/status", auth=_auth(), timeout=20)
            apply_status(order, r.json())
            db.session.commit()
        except (requests.RequestException, ValueError):
            pass   # coba lagi pada polling berikutnya
    pay = order.payment
    return jsonify({
        "status": order.status,
        "midtrans_status": pay.midtrans_status if pay else None,
        "has_proof": bool(pay and pay.proof_path),
    })


@midtrans_bp.route("/orders/<order_code>/proof", methods=["POST"])
@login_required
def upload_qris_proof(order_code):
    order = _get_order(order_code)
    if order.status != "menunggu_pembayaran" or not order.payment:
        return jsonify({"error": "Pesanan ini tidak menerima bukti bayar lagi."}), 400
    data = request.get_json(silent=True) or {}
    path = save_payment_proof(data.get("payment_proof"), order.order_code)
    if not path:
        return jsonify({"error": "Format bukti pembayaran tidak valid."}), 400
    order.payment.proof_path = path
    advance(order)
    db.session.commit()
    return jsonify({"status": order.status})


@midtrans_bp.route("/midtrans/notification", methods=["POST"])
def notification():
    n = request.get_json(silent=True) or {}
    raw = (str(n.get("order_id", "")) + str(n.get("status_code", "")) + str(n.get("gross_amount", ""))
           + current_app.config["MIDTRANS_SERVER_KEY"])
    if hashlib.sha512(raw.encode()).hexdigest() != n.get("signature_key"):
        return "invalid signature", 403
    order = Order.query.filter_by(order_code=n.get("order_id")).first()
    if order:
        apply_status(order, n)
        db.session.commit()
    return "OK", 200
