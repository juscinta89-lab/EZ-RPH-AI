# Ilustrasi kartun AI — v1.2.0

## Cara guna

**Latihan baharu:** Buka RPH → Lagi → Jana soalan latihan → Bina ayat berdasarkan gambar. Pilih Kartun berwarna atau Lukisan hitam putih. Masukkan API key Gemini imej jika enjin teks anda menggunakan penyedia lain. Jika Tetapan sudah menggunakan Gemini, kunci itu boleh digunakan dengan membiarkan ruangan kunci gambar kosong. Tekan Jana.

**Latihan sedia ada:** Buka latihan → Ilustrasi kartun / lengkapkan gambar → pilih gaya → masukkan kunci jika perlu → Jana / lengkapkan gambar. Soalan, kata bantu dan jawapan sedia ada dikekalkan. Gambar yang sudah disimpan dalam gaya sama dilangkau. Memilih gaya lain menjana semula gambar dan menggunakan kuota tambahan.

Imej dijana sebagai satu adegan penuh dengan watak, perbuatan, objek dan latar berdasarkan `perihal` soalan. Contohnya, peniaga sedang menimbang buah di gerai, bukan gabungan ikon orang, epal dan penimbang. Model imej diberi arahan supaya tidak menulis ayat jawapan di dalam gambar.

Semak visual setiap item sebelum digunakan. Penjanaan imej tidak menjamin perbuatan, bilangan objek atau butiran sentiasa tepat. Versi ini belum menyediakan penyuntingan prompt per gambar atau pengesahan visual automatik. Untuk menukar gambar yang sudah siap, memilih gaya lain akan menjana semula set; butang lengkapkan hanya menyambung gambar yang belum siap bagi gaya terpilih.

## Model, kunci dan kos

Integrasi menggunakan Gemini `gemini-3.1-flash-image` melalui REST generateContent. Ini model imej berasingan daripada model teks. Akaun perlu akses dan kuota imej yang mencukupi; penjanaan boleh dikenakan caj mengikut pelan penyedia. 15 soalan memerlukan sehingga 15 panggilan imej selain panggilan penjanaan/semakan teks.

Kunci yang ditampal dalam dialog gambar hanya digunakan untuk tindakan itu dan tidak disimpan ke Firestore atau localStorage. Jika menggunakan kunci sedia ada dalam Tetapan, penyimpanan kunci mengikut aliran sedia ada aplikasi. Penjanaan berlaku terus dari pelayar; kuota, CORS, sekatan model atau kunci tidak sah akan menghasilkan ralat. Tiada panggilan imej berbayar telah dilakukan dalam sesi pembangunan ini.

Rujukan API rasmi:
- https://firebase.google.com/docs/ai-logic/generate-images-gemini
- https://ai.google.dev/gemini-api/docs/generate-content/image-generation

## Penyimpanan dan cetakan

Imej raster dimampatkan dalam pelayar ke JPEG dan disimpan sebagai data imej bersama latihan dalam dokumen RPH. Tidak menggunakan Firebase Storage. Maksimum dimensi bermula 768px dan boleh dikurangkan mengikut bilangan gambar/had saiz. Ini sesuai untuk gambar kecil lembaran kerja, bukan imej A3 resolusi penuh.

Bajet imej bagi satu latihan dihadkan sehingga 600,000 aksara data; saiz JSON keseluruhan disemak pada had konservatif 800,000 bait sebelum menulis. Saiz sebenar Firestore berbeza daripada JSON; margin ini disediakan untuk metadata dan medan lain. Rekod yang terlalu besar ditolak sebelum panggilan imej.

Setiap gambar berjaya disimpan satu demi satu. Gambar yang sudah disimpan dikekalkan apabila panggilan seterusnya gagal. Jika penulisan Firestore gagal, gambar terakhir yang belum disimpan mungkin perlu dijana semula; semak sambungan sebelum mencuba lagi. Ralat kunci/kuota menghentikan baki panggilan. Mod kartun tidak menggantikan gambar gagal dengan emoji secara senyap. Lengkapkan gambar sebelum mencetak.

Gambar dicetak dalam kotak kira-kira 50 × 38 mm menggunakan object-fit contain. App menunggu imej dibaca sebelum membuka dialog cetak. Lembaran lebih panjang daripada contoh PDF asal kerana adegan perlu cukup besar untuk dilihat murid.

## Pemasangan pada v1.1.1

Tambah `js/gambar.js`. Gantikan `js/ai.js`, `js/rph.js`, `index.html`, `styles.css` dan `sw.js`. Kekalkan konfigurasi Firebase/Google anda. Tiada perubahan Firestore Rules pada versi ini. Muat naik semua fail sebelum membuka semula app; versi aset/cache ialah v68.

ZIP ini termasuk pembaikan Edit RPH dan penambahbaikan v1.1.x sebelumnya. PDF contoh anda tidak diubah. Kod belum diterbitkan ke laman sebenar.

## Ujian

23 ujian automatik lulus (`node --test tests/*.test.cjs`) dan semua JavaScript lulus semakan sintaks. Ujian baharu meliputi pemilihan kunci, prompt adegan, format imej dibenarkan, respons tanpa gambar, kontrak permintaan model imej, simpan berperingkat, sambung gambar gagal, kuota, had saiz dan HTML gambar pada latihan.

API imej, pemampatan canvas dan cetakan sebenar belum diuji dalam pelayar/peranti sebenar. Respons API dalam ujian disimulasikan; hasil kartun sebenar belum dinilai. Sediakan satu set percubaan dahulu sebelum penggunaan kelas.
