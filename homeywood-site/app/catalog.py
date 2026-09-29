from flask import Blueprint, jsonify, request

from .extensions import db
from .models import Category, Product

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")


def product_to_dict(p):
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category.name if p.category else None,
        "material": p.material,
        "price": float(p.price),
        "stock": p.stock,
        "desc": p.description or "",
        "icon": p.icon_emoji or "🪵",
    }


@catalog_bp.route("/products")
def list_products():
    q = Product.query.filter_by(is_active=True)

    category = request.args.get("category")
    if category and category != "Semua":
        q = q.join(Category).filter(Category.name == category)

    materials = request.args.getlist("material")
    if materials:
        q = q.filter(Product.material.in_(materials))

    search = request.args.get("search")
    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(Product.name.ilike(like), Product.description.ilike(like)))

    products = q.order_by(Product.created_at.desc()).all()
    return jsonify({"products": [product_to_dict(p) for p in products]})


@catalog_bp.route("/products/<int:product_id>")
def get_product(product_id):
    p = Product.query.get_or_404(product_id)
    if not p.is_active:
        return jsonify({"error": "Produk tidak ditemukan."}), 404
    return jsonify({"product": product_to_dict(p)})
