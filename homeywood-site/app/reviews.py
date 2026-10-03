"""
Endpoint ulasan, rating, dan komentar.

  GET  /api/products/<id>/reviews     publik, terbaru dulu
  POST /api/reviews                   body: {orderCode, productId, rating, text, images:[dataURL, ...]}
  POST /api/reviews/<id>/comments     body: {text}

Aturan yang dijaga di server (bukan di browser):
  - ulasan hanya dari pembeli asli, untuk pesanan berstatus "selesai"
  - produknya harus benar-benar ada di pesanan itu
  - satu produk per pesanan hanya boleh diulas sekali
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from .extensions import db
from .models import Order, Product, Review, ReviewComment, ReviewImage
from .orders import format_tanggal_id
from .uploads import decode_data_url, delete_upload, save_image_bytes, upload_url

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api")

MAX_REVIEW_IMAGES = 3
MIN_TEXT, MAX_TEXT = 5, 400
MAX_COMMENT = 200


def comment_to_dict(c):
    return {
        "name": c.user.full_name if c.user else "Pengguna",
        "isAdmin": bool(c.user and c.user.role == "admin"),  # ditampilkan sebagai "Penjual"
        "text": c.comment,
        "date": format_tanggal_id(c.created_at),
    }


def review_to_dict(r):
    return {
        "id": r.id,
        "userName": r.user.full_name if r.user else "Pengguna",
        "rating": r.rating,
        "text": r.comment or "",
        "date": format_tanggal_id(r.created_at),
        "images": [upload_url(i.image_path) for i in r.images],
        "comments": [comment_to_dict(c) for c in r.comments],
    }


@reviews_bp.route("/products/<int:product_id>/reviews", methods=["GET"])
def list_reviews(product_id):
    Product.query.filter_by(id=product_id, is_active=True).first_or_404()
    reviews = (
        Review.query.filter_by(product_id=product_id)
        .options(
            joinedload(Review.user),
            selectinload(Review.images),
            selectinload(Review.comments).joinedload(ReviewComment.user),
        )
        .order_by(Review.created_at.desc(), Review.id.desc())
        .all()
    )
    return jsonify({"reviews": [review_to_dict(r) for r in reviews]})


@reviews_bp.route("/reviews", methods=["POST"])
@login_required
def create_review():
    data = request.get_json(silent=True) or {}
    order_code = (data.get("orderCode") or "").strip()
    try:
        product_id = int(data.get("productId"))
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "Data ulasan tidak valid."}), 400
    text = (data.get("text") or "").strip()
    images_in = data.get("images") or []

    if not 1 <= rating <= 5:
        return jsonify({"error": "Pilih rating 1 sampai 5 bintang."}), 400
    if len(text) < MIN_TEXT:
        return jsonify({"error": f"Tulis ulasan minimal {MIN_TEXT} karakter."}), 400
    if len(text) > MAX_TEXT:
        return jsonify({"error": f"Ulasan maksimal {MAX_TEXT} karakter."}), 400
    if not isinstance(images_in, list) or len(images_in) > MAX_REVIEW_IMAGES:
        return jsonify({"error": f"Maksimal {MAX_REVIEW_IMAGES} foto."}), 400

    # Pesanan harus milik user ini -- order orang lain dijawab "tidak ditemukan"
    order = Order.query.filter_by(order_code=order_code, user_id=current_user.id).first()
    if not order:
        return jsonify({"error": "Pesanan tidak ditemukan."}), 404
    if order.status != "selesai":
        return jsonify({"error": "Ulasan hanya bisa ditulis setelah pesanan diterima."}), 400
    if not any(i.product_id == product_id for i in order.items):
        return jsonify({"error": "Produk ini tidak ada di pesanan tersebut."}), 400
    if Review.query.filter_by(order_id=order.id, product_id=product_id).first():
        return jsonify({"error": "Produk ini sudah diulas."}), 409

    # Foto disimpan paling akhir, setelah semua validasi lolos.
    saved = []
    try:
        for d in images_in:
            saved.append(save_image_bytes(decode_data_url(d), "reviews"))
    except ValueError as e:
        for p in saved:
            delete_upload(p)
        return jsonify({"error": str(e)}), 400

    review = Review(
        product_id=product_id, user_id=current_user.id, order_id=order.id,
        rating=rating, comment=text,
    )
    review.images = [ReviewImage(image_path=p) for p in saved]
    db.session.add(review)
    try:
        db.session.commit()
    except IntegrityError:  # dua klik kirim bersamaan: aturan unik di database menolak yang kedua
        db.session.rollback()
        for p in saved:
            delete_upload(p)
        return jsonify({"error": "Produk ini sudah diulas."}), 409

    return jsonify({"review": review_to_dict(review)}), 201


@reviews_bp.route("/reviews/<int:review_id>/comments", methods=["POST"])
@login_required
def add_comment(review_id):
    review = Review.query.get_or_404(review_id)
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Komentar tidak boleh kosong."}), 400
    if len(text) > MAX_COMMENT:
        return jsonify({"error": f"Komentar maksimal {MAX_COMMENT} karakter."}), 400

    comment = ReviewComment(review_id=review.id, user_id=current_user.id, comment=text)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"comment": comment_to_dict(comment)}), 201
