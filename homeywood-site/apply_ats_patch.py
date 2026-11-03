#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_ats_patch.py  --  Penyesuaian poin 2 ATS untuk proyek Homey Wood (Flask)

Cara pakai:
  1. Taruh file ini di folder yang berisi run.py (sejajar dengan folder app/).
  2. Buka terminal di folder itu, lalu jalankan:   python apply_ats_patch.py
  3. Baca laporan di layar. Skrip aman dijalankan berkali-kali.

Yang dilakukan:
  - Flask-Migrate (migration otomatis)   -> extensions.py, __init__.py, requirements.txt
  - Logging ke file logs/app.log         -> app/logging_setup.py (baru) + log di auth.py
  - Jinja2 (template engine sungguhan)   -> app/web.py, pages/base.html, pages/produk.html (baru)
  - OOP service class                    -> app/services.py (baru) + catalog.py
  - Validasi client-side HTML5           -> login.html, register.html, admin-katalog.html, js/app.js

Keamanan:
  - Tidak ada file yang ditimpa tanpa backup. Salinan asli ada di _backup_sebelum_patch/
  - File baru yang sudah ada tidak ditimpa.
  - Kalau bagian kode yang dicari tidak ketemu (misal versi kalian beda), skrip
    melaporkan GAGAL dan TIDAK mengubah apa pun di file itu.
  - Tidak menyentuh database dan tidak menjalankan migration apa pun.
"""
import os
import re
import shutil
import sys

try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

ROOT = os.getcwd()
BACKUP_DIR = os.path.join(ROOT, "_backup_sebelum_patch")
RESULTS = []


# --------------------------------------------------------------------------
# Helper
# --------------------------------------------------------------------------
def p(rel):
    return os.path.join(ROOT, *rel.split("/"))


def report(status, label, note=""):
    RESULTS.append(status)
    line = "[%-5s] %s" % (status, label)
    if note:
        line += "  -> " + note
    print(line)


def read_text(rel):
    """Baca file; kembalikan (teks dengan \\n, jenis newline asli)."""
    path = p(rel)
    if not os.path.isfile(path):
        return None, None
    with open(path, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    eol = "\r\n" if "\r\n" in raw else "\n"
    return raw.replace("\r\n", "\n"), eol


def backup(rel):
    src = p(rel)
    dst = os.path.join(BACKUP_DIR, *rel.split("/"))
    if os.path.isfile(src) and not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)


def write_text(rel, text, eol):
    backup(rel)
    with open(p(rel), "w", encoding="utf-8", newline="") as f:
        f.write(text.replace("\n", eol))


def edit(rel, label, marker, old, new, last=False, hint=""):
    """Ganti `old` dengan `new` satu kali. Lewati kalau `marker` sudah ada."""
    text, eol = read_text(rel)
    if text is None:
        report("GAGAL", label, "file %s tidak ditemukan" % rel)
        return
    if marker in text:
        report("SUDAH", label)
        return
    idx = text.rfind(old) if last else text.find(old)
    if idx < 0:
        report("GAGAL", label, "bagian kode yang dicari tidak ada di %s. %s" % (rel, hint))
        return
    text = text[:idx] + new + text[idx + len(old):]
    write_text(rel, text, eol)
    report("OK", label)


def new_file(rel, content, label):
    path = p(rel)
    if os.path.exists(path):
        cur, _ = read_text(rel)
        if cur == content:
            report("SUDAH", label)
        else:
            report("LEWAT", label, "%s sudah ada, tidak ditimpa" % rel)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    report("OK", label)


def add_attrs(rel, input_id, attrs, label):
    """Tambah atribut HTML5 ke <input id="..."> tanpa menghapus atribut lama."""
    text, eol = read_text(rel)
    if text is None:
        report("GAGAL", label, "file %s tidak ditemukan" % rel)
        return
    m = re.search(r'<input\b[^>]*?\bid="%s"[^>]*>' % re.escape(input_id), text)
    if not m:
        report("GAGAL", label, 'input id="%s" tidak ketemu di %s' % (input_id, rel))
        return
    tag = m.group(0)
    add = ""
    for name, val in attrs:
        if re.search(r"\s%s(\s|=|>|/)" % re.escape(name), tag):
            continue
        add += (" " + name) if val is None else (' %s="%s"' % (name, val))
    if not add:
        report("SUDAH", label)
        return
    new_tag = tag.replace("<input", "<input" + add, 1)
    text = text[:m.start()] + new_tag + text[m.end():]
    write_text(rel, text, eol)
    report("OK", label)


# --------------------------------------------------------------------------
# Isi file baru
# --------------------------------------------------------------------------
LOGGING_SETUP = '''"""Logging ke file (rotating) untuk Homey Wood."""
import logging
import os
from logging.handlers import RotatingFileHandler


def setup_file_logging(app):
    """Tulis log INFO ke logs/app.log (maks 1 MB x 3 file). Terminal tetap menampilkan warning."""
    logger = app.logger
    if any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
        return
    log_dir = os.path.join(app.root_path, "logs")
    try:
        os.makedirs(log_dir, exist_ok=True)
        handler = RotatingFileHandler(
            os.path.join(log_dir, "app.log"),
            maxBytes=1_000_000, backupCount=3, encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Logging ke file dinonaktifkan: %s", exc)
        return
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s [%(module)s:%(lineno)d] %(message)s"
    ))
    handler.setLevel(logging.INFO)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.info("Aplikasi Homey Wood dijalankan")
'''

SERVICES = '''"""Service layer (OOP): logika bisnis produk dipisah dari route/blueprint."""
from flask import current_app
from flask_login import current_user

from .extensions import db
from .models import Product


class ProductService:
    """Operasi bisnis untuk entitas Product."""

    @staticmethod
    def _actor():
        try:
            return current_user.email if current_user.is_authenticated else "-"
        except Exception:
            return "-"

    @classmethod
    def create(cls, category, name, slug, desc, price, stock, material, image_path=None):
        product = Product(
            category_id=category.id, name=name, slug=slug,
            description=desc, price=price, stock=stock, material=material,
            icon_emoji="\\U0001FAB5", image_path=image_path,
        )
        db.session.add(product)
        db.session.commit()
        current_app.logger.info("Produk dibuat: %r oleh %s", product.name, cls._actor())
        return product

    @classmethod
    def soft_delete(cls, product):
        product.is_active = False
        db.session.commit()
        current_app.logger.info("Produk dinonaktifkan: %r oleh %s", product.name, cls._actor())
        return product
'''

WEB_PY = '''"""Blueprint halaman yang dirender server-side dengan Jinja2."""
from flask import Blueprint, render_template

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
'''

BASE_HTML = '''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}Homey Wood{% endblock %}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container" style="padding:24px 0">
    <p>
      {% if current_user.is_authenticated %}
        Halo, {{ current_user.username }}
        {% if current_user.is_admin %}<strong>(Admin)</strong>{% endif %}
      {% else %}
        Belum masuk. <a href="/login">Masuk</a>
      {% endif %}
      &middot; <a href="/home">Beranda</a>
    </p>
    {% block content %}{% endblock %}
  </div>
</body>
</html>
'''

PRODUK_HTML = '''{% extends "base.html" %}
{% block title %}Daftar Produk - Homey Wood{% endblock %}
{% block content %}
<h1>Katalog Produk</h1>
<p>Halaman ini dirender server-side dengan Jinja2 (extends, block, for, if).</p>
<table>
  <thead>
    <tr><th>Nama</th><th>Kategori</th><th>Bahan</th><th>Harga</th><th>Stok</th></tr>
  </thead>
  <tbody>
  {% for p in products %}
    <tr>
      <td>{{ p.name }}</td>
      <td>{{ p.category.name }}</td>
      <td>{{ p.material or "-" }}</td>
      <td>Rp {{ "{:,.0f}".format(p.price)|replace(",", ".") }}</td>
      <td>{{ p.stock }}</td>
    </tr>
  {% else %}
    <tr><td colspan="5">Belum ada produk.</td></tr>
  {% endfor %}
  </tbody>
</table>
{% endblock %}
'''

CHECKFIELDS_JS = '''/* Validasi client-side (HTML5): pakai atribut required/minlength/pattern/min/max pada input */
function checkFields(ids){
  for (const id of ids){
    const el = document.getElementById(id);
    if (el && !el.reportValidity()) return false;
  }
  return true;
}

'''


# --------------------------------------------------------------------------
# Mulai
# --------------------------------------------------------------------------
def main():
    if not (os.path.isfile(p("run.py")) and os.path.isdir(p("app"))):
        print("STOP: jalankan skrip ini dari folder yang berisi run.py dan folder app/.")
        print("Folder sekarang: " + ROOT)
        sys.exit(1)

    print("Folder proyek: " + ROOT)
    print("Backup file asli: _backup_sebelum_patch/\n")

    # ---- 1. Flask-Migrate -------------------------------------------------
    print("== 1. Flask-Migrate ==")
    text, eol = read_text("requirements.txt")
    if text is None:
        report("GAGAL", "requirements.txt", "file tidak ada")
    elif re.search(r"(?im)^\s*flask-migrate\b", text):
        report("SUDAH", "requirements.txt: Flask-Migrate")
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        write_text("requirements.txt", text + "Flask-Migrate\n", eol)
        report("OK", "requirements.txt: tambah Flask-Migrate")

    text, eol = read_text("app/extensions.py")
    if text is None:
        report("GAGAL", "app/extensions.py", "file tidak ada")
    elif "Migrate" in text:
        report("SUDAH", "extensions.py: migrate")
    else:
        text = "from flask_migrate import Migrate\n" + text.rstrip("\n") + "\nmigrate = Migrate()\n"
        write_text("app/extensions.py", text, eol)
        report("OK", "extensions.py: migrate = Migrate()")

    edit("app/__init__.py", "__init__.py: import migrate", "login_manager, migrate",
         "from .extensions import db, login_manager\n",
         "from .extensions import db, login_manager, migrate\n",
         hint="Tambah manual: from .extensions import db, login_manager, migrate")
    edit("app/__init__.py", "__init__.py: migrate.init_app", "migrate.init_app",
         "    db.init_app(app)\n",
         "    db.init_app(app)\n    migrate.init_app(app, db)\n",
         hint="Tambah manual setelah db.init_app(app): migrate.init_app(app, db)")

    # ---- 2. Logging -------------------------------------------------------
    print("\n== 2. Logging ke file ==")
    new_file("app/logging_setup.py", LOGGING_SETUP, "app/logging_setup.py")

    # ---- 3. Jinja2 --------------------------------------------------------
    print("\n== 3. Jinja2 (template engine) ==")
    new_file("app/web.py", WEB_PY, "app/web.py (blueprint Jinja2)")
    new_file("pages/base.html", BASE_HTML, "pages/base.html")
    new_file("pages/produk.html", PRODUK_HTML, "pages/produk.html")

    # logging + web blueprint didaftarkan tepat sebelum 'return app'
    edit("app/__init__.py", "__init__.py: aktifkan logging + daftarkan web_bp",
         "setup_file_logging",
         "    return app",
         "    # --- Penyesuaian ATS: logging ke file + halaman Jinja2 ---\n"
         "    from .logging_setup import setup_file_logging\n"
         "    setup_file_logging(app)\n"
         "\n"
         "    from .web import web_bp\n"
         "    app.register_blueprint(web_bp)\n"
         "\n"
         "    return app",
         last=True,
         hint="Tambah manual sebelum 'return app': setup_file_logging(app) dan register web_bp")

    # log di auth.py
    edit("app/auth.py", "auth.py: log register", "User baru terdaftar",
         '    login_user(user)\n    return jsonify({"user": user_to_dict(user)}), 201',
         '    current_app.logger.info("User baru terdaftar: %s", user.email)\n'
         '    login_user(user)\n    return jsonify({"user": user_to_dict(user)}), 201')
    edit("app/auth.py", "auth.py: log login", "Login berhasil",
         '    login_user(user)\n    return jsonify({"user": user_to_dict(user)})\n',
         '    current_app.logger.info("Login berhasil: %s", user.email)\n'
         '    login_user(user)\n    return jsonify({"user": user_to_dict(user)})\n')
    edit("app/auth.py", "auth.py: log logout", "Logout: %s",
         '    logout_user()\n    return jsonify({"ok": True})',
         '    current_app.logger.info("Logout: %s", current_user.email)\n'
         '    logout_user()\n    return jsonify({"ok": True})')

    # ---- 4. OOP service ---------------------------------------------------
    print("\n== 4. OOP: ProductService ==")
    new_file("app/services.py", SERVICES, "app/services.py")
    edit("app/catalog.py", "catalog.py: import ProductService",
         "from .services import ProductService",
         "from .uploads import delete_upload, save_image, upload_url\n",
         "from .uploads import delete_upload, save_image, upload_url\n"
         "from .services import ProductService\n")
    edit("app/catalog.py", "catalog.py: create produk lewat service", "ProductService.create",
         '    product = Product(\n'
         '        category_id=category.id, name=name, slug=unique_slug(slugify(name)),\n'
         '        description=desc, price=price, stock=stock, material=material,\n'
         '        icon_emoji="\U0001FAB5", image_path=image_path,\n'
         '    )\n'
         '    db.session.add(product)\n'
         '    db.session.commit()\n',
         '    product = ProductService.create(\n'
         '        category, name, unique_slug(slugify(name)), desc, price, stock, material, image_path\n'
         '    )\n',
         hint="Bagian ini opsional; route lama tetap jalan.")
    edit("app/catalog.py", "catalog.py: hapus produk lewat service", "ProductService.soft_delete",
         '    product.is_active = False\n    db.session.commit()\n    return jsonify({"ok": True})',
         '    ProductService.soft_delete(product)\n    return jsonify({"ok": True})',
         hint="Bagian ini opsional; route lama tetap jalan.")

    # ---- 5. Validasi client-side -----------------------------------------
    print("\n== 5. Validasi client-side (HTML5) ==")
    L = "pages/login.html"
    add_attrs(L, "loginEmail", [("required", None), ("maxlength", "120")], "login.html: loginEmail")
    add_attrs(L, "loginPass", [("required", None), ("minlength", "8"), ("maxlength", "128")],
              "login.html: loginPass")
    R = "pages/register.html"
    add_attrs(R, "regName", [("required", None), ("maxlength", "100")], "register.html: regName")
    add_attrs(R, "regUsername",
              [("required", None), ("pattern", "[a-zA-Z0-9._]{3,30}"),
               ("title", "3-30 karakter: huruf, angka, titik, underscore")],
              "register.html: regUsername")
    add_attrs(R, "regEmail", [("required", None), ("maxlength", "120")], "register.html: regEmail")
    add_attrs(R, "regPhone",
              [("required", None), ("pattern", r"[0-9 +\-]{8,20}"),
               ("title", "Nomor telepon 8-20 karakter (angka, spasi, +, -)")],
              "register.html: regPhone")
    add_attrs(R, "regAddress", [("required", None), ("maxlength", "500")], "register.html: regAddress")
    add_attrs(R, "regPass", [("required", None), ("minlength", "8"), ("maxlength", "128")],
              "register.html: regPass")
    add_attrs(R, "regPassConfirm", [("required", None), ("minlength", "8"), ("maxlength", "128")],
              "register.html: regPassConfirm")
    A = "pages/admin-katalog.html"
    add_attrs(A, "apName", [("required", None), ("maxlength", "150")], "admin-katalog.html: apName")
    add_attrs(A, "apPrice",
              [("required", None), ("min", "0"), ("max", "1000000000"), ("step", "any")],
              "admin-katalog.html: apPrice")
    add_attrs(A, "apStock",
              [("required", None), ("min", "0"), ("max", "100000"), ("step", "1")],
              "admin-katalog.html: apStock")

    J = "js/app.js"
    edit(J, "app.js: fungsi checkFields", "function checkFields",
         "async function doLogin(){\n",
         CHECKFIELDS_JS + "async function doLogin(){\n",
         hint="Tambah fungsi checkFields secara manual di atas doLogin.")
    edit(J, "app.js: doLogin cek validasi", 'checkFields(["loginEmail"',
         "async function doLogin(){\n",
         'async function doLogin(){\n  if(!checkFields(["loginEmail","loginPass"])) return;\n')
    edit(J, "app.js: doRegister cek validasi", 'checkFields(["regName"',
         "async function doRegister(){\n",
         'async function doRegister(){\n'
         '  if(!checkFields(["regName","regUsername","regEmail","regPhone","regAddress","regPass","regPassConfirm"])) return;\n')
    edit(J, "app.js: saveProduct cek validasi", 'checkFields(["apName"',
         "async function saveProduct(){\n",
         'async function saveProduct(){\n  if(!checkFields(["apName","apPrice","apStock"])) return;\n')

    # ---- 6. .gitignore ----------------------------------------------------
    print("\n== 6. .gitignore ==")
    text, eol = read_text(".gitignore")
    if text is None:
        text, eol = "", "\n"
    need = [x for x in ("logs/", "_backup_sebelum_patch/") if x not in text.split("\n")]
    if need:
        if text and not text.endswith("\n"):
            text += "\n"
        write_text(".gitignore", text + "\n".join(need) + "\n", eol)
        report("OK", ".gitignore: tambah " + ", ".join(need))
    else:
        report("SUDAH", ".gitignore")

    # ---- Ringkasan --------------------------------------------------------
    print("\n==================== RINGKASAN ====================")
    for s in ("OK", "SUDAH", "LEWAT", "GAGAL"):
        print("%-6s: %d" % (s, RESULTS.count(s)))
    if "GAGAL" in RESULTS:
        print("\nAda yang GAGAL: file kalian berbeda dari yang saya kira. File itu TIDAK diubah.")
        print("Kirim laporan ini ke Claude, nanti dibantu tambal manual.")
    print("\nLANGKAH BERIKUTNYA:")
    print("  1) pip install Flask-Migrate")
    print("  2) flask --app run db init        (boleh sekarang, tidak butuh database)")
    print("  3) Di kampus saat VM menyala: lihat panduan 'Saat VM nyala'.")
    print("  4) Tes lokal tanpa database: buka http://127.0.0.1:5000/produk butuh database,")
    print("     tapi form login/register/admin bisa dites validasinya di browser.")


if __name__ == "__main__":
    main()
