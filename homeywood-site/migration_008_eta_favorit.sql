-- Migration 008: estimasi waktu tiba + produk favorit
USE homeywood;

ALTER TABLE orders
  ADD COLUMN zone       VARCHAR(20) NULL AFTER payment_label,
  ADD COLUMN shipped_at DATETIME    NULL AFTER zone;

CREATE TABLE favorites (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fav_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_fav_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_favorite_user_product (user_id, product_id)
) ENGINE=InnoDB;
