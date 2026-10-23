import os

from flask import Flask, abort, redirect, request, send_from_directory
from flask_login import current_user

from config import Config
from .extensions import db, login_manager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ALLOWED_PAGES = {
    "home", "katalog", "detail", "keranjang", "checkout", "profile",
    "kontak", "tentang", "login", "register", "lupa-password", "reset-password",
    "admin-dashboard", "admin-katalog", "admin-user", "admin-verifikasi",
}


def create_app(config_class=Config):
    app = Flask(
        __name__,
        root_path=BASE_DIR,
        template_folder="pages",
        static_folder=None,
    )
    app.config.from_object(config_class)

    if os.environ.get("BEHIND_PROXY") == "1":
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

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

    from .auth import auth_bp
    app.register_blueprint(auth_bp)

    from .password_reset import reset_bp
    app.register_blueprint(reset_bp)

    from .catalog import catalog_bp
    app.register_blueprint(catalog_bp)

    from .orders import orders_bp
    app.register_blueprint(orders_bp)

    from .midtrans import midtrans_bp
    app.register_blueprint(midtrans_bp)

    from .admin_users import admin_users_bp
    app.register_blueprint(admin_users_bp)

    from .admin_report import admin_report_bp
    app.register_blueprint(admin_report_bp)

    from .profile import profile_bp
    app.register_blueprint(profile_bp)

    from .admin_dashboard import admin_dashboard_bp
    app.register_blueprint(admin_dashboard_bp)

    from .cart import cart_bp
    app.register_blueprint(cart_bp)

    from .reviews import reviews_bp
    app.register_blueprint(reviews_bp)

    app.config["UPLOAD_ROOT"] = os.path.join(BASE_DIR, app.config.get("UPLOAD_FOLDER", "uploads"))
    os.makedirs(app.config["UPLOAD_ROOT"], exist_ok=True)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        parts = filename.split("/")
        if ".." in parts or len(parts) < 2:
            abort(404)
        folder = parts[0]

        if folder in ("products", "reviews"):
            pass
        elif not current_user.is_authenticated:
            return login_manager.unauthorized()
        elif folder == "avatars":
            pass
        elif folder == "payment_proofs":
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


    @app.route("/css/<path:filename>")
    def css_files(filename):
        return send_from_directory(os.path.join(BASE_DIR, "css"), filename)

    @app.route("/js/<path:filename>")
    def js_files(filename):
        return send_from_directory(os.path.join(BASE_DIR, "js"), filename)

    @app.route("/img/<path:filename>")
    def img_files(filename):
        return send_from_directory(os.path.join(BASE_DIR, "img"), filename)

    @app.route("/<page>")
    def page(page):
        if page.endswith(".html"):
            clean = page[:-5]
            if clean not in ALLOWED_PAGES:
                abort(404)
            qs = request.query_string.decode()
            return redirect("/" + clean + ("?" + qs if qs else ""), 302)
        if page not in ALLOWED_PAGES:
            abort(404)
        from flask import render_template
        return render_template(f"{page}.html")

    @app.route("/")
    def root():
        return redirect("/home")

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return resp
    
    return app
