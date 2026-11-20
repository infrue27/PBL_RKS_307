"""Produk favorit (wishlist) per pengguna."""
from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from .catalog import product_to_dict
from .extensions import db
from .models import Favorite, Product
from .ratings import rating_data_for

favorites_bp = Blueprint("favorites", __name__, url_prefix="/api")


def favorite_ids():
    rows = (
        db.session.query(Favorite.product_id)
        .join(Product, Favorite.product_id == Product.id)
        .filter(Favorite.user_id == current_user.id, Product.is_active.is_(True))
        .order_by(Favorite.created_at.desc(), Favorite.id.desc())
        .all()
    )
    return [r[0] for r in rows]


@favorites_bp.route("/favorites", methods=["GET"])
@login_required
def list_favorites():
    ids = favorite_ids()
    products = {p.id: p for p in Product.query.filter(Product.id.in_(ids)).all()} if ids else {}
    ratings = rating_data_for(ids) if ids else {}
    return jsonify({
        "ids": ids,
        "products": [product_to_dict(products[i], ratings[i]) for i in ids if i in products],
    })


@favorites_bp.route("/favorites/<int:product_id>", methods=["POST"])
@login_required
def add_favorite(product_id):
    product = Product.query.filter_by(id=product_id, is_active=True).first()
    if not product:
        return jsonify({"error": "Produk tidak ditemukan atau sudah tidak tersedia."}), 404
    exists = Favorite.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    if not exists:
        db.session.add(Favorite(user_id=current_user.id, product_id=product_id))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
    return jsonify({"ids": favorite_ids()})


@favorites_bp.route("/favorites/<int:product_id>", methods=["DELETE"])
@login_required
def remove_favorite(product_id):
    Favorite.query.filter_by(user_id=current_user.id, product_id=product_id).delete()
    db.session.commit()
    return jsonify({"ids": favorite_ids()})
