"""
Endpoint Dashboard admin.

  GET /api/admin/dashboard

Semua angka dihitung di database (SUM/COUNT), bukan dijumlah di browser,
jadi tetap cepat dan akurat walau datanya banyak.
"""
from flask import Blueprint, jsonify
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from .catalog import admin_required
from .extensions import db
from .models import Order, Product, User
from .orders import STATUS_LABELS

admin_dashboard_bp = Blueprint("admin_dashboard", __name__, url_prefix="/api")

# Status order yang dihitung sebagai PENDAPATAN. Ubah di sini kalau definisinya
# mau diganti, misalnya ("selesai",) kalau hanya pesanan yang sudah diterima
# pembeli yang dianggap pendapatan.
#   - menunggu_pembayaran / menunggu_verifikasi : uang belum terverifikasi
#   - ditolak / dibatalkan                      : tidak ada uang masuk
REVENUE_STATUSES = ("diproses", "dikirim", "selesai")


@admin_dashboard_bp.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    total_revenue = (
        db.session.query(func.coalesce(func.sum(Order.total_amount), 0))
        .filter(Order.status.in_(REVENUE_STATUSES))
        .scalar()
    )
    total_orders = Order.query.count()
    total_products = Product.query.filter_by(is_active=True).count()  # produk yang "dihapus" (soft delete) tidak dihitung
    total_customers = User.query.filter_by(role="customer").count()

    recent = (
        Order.query.options(joinedload(Order.user))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(6)
        .all()
    )

    return jsonify({
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "total_products": total_products,
        "total_customers": total_customers,
        "recent_orders": [
            {
                "id": o.order_code,
                "buyer": o.user.full_name if o.user else "-",
                "total": float(o.total_amount),
                "status": STATUS_LABELS.get(o.status, o.status),
            }
            for o in recent
        ],
    })