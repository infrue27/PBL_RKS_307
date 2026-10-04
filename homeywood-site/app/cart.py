from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from .extensions import db
from .models import CartItem, Product

cart_bp = Blueprint("cart", __name__, url_prefix="/api")


def cart_items_payload():
    rows = (
        CartItem.query.join(Product, CartItem.product_id == Product.id)
        .filter(CartItem.user_id == current_user.id, Product.is_active.is_(True))
        .order_by(CartItem.added_at, CartItem.id)
        .all()
    )
    return [{"productId": r.product_id, "qty": r.quantity} for r in rows]


def parse_positive_int(value):
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def get_active_product(product_id):
    return Product.query.filter_by(id=product_id, is_active=True).first()


@cart_bp.route("/cart", methods=["GET"])
@login_required
def get_cart():
    return jsonify({"items": cart_items_payload()})


@cart_bp.route("/cart/items", methods=["POST"])
@login_required
def add_item():
    data = request.get_json(silent=True) or {}
    product_id = parse_positive_int(data.get("productId"))
    qty = parse_positive_int(data.get("qty", 1))
    if product_id is None or qty is None:
        return jsonify({"error": "Data produk atau jumlah tidak valid."}), 400

    product = get_active_product(product_id)
    if not product:
        return jsonify({"error": "Produk tidak ditemukan atau sudah tidak tersedia."}), 404

    item = CartItem.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    new_qty = (item.quantity if item else 0) + qty
    if new_qty > product.stock:
        return jsonify({"error": f"Stok '{product.name}' tidak cukup (tersisa {product.stock})."}), 400

    if item:
        item.quantity = new_qty
    else:
        db.session.add(CartItem(user_id=current_user.id, product_id=product_id, quantity=new_qty))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Permintaan bentrok, silakan coba lagi."}), 409

    return jsonify({"items": cart_items_payload()})


@cart_bp.route("/cart/items/<int:product_id>", methods=["PUT"])
@login_required
def set_item_qty(product_id):
    data = request.get_json(silent=True) or {}
    qty = parse_positive_int(data.get("qty"))
    if qty is None:
        return jsonify({"error": "Jumlah harus berupa angka 1 atau lebih."}), 400

    item = CartItem.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    product = get_active_product(product_id)
    if not item or not product:
        return jsonify({"error": "Produk tidak ada di keranjang."}), 404
    if qty > product.stock:
        return jsonify({"error": f"Stok '{product.name}' tidak cukup (tersisa {product.stock})."}), 400

    item.quantity = qty
    db.session.commit()
    return jsonify({"items": cart_items_payload()})


@cart_bp.route("/cart/items/<int:product_id>", methods=["DELETE"])
@login_required
def remove_item(product_id):
    item = CartItem.query.filter_by(user_id=current_user.id, product_id=product_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({"items": cart_items_payload()})