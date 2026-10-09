# Alur keamanan reset pw:
# Token acak 256-bit (secrets.token_urlsafe). Di database HANYA hash SHA-256-nya yang disimpan, token asli cuma ada di link email.
# Token berlaku RESET_TOKEN_MINUTES menit (default 30) dan sekali pakai.
# /api/forgot-password SELALU membalas pesan yang sama, ada atau tidak emailnya, supaya orang tidak bisa menebak email siapa yang terdaftar.
# Meminta token baru menghapus token lama milik user itu.

import hashlib
import secrets
import smtplib
import threading
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
from html import escape

from flask import Blueprint, current_app, jsonify, request

from .extensions import db
from .models import PasswordReset, User

import logging
import ssl
from email.utils import formataddr, parseaddr

log = logging.getLogger(__name__)

reset_bp = Blueprint("password_reset", __name__, url_prefix="/api")

GENERIC_MSG = "Jika email tersebut terdaftar, link reset kata sandi sudah dikirim. Cek inbox atau folder spam."


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _reset_email_html(name, link, minutes):
    name = escape(name)
    return f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#3b2a1e">
  <h2 style="color:#8a5a2b;margin-bottom:4px">Homey Wood</h2>
  <p>Halo {name},</p>
  <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Klik tombol di bawah untuk membuat kata sandi baru. Link berlaku {minutes} menit dan hanya bisa dipakai sekali.</p>
  <p style="margin:24px 0"><a href="{link}" style="background:#8a5a2b;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;display:inline-block">Atur Ulang Kata Sandi</a></p>
  <p style="font-size:13px;color:#6b5a4c">Jika tombol tidak berfungsi, salin link ini ke browser:<br><span style="word-break:break-all">{link}</span></p>
  <p style="font-size:13px;color:#6b5a4c">Jika Anda tidak merasa memintanya, abaikan email ini. Kata sandi Anda tidak berubah.</p>
</div>"""

def _send_email(cfg, to_addr, subject, body, html=None):
    """Kirim email lewat SMTP. Dijalankan di thread terpisah supaya request tidak menunggu."""
    try:
        msg = EmailMessage()
        msg["From"] = formataddr(("Homey Wood", parseaddr(cfg["MAIL_FROM"])[1]))
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")
        with smtplib.SMTP(cfg["MAIL_HOST"], cfg["MAIL_PORT"], timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if cfg["MAIL_USER"]:
                smtp.login(cfg["MAIL_USER"], cfg["MAIL_PASSWORD"])
            smtp.send_message(msg)
    except Exception:
        log.exception("[reset-password] Gagal kirim email ke %s", to_addr)

@reset_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Isi email Anda."}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user and user.is_active:
        minutes = current_app.config["RESET_TOKEN_MINUTES"]

        last = PasswordReset.query.filter_by(user_id=user.id).first()
        if last and datetime.utcnow() - (last.expires_at - timedelta(minutes=minutes)) < timedelta(seconds=60):
            return jsonify({"message": GENERIC_MSG})

        PasswordReset.query.filter_by(user_id=user.id).delete()
        token = secrets.token_urlsafe(32)
        db.session.add(PasswordReset(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.utcnow() + timedelta(minutes=minutes),
        ))
        db.session.commit()

        base = (current_app.config.get("APP_BASE_URL") or "http://127.0.0.1:5000").rstrip("/")
        link = f"{base}/reset-password.html?token={token}"
        body = (
            f"Halo {user.username},\n\n"
            "Kami menerima permintaan untuk mereset kata sandi akun Homey Wood Anda.\n"
            f"Klik link berikut (berlaku {minutes} menit, hanya bisa dipakai sekali):\n\n"
            f"{link}\n\n"
            "Jika Anda tidak merasa memintanya, abaikan email ini. Kata sandi Anda tidak berubah.\n\n"
            "Homey Wood"
        )
        html = _reset_email_html(user.username, link, minutes)
        cfg = {k: current_app.config[k] for k in
               ("MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASSWORD", "MAIL_FROM")}
        if cfg["MAIL_HOST"]:
            threading.Thread(
                target=_send_email,
                args=(cfg, user.email, "Reset kata sandi Homey Wood", body, html),
                daemon=True,
            ).start()
        else:
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
    if len(password) > 128:
        return jsonify({"error": "Kata sandi maksimal 128 karakter."}), 400

    row = PasswordReset.query.filter_by(token_hash=_hash_token(token)).first()
    if not row or row.used_at or row.expires_at < datetime.utcnow():
        return jsonify({"error": "Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru."}), 400

    user = row.user
    if not user or not user.is_active:
        return jsonify({"error": "Akun tidak dapat direset. Hubungi admin."}), 403

    user.set_password(password)
    row.used_at = datetime.utcnow()
    PasswordReset.query.filter(PasswordReset.user_id == user.id, PasswordReset.id != row.id).delete()
    db.session.commit()
    return jsonify({"ok": True, "message": "Kata sandi berhasil diubah. Silakan masuk."})

@reset_bp.route("/reset-password/check", methods=["POST"])
def check_reset_token():
    """Dipanggil halaman reset-password.html saat dibuka, untuk memastikan link
    masih berlaku SEBELUM user mengetik password baru. Tidak mengubah apa pun."""
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    if not isinstance(token, str) or not token.strip():
        return jsonify({"error": "Link reset tidak valid."}), 400

    row = PasswordReset.query.filter_by(token_hash=_hash_token(token.strip())).first()
    if (not row or row.used_at or row.expires_at < datetime.utcnow()
            or not row.user or not row.user.is_active):
        return jsonify({"error": "Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru."}), 400
    return jsonify({"valid": True})