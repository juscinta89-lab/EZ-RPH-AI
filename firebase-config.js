/* =========================================================
   e-RPH AI — KONFIGURASI
   Tukar bahagian di bawah dengan config Firebase anda.
   (Firebase Console > Project settings > Your apps > Web app)
   ========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "MASUKKAN_API_KEY",
  authDomain: "PROJEK.firebaseapp.com",
  projectId: "PROJEK",
  storageBucket: "PROJEK.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx"
};

/* =========================================================
   PEMILIK APLIKASI (akses penuh semua sekolah)
   Masukkan e-mel anda. Boleh letak lebih daripada satu.
   E-mel ini automatik jadi 'pemilik' pada log masuk pertama.
   ========================================================= */
const EMEL_PEMILIK = [
  "juscinta89@gmail.com"
];

/* Tetapan lain */
const APP = {
  nama: "e-RPH AI",
  versi: "v1.0",
  tagline: "RPH Pintar. PdP Lebih Terancang."
};
