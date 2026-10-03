import re

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user

from .extensions import db
from .models import User
from .uploads import upload_url

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._]{3,30}$")


def user_to_dict(user):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "name": user.full_name,
        "username": user.username,
        "display_name": user.username,   # dipakai untuk tampilan di website
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "role": user.role,
        "avatar_path": user.avatar_path,
        "avatar_url": upload_url(user.avatar_path),
    }


@auth_bp.route("/me")
def me():
    if current_user.is_authenticated:
        return jsonify({"user": user_to_dict(current_user)})
    return jsonify({"user": None})


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    password = data.get("password") or ""

    if not all([full_name, username, email, phone, address, password]):
        return jsonify({"error": "Lengkapi semua data terlebih dahulu."}), 400
    if not USERNAME_RE.match(username):
        return jsonify({"error": "Username 3-30 karakter, hanya huruf/angka/titik/underscore."}), 400
    if len(password) < 8:
        return jsonify({"error": "Kata sandi minimal 8 karakter."}), 400

    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({"error": "Email sudah terdaftar."}), 409
    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"error": "Username sudah dipakai, coba yang lain."}), 409

    user = User(
        full_name=full_name,
        username=username,
        email=email,
        phone=phone,
        address=address,
        role="customer",
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    login_user(user)
    return jsonify({"user": user_to_dict(user)}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Isi email dan password."}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Email atau password salah."}), 401
    if not user.is_active:
        return jsonify({"error": "Akun ini dinonaktifkan. Hubungi admin."}), 403

    login_user(user)
    return jsonify({"user": user_to_dict(user)})


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"ok": True})
