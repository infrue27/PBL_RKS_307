# Homey Wood — Struktur Proyek

Struktur file untuk dipindahkan ke GitHub:

```
homeywood-site/
├── index.html          → shell utama (navbar + kerangka halaman)
├── css/
│   └── style.css       → semua CSS (desain + animasi)
├── js/
│   └── app.js          → semua logic (data, router, semua fitur)
└── pages/              → satu file HTML per halaman/fitur
    ├── home.html
    ├── katalog.html
    ├── detail.html
    ├── keranjang.html
    ├── checkout.html
    ├── login.html
    ├── register.html
    ├── lupa-sandi.html      ← fitur baru: reset kata sandi
    ├── profile.html
    ├── tentang.html
    ├── kontak.html
    ├── admin-dashboard.html
    ├── admin-katalog.html
    ├── admin-user.html
    └── admin-verifikasi.html
```

## Cara kerja

`index.html` memuat `js/app.js`, lalu setiap kali pindah halaman (`go('nama-halaman')`)
JS akan **fetch** file yang sesuai dari folder `pages/` dan menyuntikkannya ke dalam
`<div id="app">`. Navbar dan footer tetap satu tempat di `index.html`, jadi footer
otomatis tampil di semua halaman (termasuk yang sebelumnya kelewatan seperti
"Tentang Kami" & "Kontak").

## Menjalankan secara lokal

Karena memakai `fetch()`, file **tidak bisa dibuka langsung** dengan klik dua kali
(protokol `file://` diblokir browser untuk fetch). Jalankan server lokal sederhana
dari dalam folder ini, contoh:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

atau pakai extension "Live Server" di VS Code.

Setelah di-push dan diaktifkan **GitHub Pages**, semua otomatis jalan normal karena
sudah diakses lewat `https://`.

## Fitur baru di update ini

- Halaman **Lupa Kata Sandi** (`pages/lupa-sandi.html`) — alur 2 langkah:
  masukkan email → kode verifikasi (ditampilkan lewat toast untuk demo, berlaku 5 menit)
  → set kata sandi baru.
- Animasi & interaktivitas lewat `js/app.js` & `css/style.css`:
  scroll-reveal, counter angka berjalan di halaman Tentang Kami, efek ripple di tombol,
  transisi halaman, animasi toast, badge keranjang "pulse", progress bar tipis di
  bagian atas saat pindah halaman.
