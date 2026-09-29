-- Jalankan ini SEKALI di MySQL Command Line Client (source ke file ini),
-- setelah schema.sql yang pertama. Ini cuma tambahan, bukan pengganti.
USE homeywood;

ALTER TABLE products
  ADD COLUMN material VARCHAR(50) NULL AFTER category_id,
  ADD COLUMN icon_emoji VARCHAR(10) NULL AFTER image_path;

-- Kategori awal salah tebak (Ruang Tamu dkk dari footer), yang benar
-- dipakai app.js adalah tipe furniture: Sofa/Meja/Kursi/Lemari
DELETE FROM categories;
ALTER TABLE categories AUTO_INCREMENT = 1;
INSERT INTO categories (name, slug) VALUES
  ('Sofa','sofa'), ('Meja','meja'), ('Kursi','kursi'), ('Lemari','lemari');
