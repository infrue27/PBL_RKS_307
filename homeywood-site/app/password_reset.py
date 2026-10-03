"""
Reset password lewat email.

  POST /api/forgot-password   body: {email}
  POST /api/reset-password    body: {token, password}

Alur & keamanan:
- Token acak 256-bit (secrets.token_urlsafe). Di database HANYA hash SHA-256-nya
  yang disimpan, token asli cuma ada di link email.
- Token berlaku RESET_TOKEN_MINUTES menit (default 30) dan sekali pakai.
- /api/forgot-password SELALU membalas pesan yang sama, ada atau tidak emailnya,
  supaya orang tidak bisa menebak email siapa yang terdaftar.
- Meminta token baru menghapus token lama milik user itu.
"""
import hashlib
import secrets
import smtplib
import threading
from datetime import datetime, timedelta
from email.message import EmailMessage

from flask import Blueprint, current_app, jsonify, request

from .extensions import db
from .models import PasswordReset, User

reset_bp = Blueprint("password_reset", __name__, url_prefix="/api")

GENERIC_MSG = "Jika email tersebut terdaftar, link reset kata sandi sudah dikirim. Cek inbox atau folder spam."


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_email(cfg, to_addr, subject, body):
    """Kirim email lewat SMTP. Dijalankan di thread terpisah supaya request tidak menunggu."""
    try:
        msg = EmailMessage()
        msg["From"] = cfg["MAIL_FROM"]
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)
        with smtplib.SMTP(cfg["MAIL_HOST"], cfg["MAIL_PORT"], timeout=15) as smtp:
            smtp.starttls()
            if cfg["MAIL_USER"]:
                smtp.login(cfg["MAIL_USER"], cfg["MAIL_PASSWORD"])
            smtp.send_message(msg)
    except Exception as e:  # jangan sampai error email bocor ke user
        print(f"[reset-password] Gagal kirim email ke {to_addr}: {e}")


@reset_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Isi email Anda."}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user and user.is_active:
        # hapus token lama milik user ini, lalu buat yang baru
        PasswordReset.query.filter_by(user_id=user.id).delete()
        token = secrets.token_urlsafe(32)
        minutes = current_app.config["RESET_TOKEN_MINUTES"]
        db.session.add(PasswordReset(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.utcnow() + timedelta(minutes=minutes),
        ))
        db.session.commit()

        base = (current_app.config.get("APP_BASE_URL") or request.host_url).rstrip("/")
        link = f"{base}/reset-password.html?token={token}"
        body = (
            f"Halo {user.username},\n\n"
            "Kami menerima permintaan untuk mereset kata sandi akun Homey Wood Anda.\n"
            f"Klik link berikut (berlaku {minutes} menit, hanya bisa dipakai sekali):\n\n"
            f"{link}\n\n"
            "Jika Anda tidak merasa memintanya, abaikan email ini. Kata sandi Anda tidak berubah.\n\n"
            "Homey Wood"
        )
        cfg = {k: current_app.config[k] for k in
               ("MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASSWORD", "MAIL_FROM")}
        if cfg["MAIL_HOST"]:
            threading.Thread(
                target=_send_email,
                args=(cfg, user.email, "Reset kata sandi Homey Wood", body),
                daemon=True,
            ).start()
        else:
            # Mode development: belum ada SMTP, tampilkan link di terminal
            print(f"\n[reset-password] SMTP belum diatur. Link reset untuk {user.email}:\n{link}\n")

    return jsonify({"message": GENERIC_MSG})


@reset_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    password = data.get("password") or ""

    if not token:
        return jsonify({"error": "Link reset tidak valid."}), 400
    if len(password) < 8:
        return jsonify({"error": "Kata sandi minimal 8 karakter."}), 400

    row = PasswordReset.query.filter_by(token_hash=_hash_token(token)).first()
    if not row or row.used_at or row.expires_at < datetime.utcnow():
        return jsonify({"error": "Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru."}), 400

    user = row.user
    if not user or not user.is_active:
        return jsonify({"error": "Akun tidak dapat direset. Hubungi admin."}), 403

    user.set_password(password)
    row.used_at = datetime.utcnow()
    # token lain milik user ini ikut dihapus
    PasswordReset.query.filter(PasswordReset.user_id == user.id, PasswordReset.id != row.id).delete()
    db.session.commit()
    return jsonify({"ok": True, "message": "Kata sandi berhasil diubah. Silakan masuk."})
