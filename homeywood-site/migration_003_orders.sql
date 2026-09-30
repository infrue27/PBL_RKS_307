-- Jalankan setelah migration_002_catalog.sql
USE homeywood;
ALTER TABLE orders ADD COLUMN payment_label VARCHAR(100) NULL AFTER shipping_address;
