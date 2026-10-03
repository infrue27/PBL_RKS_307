-- Jalankan setelah migration_004_reviews.sql
USE homeywood;

-- 1) Token reset password. Yang disimpan HANYA hash token (SHA-256),
--    token asli cuma ada di link email.
CREATE TABLE password_resets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pwreset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pwreset_user (user_id)
) ENGINE=InnoDB;

-- 2) Nama & telepon penerima di-snapshot ke order (untuk label pengiriman),
--    jadi tidak berubah walau user nanti mengedit profilnya.
ALTER TABLE orders
  ADD COLUMN recipient_name  VARCHAR(100) NULL AFTER shipping_address,
  ADD COLUMN recipient_phone VARCHAR(20)  NULL AFTER recipient_name;

-- 3) Isi order lama dengan nama lengkap & telepon pemiliknya
UPDATE orders o JOIN users u ON u.id = o.user_id
   SET o.recipient_name = u.full_name, o.recipient_phone = u.phone
 WHERE o.recipient_name IS NULL;
