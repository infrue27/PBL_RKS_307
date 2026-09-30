"""
Endpoint Kelola User (khusus admin).

  GET   /api/admin/users?search=...&status=all|active|inactive
  PATCH /api/admin/users/<id>/status   body: {"is_active": true/false}

Tidak ada hapus user (sengaja): akun bermasalah cukup dinonaktifkan,
riwayat order tetap utuh.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func

from .catalog import admin_required
from .extensions import db
from .models import Order, User
from .orders import format_tanggal_id

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/api")


def admin_user_to_dict(user, order_count):
    return {
        "id": user.id,
        "name": user.full_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone or "",
        "address": user.address or "",
        "joined": format_tanggal_id(user.created_at),
        "is_active": bool(user.is_active),
        "order_count": int(order_count or 0),
    }


@admin_users_bp.route("/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    # jumlah order per user, dihitung sekali lewat subquery (bukan N+1 query)
    order_counts = (
        db.session.query(Order.user_id, func.count(Order.id).label("n"))
        .group_by(Order.user_id)
        .subquery()
    )

    q = (
        db.session.query(User, order_counts.c.n)
        .outerjoin(order_counts, order_counts.c.user_id == User.id)
        .filter(User.role == "customer")
    )

    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(
            User.full_name.ilike(like),
            User.email.ilike(like),
            User.username.ilike(like),
        ))

    status = request.args.get("status", "all")
    if status == "active":
        q = q.filter(User.is_active.is_(True))
    elif status == "inactive":
        q = q.filter(User.is_active.is_(False))

    rows = q.order_by(User.created_at.desc(), User.id.desc()).all()
    return jsonify({"users": [admin_user_to_dict(u, n) for u, n in rows]})


@admin_users_bp.route("/admin/users/<int:user_id>/status", methods=["PATCH"])
@admin_required
def admin_set_user_status(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if not isinstance(data.get("is_active"), bool):
        return jsonify({"error": "is_active harus true atau false."}), 400
    if user.id == current_user.id:
        return jsonify({"error": "Kamu tidak bisa menonaktifkan akunmu sendiri."}), 400
    if user.role == "admin":
        return jsonify({"error": "Akun admin tidak bisa diubah dari sini."}), 403

    user.is_active = data["is_active"]
    db.session.commit()

    order_count = Order.query.filter_by(user_id=user.id).count()
    return jsonify({"user": admin_user_to_dict(user, order_count)})
