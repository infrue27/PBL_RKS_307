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
