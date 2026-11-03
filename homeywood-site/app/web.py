"""Blueprint halaman yang dirender server-side dengan Jinja2."""
from flask import Blueprint, jsonify, render_template
from flask_wtf.csrf import generate_csrf

from .models import Product

web_bp = Blueprint("web", __name__)


@web_bp.route("/produk")
def produk_page():
    products = (
        Product.query.filter_by(is_active=True)
        .order_by(Product.created_at.desc())
        .all()
    )
    return render_template("produk.html", products=products)


@web_bp.route("/produk/<int:product_id>")
def produk_detail(product_id):
    p = Product.query.filter_by(id=product_id, is_active=True).first_or_404()
    return render_template("produk_detail.html", p=p)


@web_bp.route("/api/csrf-token")
def csrf_token():
    return jsonify(token=generate_csrf())
