import os

from flask import Flask, abort, redirect, send_from_directory
from sqlalchemy import text

from config import Config
from .extensions import db, login_manager

# Folder project (homeywood-site/), satu tingkat di atas folder app/ ini
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Daftar semua halaman yang boleh diakses lewat /<nama>.html
# Tambahkan nama file baru ke sini kalau temanmu bikin halaman baru
ALLOWED_PAGES = {
    "home", "katalog", "detail", "keranjang", "checkout", "profile",
    "kontak", "tentang", "login", "register",
    "admin-dashboard", "admin-katalog", "admin-user", "admin-verifikasi",
}


def create_app(config_class=Config):
    app = Flask(
        __name__,
        root_path=BASE_DIR,
        template_folder="pages",   # baca folder pages/ punya teman, bukan templates/
        static_folder=None,        # /css dan /js diurus manual di bawah, bukan /static
    )
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({"error": "Silakan masuk terlebih dahulu."}), 401

    # ---- SEMENTARA: cek koneksi database. Hapus setelah koneksi terbukti jalan. ----
    @app.route("/db-check")
    def db_check():
        db.session.execute(text("SELECT 1"))
        return "Koneksi database OK"

    from .auth import auth_bp
    app.register_blueprint(auth_bp)

    # ---- Menyajikan file CSS & JS langsung dari folder css/ dan js/ ----
    @app.route("/css/<path:filename>")
    def css_files(filename):
        return send_from_directory(os.path.join(BASE_DIR, "css"), filename)

    @app.route("/js/<path:filename>")
    def js_files(filename):
        return send_from_directory(os.path.join(BASE_DIR, "js"), filename)

    # ---- Menyajikan tiap halaman: /login.html, /register.html, dst ----
    # Ini sengaja pakai ".html" di URL supaya cocok dengan go() di app.js
    # yang menulis location.href = page + ".html"
    @app.route("/<page>.html")
    def page(page):
        if page not in ALLOWED_PAGES:
            abort(404)
        from flask import render_template
        return render_template(f"{page}.html")

    @app.route("/")
    def root():
        return redirect("/home.html")

    # Blueprint lain (katalog, cart, admin, dst) akan didaftarkan di sini nanti

    return app