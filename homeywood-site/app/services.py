"""Service layer (OOP): logika bisnis produk dipisah dari route/blueprint."""
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
            icon_emoji="\U0001FAB5", image_path=image_path,
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
