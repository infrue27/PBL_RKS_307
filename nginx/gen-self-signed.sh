#!/usr/bin/env sh
# Membuat sertifikat self-signed untuk testing lokal.
# Untuk produksi, ganti fullchain.pem & privkey.pem dengan sertifikat asli (mis. Let's Encrypt).
set -e
DIR="$(dirname "$0")/certs"
mkdir -p "$DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/privkey.pem" -out "$DIR/fullchain.pem" \
  -subj "/CN=homeywood.web.id" \
  -addext "subjectAltName=DNS:homeywood.web.id,DNS:www.homeywood.web.id,DNS:localhost,IP:127.0.0.1"
echo "Sertifikat dibuat di $DIR"