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

    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024  # batas upload 2 MB
