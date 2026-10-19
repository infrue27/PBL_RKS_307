-- Migration 006: QRIS dinamis Midtrans
USE homeywood;

ALTER TABLE payments
  MODIFY proof_path VARCHAR(255) NULL,
  ADD COLUMN qr_url VARCHAR(500) NULL,
  ADD COLUMN qr_expires_at DATETIME NULL,
  ADD COLUMN midtrans_status VARCHAR(30) NULL;
