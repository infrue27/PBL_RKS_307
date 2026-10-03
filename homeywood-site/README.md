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
