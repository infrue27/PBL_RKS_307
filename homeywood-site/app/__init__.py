import os

from flask import Flask, abort, redirect, send_from_directory
from flask_login import current_user
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
        user = db.session.get(User, int(user_id))
        if user and not user.is_active:
            return None
        return user

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

    from .catalog import catalog_bp
    app.register_blueprint(catalog_bp)

    from .orders import orders_bp
    app.register_blueprint(orders_bp)

    from .admin_users import admin_users_bp
    app.register_blueprint(admin_users_bp)

    from .profile import profile_bp
    app.register_blueprint(profile_bp)

    from .admin_dashboard import admin_dashboard_bp
    app.register_blueprint(admin_dashboard_bp)

    from .cart import cart_bp
    app.register_blueprint(cart_bp)

    # ---- Folder upload (bukti bayar, nanti avatar juga) ----
    app.config["UPLOAD_ROOT"] = os.path.join(BASE_DIR, app.config.get("UPLOAD_FOLDER", "uploads"))
    os.makedirs(app.config["UPLOAD_ROOT"], exist_ok=True)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        parts = filename.split("/")
        if ".." in parts or len(parts) < 2:
            abort(404)
        folder = parts[0]

        if folder == "products":
            pass  # foto produk publik: tamu yang belum login juga melihat katalog
        elif not current_user.is_authenticated:
            return login_manager.unauthorized()
        elif folder == "avatars":
            pass  # foto profil: cukup login
        elif folder == "payment_proofs":
            # bukti bayar: hanya admin dan pemilik order
            if not current_user.is_admin:
                from .models import Order, Payment
                owner = (
                    db.session.query(Payment.id)
                    .join(Order, Payment.order_id == Order.id)
                    .filter(Payment.proof_path == filename, Order.user_id == current_user.id)
                    .first()
                )
                if not owner:
                    abort(403)
        else:
            abort(404)
        return send_from_directory(app.config["UPLOAD_ROOT"], filename)

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
