"""
Helper upload gambar: dipakai foto produk dan foto profil.

Keamanan:
- Tipe file ditentukan dari ISI file (magic bytes), bukan dari nama/ekstensi
  yang dikirim browser, karena nama file bisa dipalsukan.
- Hanya JPG, PNG, WEBP. SVG sengaja tidak diizinkan (bisa menyisipkan script).
- Nama file disimpan acak (uuid), jadi nama dari user tidak pernah dipakai.
"""
import os
import uuid

from flask import current_app

MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB, sama dengan batas di frontend


def _detect_ext(head):
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def save_image(file_storage, subfolder, max_bytes=MAX_IMAGE_BYTES):
    """Simpan gambar ke uploads/<subfolder>/. Return path relatif, atau raise ValueError."""
    raw = file_storage.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError("Ukuran foto maksimal 2 MB.")
    ext = _detect_ext(raw[:12])
    if not ext:
        raise ValueError("File harus berupa gambar JPG, PNG, atau WEBP.")

    folder = os.path.join(current_app.config["UPLOAD_ROOT"], subfolder)
    os.makedirs(folder, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(folder, filename), "wb") as f:
        f.write(raw)
    return f"{subfolder}/{filename}"


def delete_upload(rel_path):
    """Hapus file lama (aman: hanya file di dalam folder uploads)."""
    if not rel_path:
        return
    root = os.path.realpath(current_app.config["UPLOAD_ROOT"])
    full = os.path.realpath(os.path.join(root, rel_path))
    if full.startswith(root + os.sep) and os.path.isfile(full):
        try:
            os.remove(full)
        except OSError:
            pass


def upload_url(rel_path):
    return f"/uploads/{rel_path}" if rel_path else None