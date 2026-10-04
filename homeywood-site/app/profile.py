# Hanya nama, telepon, dan alamat yang bisa diubah dari sini. Username, email, dan role sengaja tidak bisa diubah (role terutama: jangan sampai user bisa menaikkan dirinya jadi admin lewat request buatan sendiri).

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from .auth import user_to_dict
from .extensions import db
from .uploads import delete_upload, save_image

profile_bp = Blueprint("profile", __name__, url_prefix="/api")


@profile_bp.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()

    if not all([full_name, phone, address]):
        return jsonify({"error": "Nama, nomor WhatsApp, dan alamat wajib diisi."}), 400
    if len(full_name) > 100:
        return jsonify({"error": "Nama maksimal 100 karakter."}), 400
    if len(phone) > 20:
        return jsonify({"error": "Nomor WhatsApp maksimal 20 karakter."}), 400

    current_user.full_name = full_name
    current_user.phone = phone
    current_user.address = address
    db.session.commit()
    return jsonify({"user": user_to_dict(current_user)})


@profile_bp.route("/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    file = request.files.get("avatar")
    if not file or not file.filename:
        return jsonify({"error": "Pilih file foto terlebih dahulu."}), 400
    try:
        new_path = save_image(file, "avatars")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    old_path = current_user.avatar_path
    current_user.avatar_path = new_path
    db.session.commit()
    delete_upload(old_path)
    return jsonify({"user": user_to_dict(current_user)})


@profile_bp.route("/profile/avatar", methods=["DELETE"])
@login_required
def delete_avatar():
    old_path = current_user.avatar_path
    current_user.avatar_path = None
    db.session.commit()
    delete_upload(old_path)
    return jsonify({"user": user_to_dict(current_user)})