/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* =========================================================
   e-RPH AI — KONFIGURASI
   Tukar bahagian di bawah dengan config Firebase anda.
   (Firebase Console > Project settings > Your apps > Web app)
   ========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8gOeStzQ4JldXeYHViNFX5dfXi4LNB5A",
  authDomain: "ez-rph-ai.firebaseapp.com",
  projectId: "ez-rph-ai",
  storageBucket: "ez-rph-ai.firebasestorage.app",
  messagingSenderId: "700098799420",
  appId: "1:700098799420:web:69f0c0408baaceb4d4e039",
  measurementId: "G-4YFT645VHG"
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
  versi: "v10.0",
  tagline: "RPH Pintar. PdP Lebih Terancang."
};
