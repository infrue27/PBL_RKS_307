-- ==========================================================================
-- Migration 004: ulasan produk (foto + komentar + 1 ulasan per item pesanan)
-- Jalankan SEKALI di database homeywood.
-- ==========================================================================
USE homeywood;

-- 1. Hubungkan ulasan ke pesanan. NULL diizinkan supaya baris lama (kalau ada)
--    tidak bermasalah; kode aplikasi selalu mengisinya untuk ulasan baru.
ALTER TABLE reviews
  ADD COLUMN order_id INT UNSIGNED NULL AFTER user_id;

-- 2. Satu produk dalam satu pesanan hanya boleh diulas sekali.
ALTER TABLE reviews
  ADD UNIQUE KEY uq_review_order_product (order_id, product_id);

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- 3. Foto ulasan (maks 3 per ulasan, dibatasi di aplikasi)
CREATE TABLE review_images (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id   INT UNSIGNED NOT NULL,
  image_path  VARCHAR(255) NOT NULL,
  CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_review_images_review (review_id)
) ENGINE=InnoDB;

-- 4. Komentar di bawah ulasan (pembeli lain / penjual)
CREATE TABLE review_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  comment     VARCHAR(200) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_comments_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_comments_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_review_comments_review (review_id)
) ENGINE=InnoDB;
