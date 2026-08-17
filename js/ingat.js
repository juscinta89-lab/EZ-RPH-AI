/*!
 * e-RPH AI — Peringatan kelas
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 */

/* HAD PENTING
   Aplikasi ini tiada pelayan, jadi peringatan dijadualkan dalam peranti sendiri
   menggunakan pemasa. Ia berbunyi selagi app masih terbuka — termasuk apabila
   tab berada di latar belakang atau app dipasang sebagai PWA dan diminimumkan.
   Jika app ditutup sepenuhnya, pemasa hilang dan peringatan tidak berbunyi.
   Untuk peringatan yang berfungsi walaupun app ditutup, satu pelayan push
   diperlukan — itu perubahan seni bina yang berasingan. */

const ING_KUNCI = 'erph_ingat';
let ING_PEMASA = [];          // id setTimeout yang sedang menunggu
let ING_TARIKH = '';          // tarikh yang sedang dijadualkan

function ingatTetapan(){
  try{ return JSON.parse(localStorage.getItem(ING_KUNCI)) || {}; }
  catch(e){ return {}; }
}
function simpanIngatTetapan(t){
  localStorage.setItem(ING_KUNCI, JSON.stringify(t));
}
function ingatAktif(){
  return ingatTetapan().hidup === true && ingatDibenarkan();
}
function ingatDibenarkan(){
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
function ingatBoleh(){
  return typeof Notification !== 'undefined';
}

/* ---------- Menghantar satu peringatan ---------- */
async function hantarIngat(tajuk, isi, tag){
  const pilihan = {
    body: isi, tag, renotify: true, icon: './icons/icon-192.png',
    badge: './icons/icon-192.png', lang: 'ms',
    vibrate: [180, 90, 180], data: { hal: 'dashboard' }
  };
  try{
    const reg = await navigator.serviceWorker?.ready;
    if(reg?.showNotification){ await reg.showNotification(tajuk, pilihan); return; }
  }catch(e){ /* jatuh ke cara biasa */ }
  try{ new Notification(tajuk, pilihan); }catch(e){}
}

/* ---------- Penjadualan ---------- */
function batalIngat(){
  ING_PEMASA.forEach(id => clearTimeout(id));
  ING_PEMASA = [];
}

/* Jadualkan semula semua peringatan untuk baki hari ini. Selamat dipanggil
   berulang kali — pemasa lama dibatalkan dahulu. */
function jadualIngat(){
  batalIngat();
  if(!ingatAktif() || !S.jadual?.length) return 0;

  const t = ingatTetapan();
  const awal = Number(t.minit) > 0 ? Number(t.minit) : 5;
  const iso = tarikhISO();
  const hari = namaHari(iso);
  const cuti = typeof cutiPada === 'function' ? cutiPada(iso) : null;
  if(cuti) return 0;

  ING_TARIKH = iso;
  const sekarang = new Date();
  const kiniMinit = sekarang.getHours()*60 + sekarang.getMinutes() + sekarang.getSeconds()/60;

  const slot = S.jadual.filter(s => s.hari === hari && s.mula && s.tamat)
    .sort((a,b) => minitJam(a.mula) - minitJam(b.mula));

  let dijadual = 0;
  for(const s of slot){
    const mula = minitJam(s.mula);
    if(mula == null) continue;
    const lekat = mula - awal;                       // bila peringatan patut berbunyi
    if(lekat <= kiniMinit) continue;                 // sudah berlalu hari ini
    const jeda = (lekat - kiniMinit) * 60000;
    if(jeda > 86400000) continue;                    // lebih sedaripada sehari, abaikan

    const ada = S.rph?.find(r => r.slotId === s.id && r.tarikh === iso);
    ING_PEMASA.push(setTimeout(() => {
      hantarIngat(
        `${s.subjek} · ${s.kelas}`,
        `Bermula ${s.mula} (${awal} minit lagi)` + (ada ? '' : ' — RPH belum disediakan'),
        'slot-' + s.id
      );
      if(document.visibilityState === 'visible' && typeof toast === 'function')
        toast(`${s.subjek} ${s.kelas} bermula ${s.mula}`, 'jaya');
    }, jeda));
    dijadual++;
  }

  // Jadualkan semula selepas tengah malam supaya hari berikutnya diambil kira
  const esok = new Date(sekarang); esok.setHours(24,0,20,0);
  ING_PEMASA.push(setTimeout(jadualIngat, esok - sekarang));

  return dijadual;
}

/* Tab yang lama di latar belakang boleh menyebabkan pemasa tersasar,
   jadi jadual dibina semula setiap kali app dilihat semula. */
function pasangPemerhatiIngat(){
  if(window._ingatDipasang) return;
  window._ingatDipasang = true;
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible'){
      if(ING_TARIKH !== tarikhISO() || !ING_PEMASA.length) jadualIngat();
    }
  });
}

async function mintaIzinIngat(){
  if(!ingatBoleh()) return false;
  if(Notification.permission === 'granted') return true;
  if(Notification.permission === 'denied') return false;
  try{ return (await Notification.requestPermission()) === 'granted'; }
  catch(e){ return false; }
}

/* ---------- Antara muka dalam Tetapan ---------- */
function kadIngat(){
  const t = ingatTetapan();
  const awal = Number(t.minit) > 0 ? Number(t.minit) : 5;
  const izin = ingatBoleh() ? Notification.permission : 'tiada';

  const status = !ingatBoleh()
    ? ['Pelayar ini tidak menyokong pemberitahuan', '#a33']
    : izin === 'denied'
      ? ['Pemberitahuan disekat dalam tetapan pelayar — benarkan semula dari ikon kunci pada bar alamat', '#a33']
      : izin === 'granted'
        ? (t.hidup ? [`Aktif · ${jadualIngat()} peringatan menunggu hari ini`, '#1b7a4b']
                   : ['Kebenaran diberi, tetapi peringatan dimatikan', '#8a6106'])
        : ['Kebenaran belum diminta', '#8a6106'];

  return `<div class="kad">
    <div class="kad-h"><h3>Peringatan kelas</h3></div>
    <p style="font-size:12.5px;color:var(--teks-2);margin-bottom:12px">
      Pemberitahuan sebelum setiap slot PdP bermula, mengikut jadual waktu anda.</p>

    <div class="ing-status" style="color:${status[1]}">${esc(status[0])}</div>

    <label class="fld" style="margin-top:12px"><span>Peringatan</span>
      <select id="ingHidup" onchange="simpanIngat()">
        <option value="0"${t.hidup ? '' : ' selected'}>Dimatikan</option>
        <option value="1"${t.hidup ? ' selected' : ''}>Dihidupkan</option>
      </select></label>

    <label class="fld"><span>Berapa awal sebelum kelas</span>
      <select id="ingMinit" onchange="simpanIngat()">
        ${[1,3,5,10,15,30].map(m => `<option value="${m}"${m===awal?' selected':''}>${m} minit sebelum</option>`).join('')}
      </select></label>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="ujiIngat()">🔔 Hantar ujian</button>
      <button class="btn btn-sm" onclick="pergi('tetapan')">↻ Segarkan status</button>
    </div>

    <p style="font-size:11.5px;color:var(--teks-3);margin-top:11px;line-height:1.5">
      Peringatan berbunyi selagi app masih terbuka, termasuk di latar belakang.
      Jika app ditutup sepenuhnya, ia tidak berbunyi — itu had aplikasi web tanpa pelayan.
      Pasang app ke skrin utama untuk hasil paling baik.</p>
  </div>`;
}

async function simpanIngat(){
  const hidup = $('#ingHidup').value === '1';
  const minit = Number($('#ingMinit').value) || 5;
  if(hidup && !ingatDibenarkan()){
    const ok = await mintaIzinIngat();
    if(!ok){
      simpanIngatTetapan({ hidup:false, minit });
      toast('Kebenaran pemberitahuan tidak diberi','salah');
      return pergi('tetapan');
    }
  }
  simpanIngatTetapan({ hidup, minit });
  const n = jadualIngat();
  toast(hidup ? `Peringatan dihidupkan · ${n} slot menunggu hari ini` : 'Peringatan dimatikan','jaya');
  pergi('tetapan');
}

async function ujiIngat(){
  if(!await mintaIzinIngat()) return toast('Kebenaran pemberitahuan tidak diberi','salah');
  await hantarIngat('Ujian peringatan e-RPH AI',
    'Beginilah rupa peringatan sebelum kelas anda bermula.', 'ujian');
  toast('Peringatan ujian dihantar','jaya');
}
