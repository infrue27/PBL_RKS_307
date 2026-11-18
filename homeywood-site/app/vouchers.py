"""Voucher diskon: pengguna baru & tanggal kembar.

Cara kerja (sengaja sederhana, tanpa tabel voucher baru):
  * Aturan voucher ada di konstanta NEW_USER dan TWIN_DATE di bawah.
    Mau ganti persen/maksimal diskon/minimal belanja cukup ubah di sini.
  * Pemakaian voucher dicatat langsung di pesanan (orders.voucher_code dan
    orders.discount_amount).
  * Voucher dianggap "terpakai" selama pesanannya BELUM ditolak/dibatalkan.
    Jadi kalau pesanan QRIS kedaluwarsa atau pembayaran ditolak admin,
    voucher otomatis kembali tanpa perlu kode tambahan di tempat lain.

Dua jenis voucher:
  * WELCOME            -> pengguna baru, berlaku NEW_USER["valid_days"] hari sejak
                          daftar, sekali pakai.
  * KEMBAR-YYYY-MM-DD  -> aktif hanya pada tanggal kembar (1/1, 2/2, ... 12/12,
                          menurut WIB), sekali pakai per tanggal.

Diskon dihitung dari subtotal barang (ongkir tidak didiskon), dibulatkan ke
bawah ke rupiah, dan dibatasi max_discount. Satu pesanan hanya boleh satu voucher.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from flask import Blueprint, jsonify
from flask_login import current_user, login_required

from .extensions import db
from .models import CartItem, Order, Product, User

vouchers_bp = Blueprint("vouchers", __name__, url_prefix="/api")

WIB = timezone(timedelta(hours=7))

NEW_USER_CODE = "WELCOME"
NEW_USER = {
    "name": "Voucher Pengguna Baru",
    "percent": 10,
    "max_discount": 500_000,
    "min_purchase": 0,
    "valid_days": 30,
}
TWIN_DATE = {
    "name": "Voucher Tanggal Kembar",
    "percent": 12,
    "max_discount": 1_000_000,
    "min_purchase": 1_000_000,
}

# Pesanan berstatus ini tidak lagi "memakai" voucher.
RELEASED_STATUSES = ("ditolak", "dibatalkan")


class VoucherError(Exception):
    """Voucher tidak bisa dipakai; pesan aman ditampilkan ke pembeli."""


def _rp(n):
    return "Rp " + f"{int(n):,}".replace(",", ".")


def today_wib():
    return datetime.now(WIB).date()


def is_twin_date(d):
    return d.day == d.month


def next_twin_date(after):
    """Tanggal kembar pertama SETELAH tanggal `after`."""
    for i in range(1, 400):
        c = after + timedelta(days=i)
        if c.day == c.month:
            return c
    return None


def twin_code(d):
    return f"KEMBAR-{d.isoformat()}"


def voucher_label(code):
    if not code:
        return None
    if code == NEW_USER_CODE:
        return NEW_USER["name"]
    if code.startswith("KEMBAR-"):
        return TWIN_DATE["name"]
    return code


def active_vouchers(user, today=None):
    """Voucher yang sedang berlaku untuk user ini (belum memeriksa sudah dipakai/belum)."""
    today = today or today_wib()
    found = []

    if user.role == "customer" and user.created_at:
        expires = user.created_at + timedelta(days=NEW_USER["valid_days"])
        if datetime.utcnow() <= expires:
            found.append({**NEW_USER, "code": NEW_USER_CODE, "type": "new_user",
                          "valid_until": expires.date()})

    if is_twin_date(today):
        found.append({**TWIN_DATE, "code": twin_code(today), "type": "twin_date",
                      "valid_until": today})
    return found


def used_codes(user_id, codes, lock=False):
    """Kode voucher (dari `codes`) yang masih terpakai oleh pesanan aktif user ini."""
    if not codes:
        return set()
    q = db.session.query(Order.voucher_code).filter(
        Order.user_id == user_id,
        Order.voucher_code.in_(list(codes)),
        ~Order.status.in_(RELEASED_STATUSES),
    )
    if lock:
        q = q.with_for_update()
    return {r[0] for r in q.all()}


def calc_discount(voucher, subtotal):
    raw = (Decimal(subtotal) * Decimal(voucher["percent"]) / Decimal(100)
           ).quantize(Decimal("1"), rounding=ROUND_DOWN)
    return min(raw, Decimal(voucher["max_discount"]))


def check(voucher, subtotal, used):
    """Return (bisa_dipakai, alasan_jika_tidak)."""
    if voucher["code"] in used:
        return False, "Sudah kamu pakai"
    if Decimal(subtotal) < Decimal(voucher["min_purchase"]):
        return False, f"Belanja minimal {_rp(voucher['min_purchase'])}"
    if calc_discount(voucher, subtotal) <= 0:
        return False, "Keranjang masih kosong"
    return True, None


def validate_for_order(user, code, subtotal):
    """Dipanggil saat membuat pesanan. Return (voucher, diskon) atau raise VoucherError.

    Baris user dikunci dulu supaya dua pesanan bersamaan dari akun yang sama
    tidak bisa memakai voucher yang sama dua kali.
    """
    by_code = {v["code"]: v for v in active_vouchers(user)}
    voucher = by_code.get(code)
    if not voucher:
        raise VoucherError("Voucher tidak berlaku atau sudah kedaluwarsa.")

    db.session.query(User.id).filter(User.id == user.id).with_for_update().first()
    used = used_codes(user.id, [code], lock=True)
    ok, reason = check(voucher, subtotal, used)
    if not ok:
        raise VoucherError(f"Voucher tidak bisa dipakai: {reason.lower()}.")
    return voucher, calc_discount(voucher, subtotal)


def _cart_subtotal(user_id):
    rows = (
        db.session.query(Product.price, CartItem.quantity)
        .join(CartItem, CartItem.product_id == Product.id)
        .filter(CartItem.user_id == user_id, Product.is_active.is_(True))
        .all()
    )
    return sum((price * qty for price, qty in rows), Decimal("0"))


@vouchers_bp.route("/vouchers", methods=["GET"])
@login_required
def list_vouchers():
    """Voucher yang berlaku untuk user ini + hematnya untuk isi keranjang sekarang."""
    today = today_wib()
    subtotal = _cart_subtotal(current_user.id)
    active = active_vouchers(current_user, today)
    used = used_codes(current_user.id, [v["code"] for v in active])

    items = []
    for v in active:
        ok, reason = check(v, subtotal, used)
        items.append({
            "code": v["code"],
            "type": v["type"],
            "name": v["name"],
            "percent": v["percent"],
            "maxDiscount": v["max_discount"],
            "minPurchase": v["min_purchase"],
            "validUntil": v["valid_until"].isoformat(),
            "used": v["code"] in used,
            "eligible": ok,
            "reason": reason,
            "discount": float(calc_discount(v, subtotal)) if ok else 0,
        })

    nxt = next_twin_date(today)
    return jsonify({
        "vouchers": items,
        "subtotal": float(subtotal),
        "nextTwinDate": nxt.isoformat() if nxt else None,
    })
