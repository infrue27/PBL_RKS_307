"""
Script sekali-jalan untuk membuat akun admin pertama.
Akun admin sengaja TIDAK dibuat lewat form register publik (yang di
register.html itu khusus customer) -- ini alasan kenapa create_admin.py
dijalankan terpisah dari terminal, bukan lewat browser.

Cara pakai (dari folder project, venv aktif):
    venv\\Scripts\\python create_admin.py

Cuma minta email & password. Field lain (nama, username, dst) diisi
otomatis -- boleh diedit belakangan lewat halaman profil / database
langsung kalau mau diganti.
"""
from getpass import getpass

from app import create_app
from app.extensions import db
from app.models import User

app = create_app()

with app.app_context():
    print("=== Buat akun admin Homey Wood ===")
    email = input("Email    : ").strip().lower()

    if User.query.filter(db.func.lower(User.email) == email).first():
        print(f"\nGagal: email '{email}' sudah terdaftar.")
        raise SystemExit(1)

    password = getpass("Password (min. 8 karakter, tidak akan tampil saat diketik): ")
    if len(password) < 8:
        print("\nGagal: password minimal 8 karakter.")
        raise SystemExit(1)
    password_confirm = getpass("Ulangi password: ")
    if password != password_confirm:
        print("\nGagal: konfirmasi password tidak cocok.")
        raise SystemExit(1)

    # Username & nama dibuat otomatis dari bagian sebelum "@" di email.
    # Kalau sudah dipakai, ditambah angka di belakang (admin, admin2, admin3, ...)
    base_username = email.split("@")[0] or "admin"
    username = base_username
    n = 1
    while User.query.filter(db.func.lower(User.username) == username.lower()).first():
        n += 1
        username = f"{base_username}{n}"

    admin = User(
        full_name="Admin Homey Wood",
        username=username,
        email=email,
        phone="-",
        address="Kantor Pusat Homey Wood",
        role="admin",
    )
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()

    print(f"\nAkun admin berhasil dibuat.")
    print(f"  Email    : {email}")
    print(f"  Username : {username}  (dibuat otomatis dari email)")
    print("Silakan login lewat /login.html dengan email & password di atas.")