/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */

/* ================= SIMPAN RPH KE GOOGLE DRIVE =================
   Hanya satu skop diperlukan: drive.file — aplikasi hanya boleh melihat
   dan mengurus fail yang ia cipta sendiri, bukan seluruh Drive guru.
   Dokumen disusun dalam folder: e-RPH AI / {Sesi} / {Minggu}. */

const SKOP_DRIVE = 'https://www.googleapis.com/auth/drive.file';

/* ---------------------------------------------------------------
   CLIENT ID APLIKASI — diisi SEKALI oleh pemilik aplikasi.
   Ini bukan rahsia; ia memang terdedah dalam kod pelayar dan itu normal.
   Guru TIDAK perlu buat apa-apa tetapan — mereka hanya tekan butang
   dan log masuk dengan akaun Google masing-masing.
   --------------------------------------------------------------- */
const CLIENT_ID_TERBINA = "313464725222-2496bherbuls7iackl1q8dg0043m5ehp.apps.googleusercontent.com";   // <-- tampal Client ID anda di sini
let _tokenGoogle = null, _tokenTamat = 0, _klienToken = null, _gisSedang = null;

function clientIdGoogle(){
  // keutamaan: tetapan sekolah (jika ada) → Client ID terbina dalam app
  if(typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  return CLIENT_ID_TERBINA || '';
}
function driveSedia(){ return !!clientIdGoogle(); }
function adaToken(){ return _tokenGoogle && Date.now() < _tokenTamat - 60000; }

/* Pramuat pustaka Google seawal halaman dibuka, supaya klik butang nanti
   boleh terus membuka popup tanpa menunggu (popup akan disekat jika menunggu). */
function pramuatGIS(){
  if(!driveSedia()) return Promise.resolve();
  if(_gisSedang) return _gisSedang;
  _gisSedang = new Promise((selesai, gagal) => {
    if(window.google?.accounts?.oauth2) return selesai();
    const sk = document.createElement('script');
    sk.src = 'https://accounts.google.com/gsi/client';
    sk.onload = selesai;
    sk.onerror = () => gagal(new Error('Gagal memuat pustaka Google. Semak sambungan internet.'));
    document.head.appendChild(sk);
  }).then(() => {
    if(!_klienToken && window.google?.accounts?.oauth2){
      _klienToken = window.google.accounts.oauth2.initTokenClient({
        client_id: clientIdGoogle(), scope: SKOP_DRIVE, callback: () => {}
      });
    }
  });
  return _gisSedang;
}

/* Minta kebenaran SERTA-MERTA dalam klik pengguna — tiada await sebelum ini,
   jadi popup tidak disekat pelayar. */
function mintaTokenSegera(){
  return new Promise((selesai, gagal) => {
    if(adaToken()) return selesai(_tokenGoogle);
    if(!_klienToken) return gagal(new Error('Pustaka Google belum siap. Tunggu sebentar dan cuba lagi.'));
    _klienToken.callback = (r) => {
      if(r.error) return gagal(new Error(huraiRalatOAuth(r)));
      _tokenGoogle = r.access_token;
      _tokenTamat = Date.now() + (r.expires_in || 3600) * 1000;
      selesai(_tokenGoogle);
    };
    _klienToken.error_callback = (e) => gagal(new Error(huraiRalatOAuth(e)));
    _klienToken.requestAccessToken();      // dipanggil terus dalam gerak isyarat pengguna
  });
}

async function tokenDrive(){
  if(adaToken()) return _tokenGoogle;
  await pramuatGIS();
  return mintaTokenSegera();
}

async function apiDrive(url, pilihan){
  const t = await tokenDrive();
  const r = await fetch(url, { ...pilihan,
    headers:{ 'Authorization':'Bearer '+t, 'Content-Type':'application/json', ...(pilihan?.headers||{}) } });
  const teks = await r.text();
  let j = {}; try{ j = JSON.parse(teks); }catch(e){}
  if(!r.ok){
    const m = j.error?.message || teks.slice(0,150);
    if(r.status === 401){ _tokenGoogle = null; throw new Error('Sesi Google tamat. Sambung semula.'); }
    if(/not enabled|has not been used/i.test(m)) throw new Error('Google Drive API belum diaktifkan dalam projek Cloud anda (langkah 2 panduan).');
    throw new Error(m);
  }
  return j;
}

/* ---------- Folder ---------- */
async function cariAtauCiptaFolder(nama, indukId){
  const q = encodeURIComponent(
    `name='${nama.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
    (indukId ? ` and '${indukId}' in parents` : ''));
  const cari = await apiDrive(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  if(cari.files?.length) return cari.files[0].id;
  const baharu = await apiDrive('https://www.googleapis.com/drive/v3/files?fields=id', {
    method:'POST',
    body: JSON.stringify({ name:nama, mimeType:'application/vnd.google-apps.folder',
                           ...(indukId ? { parents:[indukId] } : {}) })
  });
  return baharu.id;
}

async function folderRph(sesi, minggu){
  const akar = await cariAtauCiptaFolder('e-RPH AI' + (S.sekolah?.nama ? ' — ' + S.sekolah.nama : ''));
  const thn  = await cariAtauCiptaFolder('Sesi ' + (sesi || new Date().getFullYear()), akar);
  return minggu ? await cariAtauCiptaFolder(minggu, thn) : thn;
}

/* ---------- Muat naik sebagai Google Docs ---------- */
async function naikDokumen(nama, html, folderId){
  const t = await tokenDrive();
  const sempadan = 'erph' + Date.now();
  const meta = { name:nama, mimeType:'application/vnd.google-apps.document',
                 ...(folderId ? { parents:[folderId] } : {}) };
  const badan =
    `--${sempadan}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${sempadan}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${sempadan}--`;
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method:'POST',
    headers:{ 'Authorization':'Bearer '+t, 'Content-Type':`multipart/related; boundary=${sempadan}` },
    body: badan
  });
  const j = await r.json();
  if(!r.ok) throw new Error('Gagal memuat naik: ' + (j.error?.message || r.status));
  return j;
}

/* ================= HALAMAN DRIVE ================= */
function halDrive(){
  const minggu = janaMinggu(S.takwim).filter(m => m.no);
  const hariIni = tarikhISO();
  const mggIni = minggu.find(m => hariIni >= m.mula && hariIni <= m.tamat);
  const rekod = JSON.parse(localStorage.getItem('erph_drive_log') || '[]');
  $('#kandungan').innerHTML = `
    ${!driveSedia() ? (S.peranan === 'pemilik' ? kadPanduanDrive() : kadBelumSedia()) : `
    <div class="kad">
      <div class="kad-h"><h3>Simpan RPH ke Google Drive</h3>
        <span id="dvStatus" class="pil ${'' }kelabu"></span></div>
      <p style="font-size:13px;color:var(--teks-2);line-height:1.6;margin-bottom:13px">
        RPH ditukar menjadi dokumen <b>Google Docs</b> dan disimpan kemas dalam folder
        <code>e-RPH AI › Sesi ${esc(S.sesi||'')} › Minggu</code> pada Drive anda sendiri.
        Dari Drive, guru boleh terus lampirkan pada tugasan Google Classroom.</p>
      <div class="grid2">
        <label class="fld"><span>Minggu persekolahan</span>
          <select id="dvMinggu" onchange="kiraRphDrive()">
            ${minggu.map(m=>`<option value="${m.mula}|${m.tamat}|${esc(m.label)}" ${mggIni&&m.mula===mggIni.mula?'selected':''}>${m.label} (${m.mula} — ${m.tamat})</option>`).join('')}
          </select></label>
        <label class="fld"><span>Gaya dokumen</span>
          <select id="dvGaya">
            <option value="padat">Padat — semua RPH satu dokumen</option>
            <option value="penuh">Lesson Plan penuh — satu muka setiap RPH</option>
          </select></label>
      </div>
      <div id="dvKira" class="kad" style="background:var(--bg);padding:11px;font-size:12.5px;margin-bottom:13px"></div>
      <button class="btn btn-primary btn-block btn-besar" onclick="hantarKeDrive()">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
          <path d="M8 3h8l5 8.5-4 7H7l-4-7z"/><path d="M8 3 3.5 11.5M16 3l-4.5 8.5M3.5 11.5h17"/></svg>
        Simpan ke Google Drive</button>
      <p style="font-size:11.5px;color:var(--teks-3);margin-top:9px;text-align:center">
        Kali pertama, Google akan minta kebenaran akses Drive.</p>
    </div>

    ${rekod.length ? `<div class="kad">
      <div class="kad-h"><h3>Dokumen terkini</h3>
        <button class="btn btn-sm" onclick="kosongkanLogDrive()">Kosongkan senarai</button></div>
      <div class="senarai">${rekod.slice(0,15).map(x=>`
        <div class="baris"><div class="baris-t"><b>${esc(x.nama)}</b>
          <small>${esc(x.masa)}</small></div>
          <button class="btn btn-sm" onclick="salinTeks('${esc(x.pautan)}')">Salin pautan</button>
          <a class="btn btn-sm btn-primary" href="${esc(x.pautan)}" target="_blank" rel="noopener">Buka</a>
        </div>`).join('')}</div>
    </div>` : ''}

    <div class="kad">
      <div class="kad-h"><h3>Cara lampirkan ke Google Classroom</h3></div>
      <div class="senarai" style="font-size:13px">
        ${[['Buka tugasan minggu berkenaan','Contoh: MINGGU 29 dalam kelas e-RPH 2026.'],
           ['Tekan "Add or create" → Google Drive','Dokumen anda ada dalam folder e-RPH AI mengikut sesi dan minggu.'],
           ['Pilih dokumen RPH','Nama fail sudah mengandungi nama guru dan minggu.'],
           ['Tekan "Hand in"','Selesai — tiada muat naik manual, tiada tukar format.']]
          .map((x,i)=>`<div class="baris"><div class="baris-t"><b>${i+1}. ${x[0]}</b>
            <small style="display:block">${x[1]}</small></div></div>`).join('')}
      </div>
    </div>`}`;
  if(driveSedia()){
    kiraRphDrive();
    pramuatGIS().then(() => {
      const el = $('#dvStatus'); if(!el) return;
      if(adaToken()){ el.className = 'pil hijau'; el.textContent = 'Akaun disambung'; }
      else { el.className = 'pil kelabu'; el.textContent = 'Sedia'; }
    }).catch(() => {
      const el = $('#dvStatus'); if(el){ el.className='pil merah'; el.textContent='Pustaka Google gagal dimuat'; }
    });
  }
}

function kadBelumSedia(){
  return `<div class="kad" style="text-align:center;padding:28px">
    <div style="font-size:34px">🔧</div>
    <h3 style="margin:10px 0 6px">Ciri ini belum diaktifkan</h3>
    <p style="font-size:13px;color:var(--teks-2);line-height:1.6">
      Penyelenggara aplikasi belum mengaktifkan simpanan Google Drive.<br>
      Buat sementara, gunakan menu <b>Cetak Mingguan</b> untuk simpan PDF
      dan muat naik ke Classroom seperti biasa.</p>
    <button class="btn" style="margin-top:14px" onclick="pergi('cetak')">Buka Cetak Mingguan</button>
  </div>`;
}

function kadPanduanDrive(){
  return `<div class="kad">
    <div class="kad-h"><h3>Sediakan sambungan Google Drive</h3></div>
    <p style="font-size:13px;color:var(--teks-2);line-height:1.65;margin-bottom:6px">
      <b>Untuk pemilik aplikasi sahaja.</b> Anda buat ini <b>sekali sahaja</b> —
      selepas itu semua guru di semua sekolah hanya perlu tekan butang dan log masuk
      dengan akaun Google mereka sendiri. Tiada tetapan untuk mereka.</p>
    <p style="font-size:12.5px;color:var(--teks-3);line-height:1.6;margin-bottom:14px">
      Client ID bukan kata laluan — ia memang terdedah dalam kod pelayar dan itu selamat.
      Yang melindungi data ialah kebenaran Google setiap pengguna.</p>
    <div class="senarai" style="font-size:13px">
      ${[
        ['Cipta projek','Buka console.cloud.google.com → cipta projek baharu (contoh: e-RPH AI).'],
        ['Aktifkan API','APIs &amp; Services → Library → aktifkan <b>Google Drive API</b> sahaja.'],
        ['Skrin persetujuan','OAuth consent screen → External → isi nama app dan e-mel. Tambah skop <code>drive.file</code>. Tambah e-mel guru sebagai Test user.'],
        ['Cipta Client ID','Credentials → OAuth client ID → Web application. Dalam "Authorized JavaScript origins" masukkan alamat app anda, contoh https://juscinta89-lab.github.io'],
        ['Tampal ke app','Salin Client ID ke <code>js/drive.js</code> pada baris <code>const CLIENT_ID_TERBINA = "..."</code>, kemudian muat naik semula ke GitHub. Siap — semua guru terus boleh guna.'],
        ['Terbitkan app','OAuth consent screen → tekan <b>Publish app</b>. Semasa dalam mod Testing, hanya 100 akaun yang ditambah sebagai Test user boleh guna.']
      ].map((x,i)=>`<div class="baris"><div class="baris-t"><b>${i+1}. ${x[0]}</b>
        <small style="display:block;margin-top:2px">${x[1]}</small></div></div>`).join('')}
    </div>
    <p style="font-size:12px;color:var(--teks-2);background:var(--ungu-t);padding:11px;border-radius:9px;margin-top:14px;line-height:1.6">
      Hanya skop <b>drive.file</b> digunakan — aplikasi cuma nampak fail yang ia cipta sendiri,
      bukan dokumen lain dalam Drive anda.</p>
  </div>`;
}

function rphMingguDrive(){
  const [m1,m2] = ($('#dvMinggu')?.value||'|').split('|');
  return S.rph.filter(r => r.tarikh >= m1 && r.tarikh <= m2)
              .sort((a,b)=> (a.tarikh+(a.mula||'')).localeCompare(b.tarikh+(b.mula||'')));
}
function kiraRphDrive(){
  const senarai = rphMingguDrive();
  const draf = senarai.filter(r=>r.status!=='lengkap').length;
  const el = $('#dvKira'); if(!el) return;
  el.innerHTML = senarai.length
    ? `<b>${senarai.length} RPH</b> akan dimasukkan${draf?` · <span style="color:var(--kuning)">${draf} masih draf</span>`:' · semua lengkap'}`
    : '<span style="color:var(--merah)">Tiada RPH untuk minggu ini</span>';
}

function hantarKeDrive(){
  const senarai = rphMingguDrive();
  if(!senarai.length) return toast('Tiada RPH untuk minggu ini','salah');
  const [,,label] = $('#dvMinggu').value.split('|');
  const gaya = $('#dvGaya').value;

  /* Popup Google MESTI dibuka terus dalam klik ini — jangan letak await sebelumnya */
  const tok = adaToken() ? Promise.resolve(_tokenGoogle) : mintaTokenSegera();
  tok.then(() => teruskanMuatNaik(senarai, label, gaya))
     .catch(e => modal('Gagal menyambung', `
        <p style="font-size:13.5px;color:var(--merah);line-height:1.6">${esc(e.message)}</p>
        <p style="font-size:12.5px;color:var(--teks-2);margin-top:10px">
          Jika popup tidak muncul, benarkan pop-up untuk laman ini dalam tetapan pelayar,
          kemudian cuba sekali lagi.</p>`));
}

async function teruskanMuatNaik(senarai, label, gaya){
  try{
    sibuk(true,'Menyediakan dokumen…');
    const html = dokumenDrive(senarai, gaya);
    sibuk(true,'Menyediakan folder dalam Drive…');
    const folder = await folderRph(S.sesi, label);
    const nama = `RPH ${label} — ${S.profil.nama||''}`.trim().slice(0,120);
    sibuk(true,'Memuat naik dokumen…');
    const fail = await naikDokumen(nama, html, folder);
    const rekod = JSON.parse(localStorage.getItem('erph_drive_log') || '[]');
    rekod.unshift({ nama:fail.name, pautan:fail.webViewLink, masa:new Date().toLocaleString('ms-MY') });
    localStorage.setItem('erph_drive_log', JSON.stringify(rekod.slice(0,30)));
    sibuk(false);
    if($('#dvStatus')){ $('#dvStatus').className='pil hijau'; $('#dvStatus').textContent='Akaun disambung'; }
    modal('Tersimpan dalam Drive', `
      <p style="font-size:13.5px;color:var(--teks-2);line-height:1.65">
        <b>${senarai.length} RPH</b> disimpan sebagai Google Docs dalam folder
        <code>e-RPH AI › Sesi ${esc(S.sesi||'')} › ${esc(label)}</code>.</p>
      <div class="toolbar" style="margin-top:14px">
        <a class="btn btn-primary" href="${esc(fail.webViewLink)}" target="_blank" rel="noopener">Buka dokumen</a>
        <button class="btn" onclick="salinTeks('${esc(fail.webViewLink)}')">Salin pautan</button>
      </div>
      <p style="font-size:12.5px;color:var(--teks-2);margin-top:13px;line-height:1.6">
        Untuk hantar ke Classroom: buka tugasan minggu berkenaan → <b>Add or create</b> →
        <b>Google Drive</b> → pilih dokumen ini → <b>Hand in</b>.</p>`,
      `<button class="btn btn-primary" onclick="tutupModal();pergi('drive')">Selesai</button>`);
  }catch(e){
    sibuk(false);
    modal('Gagal menyimpan', `<p style="font-size:13.5px;color:var(--merah);line-height:1.6">${esc(e.message)}</p>
      <p style="font-size:12.5px;color:var(--teks-2);margin-top:10px">
        Anda masih boleh cetak RPH sebagai PDF dan muat naik ke Classroom seperti biasa.</p>`);
  }
}

/* Simpan RPH tunggal terus dari editor — satu klik */
function simpanRphKeDrive(){
  if(!driveSedia()) return toast('Ciri Drive belum diaktifkan','salah');
  const r = { ...S.rph.find(x => x.id === S.editRphId), ...bacaEditor() };
  const tok = adaToken() ? Promise.resolve(_tokenGoogle) : mintaTokenSegera();
  tok.then(async () => {
    try{
      sibuk(true,'Menyimpan ke Drive…');
      const html = dokumenDrive([r], gayaCetak());
      const folder = await folderRph(S.sesi, r.minggu || '');
      const nama = `RPH ${r.subjek} ${r.kelas} — ${r.tarikh}`.slice(0,120);
      const fail = await naikDokumen(nama, html, folder);
      const log = JSON.parse(localStorage.getItem('erph_drive_log') || '[]');
      log.unshift({ nama:fail.name, pautan:fail.webViewLink, masa:new Date().toLocaleString('ms-MY') });
      localStorage.setItem('erph_drive_log', JSON.stringify(log.slice(0,30)));
      sibuk(false);
      modal('Tersimpan dalam Drive', `
        <p style="font-size:13.5px;color:var(--teks-2);line-height:1.6">
          <b>${esc(fail.name)}</b> disimpan dalam folder e-RPH AI.</p>
        <div class="toolbar" style="margin-top:12px">
          <a class="btn btn-primary" href="${esc(fail.webViewLink)}" target="_blank" rel="noopener">Buka dokumen</a>
          <button class="btn" onclick="salinTeks('${esc(fail.webViewLink)}')">Salin pautan</button></div>`,
        `<button class="btn btn-primary" onclick="tutupModal()">Selesai</button>`);
    }catch(e){ sibuk(false); toast(e.message,'salah'); }
  }).catch(e => toast(e.message,'salah'));
}

function salinTeks(t){
  navigator.clipboard?.writeText(t).then(()=>toast('Pautan disalin','jaya')).catch(()=>toast('Gagal menyalin','salah'));
}
function kosongkanLogDrive(){
  localStorage.removeItem('erph_drive_log'); pergi('drive'); toast('Senarai dikosongkan');
}

/* Bina HTML dokumen menggunakan templat cetakan sedia ada */
function dokumenDrive(senarai, gaya){
  const asal = localStorage.getItem('erph_gaya_cetak');
  localStorage.setItem('erph_gaya_cetak', gaya);
  let badan = '';
  if(gaya === 'penuh'){
    const akhirHari = {}; senarai.forEach((r,i)=> akhirHari[r.tarikh] = i);
    badan = senarai.map((r,i)=> `<div>${htmlRph(r, akhirHari[r.tarikh] === i)}</div>`)
                   .join('<br style="page-break-before:always">');
  }else{
    let hari = '', n = 0;
    senarai.forEach(r => {
      if(r.tarikh !== hari){ if(hari) badan += semakanHari(); badan += kepalaHari(r.tarikh); hari = r.tarikh; n = 0; }
      badan += htmlRphPadat(r, ++n);
    });
    badan += semakanHari();
  }
  if(asal) localStorage.setItem('erph_gaya_cetak', asal);
  const semua = [...document.styleSheets].map(ss => { try{ return [...ss.cssRules].map(x=>x.cssText).join('\n'); }catch(e){ return ''; } }).join('\n');
  const cetak = (semua.match(/@media print\{[\s\S]*?\n\}/) || [''])[0].replace(/^@media print\{/,'').replace(/\}$/,'');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:9pt}
    ${cetak}
  </style></head><body>${badan}</body></html>`;
}
