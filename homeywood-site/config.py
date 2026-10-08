import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]

    # quote_plus supaya password yang mengandung karakter khusus (@, :, /) aman
    SQLALCHEMY_DATABASE_URI = (
        "mysql+pymysql://"
        f"{os.environ['DB_USER']}:{quote_plus(os.environ['DB_PASSWORD'])}"
        f"@{os.environ.get('DB_HOST', '127.0.0.1')}:{os.environ.get('DB_PORT', '3306')}"
        f"/{os.environ['DB_NAME']}?charset=utf8mb4"
    )
    # Cek koneksi sebelum dipakai, supaya tidak error kalau koneksi ke VM DB putus
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # ---- Email (untuk link reset password). Kosongkan MAIL_HOST saat development:
    # link reset akan dicetak di terminal, tidak dikirim lewat email.
    MAIL_HOST = os.environ.get("MAIL_HOST", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USER = os.environ.get("MAIL_USER", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "Homey Wood <no-reply@homeywood.com>")
    # Alamat publik website, dipakai membuat link di email. Contoh: https://homeywood.com
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "")
    RESET_TOKEN_MINUTES = int(os.environ.get("RESET_TOKEN_MINUTES", "30"))

    # ---- Midtrans (Sandbox: key berawalan SB-Mid-server-)
    MIDTRANS_SERVER_KEY = os.environ.get("MIDTRANS_SERVER_KEY", "").strip()
    MIDTRANS_BASE_URL = os.environ.get("MIDTRANS_BASE_URL", "https://api.sandbox.midtrans.com")

    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024
