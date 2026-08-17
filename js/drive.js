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
const CLIENT_ID_TERBINA = "";   // <-- tampal Client ID anda di sini
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

/* ---------- Penjanaan PDF (kekal format asal) ---------- */
function muatPustaka(url, nama){
  return new Promise((selesai, gagal) => {
    if(window[nama]) return selesai(window[nama]);
    const sk = document.createElement('script');
    sk.src = url;
    sk.onload = () => window[nama] ? selesai(window[nama]) : gagal(new Error('Pustaka '+nama+' gagal dimuat'));
    sk.onerror = () => gagal(new Error('Gagal memuat '+nama+'. Semak sambungan internet.'));
    document.head.appendChild(sk);
  });
}

/* Ukuran A4 pada 96 DPI */
const A4_LEBAR_PX = 794, A4_TINGGI_PX = 1123;

async function jadikanPdf(html, lapor){
  lapor?.('Memuat pustaka PDF…');
  await muatPustaka('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
  await muatPustaka('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
  const { jsPDF } = window.jspdf;

  // Bingkai tersembunyi seluas A4 supaya susun atur sama seperti cetakan
  const bingkai = document.createElement('iframe');
  bingkai.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_LEBAR_PX}px;height:${A4_TINGGI_PX}px;border:0`;
  document.body.appendChild(bingkai);
  try{
    const d = bingkai.contentDocument;
    d.open(); d.write(html); d.close();
    await new Promise(r => setTimeout(r, 350));            // beri masa imej & fon dimuat
    if(d.fonts?.ready) await d.fonts.ready;

    lapor?.('Menyusun halaman…');
    const kanvas = await window.html2canvas(d.body, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      windowWidth: A4_LEBAR_PX, width: A4_LEBAR_PX
    });

    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const lebarMm = 210, tinggiMm = 297;
    const nisbah = kanvas.width / A4_LEBAR_PX;              // faktor skala kanvas
    const tinggiHalamanKanvas = Math.floor(A4_TINGGI_PX * nisbah);
    const jumlahHalaman = Math.max(1, Math.ceil(kanvas.height / tinggiHalamanKanvas));

    for(let i = 0; i < jumlahHalaman; i++){
      lapor?.(`Menjana halaman ${i+1}/${jumlahHalaman}…`);
      const tinggiPotong = Math.min(tinggiHalamanKanvas, kanvas.height - i*tinggiHalamanKanvas);
      const potong = document.createElement('canvas');
      potong.width = kanvas.width; potong.height = tinggiPotong;
      const ctx = potong.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,potong.width,potong.height);
      ctx.drawImage(kanvas, 0, i*tinggiHalamanKanvas, kanvas.width, tinggiPotong,
                            0, 0, kanvas.width, tinggiPotong);
      if(i) pdf.addPage();
      pdf.addImage(potong.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0,
                   lebarMm, (tinggiPotong / nisbah) * (tinggiMm / A4_TINGGI_PX), '', 'FAST');
    }
    return pdf.output('blob');
  } finally {
    bingkai.remove();
  }
}

/* ---------- Muat naik fail ke Drive ---------- */
async function naikPdf(nama, blob, folderId){
  const t = await tokenDrive();
  const b = 'erph' + Date.now();
  const meta = { name:nama, mimeType:'application/pdf', ...(folderId ? { parents:[folderId] } : {}) };
  const awal = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/pdf\r\n\r\n`;
  const akhir = `\r\n--${b}--`;
  const badan = new Blob([awal, blob, akhir], { type:`multipart/related; boundary=${b}` });
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method:'POST', headers:{ 'Authorization':'Bearer '+t }, body: badan
  });
  const j = await r.json();
  if(!r.ok) throw new Error('Gagal memuat naik: ' + (j.error?.message || r.status));
  return j;
}

/* ---------- Muat naik sebagai Google Docs (pilihan) ---------- */
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
            <option value="padat">Padat — semua RPH mengalir</option>
            <option value="penuh">Lesson Plan penuh — satu muka setiap RPH</option>
          </select></label>
      </div>
      <div class="grid2">
        <label class="fld"><span>Format fail</span>
          <select id="dvFormat">
            <option value="pdf">PDF — kekal format cetakan (disyorkan)</option>
            <option value="doc">Google Docs — boleh diedit, susun atur mungkin berubah</option>
          </select></label>
      </div>
      <div id="dvKira" class="kad" style="background:var(--bg);padding:11px;font-size:12.5px;margin-bottom:13px"></div>
      <button class="btn btn-primary btn-block btn-besar" onclick="hantarKeDrive()">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
          <path d="M8 3h8l5 8.5-4 7H7l-4-7z"/><path d="M8 3 3.5 11.5M16 3l-4.5 8.5M3.5 11.5h17"/></svg>
        Simpan ke Google Drive</button>
      <p style="font-size:11.5px;color:var(--teks-3);margin-top:9px;text-align:center;line-height:1.5">
        Kali pertama, Google akan minta kebenaran akses Drive.<br>
        PDF dijana dalam peranti anda — RPH banyak mungkin ambil beberapa saat.</p>
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
  const format = $('#dvFormat')?.value || 'pdf';
  try{
    sibuk(true,'Menyediakan dokumen…');
    const html = dokumenDrive(senarai, gaya, format !== 'pdf');
    const nama = `RPH ${label} — ${S.profil.nama||''}`.trim().slice(0,120);
    let fail;
    if(format === 'pdf'){
      const blob = await jadikanPdf(html, m => sibuk(true, m));
      sibuk(true,'Menyediakan folder dalam Drive…');
      const folder = await folderRph(S.sesi, label);
      sibuk(true,'Memuat naik PDF…');
      fail = await naikPdf(nama + '.pdf', blob, folder);
    }else{
      sibuk(true,'Menyediakan folder dalam Drive…');
      const folder = await folderRph(S.sesi, label);
      sibuk(true,'Memuat naik dokumen…');
      fail = await naikDokumen(nama, html, folder);
    }
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
      const html = dokumenDrive([r], gayaCetak());
      const blob = await jadikanPdf(html, m => sibuk(true, m));
      sibuk(true,'Memuat naik ke Drive…');
      const folder = await folderRph(S.sesi, r.minggu || '');
      const nama = `RPH ${r.subjek} ${r.kelas} — ${r.tarikh}.pdf`.slice(0,120);
      const fail = await naikPdf(nama, blob, folder);
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

/* ================= PENJANA PDF =================
   RPH dirender dalam iframe tersembunyi bersaiz A4 dengan CSS cetakan sebenar,
   kemudian ditangkap sebagai imej dan disusun ke dalam PDF berbilang muka surat.
   Hasilnya sama persis dengan pratonton cetakan. */

let _pdfSedia = null;
function muatPustakaPdf(){
  if(_pdfSedia) return _pdfSedia;
  const muat = src => new Promise((ok, gagal) => {
    const sk = document.createElement('script');
    sk.src = src; sk.onload = ok;
    sk.onerror = () => gagal(new Error('Gagal memuat pustaka PDF: ' + src));
    document.head.appendChild(sk);
  });
  _pdfSedia = Promise.all([
    window.html2canvas ? Promise.resolve() : muat('lib/html2canvas.min.js'),
    window.jspdf ? Promise.resolve() : muat('lib/jspdf.umd.min.js')
  ]);
  return _pdfSedia;
}

const A4_LEBAR_MM = 210, A4_TINGGI_MM = 297;

async function binaPdf(html, lapor){
  await muatPustakaPdf();
  const { jsPDF } = window.jspdf;

  // Iframe tersembunyi bersaiz A4 (96dpi: 210mm ≈ 794px)
  const bingkai = document.createElement('iframe');
  bingkai.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden';
  document.body.appendChild(bingkai);
  try{
    const d = bingkai.contentDocument;
    d.open();
    d.write(html.replace('</head>',
      `<style>
        html,body{margin:0;padding:0;background:#fff;width:794px}
        body{padding:34px 38px}   /* margin cetakan ~9mm/10mm */
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      </style></head>`));
    d.close();
    await new Promise(r => setTimeout(r, 350));            // tunggu susun atur & imej
    const imej = [...d.images].map(i => i.complete ? null : new Promise(ok => { i.onload = i.onerror = ok; }));
    await Promise.all(imej.filter(Boolean));

    const badan = d.body;
    const skala = 2;                                        // ketajaman 2x
    lapor?.('Merender halaman…');
    const kanvas = await html2canvas(badan, {
      scale: skala, backgroundColor:'#fff', logging:false,
      windowWidth: 794, width: 794, height: badan.scrollHeight, useCORS:true
    });

    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
    const lebarPx = kanvas.width;
    const tinggiMukaPx = Math.floor(lebarPx * (A4_TINGGI_MM / A4_LEBAR_MM));   // nisbah A4
    const jumMuka = Math.max(1, Math.ceil(kanvas.height / tinggiMukaPx));

    for(let i = 0; i < jumMuka; i++){
      lapor?.(`Menyusun muka surat ${i+1}/${jumMuka}…`);
      const tinggiPotong = Math.min(tinggiMukaPx, kanvas.height - i * tinggiMukaPx);
      const potong = document.createElement('canvas');
      potong.width = lebarPx; potong.height = tinggiPotong;
      potong.getContext('2d').drawImage(kanvas, 0, i * tinggiMukaPx, lebarPx, tinggiPotong,
                                                0, 0, lebarPx, tinggiPotong);
      const tinggiMm = (tinggiPotong / lebarPx) * A4_LEBAR_MM;
      if(i) pdf.addPage();
      pdf.addImage(potong.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_LEBAR_MM, tinggiMm, undefined, 'FAST');
    }
    return { blob: pdf.output('blob'), muka: jumMuka };
  } finally {
    bingkai.remove();
  }
}

/* Bina HTML dokumen menggunakan templat cetakan sedia ada */
/* Google Docs membuang hampir semua CSS berasaskan kelas semasa import HTML.
   Warna latar terselamat kerana ia inline pada elemen, tetapi sempadan jadual
   yang datang daripada .pd-tbl td hilang sepenuhnya. Penyelesaiannya ialah
   menyalin gaya penting terus ke atribut style setiap elemen sebelum dihantar. */
const GAYA_DRIVE = [
  ['table.pd-tbl, table.lp-tbl',
   'border-collapse:collapse;width:100%;border:1px solid #444;table-layout:fixed'],
  ['table.pd-tbl > tbody > tr > td, table.pd-tbl > tbody > tr > th',
   'border:1px solid #444;padding:3px 5px;vertical-align:top;font-size:9pt;word-wrap:break-word'],
  ['table.lp-tbl > tbody > tr > td, table.lp-tbl > tbody > tr > th',
   'border:1px solid #444;padding:4px 6px;vertical-align:top;font-size:9.5pt;word-wrap:break-word'],
  ['.pd-tbl th, .lp-tbl th', 'font-weight:700;text-align:left'],
  ['.pd-band td, .lp-band td', 'font-weight:700;letter-spacing:.2px'],
  ['.pd-sek, .lp-seksyen',
   'background:#f0f0f0;border-bottom:1px solid #444;font-weight:700;font-size:8.5pt;padding:3px 5px'],
  ['.pd-isi2, .lp-isi', 'padding:3px 5px;border-bottom:1px solid #444'],
  ['.pd-ref, .lp-refleksi', 'background:#fdf6e6;font-size:8.5pt;line-height:1.4'],
  ['.pd-hari td', 'background:#f5b301;font-weight:600'],
  ['.pd-tbl table, .lp-tbl table', 'border-collapse:collapse;width:100%;border:0'],
  ['.pd-tbl table td, .lp-tbl table td', 'border:1px solid #444;padding:3px 5px'],
  ['.cetak-nota', 'font-size:8pt;color:#777;text-align:right;margin-top:4px'],
  ['.pd-tbl ol, .pd-tbl ul, .lp-tbl ol, .lp-tbl ul', 'margin:2px 0;padding-left:16px'],
  ['.pd-tbl p, .lp-tbl p', 'margin:2px 0']
];

function inlineGayaDrive(html){
  const bekas = document.createElement('div');
  bekas.innerHTML = html;
  for(const [pemilih, gaya] of GAYA_DRIVE){
    let elemen;
    try{ elemen = bekas.querySelectorAll(pemilih); }catch(e){ continue; }
    elemen.forEach(el => {
      // Gaya inline sedia ada (cth. warna latar kepala) mesti menang
      el.setAttribute('style', gaya + ';' + (el.getAttribute('style') || ''));
    });
  }
  // Bahagian terakhir dalam sel tidak perlu garisan bawah — sempadan sel sudah ada
  bekas.querySelectorAll('td > .pd-isi2:last-child, td > .pd-sek:last-child, td > .lp-isi:last-child, td > .lp-seksyen:last-child')
    .forEach(el => el.style.borderBottom = '0');
  // Sel kosong boleh runtuh dan kehilangan sempadan dalam Docs
  bekas.querySelectorAll('td, th').forEach(el => {
    if(!el.textContent.trim() && !el.children.length) el.innerHTML = '&nbsp;';
  });
  return bekas.innerHTML;
}

function dokumenDrive(senarai, gaya, untukDocs){
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
  // PDF dijana melalui pelayar, jadi helaian gaya memadai.
  // Docs membuang CSS kelas, jadi gaya perlu disalin terus ke elemen.
  if(untukDocs) badan = inlineGayaDrive(badan);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:9pt}
    ${cetak}
  </style></head><body>${badan}</body></html>`;
}
