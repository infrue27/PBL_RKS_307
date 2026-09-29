"""
Isi 8 produk contoh (persis yang dulu hardcode di app.js) ke database.
Jalankan SEKALI setelah migration_002_catalog.sql:
    venv\\Scripts\\python seed_products.py
Aman dijalankan berkali-kali -- kalau produk sudah ada (dicek dari slug),
tidak akan dobel.
"""
import re

from app import create_app
from app.extensions import db
from app.models import Category, Product

app = create_app()

PRODUCTS = [
    ("Sofa Kain Linen Naima 3-Seater", "Sofa", "Kayu Jati", 5850000, 8,
     "Sofa 3 dudukan dengan rangka kayu jati solid dan pelapis linen premium yang lembut dan tahan lama.", "🛋️"),
    ("Meja Makan Kayu Solid Wijaya", "Meja", "Kayu Mahoni", 4200000, 5,
     "Meja makan 6 kursi dari kayu mahoni solid dengan finishing natural.", "🍽️"),
    ("Kursi Santai Rotan Elegan", "Kursi", "Rotan", 1850000, 12,
     "Kursi santai anyaman rotan asli, ringan dan nyaman untuk teras.", "💺"),
    ("Lemari Baju 3 Pintu Klasik", "Lemari", "Kayu Jati", 3950000, 6,
     "Lemari pakaian 3 pintu kayu jati dengan cermin dan rak dalam luas.", "🚪"),
    ("Meja Kerja Solid Aksara", "Meja", "Kayu Mahoni", 2450000, 9,
     "Meja kerja minimalis kayu solid, cocok untuk ruang kerja di rumah.", "🖥️"),
    ("Kursi Makan Kayu Klasik", "Kursi", "Kayu Jati", 950000, 20,
     "Kursi makan kayu jati dengan desain klasik dan kokoh.", "🪑"),
    ("Sofa 2-Seater Tropical Suede", "Sofa", "Kayu Mahoni", 4650000, 7,
     "Sofa dua dudukan berbahan suede lembut dengan kaki kayu solid.", "🛋️"),
    ("Rak Buku Kayu Minimalis", "Lemari", "Kayu Jati", 1650000, 10,
     "Rak buku terbuka dari kayu solid, cocok untuk ruang baca maupun kerja.", "📚"),
]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


with app.app_context():
    created, skipped = 0, 0
    for name, cat_name, material, price, stock, desc, icon in PRODUCTS:
        slug = slugify(name)
        if Product.query.filter_by(slug=slug).first():
            skipped += 1
            continue
        category = Category.query.filter_by(name=cat_name).first()
        if not category:
            print(f"Lewati '{name}': kategori '{cat_name}' tidak ditemukan. "
                  f"Sudah jalankan migration_002_catalog.sql?")
            continue
        db.session.add(Product(
            category_id=category.id, name=name, slug=slug, description=desc,
            price=price, stock=stock, material=material, icon_emoji=icon,
        ))
        created += 1
    db.session.commit()
    print(f"Selesai. {created} produk baru dibuat, {skipped} sudah ada sebelumnya.")
