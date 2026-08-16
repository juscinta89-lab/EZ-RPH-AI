/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* ================= e-RPH AI — CORE ================= */
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- State global ---------- */
const S = {
  user: null,          // firebase user
  profil: null,        // dok pengguna/{emel}
  sekolah: null,       // dok sekolah/{sid}
  sid: null,
  peranan: 'guru',     // pemilik | admin | guru
  kelas: [], subjek: [], jadual: [], rpt: [], rptAda: false, buku: [], takwim: null, logo: '',
  rph: [],             // cache RPH pengguna
  hal: 'dashboard',
  editRphId: null
};

/* ---------- Helper ---------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const HARI = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
const BULAN = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];

function tarikhISO(d){ d = d || new Date(); const p = n => String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function tarikhCantik(iso){ if(!iso) return '—'; const d = new Date(iso+'T00:00:00'); return HARI[d.getDay()]+', '+d.getDate()+' '+BULAN[d.getMonth()]+' '+d.getFullYear(); }
function namaHari(iso){ return HARI[new Date(iso+'T00:00:00').getDay()]; }
function minit(a,b){ if(!a||!b) return 0; const [h1,m1]=a.split(':').map(Number), [h2,m2]=b.split(':').map(Number); return (h2*60+m2)-(h1*60+m1); }

function toast(msg, jenis){
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + (jenis||'');
  clearTimeout(t._x); t._x = setTimeout(()=> t.className = 'toast', 2600);
}
function sibuk(on, msg){ $('#busyMsg').textContent = msg || 'Sedang memproses…'; $('#busy').classList.toggle('hide', !on); }

function modal(tajuk, html, butang){
  $('#modalTajuk').textContent = tajuk;
  $('#modalBody').innerHTML = html;
  $('#modalFoot').innerHTML = butang || '<button class="btn" onclick="tutupModal()">Tutup</button>';
  $('#modalWrap').classList.remove('hide');
}
function tutupModal(){ $('#modalWrap').classList.add('hide'); }
function sahkan(msg, fn){
  window._sah = fn;
  modal('Sahkan', '<p>'+esc(msg)+'</p>',
    '<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-danger" onclick="tutupModal();window._sah()">Ya, teruskan</button>');
}
window.tutupModal = tutupModal;

/* ---------- Ikon SVG (garis ringkas) ---------- */
const IKON = {
  dashboard:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  rph:      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M8 7.5h7M8 11h5"/>',
  kalendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/><path d="M7.5 13.5h3v3h-3z"/>',
  jana:     '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  jadual:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  kelas:    '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5c.5-3.2 3-5.2 5.8-5.2s5.3 2 5.8 5.2"/><path d="M16.5 6.2a3 3 0 0 1 0 5.8M18 14.6c2 .7 3.3 2.5 3.6 4.9"/>',
  subjek:   '<path d="M4 6.5C4 5 5.2 4 6.7 4H11v15H6.7C5.2 19 4 20 4 21.5z"/><path d="M20 6.5C20 5 18.8 4 17.3 4H13v15h4.3c1.5 0 2.7 1 2.7 2.5z"/>',
  rpt:      '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  buku:     '<path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3z"/><path d="M9 9h6"/>',
  takwim:   '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  cetak:    '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  laporan:  '<path d="M4 20.5h16"/><path d="M7 20.5v-7M12 20.5V7M17 20.5v-10"/>',
  tetapan:  '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.4a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.84 2.84l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.84-2.84l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.84-2.84l.06.06a1.7 1.7 0 0 0 1.88.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.84 2.84l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.4z"/>',
  admin:    '<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  audit:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/><path d="m8.5 11 1.8 1.8L14 9.2"/>',
  drive:    '<path d="M8 3h8l5 8.5-4 7H7l-4-7z"/><path d="M8 3 3.5 11.5M16 3l-4.5 8.5M3.5 11.5h17"/>',
  rujukan:  '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><circle cx="11.5" cy="9" r="2.2"/><path d="M11.5 11.2v2"/>',
  lagi:     '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>'
};
function svgIkon(id, saiz){
  return `<svg viewBox="0 0 24 24" width="${saiz||20}" height="${saiz||20}" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IKON[id]||IKON.lagi}</svg>`;
}

/* ---------- Kunci zoom pada peranti mudah alih ---------- */
(function kunciZoom(){
  // iOS Safari mengabaikan user-scalable=no, jadi disekat secara manual
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive:false });
  document.addEventListener('gesturechange', e => e.preventDefault(), { passive:false });
  document.addEventListener('gestureend', e => e.preventDefault(), { passive:false });
  let ketukAkhir = 0;
  document.addEventListener('touchend', e => {
    const kini = Date.now();
    if(kini - ketukAkhir <= 300) e.preventDefault();   // ketuk dua kali
    ketukAkhir = kini;
  }, { passive:false });
  document.addEventListener('touchmove', e => {
    if(e.touches.length > 1) e.preventDefault();       // cubit dua jari
  }, { passive:false });
})();

/* ---------- Menu ---------- */
const MENU = [
  { grp:'Utama' },
  { id:'dashboard', nama:'Dashboard' },
  { id:'rph',       nama:'RPH Saya' },
  { id:'kalendar',  nama:'Kalendar' },
  { id:'jana',      nama:'AI Generator' },
  { grp:'Setup Kurikulum' },
  { id:'jadual',    nama:'Jadual Waktu' },
  { id:'kelas',     nama:'Kelas' },
  { id:'subjek',    nama:'Subjek' },
  { id:'rpt',       nama:'RPT' },
  { id:'buku',      nama:'Buku Teks' },
  { id:'takwim',    nama:'Takwim' },
  { grp:'Tools & Laporan' },
  { id:'cetak',     nama:'Cetak Mingguan' },
  { id:'audit',     nama:'Semakan RPH' },
  { id:'drive',     nama:'Google Drive' },
  { id:'rujukan',   nama:'Bahan Rujukan' },
  { id:'laporan',   nama:'Laporan & Statistik' },
  { id:'tetapan',   nama:'Tetapan' },
  { id:'admin',     nama:'Admin Panel', peranan:['pemilik','admin'] }
];

function binaMenu(){
  const boleh = m => !m.peranan || m.peranan.includes(S.peranan);
  $('#sideNav').innerHTML = MENU.filter(boleh).map(m =>
    m.grp ? `<div class="nav-lbl">${m.grp}</div>`
          : `<button class="nav-i" data-hal="${m.id}">${svgIkon(m.id)}<span>${m.nama}</span></button>`).join('');
  $('#botNav').innerHTML = [
    {id:'dashboard',n:'Utama'},{id:'rph',n:'RPH'},{id:'jana',n:'Jana'},
    {id:'cetak',n:'Cetak'},{id:'lagi',n:'Lagi'}
  ].map(m => `<button data-hal="${m.id}">${svgIkon(m.id, 22)}<span>${m.n}</span></button>`).join('');

  $$('[data-hal]').forEach(b => b.onclick = () => {
    if(b.dataset.hal === 'lagi'){ $('.side').classList.add('buka'); return; }
    pergi(b.dataset.hal);
  });
}

const TAJUK = {
  dashboard:['Dashboard','Ringkasan PdP anda hari ini'],
  rph:['RPH Saya','Semua Rancangan Pengajaran Harian'],
  kalendar:['Kalendar RPH','Status RPH mengikut tarikh'],
  jana:['AI Generator','Hasilkan RPH daripada jadual waktu & RPT'],
  jadual:['Jadual Waktu','Slot PdP mingguan anda'],
  kelas:['Kelas','Senarai kelas yang anda ajar'],
  subjek:['Subjek','Mata pelajaran sekolah'],
  rpt:['Rancangan Pengajaran Tahunan','Tajuk & standard mengikut minggu persekolahan'],
  buku:['Buku Teks','Rujukan bab & unit buku teks'],
  takwim:['Takwim Persekolahan','Minggu persekolahan & cuti'],
  cetak:['Cetak Mingguan','Cetak set RPH untuk fail rekod'],
  audit:['Semakan RPH','Kesan isu dalam semua RPH sekali gus'],
  drive:['Google Drive','Dokumen Google Docs sedia untuk Classroom'],
  rujukan:['Bahan Rujukan','Pautan sekolah & panduan tetap untuk AI'],
  laporan:['Laporan & Statistik','Prestasi RPH & liputan RPT'],
  tetapan:['Tetapan','Profil, AI dan aplikasi'],
  admin:['Admin Panel','Urus sekolah, guru dan data'],
  editor:['Editor RPH','Semak dan edit sebelum simpan']
};

function pergi(hal){
  S.hal = hal;
  $('.side').classList.remove('buka');
  $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.hal === hal));
  const dalamBot = ['dashboard','rph','jana','cetak'];
  $$('.botnav button').forEach(b => b.classList.toggle('on',
    b.dataset.hal === hal || (b.dataset.hal === 'lagi' && !dalamBot.includes(hal))));
  const t = TAJUK[hal] || ['e-RPH AI',''];
  $('#tajukHal').textContent = t[0]; $('#subTajuk').textContent = t[1];
  window.scrollTo(0,0);
  const f = {
    dashboard:halDashboard, rph:halRph, kalendar:halKalendar, jana:halJana,
    jadual:halJadual, kelas:halKelas, subjek:halSubjek, rpt:halRpt,
    buku:halBuku, takwim:halTakwim, cetak:halCetak, audit:halAudit, drive:halDrive, rujukan:halRujukan, laporan:halLaporan, tetapan:halTetapan,
    admin:halAdmin, editor:halEditor
  }[hal];
  if(f) f(); else $('#kandungan').innerHTML = '<div class="kosong"><b>Halaman tidak dijumpai</b></div>';
}
window.pergi = pergi;

/* ---------- AUTH ---------- */
function tunjuk(view){
  ['#boot','#authView','#app'].forEach(v => $(v).classList.add('hide'));
  $(view).classList.remove('hide');
}

$$('[data-authtab]').forEach(b => b.onclick = () => {
  $$('[data-authtab]').forEach(x => x.classList.toggle('active', x === b));
  $('#tabMasuk').classList.toggle('hide', b.dataset.authtab !== 'masuk');
  $('#tabDaftar').classList.toggle('hide', b.dataset.authtab !== 'daftar');
});

$('#btnGoogle').onclick = async () => {
  try{
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt:'select_account' });
    await auth.signInWithPopup(p);
  }catch(e){ toast(ralat(e),'salah'); }
};

$('#btnMasuk').onclick = async () => {
  const e = $('#inEmel').value.trim(), k = $('#inKata').value;
  if(!e || !k) return toast('Isi e-mel dan kata laluan','salah');
  sibuk(true,'Log masuk…');
  try{ await auth.signInWithEmailAndPassword(e,k); }
  catch(err){ toast(ralat(err),'salah'); }
  sibuk(false);
};

$('#btnDaftar').onclick = async () => {
  const nama = $('#rgNama').value.trim(), e = $('#rgEmel').value.trim().toLowerCase();
  const k = $('#rgKata').value, kod = $('#rgKod').value.trim().toUpperCase();
  if(!nama || !e || k.length < 6) return toast('Lengkapkan nama, e-mel dan kata laluan (6 aksara)','salah');
  sibuk(true,'Mendaftar…');
  try{
    let sid = null;
    if(kod){
      const q = await db.collection('sekolah').where('kod','==',kod).limit(1).get();
      if(q.empty){ sibuk(false); return toast('Kod sekolah tidak dijumpai','salah'); }
      sid = q.docs[0].id;
    }
    const cred = await auth.createUserWithEmailAndPassword(e,k);
    await cred.user.updateProfile({ displayName: nama });
    await db.collection('pengguna').doc(e).set({
      emel:e, nama, peranan: EMEL_PEMILIK.includes(e) ? 'pemilik' : 'guru',
      sekolahId: sid, aktif:true, dibuat: Date.now()
    });
  }catch(err){ toast(ralat(err),'salah'); }
  sibuk(false);
};

$('#btnLupa').onclick = async () => {
  const e = $('#inEmel').value.trim();
  if(!e) return toast('Masukkan e-mel dahulu','salah');
  try{ await auth.sendPasswordResetEmail(e); toast('Pautan set semula dihantar ke e-mel','jaya'); }
  catch(err){ toast(ralat(err),'salah'); }
};

$('#btnKeluar').onclick = () => sahkan('Log keluar daripada e-RPH AI?', () => auth.signOut());
$('#btnMenu').onclick = () => $('.side').classList.toggle('buka');
$('#btnAI').onclick = () => pergi('jana');

function statusLanggan(p){
  const t = (p && p.langganTamat) || '';
  if(!t) return { jenis:'tiada' };
  const cantik = t.split('-').reverse().join('/');
  const hariIni = tarikhISO();
  if(t < hariIni) return { jenis:'tamat', tarikh:cantik };
  const baki = Math.ceil((new Date(t+'T00:00:00') - new Date(hariIni+'T00:00:00')) / 86400000);
  if(baki <= 14) return { jenis:'hampir', tarikh:cantik, baki };
  return { jenis:'aktif', tarikh:cantik, baki };
}

function ralat(e){
  const m = {
    'auth/invalid-credential':'E-mel atau kata laluan salah',
    'auth/wrong-password':'Kata laluan salah',
    'auth/user-not-found':'Akaun tidak wujud',
    'auth/email-already-in-use':'E-mel ini sudah didaftarkan',
    'auth/weak-password':'Kata laluan terlalu pendek',
    'auth/popup-closed-by-user':'Log masuk dibatalkan',
    'auth/network-request-failed':'Tiada sambungan internet',
    'permission-denied':'Akses ditolak. Semak Firestore Rules.'
  };
  return m[e.code] || e.message || 'Ralat tidak dijangka';
}
