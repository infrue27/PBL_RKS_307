# Homey Wood

Dipecah dari homeywood-all-in-one.html. Desain (CSS) & logic tidak diubah.

    index.html        -> otomatis membuka pages/home.html
    css/style.css     -> seluruh CSS
    js/app.js         -> seluruh logic
    pages/*.html      -> satu file utuh per halaman

Buka index.html (atau pages/home.html) dengan klik dua kali. Tidak perlu server.

## Update fitur
- Rating, ulasan & komentar: setelah pesanan "Dikirim", pembeli klik "Barang Sudah Tiba" (status jadi Selesai), lalu bisa beri bintang + ulasan per produk. Komentar bisa ditulis pembeli lain & admin (tampil label Penjual).
- Katalog/beranda menampilkan rata-rata rating, jumlah ulasan & cuplikan ulasan terbaru; halaman detail menampilkan semua ulasan.
- Checkout: Transfer/QRIS wajib unggah bukti bayar; COD tidak perlu (langsung status Diproses).
- Ongkir: atur tarif di konstanta ZONES / SIZE_UNITS pada js/app.js.
- Alur status: Menunggu Verifikasi -> Diproses -> Dikirim -> Selesai (admin: halaman Verifikasi).
- Animasi: fade halaman, scroll reveal, hover kartu, badge keranjang, modal, toast. Otomatis mati jika perangkat mengaktifkan "reduce motion".

## Update: reset password, username, label pengiriman
- Jalankan `migration_005_reset_label.sql` di database yang sudah ada (instalasi baru cukup pakai schema.sql).
- Reset password: halaman `lupa-password.html` -> email berisi link -> `reset-password.html?token=...`.
  Tambahkan di `.env` (opsional saat development; tanpa MAIL_HOST link dicetak di terminal):
  `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`, `APP_BASE_URL` (mis. https://homeywood.com)
- Di website yang tampil = username. Nama lengkap dipakai untuk penerima di checkout dan label pengiriman (admin > Verifikasi > tombol Label pengiriman).

## Update: voucher diskon (pengguna baru & tanggal kembar)
- Jalankan `migration_007_voucher.sql` di database yang sudah ada (atau `python migrasi.py upgrade` jika memakai Flask-Migrate; revisinya aman dijalankan walau SQL-nya sudah dipakai).
- **Voucher Pengguna Baru** (`WELCOME`): otomatis didapat saat daftar, berlaku 30 hari, sekali pakai.
- **Voucher Tanggal Kembar** (`KEMBAR-YYYY-MM-DD`): aktif otomatis pada tanggal kembar 1/1, 2/2 ... 12/12 (zona WIB), sekali pakai per tanggal.
- Persen, maksimal diskon, minimal belanja, dan masa berlaku diatur di konstanta `NEW_USER` dan `TWIN_DATE` pada `app/vouchers.py`.
- Diskon dihitung dari subtotal barang (ongkir tidak didiskon) dan satu pesanan hanya boleh satu voucher. Semua perhitungan divalidasi ulang di server.
- Kalau pesanan ditolak/dibatalkan/kedaluwarsa, voucher otomatis bisa dipakai lagi.
- Laporan penjualan menambah baris "Diskon voucher" supaya total tetap cocok (barang + ongkir - diskon).
