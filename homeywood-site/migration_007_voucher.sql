-- Migration 007: voucher diskon (pengguna baru & tanggal kembar)
-- Jalankan setelah migration_006_midtrans.sql
USE homeywood;

-- Pemakaian voucher dicatat di pesanan:
--   voucher_code    : kode yang dipakai (WELCOME / KEMBAR-YYYY-MM-DD), NULL kalau tanpa voucher
--   discount_amount : nominal potongan (sudah termasuk dalam total_amount)
-- Rumus total:  total_amount = subtotal barang - discount_amount + ongkir
ALTER TABLE orders
  ADD COLUMN voucher_code    VARCHAR(40)   NULL AFTER total_amount,
  ADD COLUMN discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER voucher_code,
  ADD INDEX idx_orders_user_voucher (user_id, voucher_code);
