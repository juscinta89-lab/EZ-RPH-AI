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

/* ---------- Menu ---------- */
const MENU = [
  { grp:'Utama' },
  { id:'dashboard', ikon:'🏠', nama:'Dashboard' },
  { id:'rph',       ikon:'📘', nama:'RPH Saya' },
  { id:'kalendar',  ikon:'📅', nama:'Kalendar' },
  { id:'jana',      ikon:'✨', nama:'Jana RPH AI' },
  { grp:'Tetapan Kurikulum' },
  { id:'jadual',    ikon:'⏰', nama:'Jadual Waktu' },
  { id:'kelas',     ikon:'👥', nama:'Kelas' },
  { id:'subjek',    ikon:'📚', nama:'Subjek' },
  { id:'rpt',       ikon:'📗', nama:'RPT' },
  { id:'buku',      ikon:'📖', nama:'Buku Teks' },
  { id:'takwim',    ikon:'🗓️', nama:'Takwim' },
  { grp:'Lain-lain' },
  { id:'cetak',     ikon:'🖨️', nama:'Cetak Mingguan' },
  { id:'laporan',   ikon:'📊', nama:'Laporan' },
  { id:'tetapan',   ikon:'⚙️', nama:'Tetapan' },
  { id:'admin',     ikon:'🛡️', nama:'Panel Pentadbir', peranan:['pemilik','admin'] }
];

function binaMenu(){
  const boleh = m => !m.peranan || m.peranan.includes(S.peranan);
  $('#sideNav').innerHTML = MENU.filter(boleh).map(m =>
    m.grp ? `<div class="nav-lbl">${m.grp}</div>`
          : `<button class="nav-i" data-hal="${m.id}"><span>${m.ikon}</span>${m.nama}</button>`).join('');
  $('#botNav').innerHTML = [
    {id:'dashboard',i:'🏠',n:'Utama'},{id:'rph',i:'📘',n:'RPH'},
    {id:'jana',i:'✨',n:'Jana'},{id:'kalendar',i:'📅',n:'Kalendar'},
    {id:'lagi',i:'⋯',n:'Lagi'}
  ].map(m => `<button data-hal="${m.id}"><i>${m.i}</i>${m.n}</button>`).join('');

  $$('[data-hal]').forEach(b => b.onclick = () => {
    if(b.dataset.hal === 'lagi'){ $('.side').classList.add('buka'); return; }
    pergi(b.dataset.hal);
  });
}

const TAJUK = {
  dashboard:['Dashboard','Ringkasan PdP anda hari ini'],
  rph:['RPH Saya','Semua Rancangan Pengajaran Harian'],
  kalendar:['Kalendar RPH','Status RPH mengikut tarikh'],
  jana:['Jana RPH AI','Hasilkan RPH daripada jadual waktu & RPT'],
  jadual:['Jadual Waktu','Slot PdP mingguan anda'],
  kelas:['Kelas','Senarai kelas yang anda ajar'],
  subjek:['Subjek','Mata pelajaran sekolah'],
  rpt:['Rancangan Pengajaran Tahunan','Tajuk & standard mengikut minggu persekolahan'],
  buku:['Buku Teks','Rujukan bab & unit buku teks'],
  takwim:['Takwim Persekolahan','Minggu persekolahan & cuti'],
  cetak:['Cetak Mingguan','Cetak set RPH untuk fail rekod'],
  laporan:['Laporan','Statistik RPH & liputan RPT'],
  tetapan:['Tetapan','Profil, AI dan aplikasi'],
  admin:['Panel Pentadbir','Urus sekolah, guru dan data'],
  editor:['Editor RPH','Semak dan edit sebelum simpan']
};

function pergi(hal){
  S.hal = hal;
  $('.side').classList.remove('buka');
  $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.hal === hal));
  $$('.botnav button').forEach(b => b.classList.toggle('on', b.dataset.hal === hal));
  const t = TAJUK[hal] || ['e-RPH AI',''];
  $('#tajukHal').textContent = t[0]; $('#subTajuk').textContent = t[1];
  window.scrollTo(0,0);
  const f = {
    dashboard:halDashboard, rph:halRph, kalendar:halKalendar, jana:halJana,
    jadual:halJadual, kelas:halKelas, subjek:halSubjek, rpt:halRpt,
    buku:halBuku, takwim:halTakwim, cetak:halCetak, laporan:halLaporan, tetapan:halTetapan,
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
