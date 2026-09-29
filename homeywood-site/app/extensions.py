from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "login"          # redirect ke sini kalau belum login
login_manager.login_message = "Silakan masuk terlebih dahulu."
