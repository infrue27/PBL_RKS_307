#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrasi.py -- pembantu Flask-Migrate untuk Homey Wood (jalankan dari folder yang ada run.py)

PERSIAPAN (sekali, boleh di rumah, tidak butuh database):
    pip install Flask-Migrate
    python migrasi.py init           -> membuat folder migrations/

SAAT VM / DATABASE MENYALA (di kampus):
  A) Database KOSONG (paling aman, disarankan untuk demo):
       1. Buat database baru, mis:  CREATE DATABASE homeywood_ats CHARACTER SET utf8mb4;
       2. Ubah DB_NAME di .env menjadi homeywood_ats
       3. python migrasi.py baru      -> buat file migration + jalankan upgrade (semua tabel jadi)
       4. python create_admin.py   lalu   python seed_products.py

  B) Database SUDAH BERISI tabel (data lama, jangan dirusak):
       python migrasi.py tandai       -> buat file migration + 'stamp' (tandai sudah sinkron)
                                         TIDAK mengubah tabel/data sama sekali

  Cek status kapan saja:
       python migrasi.py status

DEMO KE DOSEN (perubahan model -> migration):
    1. ubah satu kolom di app/models.py
    2. python migrasi.py perubahan "tambah kolom xyz"   -> file migration baru
    3. python migrasi.py upgrade                        -> terapkan ke database
"""
import os
import sys

try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

ROOT = os.getcwd()
if not (os.path.isfile(os.path.join(ROOT, "run.py")) and os.path.isdir(os.path.join(ROOT, "app"))):
    print("STOP: jalankan dari folder yang berisi run.py dan folder app/.")
    sys.exit(1)
sys.path.insert(0, ROOT)

try:
    from flask_migrate import init as fm_init, migrate as fm_migrate, upgrade as fm_upgrade
    from flask_migrate import stamp as fm_stamp, current as fm_current, heads as fm_heads
    from flask_migrate import revision as fm_revision
except ImportError:
    print("STOP: Flask-Migrate belum terpasang. Jalankan:  pip install Flask-Migrate")
    sys.exit(1)

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402

MIG_DIR = os.path.join(ROOT, "migrations")


def build_app():
    """Buat app. MIGRASI_DB_URL (opsional) dipakai hanya untuk uji coba tanpa MySQL."""
    override = os.environ.get("MIGRASI_DB_URL")
    if not override:
        return create_app()
    from config import Config

    class _Cfg(Config):
        SQLALCHEMY_DATABASE_URI = override
        SQLALCHEMY_ENGINE_OPTIONS = {}

    return create_app(_Cfg)


def existing_tables(app):
    from sqlalchemy import inspect
    with app.app_context():
        names = set(inspect(db.engine).get_table_names())
    names.discard("alembic_version")
    return names


def has_versions():
    vdir = os.path.join(MIG_DIR, "versions")
    return os.path.isdir(vdir) and any(f.endswith(".py") for f in os.listdir(vdir))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd = args[0].lower()
    app = build_app()

    if cmd == "init":
        if os.path.isdir(MIG_DIR):
            print("Folder migrations/ sudah ada. Tidak ada yang diubah.")
            return
        with app.app_context():
            fm_init(directory=MIG_DIR)
        print("\nSELESAI: folder migrations/ dibuat (belum ada tabel/database yang disentuh).")
        return

    if not os.path.isdir(MIG_DIR):
        print("Folder migrations/ belum ada. Jalankan dulu:  python migrasi.py init")
        sys.exit(1)

    if cmd == "baru":
        tables = existing_tables(app)
        if tables:
            print("STOP: database ini sudah berisi %d tabel (%s, ...)." % (len(tables), sorted(tables)[0]))
            print("Untuk database berisi data pakai:  python migrasi.py tandai")
            print("Atau ganti DB_NAME di .env ke database kosong, lalu ulangi.")
            sys.exit(1)
        with app.app_context():
            if not has_versions():
                fm_migrate(directory=MIG_DIR, message="initial schema")
            fm_upgrade(directory=MIG_DIR)
        print("\nSELESAI: semua tabel dibuat lewat migration.")
        print("Berikutnya:  python create_admin.py   lalu   python seed_products.py")
        return

    if cmd == "tandai":
        tables = existing_tables(app)
        if not tables:
            print("Database masih kosong. Pakai:  python migrasi.py baru")
            sys.exit(1)
        with app.app_context():
            if not has_versions():
                # baseline KOSONG (tanpa autogenerate) supaya tidak ada perintah yang
                # mengubah tabel lama; hanya penanda titik awal riwayat migration
                fm_revision(directory=MIG_DIR, message="baseline dari database yang sudah ada",
                            autogenerate=False)
            fm_stamp(directory=MIG_DIR, revision="head")
        print("\nSELESAI: database ditandai sinkron dengan migration. Tabel/data TIDAK diubah.")
        print("JANGAN jalankan 'upgrade' untuk file baseline ini (tabelnya sudah ada).")
        return

    if cmd == "perubahan":
        msg = " ".join(args[1:]) or "perubahan model"
        with app.app_context():
            fm_migrate(directory=MIG_DIR, message=msg)
        print("\nSELESAI: file migration baru dibuat di migrations/versions/. Periksa isinya, lalu:")
        print("  python migrasi.py upgrade")
        return

    if cmd == "upgrade":
        with app.app_context():
            fm_upgrade(directory=MIG_DIR)
        print("\nSELESAI: database sudah di versi migration terbaru.")
        return

    if cmd == "status":
        with app.app_context():
            print("Versi database saat ini:")
            fm_current(directory=MIG_DIR)
            print("Versi terbaru di folder migrations:")
            fm_heads(directory=MIG_DIR)
        return

    print("Perintah tidak dikenal: %s" % cmd)
    print(__doc__)


if __name__ == "__main__":
    main()
