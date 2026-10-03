-- ==========================================================================
-- Homey Wood - Skema Database (MySQL 8.x / MariaDB 10.5+)
-- Jalankan:  mysql -u root -p < schema.sql
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS homeywood
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE homeywood;

-- --------------------------------------------------------------------------
-- 1. USERS  (req 2, 5, 9)
--    Satu tabel untuk admin & customer, dibedakan kolom role.
--    Password TIDAK PERNAH disimpan mentah, hanya hash (werkzeug/bcrypt).
-- --------------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  username      VARCHAR(50)   NOT NULL UNIQUE,
  email         VARCHAR(120)  NOT NULL UNIQUE,
  phone         VARCHAR(20)   NULL,
  address       TEXT          NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('admin','customer') NOT NULL DEFAULT 'customer',
  avatar_path   VARCHAR(255)  NULL,          -- path file avatar hasil upload
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,   -- admin bisa nonaktifkan akun
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 2. CATEGORIES & PRODUCTS  (req 1, 6, 7)
-- --------------------------------------------------------------------------
CREATE TABLE categories (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE,
  slug  VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE products (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED  NOT NULL,
  name         VARCHAR(150)  NOT NULL,
  slug         VARCHAR(160)  NOT NULL UNIQUE,
  description  TEXT          NULL,
  price        DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  stock        INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_path   VARCHAR(255)  NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,   -- "hapus" = soft delete, riwayat pesanan aman
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_products_category (category_id),
  INDEX idx_products_price (price),
  FULLTEXT INDEX ft_products_search (name, description)   -- untuk fitur pencarian katalog
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 3. REVIEWS  (req 7, 8)
-- --------------------------------------------------------------------------
CREATE TABLE reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_reviews_product (product_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 4. CART  (req 10)
--    Satu baris = satu produk di keranjang seorang user.
-- --------------------------------------------------------------------------
CREATE TABLE cart_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    INT UNSIGNED NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cart_user_product (user_id, product_id)   -- produk sama = tambah quantity, bukan baris baru
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 5. ORDERS & ORDER_ITEMS  (req 3, 11, 13)
--    order_items menyimpan "snapshot" nama & harga saat beli, supaya riwayat
--    tidak berubah walau admin nanti mengedit harga/nama produk.
-- --------------------------------------------------------------------------
CREATE TABLE orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code       VARCHAR(30)   NOT NULL UNIQUE,      -- contoh: HW-260918-0842
  user_id          INT UNSIGNED  NOT NULL,
  total_amount     DECIMAL(14,2) NOT NULL,
  shipping_address TEXT          NOT NULL,
  recipient_name   VARCHAR(100)  NULL,                 -- snapshot nama lengkap untuk label pengiriman
  recipient_phone  VARCHAR(20)   NULL,
  status           ENUM('menunggu_pembayaran','menunggu_verifikasi',
                        'diproses','dikirim','selesai','ditolak','dibatalkan')
                   NOT NULL DEFAULT 'menunggu_pembayaran',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NULL,                  -- NULL kalau produk dihapus permanen
  product_name  VARCHAR(150)  NOT NULL,              -- snapshot
  unit_price    DECIMAL(12,2) NOT NULL,              -- snapshot
  quantity      INT UNSIGNED  NOT NULL CHECK (quantity > 0),
  subtotal      DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_items_order (order_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- 6. PAYMENTS  (req 4, 12)
--    Bukti bayar yang di-upload customer, di-approve/tolak admin.
-- --------------------------------------------------------------------------
CREATE TABLE payments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL UNIQUE,         -- 1 order = 1 bukti bayar aktif
  proof_path   VARCHAR(255) NOT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note   VARCHAR(255) NULL,                    -- alasan kalau ditolak
  verified_by  INT UNSIGNED NULL,                    -- id admin yang memproses
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at  DATETIME NULL,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_admin FOREIGN KEY (verified_by) REFERENCES users(id)  ON DELETE SET NULL,
  INDEX idx_payments_status (status)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- DATA AWAL: kategori (diambil dari footer desain Figma)
-- Akun admin sengaja TIDAK di-seed di sini karena butuh password hash;
-- buat lewat script Python terpisah (create_admin.py).
-- --------------------------------------------------------------------------
INSERT INTO categories (name, slug) VALUES
  ('Ruang Tamu',     'ruang-tamu'),
  ('Ruang Makan',    'ruang-makan'),
  ('Kamar Tidur',    'kamar-tidur'),
  ('Dekorasi Alami', 'dekorasi-alami');

-- --------------------------------------------------------------------------
-- USER DATABASE KHUSUS APLIKASI (least privilege)
-- Jangan pakai root dari Flask. Ganti IP sesuai subnet DMZ (VLAN 10) kalian
-- dan ganti password. Contoh IP di bawah hanya asumsi.
-- --------------------------------------------------------------------------
-- CREATE USER 'homey_app'@'10.0.10.%' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON homeywood.* TO 'homey_app'@'10.0.10.%';
-- FLUSH PRIVILEGES;


-- --------------------------------------------------------------------------
-- PASSWORD RESETS: token reset password (hanya hash yang disimpan)
-- --------------------------------------------------------------------------
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
