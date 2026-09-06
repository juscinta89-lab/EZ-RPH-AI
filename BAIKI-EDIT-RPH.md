# Pembaikan Edit RPH — v1.1.1 (cache v67)

## Apa yang dibaiki

Ralat berjaya dihasilkan semula pada kod v1.1.0: apabila objektif disimpan sebagai array/senarai, semakKualiti memanggil `.trim()` pada array sebelum borang editor dipaparkan. Akibatnya, paparan editor tidak muncul. Ini satu laluan kegagalan yang disahkan melalui ujian; ia belum membuktikan punca tunggal masalah klik berulang pada peranti pengguna.

- Rekod lama/import dinormalisasi pada salinan paparan. Data asal tidak ditulis ganti semasa membuka editor.
- Borang disediakan sebelum semakan kualiti. Ralat semakan hanya menjejaskan panel semakan, bukan seluruh borang.
- Kerja semakan tertangguh dibatalkan apabila RPH ditukar dan tidak mengubah halaman selepas pengguna keluar dari editor.
- Modal ditutup apabila membuka RPH. Rekod hilang atau ralat paparan kini memberi mesej, bukan senyap.
- Butang Edit pada senarai dan dashboard kini berlabel, lebih besar dan tidak mengecil ketika ditekan.
- Tindakan Betulkan angka tidak lagi melukis semula borang daripada data lama yang boleh membuang suntingan belum disimpan.
- Versi aset dan cache dinaikkan kepada v67.

## Cara memasang pada versi v1.1.0

Gantikan lima fail berikut sambil mengekalkan struktur folder:

1. `index.html`
2. `styles.css`
3. `sw.js`
4. `js/rph.js`
5. `js/data.js`

Kekalkan `firebase-config.js` anda, termasuk konfigurasi Firebase dan Google. Tiada perubahan Firestore Rules diperlukan untuk pembaikan v1.1.1 ini. Fail lain dalam ZIP meneruskan versi v1.1.0 sebelumnya.

Selepas semua fail dimuat naik, tutup tab/aplikasi e-RPH dan buka semula. Di desktop, gunakan Ctrl+Shift+R jika masih nampak butang lama. Pastikan butang pensel kini memaparkan perkataan **Edit**.

Cuba Edit dari RPH Saya, dashboard dan pratonton. Cuba RPH yang sebelum ini bermasalah, sunting satu medan dan simpan. Jika masalah masih berlaku, berikan pautan laman/repo, jenis peranti/pelayar dan rakaman ringkas laluan klik supaya masalah sebenar boleh diuji.

## Bukti ujian dan had

14 ujian automatik lulus: tujuh ujian AI sedia ada dan tujuh ujian editor baharu. Ujian menggunakan fungsi aplikasi sebenar dengan DOM dan navigasi simulasi, termasuk menjalankan pengendali butang Edit sekali dan mengesahkan HTML borang tersedia. Semua fail JavaScript lulus semakan sintaks.

Ujian editor meliputi data lama berbentuk array, audit gagal, pertukaran RPH pantas, keluar halaman sebelum audit selesai, rekod tiada, ralat render dan pengendali butang Edit. Kod sebelum pembetulan menghasilkan ralat `(r.objektif || "").trim is not a function` untuk data ujian yang sama.

Belum diuji pada pelayar/peranti sebenar atau Firebase sebenar. Chromium tidak tersedia dan muat turun pelayar tidak berjaya. Kod belum diterbitkan; akses GitHub dalam sesi ini hanya menunjukkan repositori KEBERADAAN-GURU.

Jalankan ujian: `node --test tests/*.test.cjs`.
