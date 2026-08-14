# e-RPH AI

Sistem AI Pintar Menjana dan Mengurus Rancangan Pengajaran Harian Guru.
PWA vanilla JS + Firebase (Auth & Firestore) + GitHub Pages. Tiada backend, tiada build step.

---

## 1. Struktur fail

```
index.html
styles.css
firebase-config.js      <-- HANYA fail ini perlu diedit
manifest.json
sw.js
firestore.rules
icons/icon-192.png
icons/icon-512.png
js/core.js
js/data.js
js/ai.js
js/rph.js
js/admin.js
js/boot.js
contoh-rpt.csv
contoh-cuti.csv
```

## 2. Langkah pemasangan

**a) Firebase**
1. Firebase Console → Authentication → Sign-in method → aktifkan **Google** dan **Email/Password**.
2. Authentication → Settings → Authorized domains → tambah `namauser.github.io`.
3. Firestore Database → Create database (mod production).
4. Rules → tampal isi `firestore.rules` → Publish.

**b) firebase-config.js**
- Tampal `FIREBASE_CONFIG` dari Firebase Console (Project settings → Your apps → Web).
- Isi `EMEL_PEMILIK` dengan e-mel anda. E-mel dalam senarai ini automatik jadi **pemilik** (akses penuh semua sekolah) pada log masuk pertama.

**c) GitHub Pages**
1. Cipta repo baharu, upload semua fail (kekalkan folder `js/` dan `icons/`).
2. Settings → Pages → Branch: `main`, Folder: `/ (root)` → Save.
3. Buka `https://namauser.github.io/nama-repo/`.

## 3. Peranan

| Peranan | Kebolehan |
|---|---|
| **pemilik** | Semua sekolah, cipta/edit sekolah, tukar peranan pengguna, masuk mana-mana sekolah, sandaran data |
| **admin** | Urus sekolah sendiri, guru sekolah sendiri, DSKP, buku teks, takwim |
| **guru** | RPH sendiri sahaja, jadual waktu sendiri |

Guru baharu daftar guna **kod sekolah** (ditetapkan oleh pemilik semasa cipta sekolah).

## 4. Enjin AI

Buka **Tetapan → Enjin AI**. Pilih Gemini / OpenAI / Claude, masukkan API key dan model.
Kunci disimpan dalam `localStorage` peranti tersebut sahaja (aplikasi statik, tiada server).
Tekan **Uji sambungan** untuk sahkan.

Model lalai:
- Gemini: `gemini-2.0-flash` (paling murah, ada kuota percuma)
- OpenAI: `gpt-4o-mini`
- Claude: `claude-sonnet-4-6`

## 5. Aliran penggunaan

```
Takwim → Minggu persekolahan → Jadual waktu → Kelas + Subjek → RPT → Buku teks
→ Jana RPH AI → Semakan kualiti → Guru edit → Simpan → Cetak/PDF
```

## 6. Import data

**RPT — Rancangan Pengajaran Tahunan (Excel/CSV):**
`minggu,tahun_tingkatan,subjek,tema_bidang,tajuk_kemahiran,kod_sk,standard_kandungan,kod_sp,standard_pembelajaran,tp,catatan`

Satu baris untuk satu minggu persekolahan. Muat turun templat terus dari menu RPT.

**Buku teks (CSV):**
`tahun,subjek,buku,bab,unit,tajuk,kandungan`

**Cuti takwim (CSV):**
`nama,mula,tamat` (format tarikh `YYYY-MM-DD`)

Lihat `contoh-rpt.csv` dan `contoh-cuti.csv`.

## 7. Logo & tandatangan (tiada Firebase Storage)

Projek kekal pada **pelan Spark percuma** — Cloud Storage tidak digunakan langsung.

- **Logo sekolah** — Tetapan → Muat naik logo. Imej dikecilkan dalam pelayar (maks 400px, ~50 KB)
  dan disimpan sebagai base64 dalam `sekolah/{sid}/tetapan/logo`. Dikongsi semua guru,
  dicache dalam `localStorage` supaya tidak dibaca berulang kali. Admin/pemilik sahaja boleh tukar.
- **Tandatangan digital** — peribadi, disimpan dalam `localStorage` peranti itu sahaja
  (kunci `erph_ttd_{emel}`). Tidak dihantar ke Firestore.

Had dokumen Firestore ialah 1 MB; logo terkecil jauh di bawah had itu.

## 8. Nota penting

- AI **tidak** mencipta Standard Pembelajaran sendiri. Ia mengambil SK/SP tepat daripada baris RPT bagi minggu berkenaan. Jika RPT minggu itu kosong, sistem tandakan amaran dan minta guru lengkapkan RPT.
- Semakan kualiti (%) adalah bantuan sistem, **bukan** pengesahan rasmi KPM.
- Struktur Firestore:

```
pengguna/{emel}                       peranan, sekolahId, aktif
sekolah/{sid}                         nama, kod, negeri, daerah, logo
sekolah/{sid}/kelas/{id}
sekolah/{sid}/subjek/{id}
sekolah/{sid}/jadual/{emel}           slot[]
sekolah/{sid}/takwim/{tahun}          mula, tamat, cuti[]
sekolah/{sid}/dskp/{id}
sekolah/{sid}/buku/{id}
sekolah/{sid}/rph/{id}
sekolah/{sid}/rph/{id}/versi/{vid}    sejarah versi
```

## 9. Kemas kini versi

Selepas upload fail baharu, tukar `const CACHE = 'erph-v1'` dalam `sw.js` kepada `erph-v2`
supaya service worker muat semula fail terkini. Pengguna juga boleh tekan
**Tetapan → Kosongkan cache**.
