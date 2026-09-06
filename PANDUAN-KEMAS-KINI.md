# e-RPH AI v1.1.0 — Panduan kemas kini

## Perubahan siap dalam kod

- Menu Pembantu AI: aktiviti PdP, pembezaan aras, pentaksiran/rubrik, bahan pengajaran, refleksi dan pertanyaan bebas.
- Boleh memilih salah satu daripada 60 RPH sendiri terkini sebagai konteks. Hanya medan pedagogi terpilih dihantar; tiada e-mel guru atau medan refleksi dihantar secara automatik. Arahan guru dihantar seperti ditulis.
- Hasil berbentuk teks selamat untuk disalin, tidak dirender sebagai HTML. Draf pembantu kekal dalam memori sepanjang sesi halaman; ia belum disimpan ke Firestore.
- Had masa 90 saat bagi setiap permintaan AI; ralat HTTP, jawapan kosong dan jawapan terpotong dikesan. Penyedia sandaran tidak lagi menulis ganti tetapan utama. Permintaan menunggu giliran kadar secara tersusun.
- Respons RPH dengan objektif/kriteria berbentuk teks diterima; RPH tanpa objektif atau aktiviti ditolak.
- Pendaftaran mencari kod sekolah selepas pengesahan, serta mengelakkan perebutan penciptaan profil dengan callback log masuk.
- Akaun baharu tidak boleh memberikan peranan pemilik kepada dirinya melalui pelayar. Admin dihadkan kepada pengguna sekolah sendiri. Akaun tidak aktif disekat daripada data sekolah. RPH, kitar semula dan jadual guru dilindungi mengikut pemilik rekod.
- Cache hanya menyimpan aset aplikasi yang disenaraikan, menyokong URL versi, dan tidak menggunakan HTML sebagai pengganti skrip yang gagal. Zoom telefon dan pilihan kurangkan animasi disokong.

## Langkah pemasangan

1. Sandarkan Firestore dan fail laman sebelum kemas kini.
2. Pastikan akaun pemilik sedia ada mempunyai `peranan: pemilik` dan `aktif: true` dalam `pengguna/{emel huruf kecil}`. Untuk pemasangan pertama, daftar akaun guru, kemudian tetapkan peranan pemilik menggunakan Firebase Console. Tiada lagi naik taraf automatik daripada EMEL_PEMILIK.
3. Uji dalam projek Firebase percubaan. Gantikan fail aplikasi dan terbitkan `firestore.rules` yang disertakan bersama. Rules dan kod perlu digunakan sebagai satu versi.
4. Log masuk sebagai pemilik, admin dan dua guru. Pastikan setiap guru hanya boleh mengubah RPH sendiri; admin tidak boleh mengurus pengguna sekolah lain. Uji import, kitar semula/pulih, sejarah versi, jadual dan cetakan. Uji akaun dinyahaktifkan.
5. Dalam Tetapan → Enjin AI, semak penyedia, model yang masih tersedia pada akaun anda dan API key. Uji sambungan, satu RPH, satu set soalan dan keenam-enam mod Pembantu AI.
6. Semak muat semula aplikasi pada telefon. AI dan data Firebase masih memerlukan internet; cache aset bukan jaminan operasi data sepenuhnya di luar talian.

## Pengesahan yang telah dijalankan

Semakan sintaks semua fail JavaScript lulus. Tujuh ujian automatik lulus untuk pengasingan penyedia sandaran, ralat 429, respons kosong/terpotong, tamat masa, JSON rosak, tetapan kadar rosak dan normalisasi/validasi RPH.

Jalankan semula dengan `node --test tests/ai.test.cjs`.

Belum diuji dengan Firebase sebenar, emulator Rules, panggilan AI berbayar atau akaun pengguna sebenar. Ujian visual pelayar tidak dapat dijalankan kerana Chromium tidak tersedia dalam persekitaran kerja. Fail ini belum diterbitkan ke GitHub atau laman sebenar.

## Had seni bina yang masih perlu diselesaikan

Aplikasi masih statik dengan panggilan AI terus dari pelayar. API key boleh dicapai oleh pengguna peranti dan skrip aplikasi; untuk penggunaan berpusat dengan kunci milik sekolah, perlu backend berautentikasi, stor rahsia pelayan dan kuota setiap pengguna. Sesetengah penyedia mungkin menyekat CORS. Model lalai sedia ada dikekalkan dan ketersediaannya belum disahkan.

Penyertaan sekolah masih menggunakan aliran kendiri sedia ada. Senarai sekolah boleh dibaca oleh pengguna yang log masuk dan kod sekolah bukan pengesahan jemputan yang kuat. Untuk akses sekolah tertutup, perlu aliran kelulusan admin atau jemputan yang disahkan di pelayan. Penguatkuasaan tarikh langganan masih pada klien; ia belum menjadi kawalan pelayan. Koleksi kurikulum dikongsi untuk ahli sekolah seperti aliran sedia ada; tetapan dan takwim kini hanya boleh ditulis pentadbir.

Output AI ialah draf. Arahan prompt menghalang penciptaan SK/SP tetapi tidak menjamin ketepatan; guru perlu membandingkan dengan DSKP/RPT sumber. Versi ini belum melaksanakan carian dokumen semantik atau pengesahan petikan sumber automatik.
