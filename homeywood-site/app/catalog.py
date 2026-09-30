import re
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from .extensions import db
from .models import Category, Product

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if current_user.role != "admin":
            return jsonify({"error": "Halaman/aksi ini khusus admin."}), 403
        return fn(*args, **kwargs)
    return wrapper


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "produk"


def unique_slug(base):
    slug = base
    n = 1
    while Product.query.filter_by(slug=slug).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


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


# ============ Khusus admin: tambah / edit / hapus produk ============

@catalog_bp.route("/admin/products", methods=["POST"])
@admin_required
def admin_create_product():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    category_name = (data.get("category") or "").strip()
    material = (data.get("material") or "").strip() or None
    desc = (data.get("desc") or "").strip()

    if not name:
        return jsonify({"error": "Nama produk wajib diisi."}), 400
    try:
        price = float(data.get("price"))
        stock = int(data.get("stock"))
    except (TypeError, ValueError):
        return jsonify({"error": "Harga dan stok harus berupa angka."}), 400
    if price < 0 or stock < 0:
        return jsonify({"error": "Harga dan stok tidak boleh negatif."}), 400

    category = Category.query.filter_by(name=category_name).first()
    if not category:
        valid = ", ".join(c.name for c in Category.query.all())
        return jsonify({"error": f"Kategori '{category_name}' tidak ditemukan. Pilihan: {valid}"}), 400

    product = Product(
        category_id=category.id, name=name, slug=unique_slug(slugify(name)),
        description=desc, price=price, stock=stock, material=material,
        icon_emoji="🪵",
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({"product": product_to_dict(product)}), 201


@catalog_bp.route("/admin/products/<int:product_id>", methods=["PUT"])
@admin_required
def admin_update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Nama produk tidak boleh kosong."}), 400
        product.name = name
    if "category" in data:
        category = Category.query.filter_by(name=(data.get("category") or "").strip()).first()
        if not category:
            return jsonify({"error": "Kategori tidak ditemukan."}), 400
        product.category_id = category.id
    if "material" in data:
        product.material = (data.get("material") or "").strip() or None
    if "desc" in data:
        product.description = (data.get("desc") or "").strip()
    if "price" in data:
        try:
            price = float(data.get("price"))
            if price < 0:
                raise ValueError
            product.price = price
        except (TypeError, ValueError):
            return jsonify({"error": "Harga tidak valid."}), 400
    if "stock" in data:
        try:
            stock = int(data.get("stock"))
            if stock < 0:
                raise ValueError
            product.stock = stock
        except (TypeError, ValueError):
            return jsonify({"error": "Stok tidak valid."}), 400

    db.session.commit()
    return jsonify({"product": product_to_dict(product)})


@catalog_bp.route("/admin/products/<int:product_id>", methods=["DELETE"])
@admin_required
def admin_delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    product.is_active = False  # soft delete -- riwayat order_items yang sudah ada tetap aman
    db.session.commit()
    return jsonify({"ok": True})
