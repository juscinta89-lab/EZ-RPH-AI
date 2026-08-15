/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* ================= e-RPH AI — DATA & HALAMAN ASAS ================= */

function rujuk(sub){ return db.collection('sekolah').doc(S.sid).collection(sub); }

async function muatData(){
  if(!S.sid) return;
  const [k, sj, jd, bk, tw, ada] = await Promise.all([
    rujuk('kelas').get(),
    rujuk('subjek').get(),
    rujuk('jadual').doc(S.user.email).get(),
    rujuk('buku').get(),
    rujuk('takwim').get(),                                  // semua sesi
    rujuk('rpt').limit(1).get()
  ]);
  S.rptAda = !ada.empty;
  S.senaraiSesi = tw.docs.map(d => ({ id:d.id, ...d.data() }))
                         .sort((a,b)=> (b.mula||b.id||'').localeCompare(a.mula||a.id||''));
  S.kelas  = k.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.subjek = sj.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.jadual = jd.exists ? (jd.data().slot || []) : [];
  S.buku   = bk.docs.map(d => ({id:d.id, ...d.data()}));
  S.takwim = pilihTakwimAktif(S.senaraiSesi);
  S.sesi = S.takwim ? S.takwim.id : null;
  await muatRpt();
  await muatRph();
}

async function muatRph(){
  let q = rujuk('rph');
  q = (S.peranan === 'guru') ? q.where('emel','==',S.user.email) : q;
  const snap = await q.get();
  S.rph = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (b.tarikh||'').localeCompare(a.tarikh||''));
}

/* ---------- Sesi takwim aktif ---------- */
function pilihTakwimAktif(senarai){
  if(!senarai || !senarai.length) return null;
  const hariIni = tarikhISO();
  // sesi yang merangkumi hari ini
  let aktif = senarai.find(t => t.mula && t.tamat && hariIni >= t.mula && hariIni <= t.tamat);
  if(aktif) return aktif;
  // sesi akan datang paling hampir (persediaan awal tahun)
  const akan = senarai.filter(t => t.mula && t.mula > hariIni).sort((a,b)=> a.mula.localeCompare(b.mula));
  if(akan.length) return akan[0];
  // jika tiada, sesi terkini
  return senarai[0];
}
function sesiPilihan(){ return window._sesiPilih || S.sesi || String(new Date().getFullYear()); }
function takwimSesi(id){ return (S.senaraiSesi||[]).find(t => t.id === id) || null; }

/* ---------- RPT (Rancangan Pengajaran Tahunan) ---------- */
/* Semua RPT sekolah dimuat sekali dan dicache dalam peranti.
   Dibaca semula dari Firestore hanya apabila RPT dikemas kini (jimat kuota Spark). */
function norma(t){ return String(t==null?'':t).toLowerCase().replace(/\s+/g,' ').trim(); }

async function muatRpt(){
  if(!S.sid) return;
  const kunci = 'erph_rpt_' + S.sid;
  let meta = 0;
  try{ const m = await rujuk('tetapan').doc('rptMeta').get(); meta = m.exists ? (m.data().dikemas||0) : 0; }catch(e){}
  try{
    const cache = JSON.parse(localStorage.getItem(kunci) || 'null');
    if(cache && cache.meta === meta && Array.isArray(cache.data)){
      S.rpt = cache.data; S.rptAda = S.rpt.length > 0; susunRpt(); return;
    }
  }catch(e){}
  S.rpt = [];
  let last = null;
  for(let pusingan=0; pusingan<5; pusingan++){
    let q = rujuk('rpt').orderBy(firebase.firestore.FieldPath.documentId()).limit(1500);
    if(last) q = q.startAfter(last);
    const snap = await q.get();
    S.rpt.push(...snap.docs.map(d => ({id:d.id, ...d.data()})));
    if(snap.docs.length < 1500) break;
    last = snap.docs[snap.docs.length-1];
  }
  S.rptAda = S.rpt.length > 0; susunRpt();
  try{ localStorage.setItem(kunci, JSON.stringify({ meta, data:S.rpt })); }
  catch(e){ /* cache penuh — abaikan, data tetap dalam memori */ }
}
async function tandaRptBerubah(){
  await rujuk('tetapan').doc('rptMeta').set({ dikemas: Date.now() });
  localStorage.removeItem('erph_rpt_' + S.sid);
}
async function muatRptSubjek(subjek, tahun){
  const sn = norma(subjek), tn = norma(tahun);
  return S.rpt.filter(r => norma(r.subjek) === sn && (!tn || !r.tahun || norma(r.tahun) === tn));
}
function noMinggu(v){ const m = String(v==null?'':v).match(/\d+/); return m ? +m[0] : 999; }
function susunRpt(){ S.rpt.sort((a,b)=> noMinggu(a.minggu) - noMinggu(b.minggu)); }

/* Cari baris RPT untuk sesi tertentu */
function rptUntuk(subjek, tahun, minggu){
  const n = noMinggu(minggu);
  const sn = norma(subjek), tn = norma(tahun);
  const sama = S.rpt.filter(r => norma(r.subjek) === sn && (!tn || !r.tahun || norma(r.tahun) === tn));
  return {
    minggu: sama.filter(r => noMinggu(r.minggu) === n),
    sekitar: sama.filter(r => Math.abs(noMinggu(r.minggu) - n) <= 2 && noMinggu(r.minggu) !== n),
    semua: sama
  };
}

/* ---------- Minggu persekolahan ---------- */
function hariSekolah(tw){
  // Kumpulan A (Ahad–Khamis) atau Kumpulan B (Isnin–Jumaat)
  return (tw && tw.mulaHari === 'isnin') ? [1,2,3,4,5] : [0,1,2,3,4];
}
function janaMinggu(tw){
  if(!tw || !tw.mula || !tw.tamat) return [];
  const hari = hariSekolah(tw);
  const mulaHari = hari[0];
  const d = new Date(tw.mula + 'T00:00:00');
  while(d.getDay() !== mulaHari) d.setDate(d.getDate() - 1);
  const akhir = new Date(tw.tamat + 'T00:00:00');
  const cuti = (tw.cuti || []);
  const dalamCuti = iso => cuti.some(c => iso >= c.mula && iso <= c.tamat);
  const senarai = []; let no = 0, guard = 0;

  while(d <= akhir && guard++ < 80){
    const mula = new Date(d), hujung = new Date(d); hujung.setDate(hujung.getDate() + 6);
    // kumpul hari persekolahan sebenar dalam blok ini
    const hariPdP = [];
    for(let i=0;i<7;i++){
      const x = new Date(mula); x.setDate(x.getDate() + i);
      const iso = tarikhISO(x);
      if(!hari.includes(x.getDay())) continue;              // hujung minggu
      if(iso < tw.mula || iso > tw.tamat) continue;         // luar sesi
      if(dalamCuti(iso)) continue;                          // cuti penggal/perayaan
      hariPdP.push(iso);
    }
    const cutiBlok = cuti.find(c => tarikhISO(mula) <= c.tamat && tarikhISO(hujung) >= c.mula);
    if(!hariPdP.length){
      if(tw.kiraMinggu === 'semua'){
        senarai.push({ no:++no, label:'Minggu '+no+' (cuti)', mula:tarikhISO(mula), tamat:tarikhISO(hujung),
                       hariPdP:0, cuti:cutiBlok ? (cutiBlok.nama||'Cuti') : 'Tiada PdP' });
      }else{
        senarai.push({ no:null, label: cutiBlok ? (cutiBlok.nama||'Cuti') : 'Tiada PdP',
                       mula:tarikhISO(mula), tamat:tarikhISO(hujung), hariPdP:0 });
      }
    }else{
      senarai.push({ no:++no, label:'Minggu '+no, mula:tarikhISO(mula), tamat:tarikhISO(hujung),
                     hariPdP:hariPdP.length, pdpMula:hariPdP[0], pdpTamat:hariPdP[hariPdP.length-1] });
    }
    d.setDate(d.getDate() + 7);
  }
  return senarai;
}
function mingguUntuk(iso){
  const m = janaMinggu(S.takwim).find(w => iso >= w.mula && iso <= w.tamat);
  return m ? m.label : '';
}
function cutiPada(iso){
  if(!S.takwim) return null;
  return (S.takwim.cuti || []).find(c => iso >= c.mula && iso <= c.tamat) || null;
}

/* ---------- Imej: kecilkan dalam browser, simpan sebagai base64 ---------- */
/* Tiada Firebase Storage — kekal pelan Spark. Imej dikecilkan supaya jauh di bawah
   had 1 MB satu dokumen Firestore, dan dicache dalam peranti. */
function kecilkanImej(fail, maksPx, kualiti){
  return new Promise((selesai, gagal) => {
    const r = new FileReader();
    r.onerror = () => gagal(new Error('Gagal membaca fail'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => gagal(new Error('Fail imej tidak sah'));
      img.onload = () => {
        const skala = Math.min(1, maksPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * skala), h = Math.round(img.height * skala);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        // PNG kekalkan latar telus; selain itu JPEG lebih kecil
        const png = /png|webp/i.test(fail.type);
        selesai(c.toDataURL(png ? 'image/png' : 'image/jpeg', kualiti || 0.85));
      };
      img.src = r.result;
    };
    r.readAsDataURL(fail);
  });
}
function saizBase64(d){ return Math.round((d.length * 3 / 4) / 1024); }   // KB

/* Logo sekolah — dikongsi semua guru, disimpan sekali dalam Firestore */
async function muatLogo(){
  if(!S.sid) return;
  const cacheKey = 'erph_logo_' + S.sid;
  const cache = localStorage.getItem(cacheKey);
  if(cache){ S.logo = cache; return; }
  try{
    const d = await rujuk('tetapan').doc('logo').get();
    if(d.exists && d.data().data){
      S.logo = d.data().data;
      try{ localStorage.setItem(cacheKey, S.logo); }catch(e){}
    }
  }catch(e){}
}
async function simpanLogo(dataUrl){
  S.logo = dataUrl;
  try{ localStorage.setItem('erph_logo_' + S.sid, dataUrl); }catch(e){}
  await rujuk('tetapan').doc('logo').set({ data:dataUrl, dikemas:Date.now(), oleh:S.user.email });
}
async function padamLogo(){
  S.logo = '';
  localStorage.removeItem('erph_logo_' + S.sid);
  await rujuk('tetapan').doc('logo').delete().catch(()=>{});
}

/* Tandatangan guru — peribadi, simpan dalam peranti sahaja */
function tandatanganSaya(){ return localStorage.getItem('erph_ttd_' + S.user.email) || ''; }

/* ---------- Helper CSV ---------- */
function parseCSV(teks){
  const baris = teks.replace(/\r/g,'').split('\n').filter(x => x.trim());
  return baris.map(b => {
    const sel = []; let cur = '', dlm = false;
    for(let i=0;i<b.length;i++){
      const c = b[i];
      if(c === '"'){ if(dlm && b[i+1] === '"'){ cur += '"'; i++; } else dlm = !dlm; }
      else if((c === ',' || c === ';' || c === '\t') && !dlm){ sel.push(cur); cur = ''; }
      else cur += c;
    }
    sel.push(cur); return sel.map(x => x.trim());
  });
}
/* Terima .xlsx / .xls / .csv / .txt — Excel ditukar auto kepada CSV */
function pilihFail(terima, fn){
  const i = document.createElement('input'); i.type = 'file';
  i.accept = (terima || '') + ',.xlsx,.xls';
  i.onchange = () => {
    const f = i.files[0]; if(!f) return;
    const excel = /\.(xlsx|xls)$/i.test(f.name);
    const r = new FileReader();
    r.onload = () => {
      if(!excel) return fn(r.result, f.name);
      if(typeof XLSX === 'undefined') return toast('Pustaka Excel gagal dimuat. Guna CSV.','salah');
      try{
        const wb = XLSX.read(new Uint8Array(r.result), { type:'array' });
        fn(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]), f.name);
      }catch(e){ toast('Gagal membaca fail Excel','salah'); }
    };
    excel ? r.readAsArrayBuffer(f) : r.readAsText(f);
  };
  i.click();
}

/* Muat turun templat Excel */
function templatExcel(namaFail, kepala, contoh){
  if(typeof XLSX === 'undefined') return toast('Pustaka Excel belum dimuat','salah');
  const ws = XLSX.utils.aoa_to_sheet([kepala, ...(contoh||[])]);
  ws['!cols'] = kepala.map(k => ({ wch: Math.max(14, k.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, namaFail);
  toast('Templat dimuat turun','jaya');
}
const TEMPLAT = {
  kelas:  ['nama_kelas','tahun_tingkatan','bilangan_murid','tahap','nota'],
  subjek: ['nama_subjek','kod','peringkat'],
  rpt:    ['minggu','tahun_tingkatan','subjek','tema_bidang','tajuk_kemahiran','kod_sk','standard_kandungan','kod_sp','standard_pembelajaran','tp','catatan'],
  buku:   ['tahun','subjek','buku','bab','unit','tajuk','kandungan'],
  cuti:   ['nama','mula','tamat'],
  jadual: ['hari','masa_mula','masa_tamat','subjek','kelas','bilik','catatan']
};

/* ================= DASHBOARD ================= */
function halDashboard(){
  const hariIni = tarikhISO();
  const hari = namaHari(hariIni);
  const slotHariIni = S.jadual.filter(s => s.hari === hari).sort((a,b)=> a.mula.localeCompare(b.mula));
  const mgg = mingguUntuk(hariIni);
  const cuti = cutiPada(hariIni);
  const minggu = janaMinggu(S.takwim).find(w => hariIni >= w.mula && hariIni <= w.tamat);
  const rphMinggu = minggu ? S.rph.filter(r => r.tarikh >= minggu.mula && r.tarikh <= minggu.tamat) : [];
  const lengkap = rphMinggu.filter(r => r.status === 'lengkap').length;
  const draf = rphMinggu.filter(r => r.status === 'draf').length;

  const perluSetup = !S.jadual.length || !S.kelas.length || !S.subjek.length || !S.takwim;

  $('#kandungan').innerHTML = `
    ${S.langganPeringatan ? `<div class="kad" style="background:#fdf3dd;border-color:#f0dcae;margin-bottom:14px">
      <b style="font-size:13.5px">⏳ Langganan anda berbaki ${S.langganPeringatan.baki} hari</b>
      <p style="font-size:12.5px;color:#8a6106;margin-top:4px">Tamat pada ${esc(S.langganPeringatan.tarikh)}. Hubungi pentadbir untuk melanjutkan supaya akses tidak terputus.</p>
    </div>` : ''}
    ${perluSetup ? kadWizard() : ''}
    <div class="hero">
      <h3>Selamat datang, ${esc((S.profil.nama||'Cikgu').split(' ').slice(0,2).join(' '))} 👋</h3>
      <p>${tarikhCantik(hariIni)} · ${mgg || 'Takwim belum ditetapkan'}${cuti ? ' · '+esc(cuti.nama) : ''}</p>
      <button class="btn" onclick="pergi('jana')">✨ Jana RPH hari ini</button>
    </div>

    <div class="stat-grid">
      <div class="stat b"><b>${rphMinggu.length}</b><small>RPH minggu ini</small></div>
      <div class="stat h"><b>${lengkap}</b><small>Lengkap</small></div>
      <div class="stat k"><b>${draf}</b><small>Draf</small></div>
      <div class="stat m"><b>${Math.max(0, slotHariIni.length - S.rph.filter(r=>r.tarikh===hariIni).length)}</b><small>Belum disediakan hari ini</small></div>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Hari ini · ${hari.toUpperCase()}</h3><small>${slotHariIni.length} slot PdP</small>
        ${S.rph.some(r=>r.tarikh===hariIni)?`<button class="btn btn-sm" onclick="cetakHari('${hariIni}')">🖨️ Cetak semua</button>`:''}</div>
      ${cuti ? `<div class="kosong"><b>${esc(cuti.nama)}</b>Tiada sesi PdP pada tarikh ini.</div>`
        : slotHariIni.length ? slotHariIni.map(s => {
        const ada = S.rph.find(r => r.tarikh === hariIni && r.slotId === s.id);
        return `<div class="slot">
          <div class="slot-masa">${esc(s.mula)}<br>${esc(s.tamat)}</div>
          <div class="slot-info"><b>${esc(s.subjek)}</b><small>${esc(s.kelas)} · ${minit(s.mula,s.tamat)} minit</small></div>
          ${ada ? `<span class="pil ${ada.status==='lengkap'?'hijau':'kuning'}">${ada.status==='lengkap'?'Lengkap':'Draf'}</span>
                  <button class="btn btn-sm" onclick="bukaRph('${ada.id}')">Buka</button>`
                : `<button class="btn btn-sm btn-primary" onclick="janaSlot('${s.id}','${hariIni}')">✨ Jana RPH</button>`}
        </div>`; }).join('')
        : `<div class="kosong"><b>Tiada slot pada hari ini</b>Tambah jadual waktu untuk melihat sesi PdP anda.<br><br><button class="btn btn-primary btn-sm" onclick="pergi('jadual')">Tetapkan jadual waktu</button></div>`}
    </div>

    <div class="kad">
      <div class="kad-h"><h3>RPH terkini</h3><button class="btn btn-sm" onclick="pergi('rph')">Lihat semua</button></div>
      ${S.rph.length ? `<div class="senarai">${S.rph.slice(0,5).map(barisRph).join('')}</div>`
        : `<div class="kosong"><b>Belum ada RPH</b>Jana RPH pertama anda dengan AI.</div>`}
    </div>`;
}

function kadWizard(){
  const langkah = [
    ['Profil guru', !!(S.profil && S.profil.nama), 'tetapan'],
    ['Maklumat sekolah', !!(S.sekolah && S.sekolah.nama), 'admin'],
    ['Kelas', S.kelas.length > 0, 'kelas'],
    ['Subjek', S.subjek.length > 0, 'subjek'],
    ['Jadual waktu', S.jadual.length > 0, 'jadual'],
    ['Takwim persekolahan', !!S.takwim, 'takwim'],
    ['RPT (Rancangan Pengajaran Tahunan)', !!S.rptAda, 'rpt'],
    ['Buku teks (pilihan)', S.buku.length > 0, 'buku']
  ];
  const siap = langkah.filter(l => l[1]).length;
  return `<div class="kad">
    <div class="kad-h"><h3>Persediaan awal</h3><small>${siap}/${langkah.length} selesai</small></div>
    <div class="progress"><i style="width:${siap/langkah.length*100}%"></i></div>
    ${langkah.map((l,i)=>`<div class="wiz-step ${l[1]?'siap':''}">
      <div class="wiz-no">${l[1]?'✓':i+1}</div><b>${l[0]}</b>
      <button class="btn btn-sm" onclick="pergi('${l[2]}')">${l[1]?'Semak':'Tetapkan'}</button></div>`).join('')}
  </div>`;
}

/* ================= KELAS ================= */
function halKelas(){
  $('#kandungan').innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" onclick="formKelas()">+ Tambah kelas</button>
      <button class="btn" onclick="importKelas()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-kelas.xlsx',TEMPLAT.kelas,[['Tahun 1 Iltizam','Tahun 1',28,'Campuran','']])">⬇️ Templat Excel</button>
    </div>
    ${S.kelas.length ? `<div class="kad-grid">${S.kelas.map(k => {
      const t = warnaTahap(k.tahap);
      const th = (k.tahun || k.nama || '').match(/\d+/);
      return `<div class="item-kad" style="--w:${t.warna};--wt:${t.tint}">
        <div class="item-atas">
          <span class="item-avatar">${th?th[0]:(k.nama||'?')[0]}</span>
          <div class="item-txt"><b>${esc(k.nama)}</b>
            <small>${k.bilangan||0} murid</small></div>
          <span class="pil" style="background:${t.tint};color:${t.warna}">${esc(k.tahap||'—')}</span>
        </div>
        ${k.nota?`<p class="item-nota">${esc(k.nota)}</p>`:''}
        <div class="item-btm">
          <button class="btn btn-sm" onclick="formKelas('${k.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="hapusItem('kelas','${k.id}')">Padam</button>
        </div></div>`;}).join('')}</div>`
      : `<div class="kosong"><b>Belum ada kelas</b>Tambah kelas yang anda ajar, contoh: Tahun 6 Amanah.</div>`}`;
}
function warnaTahap(t){
  const n = norma(t||'');
  if(/cemerlang|tinggi/.test(n))  return { warna:'#16a37b', tint:'#e4f6ef' };
  if(/sederhana/.test(n))          return { warna:'#e0a010', tint:'#fdf3dd' };
  if(/rendah|lemah|pemulihan/.test(n)) return { warna:'#dc4d4d', tint:'#fdeaea' };
  if(/campur/.test(n))             return { warna:'#1f6df5', tint:'#e6effe' };
  return { warna:'#6a1ed6', tint:'#f2ebfe' };
}

function formKelas(id){
  const k = S.kelas.find(x => x.id === id) || {};
  modal(id ? 'Edit kelas' : 'Tambah kelas', `
    <label class="fld"><span>Nama kelas</span><input id="fkNama" value="${esc(k.nama||'')}" placeholder="Tahun 6 Amanah"></label>
    <div class="grid2">
      <label class="fld"><span>Tahun / Tingkatan</span><input id="fkTahun" value="${esc(k.tahun||'')}" placeholder="Tahun 6"></label>
      <label class="fld"><span>Bilangan murid</span><input id="fkBil" type="number" value="${k.bilangan||''}" placeholder="32"></label>
    </div>
    <label class="fld"><span>Tahap kelas</span><select id="fkTahap">
      ${['Cemerlang','Sederhana','Rendah','Campuran'].map(t=>`<option ${k.tahap===t?'selected':''}>${t}</option>`).join('')}
    </select></label>
    <label class="fld"><span>Nota guru</span><textarea id="fkNota" placeholder="Cth: 5 murid perlu pemulihan bacaan">${esc(k.nota||'')}</textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanKelas('${id||''}')">Simpan</button>`);
}
async function simpanKelas(id){
  const d = { nama:$('#fkNama').value.trim(), tahun:$('#fkTahun').value.trim(), bilangan:+$('#fkBil').value||0,
              tahap:$('#fkTahap').value, nota:$('#fkNota').value.trim() };
  if(!d.nama) return toast('Nama kelas diperlukan','salah');
  sibuk(true,'Menyimpan…');
  id ? await rujuk('kelas').doc(id).update(d) : await rujuk('kelas').add(d);
  await muatData(); sibuk(false); tutupModal(); pergi('kelas'); toast('Kelas disimpan','jaya');
}

function importKelas(){
  pilihFail('.csv,.txt', async teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /nama|kelas/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r[0] && r[0].trim());
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    sibuk(true,'Mengimport '+rows.length+' kelas…');
    const b = db.batch(); let tambah = 0;
    rows.forEach(r => {
      const nama = r[0].trim();
      if(S.kelas.some(k => k.nama.toLowerCase() === nama.toLowerCase())) return;
      b.set(rujuk('kelas').doc(), { nama, tahun:(r[1]||'').trim(), bilangan:+(r[2]||0)||0,
        tahap:(r[3]||'Campuran').trim(), nota:(r[4]||'').trim() });
      tambah++;
    });
    await b.commit(); await muatData(); sibuk(false); pergi('kelas');
    toast(tambah+' kelas diimport'+(rows.length-tambah?', '+(rows.length-tambah)+' dilangkau (sudah ada)':''),'jaya');
  });
}

function importSubjek(){
  pilihFail('.csv,.txt', async teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /nama|subjek/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r[0] && r[0].trim());
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    sibuk(true,'Mengimport…');
    const b = db.batch(); let tambah = 0;
    rows.forEach(r => {
      const nama = r[0].trim();
      if(S.subjek.some(x => x.nama.toLowerCase() === nama.toLowerCase())) return;
      b.set(rujuk('subjek').doc(), { nama, kod:(r[1]||'').trim(), peringkat:(r[2]||'Rendah').trim() });
      tambah++;
    });
    await b.commit(); await muatData(); sibuk(false); pergi('subjek'); toast(tambah+' subjek diimport','jaya');
  });
}

function importJadual(){
  pilihFail('.csv,.txt', async teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /hari/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r.length >= 5 && r[0] && r[1]);
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    const jam = t => { const m = String(t).match(/(\d{1,2})[:.](\d{2})/); return m ? String(m[1]).padStart(2,'0')+':'+m[2] : ''; };
    const baru = rows.map(r => ({ id:uid(), hari:r[0].trim(), mula:jam(r[1]), tamat:jam(r[2]),
      subjek:(r[3]||'').trim(), kelas:(r[4]||'').trim(), bilik:(r[5]||'').trim(), nota:(r[6]||'').trim() }))
      .filter(x => x.mula && x.tamat);
    sibuk(true,'Mengimport…');
    S.jadual = [...S.jadual, ...baru];
    await rujuk('jadual').doc(S.user.email).set({ slot:S.jadual, emel:S.user.email, dikemas:Date.now() });
    sibuk(false); pergi('jadual'); toast(baru.length+' slot diimport','jaya');
  });
}

/* ================= SUBJEK ================= */
const SUBJEK_RENDAH = ['Bahasa Melayu','Bahasa Inggeris','Matematik','Sains','Pendidikan Islam','Pendidikan Moral','Sejarah','Pendidikan Jasmani dan Kesihatan','Pendidikan Seni Visual','Pendidikan Muzik','Reka Bentuk dan Teknologi','Bahasa Arab'];
const SUBJEK_MENENGAH = ['Bahasa Melayu','Bahasa Inggeris','Matematik','Matematik Tambahan','Sains','Fizik','Kimia','Biologi','Sejarah','Geografi','Pendidikan Islam','Pendidikan Moral','Reka Bentuk dan Teknologi','Asas Sains Komputer','Prinsip Perakaunan','Ekonomi','Perniagaan'];

function halSubjek(){
  $('#kandungan').innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" onclick="formSubjek()">+ Tambah subjek</button>
      <button class="btn" onclick="pratetapSubjek('rendah')">Muat pratetap rendah</button>
      <button class="btn" onclick="pratetapSubjek('menengah')">Muat pratetap menengah</button>
      <button class="btn" onclick="importSubjek()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-subjek.xlsx',TEMPLAT.subjek,[['Bahasa Melayu','BM','Rendah']])">⬇️ Templat</button>
    </div>
    ${S.subjek.length ? `<div class="kad-grid">${S.subjek.map(x => {
      const [gelap, cerah] = warnaSubjek(x.nama);
      const singkat = x.kod || (x.nama||'').split(/\s+/).map(w=>w[0]).join('').slice(0,3).toUpperCase();
      return `<div class="item-kad" style="--w:${gelap};--wt:${cerah}">
        <div class="item-atas">
          <span class="item-avatar sj">${esc(singkat)}</span>
          <div class="item-txt"><b>${esc(x.nama)}</b><small>${esc(x.peringkat||'—')}</small></div>
          <span class="sj-bulat"></span>
        </div>
        <div class="item-btm">
          <button class="btn btn-sm" onclick="formSubjek('${x.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="hapusItem('subjek','${x.id}')">Padam</button>
        </div></div>`;}).join('')}</div>`
      : `<div class="kosong"><b>Belum ada subjek</b>Tambah sendiri atau muat senarai pratetap.</div>`}`;
}
function formSubjek(id){
  const s = S.subjek.find(x => x.id === id) || {};
  modal(id ? 'Edit subjek' : 'Tambah subjek', `
    <label class="fld"><span>Nama subjek</span><input id="fsNama" value="${esc(s.nama||'')}" placeholder="Bahasa Melayu"></label>
    <div class="grid2">
      <label class="fld"><span>Kod (pilihan)</span><input id="fsKod" value="${esc(s.kod||'')}" placeholder="BM"></label>
      <label class="fld"><span>Peringkat</span><select id="fsPeringkat">
        <option ${s.peringkat==='Rendah'?'selected':''}>Rendah</option>
        <option ${s.peringkat==='Menengah'?'selected':''}>Menengah</option></select></label>
    </div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanSubjek('${id||''}')">Simpan</button>`);
}
async function simpanSubjek(id){
  const d = { nama:$('#fsNama').value.trim(), kod:$('#fsKod').value.trim(), peringkat:$('#fsPeringkat').value };
  if(!d.nama) return toast('Nama subjek diperlukan','salah');
  sibuk(true,'Menyimpan…');
  id ? await rujuk('subjek').doc(id).update(d) : await rujuk('subjek').add(d);
  await muatData(); sibuk(false); tutupModal(); pergi('subjek'); toast('Subjek disimpan','jaya');
}
async function pratetapSubjek(jenis){
  const senarai = jenis === 'rendah' ? SUBJEK_RENDAH : SUBJEK_MENENGAH;
  sibuk(true,'Memuat subjek…');
  const b = db.batch();
  senarai.filter(n => !S.subjek.some(s => s.nama === n)).forEach(n =>
    b.set(rujuk('subjek').doc(), { nama:n, peringkat: jenis === 'rendah' ? 'Rendah' : 'Menengah', kod:'' }));
  await b.commit(); await muatData(); sibuk(false); pergi('subjek'); toast('Senarai subjek dimuatkan','jaya');
}

/* ================= JADUAL WAKTU ================= */
function halJadual(){
  const hariAjar = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
  $('#kandungan').innerHTML = `
    <div class="toolbar"><button class="btn btn-primary" onclick="formSlot()">+ Tambah slot</button>
      <button class="btn" onclick="importJadual()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-jadual.xlsx',TEMPLAT.jadual,[['Isnin','08:00','09:00','Bahasa Melayu','Tahun 6 Iltizam','','']])">⬇️ Templat</button>
      <button class="btn" onclick="pergi('jana')">✨ Jana RPH minggu ini</button></div>
    ${hariAjar.map(h => {
      const slot = S.jadual.filter(s => s.hari === h).sort((a,b)=> a.mula.localeCompare(b.mula));
      if(!slot.length) return '';
      return `<div class="kad"><div class="kad-h"><h3>${h}</h3><small>${slot.length} slot</small></div>
        ${slot.map(s => `<div class="slot">
          <div class="slot-masa">${esc(s.mula)}<br>${esc(s.tamat)}</div>
          <div class="slot-info"><b>${esc(s.subjek)}</b><small>${esc(s.kelas)} · ${minit(s.mula,s.tamat)} min${s.bilik?' · '+esc(s.bilik):''}</small></div>
          <button class="btn btn-sm" onclick="formSlot('${s.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="hapusSlot('${s.id}')">✕</button>
        </div>`).join('')}</div>`;
    }).join('') || `<div class="kosong"><b>Jadual waktu masih kosong</b>Tambah slot PdP mengikut hari, masa, subjek dan kelas.</div>`}`;
}
function formSlot(id){
  const s = S.jadual.find(x => x.id === id) || {};
  if(!S.kelas.length || !S.subjek.length) return toast('Tambah kelas dan subjek dahulu','salah');
  modal(id ? 'Edit slot' : 'Tambah slot', `
    <label class="fld"><span>Hari</span><select id="fjHari">${HARI.map(h=>`<option ${s.hari===h?'selected':''}>${h}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="fld"><span>Masa mula</span><input id="fjMula" type="time" value="${esc(s.mula||'08:00')}"></label>
      <label class="fld"><span>Masa tamat</span><input id="fjTamat" type="time" value="${esc(s.tamat||'09:00')}"></label>
    </div>
    <label class="fld"><span>Subjek</span><select id="fjSubjek">${S.subjek.map(x=>`<option ${s.subjek===x.nama?'selected':''}>${esc(x.nama)}</option>`).join('')}</select></label>
    <label class="fld"><span>Kelas</span><select id="fjKelas">${S.kelas.map(x=>`<option ${s.kelas===x.nama?'selected':''}>${esc(x.nama)}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="fld"><span>Bilik (pilihan)</span><input id="fjBilik" value="${esc(s.bilik||'')}" placeholder="Bilik Sains"></label>
      <label class="fld"><span>Catatan</span><input id="fjNota" value="${esc(s.nota||'')}"></label>
    </div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanSlot('${id||''}')">Simpan</button>`);
}
async function simpanSlot(id){
  const d = { id: id || uid(), hari:$('#fjHari').value, mula:$('#fjMula').value, tamat:$('#fjTamat').value,
              subjek:$('#fjSubjek').value, kelas:$('#fjKelas').value, bilik:$('#fjBilik').value.trim(), nota:$('#fjNota').value.trim() };
  if(minit(d.mula,d.tamat) <= 0) return toast('Masa tamat mesti selepas masa mula','salah');
  S.jadual = id ? S.jadual.map(x => x.id === id ? d : x) : [...S.jadual, d];
  sibuk(true,'Menyimpan…');
  await rujuk('jadual').doc(S.user.email).set({ slot:S.jadual, emel:S.user.email, dikemas:Date.now() });
  sibuk(false); tutupModal(); pergi('jadual'); toast('Slot disimpan','jaya');
}
function hapusSlot(id){
  sahkan('Padam slot ini daripada jadual?', async () => {
    S.jadual = S.jadual.filter(x => x.id !== id);
    await rujuk('jadual').doc(S.user.email).set({ slot:S.jadual, emel:S.user.email, dikemas:Date.now() });
    pergi('jadual'); toast('Slot dipadam');
  });
}
async function hapusItem(koleksi, id){
  sahkan('Padam rekod ini?', async () => {
    sibuk(true,'Memadam…'); await rujuk(koleksi).doc(id).delete();
    if(koleksi === 'rpt') await tandaRptBerubah();
    await muatData();
    sibuk(false); pergi(S.hal); toast('Rekod dipadam');
  });
}

/* ================= TAKWIM ================= */
function halTakwim(){
  const sesi = sesiPilihan();
  const tw = takwimSesi(sesi);
  const minggu = janaMinggu(tw);
  const senarai = S.senaraiSesi || [];
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Sesi persekolahan</h3>
        ${S.sesi === sesi ? '<span class="pil hijau">Sesi aktif</span>' : '<span class="pil kuning">Bukan sesi aktif</span>'}</div>
      <div class="toolbar" style="margin:0">
        <select id="twSesi" onchange="tukarSesi(this.value)" style="flex:1">
          ${senarai.map(t=>`<option value="${esc(t.id)}" ${t.id===sesi?'selected':''}>Sesi ${esc(t.id)} ${t.mula?'('+t.mula+' — '+t.tamat+')':'(belum lengkap)'} ${t.id===S.sesi?'· AKTIF':''}</option>`).join('')
            || '<option value="">Tiada sesi lagi</option>'}
        </select>
        <button class="btn btn-primary btn-sm" onclick="sesiBaharu()">+ Sesi baharu</button>
        ${senarai.length>1 && ['pemilik','admin'].includes(S.peranan) ? `<button class="btn btn-danger btn-sm" onclick="padamSesi('${esc(sesi)}')">Padam sesi ini</button>` : ''}
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">
        Untuk tahun hadapan: tekan <b>+ Sesi baharu</b>, isi tarikh & cuti (atau import), dan sistem
        bertukar ke sesi baharu secara automatik apabila tarikhnya bermula. Data tahun lama kekal untuk rujukan.</p>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Takwim Sesi ${esc(sesi)}</h3><small>${minggu.filter(m=>m.no).length} minggu persekolahan</small></div>
      ${!tw ? `<div class="kosong"><b>Sesi ini belum ditetapkan</b>Isi tarikh di bawah atau muat pratetap KPM.</div>` : ''}
      ${sesi === '2026' ? `<div class="toolbar" style="margin-bottom:14px">
        <button class="btn btn-ungu" onclick="muatTakwimKPM('A')">📅 Muat Takwim KPM 2026 — Kumpulan A</button>
        <button class="btn" onclick="muatTakwimKPM('B')">📅 Kumpulan B</button>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin:-6px 0 14px">
        <b>Kumpulan A:</b> Kedah, Kelantan, Terengganu (Ahad–Khamis) ·
        <b>Kumpulan B:</b> negeri lain (Isnin–Jumaat).</p>` : ''}
      <div class="grid2">
        <label class="fld"><span>Tarikh mula sesi</span><input id="twMula" type="date" value="${esc(tw?.mula||'')}"></label>
        <label class="fld"><span>Tarikh akhir sesi</span><input id="twTamat" type="date" value="${esc(tw?.tamat||'')}"></label>
      </div>
      <label class="fld"><span>Cara nombor minggu <em>(padankan dengan RPT anda)</em></span>
        <select id="twKira">
          <option value="langkau" ${tw?.kiraMinggu!=='semua'?'selected':''}>Langkau minggu cuti penuh (disyorkan)</option>
          <option value="semua" ${tw?.kiraMinggu==='semua'?'selected':''}>Kira semua minggu kalendar</option>
        </select></label>
      <label class="fld"><span>Hari persekolahan</span>
        <select id="twHari">
          <option value="ahad" ${tw?.mulaHari!=='isnin'?'selected':''}>Ahad – Khamis (Kumpulan A)</option>
          <option value="isnin" ${tw?.mulaHari==='isnin'?'selected':''}>Isnin – Jumaat (Kumpulan B)</option>
        </select></label>
      <button class="btn btn-primary" onclick="simpanTakwim()">Simpan takwim sesi ${esc(sesi)}</button>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Cuti & tiada PdP · Sesi ${esc(sesi)}</h3>
        <button class="btn btn-sm" onclick="formCuti()">+ Tambah</button>
        <button class="btn btn-sm" onclick="importCuti()">📥 Import Excel/CSV</button>
        <button class="btn btn-sm" onclick="templatExcel('templat-cuti.xlsx',TEMPLAT.cuti,[['Cuti Penggal 1','2027-03-20','2027-03-28']])">⬇️ Templat</button></div>
      ${(tw?.cuti||[]).length ? `<div class="senarai">${tw.cuti.sort((a,b)=>a.mula.localeCompare(b.mula)).map((c,i)=>`
        <div class="baris"><div class="baris-t"><b>${esc(c.nama)}</b><small>${tarikhCantik(c.mula)} — ${tarikhCantik(c.tamat)}</small></div>
        <button class="btn btn-sm btn-danger" onclick="hapusCuti(${i})">✕</button></div>`).join('')}</div>`
        : `<div class="kosong">Tiada rekod cuti. Tambah cuti penggal, cuti perayaan atau cuti umum negeri.</div>`}
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">
        Format: <code>nama,mula(YYYY-MM-DD),tamat(YYYY-MM-DD)</code>. Sila tambah cuti umum negeri sendiri
        supaya kiraan hari PdP tepat.</p>
    </div>

    ${minggu.length ? `<div class="kad">
      <div class="kad-h"><h3>Minggu persekolahan</h3>
        <small>${minggu.filter(m=>m.no).length} minggu · ${minggu.reduce((j,m)=>j+(m.hariPdP||0),0)} hari PdP</small></div>
      <div class="tbl-scroll"><table><tr><th>Minggu</th><th>Hari PdP</th><th>Mula</th><th>Tamat</th></tr>
      ${minggu.map(m=>`<tr>
        <td>${m.no?`<span class="pil biru">${m.label}</span>`:`<span class="pil kelabu">${esc(m.label)}</span>`}</td>
        <td>${m.hariPdP ? m.hariPdP+' hari' : '—'}</td>
        <td>${m.pdpMula||m.mula}</td><td>${m.pdpTamat||m.tamat}</td></tr>`).join('')}</table></div>
    </div>` : ''}`;
}
function tukarSesi(id){ window._sesiPilih = id; pergi('takwim'); }
function sesiBaharu(){
  const cadang = String((parseInt(S.sesi) || new Date().getFullYear()) + 1);
  modal('Sesi baharu', `
    <label class="fld"><span>Tahun sesi</span><input id="sbTahun" value="${cadang}" placeholder="2027"></label>
    <p style="font-size:12.5px;color:var(--teks-2)">Sesi baharu dicipta kosong — isi tarikh mula/akhir dan cuti selepas ini.
    Semua kelas, subjek, jadual dan RPH sedia ada tidak terjejas.</p>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="ciptaSesi()">Cipta sesi</button>`);
}
async function ciptaSesi(){
  const th = $('#sbTahun').value.trim();
  if(!/^\d{4}$/.test(th)) return toast('Masukkan tahun 4 digit','salah');
  if(takwimSesi(th)) { window._sesiPilih = th; tutupModal(); return pergi('takwim'); }
  sibuk(true,'Mencipta sesi…');
  await rujuk('takwim').doc(th).set({ tahun:th, cuti:[] });
  await muatData(); window._sesiPilih = th;
  sibuk(false); tutupModal(); pergi('takwim'); toast('Sesi '+th+' dicipta','jaya');
}
function padamSesi(id){
  sahkan('Padam Sesi '+id+' beserta takwim & cutinya? RPH tidak terjejas.', async () => {
    sibuk(true,'Memadam…'); await rujuk('takwim').doc(id).delete();
    window._sesiPilih = null; await muatData(); sibuk(false); pergi('takwim'); toast('Sesi dipadam');
  });
}
const TAKWIM_KPM = {
  A: { nama:'Kumpulan A — Kedah, Kelantan, Terengganu', mulaHari:'ahad',
       mula:'2026-01-11', tamat:'2026-12-03',
       cuti:[
         {nama:'Cuti Tahun Baru Cina',        mula:'2026-02-15', tamat:'2026-02-19'},
         {nama:'Cuti Hari Raya Aidilfitri',   mula:'2026-03-19', tamat:'2026-03-19'},
         {nama:'Cuti Penggal 1',              mula:'2026-03-20', tamat:'2026-03-28'},
         {nama:'Cuti Pertengahan Tahun',      mula:'2026-05-22', tamat:'2026-06-06'},
         {nama:'Cuti Penggal 2',              mula:'2026-08-28', tamat:'2026-09-05'},
         {nama:'Cuti Deepavali',              mula:'2026-11-08', tamat:'2026-11-09'},
         {nama:'Cuti Akhir Persekolahan',     mula:'2026-12-04', tamat:'2026-12-31'}
       ]},
  B: { nama:'Kumpulan B — negeri lain & Wilayah Persekutuan', mulaHari:'isnin',
       mula:'2026-01-12', tamat:'2026-12-04',
       cuti:[
         {nama:'Cuti Tahun Baru Cina',        mula:'2026-02-16', tamat:'2026-02-20'},
         {nama:'Cuti Hari Raya Aidilfitri',   mula:'2026-03-19', tamat:'2026-03-20'},
         {nama:'Cuti Penggal 1',              mula:'2026-03-21', tamat:'2026-03-29'},
         {nama:'Cuti Pertengahan Tahun',      mula:'2026-05-23', tamat:'2026-06-07'},
         {nama:'Cuti Penggal 2',              mula:'2026-08-29', tamat:'2026-09-06'},
         {nama:'Cuti Deepavali',              mula:'2026-11-09', tamat:'2026-11-10'},
         {nama:'Cuti Akhir Persekolahan',     mula:'2026-12-05', tamat:'2026-12-31'}
       ]}
};
function muatTakwimKPM(kump){
  const t = TAKWIM_KPM[kump];
  sahkan('Muat '+t.nama+'? Takwim sesi 2026 akan digantikan.', async () => {
    sibuk(true,'Memuatkan takwim KPM…');
    await rujuk('takwim').doc('2026').set({ tahun:'2026', mula:t.mula, tamat:t.tamat,
      mulaHari:t.mulaHari, kumpulan:kump, cuti:t.cuti });
    await muatData(); sibuk(false); pergi('takwim'); toast('Takwim '+kump+' dimuatkan','jaya');
  });
}

async function simpanTakwim(){
  const sesi = sesiPilihan();
  const d = { tahun:sesi, mula:$('#twMula').value, tamat:$('#twTamat').value, mulaHari:$('#twHari').value,
              kiraMinggu:$('#twKira').value };
  if(!d.mula || !d.tamat) return toast('Isi tarikh mula dan akhir sesi','salah');
  sibuk(true,'Menyimpan…'); await rujuk('takwim').doc(sesi).set(d,{merge:true});
  await muatData(); sibuk(false); pergi('takwim'); toast('Takwim sesi '+sesi+' disimpan','jaya');
}
function formCuti(){
  modal('Tambah cuti', `
    <label class="fld"><span>Nama</span><input id="fcNama" placeholder="Cuti Penggal 1"></label>
    <div class="grid2">
      <label class="fld"><span>Mula</span><input id="fcMula" type="date"></label>
      <label class="fld"><span>Tamat</span><input id="fcTamat" type="date"></label>
    </div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanCuti()">Simpan</button>`);
}
async function simpanCuti(){
  const c = { nama:$('#fcNama').value.trim(), mula:$('#fcMula').value, tamat:$('#fcTamat').value };
  if(!c.nama || !c.mula || !c.tamat) return toast('Lengkapkan maklumat cuti','salah');
  const sesi = sesiPilihan();
  const cuti = [...((takwimSesi(sesi)||{}).cuti||[]), c];
  await rujuk('takwim').doc(sesi).set({ tahun:sesi, cuti },{merge:true});
  await muatData(); tutupModal(); pergi('takwim'); toast('Cuti ditambah','jaya');
}
function hapusCuti(i){
  sahkan('Padam rekod cuti ini?', async () => {
    const sesi = sesiPilihan();
    const susun = ((takwimSesi(sesi)||{}).cuti||[]).sort((a,b)=>a.mula.localeCompare(b.mula));
    const cuti = susun.filter((_,x)=> x !== i);
    await rujuk('takwim').doc(sesi).set({ cuti },{merge:true});
    await muatData(); pergi('takwim'); toast('Cuti dipadam');
  });
}
function importCuti(){
  pilihFail('.csv,.txt', async teks => {
    const rows = parseCSV(teks).filter(r => r.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(r[1]));
    if(!rows.length) return toast('Format CSV tidak dikenali','salah');
    const sesi = sesiPilihan();
    const cuti = [...((takwimSesi(sesi)||{}).cuti||[]), ...rows.map(r => ({nama:r[0], mula:r[1], tamat:r[2]}))];
    sibuk(true,'Mengimport…');
    await rujuk('takwim').doc(sesi).set({ tahun:sesi, cuti },{merge:true});
    await muatData(); sibuk(false); pergi('takwim'); toast(rows.length+' rekod cuti diimport','jaya');
  });
}

/* ================= RPT ================= */
let rptHasil = [];
function halRpt(){
  const sjJadual = [...new Set(S.jadual.map(x=>x.subjek).filter(Boolean))];
  const senaraiSubjek = [...new Set([...sjJadual, ...S.subjek.map(x=>x.nama)])].sort();
  const tahunSenarai = ['Prasekolah','Tahun 1','Tahun 2','Tahun 3','Tahun 4','Tahun 5','Tahun 6',
                        'Tingkatan 1','Tingkatan 2','Tingkatan 3','Tingkatan 4','Tingkatan 5'];
  rptHasil = S.rpt.filter(r => sjJadual.includes(r.subjek));
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Rancangan Pengajaran Tahunan</h3>
        <small>${S.rptAda ? S.rpt.length+' baris dimuat' : 'Belum ada RPT'}</small></div>
      <div class="toolbar" style="margin:0">
        <select id="rtSubjek"><option value="">Semua subjek saya</option>
          ${senaraiSubjek.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
        <select id="rtTahun"><option value="">Semua tahun</option>
          ${tahunSenarai.map(x=>`<option>${x}</option>`).join('')}</select>
        <button class="btn btn-primary" onclick="cariRpt()">Papar</button>
      </div>
      <div class="toolbar" style="margin:12px 0 0">
        <input id="rtCari" placeholder="Tapis tajuk, SK atau SP…" oninput="lukisRpt()">
        <button class="btn" onclick="formRpt()">+ Tambah baris</button>
        <button class="btn btn-ungu" onclick="importRpt()">📥 Muat naik RPT (Excel)</button>
        <button class="btn" onclick="templatRpt()">⬇️ Templat Excel</button>
        <button class="btn btn-danger" onclick="padamRptPukal()">🗑️ Padam pukal</button>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">
        Satu baris untuk satu minggu. Semasa menjana RPH, sistem padankan minggu persekolahan
        dengan RPT anda dan AI menggunakan tajuk serta standard di situ — AI tidak mencipta SP sendiri.</p>
    </div>
    <div id="rtSenarai"></div>`;
  lukisRpt();
}
async function cariRpt(){
  const sj = $('#rtSubjek').value, th = $('#rtTahun').value;
  rptHasil = sj ? await muatRptSubjek(sj, th)
                : S.rpt.filter(r => !th || norma(r.tahun) === norma(th));
  lukisRpt();
  if(!rptHasil.length) toast('Tiada baris RPT untuk pilihan ini','salah');
}
function lukisRpt(){
  const q = ($('#rtCari')?.value || '').toLowerCase();
  const hasil = rptHasil.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q))
                        .sort((a,b)=> noMinggu(a.minggu) - noMinggu(b.minggu));
  if(!hasil.length){
    $('#rtSenarai').innerHTML = `<div class="kosong"><b>Tiada baris RPT</b>
      Muat turun templat Excel, isikan RPT subjek anda, kemudian muat naik semula.</div>`;
    return;
  }
  $('#rtSenarai').innerHTML = `<div class="kad"><div class="tbl-scroll"><table>
    <tr><th>Minggu</th><th>Subjek</th><th>Tahun</th><th>Tajuk</th><th>SK</th><th>SP</th><th></th></tr>
    ${hasil.slice(0,400).map(r=>`<tr>
      <td><span class="pil biru">${esc(r.minggu||'-')}</span></td>
      <td>${esc(r.subjek||'')}</td><td>${esc(r.tahun||'')}</td>
      <td>${esc((r.tajuk||r.tema||'').slice(0,60))}</td>
      <td style="font-size:12px">${esc(((r.kodSk?r.kodSk+' ':'')+(r.sk||'')).slice(0,70))}</td>
      <td style="font-size:12px">${esc(((r.kodSp?r.kodSp+' ':'')+(r.sp||'')).slice(0,70))}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm" onclick="formRpt('${r.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="hapusItem('rpt','${r.id}')">✕</button></td>
    </tr>`).join('')}
  </table></div>
  ${hasil.length>400?`<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:10px">Menunjukkan 400 daripada ${hasil.length} baris</p>`:''}
  </div>`;
}

function formRpt(id){
  const r = S.rpt.find(x => x.id === id) || {};
  modal(id?'Edit baris RPT':'Tambah baris RPT', `
    <div class="grid3">
      <label class="fld"><span>Minggu</span><input id="frMinggu" value="${esc(r.minggu||'')}" placeholder="12"></label>
      <label class="fld"><span>Tahun / Tingkatan</span><input id="frTahun" value="${esc(r.tahun||'')}" placeholder="Tahun 6"></label>
      <label class="fld"><span>Subjek</span><input id="frSubjek" value="${esc(r.subjek||'')}" list="lsSubjekRpt">
        <datalist id="lsSubjekRpt">${S.subjek.map(x=>`<option>${esc(x.nama)}</option>`).join('')}</datalist></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>Tema / Bidang</span><input id="frTema" value="${esc(r.tema||'')}"></label>
      <label class="fld"><span>Tajuk / Kemahiran</span><input id="frTajuk" value="${esc(r.tajuk||'')}"></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>Kod SK</span><input id="frKodSk" value="${esc(r.kodSk||'')}" placeholder="5.1"></label>
      <label class="fld"><span>Kod SP</span><input id="frKodSp" value="${esc(r.kodSp||'')}" placeholder="5.1.1"></label>
    </div>
    <label class="fld"><span>Standard Kandungan</span><textarea id="frSk" style="min-height:64px">${esc(r.sk||'')}</textarea></label>
    <label class="fld"><span>Standard Pembelajaran</span><textarea id="frSp" style="min-height:64px">${esc(r.sp||'')}</textarea></label>
    <div class="grid2">
      <label class="fld"><span>Standard Prestasi (TP)</span><input id="frTp" value="${esc(r.tp||'')}"></label>
      <label class="fld"><span>Catatan</span><input id="frCatatan" value="${esc(r.catatan||'')}"></label>
    </div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="simpanRpt('${id||''}')">Simpan</button>`);
}
async function simpanRpt(id){
  const d = { minggu:$('#frMinggu').value.trim(), tahun:$('#frTahun').value.trim(), subjek:$('#frSubjek').value.trim(),
    tema:$('#frTema').value.trim(), tajuk:$('#frTajuk').value.trim(), kodSk:$('#frKodSk').value.trim(),
    kodSp:$('#frKodSp').value.trim(), sk:$('#frSk').value.trim(), sp:$('#frSp').value.trim(),
    tp:$('#frTp').value.trim(), catatan:$('#frCatatan').value.trim(), emel:S.user.email };
  if(!d.subjek || !d.minggu) return toast('Subjek dan minggu diperlukan','salah');
  sibuk(true,'Menyimpan…');
  id ? await rujuk('rpt').doc(id).update(d) : await rujuk('rpt').add(d);
  await tandaRptBerubah();
  S.rptAda = true; await muatRpt(); sibuk(false); tutupModal(); pergi('rpt'); toast('Baris RPT disimpan','jaya');
}

function padamRptPukal(){
  if(!S.rpt.length) return toast('Tiada RPT untuk dipadam','salah');
  const kira = {};
  S.rpt.forEach(r => {
    const k = (r.subjek||'—') + '|' + (r.tahun||'—');
    kira[k] = (kira[k]||0) + 1;
  });
  const senarai = Object.entries(kira).sort((a,b)=> a[0].localeCompare(b[0]));
  modal('Padam RPT secara pukal', `
    <p style="font-size:13px;color:var(--teks-2);margin-bottom:12px">
      Pilih RPT yang hendak dipadam — sesuai apabila menukar RPT bagi sesi persekolahan baharu.
      RPH yang telah dijana <b>tidak</b> terjejas.</p>
    <div class="toolbar" style="margin-bottom:10px">
      <button class="btn btn-sm" onclick="$$('.rtPadamPilih').forEach(c=>c.checked=true)">Tanda semua</button>
      <button class="btn btn-sm" onclick="$$('.rtPadamPilih').forEach(c=>c.checked=false)">Buang semua</button></div>
    <div style="max-height:44vh;overflow:auto">${senarai.map(([k,n])=>{
      const [sj,th] = k.split('|');
      return `<label style="display:flex;gap:9px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--garis);font-size:13.5px">
        <input type="checkbox" class="rtPadamPilih" value="${esc(k)}" style="width:auto">
        <span style="flex:1">${esc(sj)} <small style="color:var(--teks-3)">· ${esc(th)}</small></span>
        <span class="pil kelabu">${n} baris</span></label>`;}).join('')}</div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-danger" onclick="jalankanPadamRpt()">Padam yang ditanda</button>`);
}
async function jalankanPadamRpt(){
  const pilih = new Set($$('.rtPadamPilih').filter(c => c.checked).map(c => c.value));
  if(!pilih.size) return toast('Tanda sekurang-kurangnya satu','salah');
  const sasar = S.rpt.filter(r => pilih.has((r.subjek||'—')+'|'+(r.tahun||'—')));
  tutupModal();
  sahkan(sasar.length + ' baris RPT akan dipadam secara kekal. Teruskan?', async () => {
    let siap = 0;
    for(let i=0;i<sasar.length;i+=400){
      sibuk(true,`Memadam ${siap}/${sasar.length}…`);
      const b = db.batch();
      sasar.slice(i,i+400).forEach(r => b.delete(rujuk('rpt').doc(r.id)));
      await b.commit(); siap += Math.min(400, sasar.length - i);
    }
    await tandaRptBerubah(); await muatRpt();
    sibuk(false); pergi('rpt'); toast(sasar.length + ' baris RPT dipadam','jaya');
  });
}

function templatRpt(){
  templatExcel('templat-rpt.xlsx', TEMPLAT.rpt, [
    ['1','Tahun 6','Bahasa Melayu','Kemahiran Mendengar dan Bertutur','Perbualan Harian','1.1',
     'Mendengar dan memberikan respons terhadap pelbagai bahan bukan sastera','1.1.1',
     'Mendengar dan memberikan respons dengan betul terhadap arahan mengikut situasi','TP3','Minggu orientasi'],
    ['2','Tahun 6','Bahasa Melayu','Kemahiran Membaca','Bacaan Mekanis','2.1',
     'Membaca pelbagai bahan bacaan bukan sastera','2.1.1',
     'Membaca dan memahami maklumat tersurat daripada pelbagai bahan','TP3','']
  ]);
}

function importRpt(){
  pilihFail('.csv,.txt', teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /minggu/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r.length >= 3 && (r[0]||'').trim() && (r[2]||'').trim());
    if(!rows.length) return toast('Tiada baris sah. Pastikan lajur pertama Minggu dan ketiga Subjek.','salah');
    window._rptRows = rows;
    const kira = {};
    rows.forEach(r => { const k = (r[2]||'').trim()+' · '+((r[1]||'').trim()||'—'); kira[k] = (kira[k]||0)+1; });
    modal('Sahkan muat naik RPT', `
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:12px">
        <b>${rows.length}</b> baris dikesan:</p>
      <div style="max-height:40vh;overflow:auto">${Object.entries(kira).map(([k,n])=>`
        <div style="display:flex;gap:9px;padding:7px 4px;border-bottom:1px solid var(--garis);font-size:13.5px">
          <span style="flex:1">${esc(k)}</span><span class="pil kelabu">${n} minggu</span></div>`).join('')}</div>
      <label class="fld" style="margin-top:14px"><span>Sebelum import</span>
        <select id="rtGanti">
          <option value="tambah">Tambah kepada RPT sedia ada</option>
          <option value="ganti">Ganti — padam RPT subjek yang sama dahulu</option>
        </select></label>`,
      `<button class="btn" onclick="tutupModal()">Batal</button>
       <button class="btn btn-primary" onclick="jalankanImportRpt()">Muat naik</button>`);
  });
}
async function jalankanImportRpt(){
  const rows = window._rptRows || [];
  const ganti = $('#rtGanti').value === 'ganti';
  tutupModal(); sibuk(true,'Memuat naik RPT…');
  try{
    if(ganti){
      const subj = [...new Set(rows.map(r => (r[2]||'').trim()))];
      for(const sj of subj){
        const lama = await rujuk('rpt').where('subjek','==',sj).limit(1000).get();
        for(let i=0;i<lama.docs.length;i+=400){
          const b = db.batch();
          lama.docs.slice(i,i+400).forEach(d => b.delete(d.ref));
          await b.commit();
        }
      }
    }
    for(let i=0;i<rows.length;i+=400){
      sibuk(true,`Menyimpan ${Math.min(i+400,rows.length)}/${rows.length} baris…`);
      const b = db.batch();
      rows.slice(i,i+400).forEach(r => b.set(rujuk('rpt').doc(), {
        minggu:(r[0]||'').trim(), tahun:(r[1]||'').trim(), subjek:(r[2]||'').trim(),
        tema:(r[3]||'').trim(), tajuk:(r[4]||'').trim(), kodSk:(r[5]||'').trim(), sk:(r[6]||'').trim(),
        kodSp:(r[7]||'').trim(), sp:(r[8]||'').trim(), tp:(r[9]||'').trim(), catatan:(r[10]||'').trim(),
        emel:S.user.email, dicipta:Date.now() }));
      await b.commit();
    }
    await tandaRptBerubah();
    S.rptAda = true; await muatRpt(); sibuk(false); pergi('rpt');
    toast(rows.length+' baris RPT dimuat naik','jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}

/* ================= BUKU TEKS ================= */
function halBuku(){
  $('#kandungan').innerHTML = `
    <div class="toolbar"><button class="btn btn-primary" onclick="formBuku()">+ Tambah bab/unit</button>
      <button class="btn btn-ungu" onclick="formPdfBuku()">📄 Import PDF buku teks</button>
      <button class="btn" onclick="importBuku()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-bukuteks.xlsx',TEMPLAT.buku)">⬇️ Templat</button></div>
    <div class="kad" style="margin-bottom:14px"><p style="font-size:12.5px;color:var(--teks-2)">
      Format: <code>tahun,subjek,buku,bab,unit,tajuk,kandungan</code><br>
      Masukkan hanya bahan yang anda ada hak untuk gunakan. AI hanya merujuk kandungan yang dimasukkan di sini.</p></div>
    <div class="senarai">${S.buku.length ? S.buku.map(b => `
      <div class="baris"><div class="baris-t"><b>${esc(b.tajuk||b.unit||'—')}</b>
        <small>${esc(b.subjek)} ${esc(b.tahun)} · ${esc(b.buku||'')} ${b.bab?'· Bab '+esc(b.bab):''} ${b.unit?'· '+esc(b.unit):''}</small></div>
        ${b.pautan?`<a class="btn btn-sm" href="${esc(b.pautan)}" target="_blank" rel="noopener">🔗</a>`:''}
        <button class="btn btn-sm" onclick="formBuku('${b.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="hapusItem('buku','${b.id}')">✕</button></div>`).join('')
      : `<div class="kosong"><b>Belum ada rujukan buku teks</b>Tambah bab/unit supaya AI boleh merujuk kandungan sebenar.</div>`}
    </div>`;
}
function formBuku(id){
  const b = S.buku.find(x => x.id === id) || {};
  modal(id?'Edit rujukan':'Tambah rujukan buku teks', `
    <div class="grid2">
      <label class="fld"><span>Tahun / Tingkatan</span><input id="fbTahun" value="${esc(b.tahun||'')}"></label>
      <label class="fld"><span>Subjek</span><input id="fbSubjek" value="${esc(b.subjek||'')}" list="lsSubjek2">
        <datalist id="lsSubjek2">${S.subjek.map(s=>`<option>${esc(s.nama)}</option>`).join('')}</datalist></label>
    </div>
    <div class="grid3">
      <label class="fld"><span>Buku</span><input id="fbBuku" value="${esc(b.buku||'')}"></label>
      <label class="fld"><span>Bab</span><input id="fbBab" value="${esc(b.bab||'')}"></label>
      <label class="fld"><span>Unit</span><input id="fbUnit" value="${esc(b.unit||'')}"></label>
    </div>
    <label class="fld"><span>Tajuk</span><input id="fbTajuk" value="${esc(b.tajuk||'')}"></label>
    <label class="fld"><span>Pautan rujukan <em>(pilihan — buku teks digital, video, bahan)</em></span>
      <input id="fbPautan" value="${esc(b.pautan||'')}" placeholder="https://…"></label>
    <label class="fld"><span>Ringkasan kandungan</span><textarea id="fbIsi" placeholder="Isi pelajaran, aktiviti dalam buku, latihan…">${esc(b.kandungan||'')}</textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanBuku('${id||''}')">Simpan</button>`);
}
async function simpanBuku(id){
  const d = { tahun:$('#fbTahun').value.trim(), subjek:$('#fbSubjek').value.trim(), buku:$('#fbBuku').value.trim(),
    bab:$('#fbBab').value.trim(), unit:$('#fbUnit').value.trim(), tajuk:$('#fbTajuk').value.trim(),
    pautan:$('#fbPautan').value.trim(), kandungan:$('#fbIsi').value.trim() };
  if(!d.subjek) return toast('Subjek diperlukan','salah');
  sibuk(true,'Menyimpan…');
  id ? await rujuk('buku').doc(id).update(d) : await rujuk('buku').add(d);
  await muatData(); sibuk(false); tutupModal(); pergi('buku'); toast('Rujukan disimpan','jaya');
}
function importBuku(){
  pilihFail('.csv,.txt', async teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /tahun/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r.length >= 6 && r[1]);
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    sibuk(true,'Mengimport…');
    for(let i=0;i<rows.length;i+=400){
      const b = db.batch();
      rows.slice(i,i+400).forEach(r => b.set(rujuk('buku').doc(), {
        tahun:r[0], subjek:r[1], buku:r[2], bab:r[3], unit:r[4], tajuk:r[5], kandungan:r[6]||'' }));
      await b.commit();
    }
    await muatData(); sibuk(false); pergi('buku'); toast(rows.length+' rekod diimport','jaya');
  });
}

/* ---------- Import PDF buku teks ---------- */
function formPdfBuku(){
  modal('Import PDF buku teks', `
    <div class="grid2">
      <label class="fld"><span>Tahun / Tingkatan</span><input id="pdTahun" placeholder="Tahun 6"></label>
      <label class="fld"><span>Subjek</span><input id="pdSubjek" list="lsSubjek3" placeholder="Bahasa Melayu">
        <datalist id="lsSubjek3">${S.subjek.map(x=>`<option>${esc(x.nama)}</option>`).join('')}</datalist></label>
    </div>
    <label class="fld"><span>Nama buku</span><input id="pdBuku" placeholder="Buku Teks Bahasa Melayu Tahun 6"></label>
    <label class="fld"><span>Pautan rujukan <em>(pilihan)</em></span><input id="pdPautan" placeholder="https://…"></label>
    <label class="fld"><span>Cara pecahan</span><select id="pdPecah">
      <option value="auto">Auto — ikut tajuk Unit / Bab / Tema</option>
      <option value="4">Setiap 4 muka surat</option>
      <option value="8">Setiap 8 muka surat</option>
    </select></label>
    <p style="font-size:12px;color:var(--teks-3)">Teks sahaja diekstrak (bukan gambar). PDF hasil imbasan tanpa OCR tidak akan menghasilkan teks.
    Masukkan hanya bahan yang anda ada hak untuk gunakan.</p>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="mulaPdfBuku()">Pilih fail PDF</button>`);
}

function mulaPdfBuku(){
  const meta = {
    tahun:$('#pdTahun').value.trim(), subjek:$('#pdSubjek').value.trim(),
    buku:$('#pdBuku').value.trim(), pautan:$('#pdPautan').value.trim(), pecah:$('#pdPecah').value
  };
  if(!meta.subjek) return toast('Isi subjek dahulu','salah');
  if(typeof pdfjsLib === 'undefined') return toast('Pustaka PDF belum dimuat. Semak sambungan internet.','salah');
  tutupModal();
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.pdf';
  i.onchange = () => { const f = i.files[0]; if(f) prosesPdfBuku(f, meta); };
  i.click();
}

async function prosesPdfBuku(fail, meta){
  sibuk(true,'Membuka PDF…');
  try{
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await fail.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data:buf }).promise;
    const muka = [];
    for(let n=1; n<=pdf.numPages; n++){
      sibuk(true,`Membaca muka surat ${n}/${pdf.numPages}…`);
      const t = await (await pdf.getPage(n)).getTextContent();
      muka.push(t.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim());
    }
    const rekod = pecahkanMuka(muka, meta);
    if(!rekod.length){ sibuk(false); return toast('Tiada teks dijumpai. PDF ini mungkin imbasan gambar.','salah'); }

    sibuk(true,`Menyimpan ${rekod.length} rekod…`);
    for(let i=0;i<rekod.length;i+=300){
      const b = db.batch();
      rekod.slice(i,i+300).forEach(x => b.set(rujuk('buku').doc(), x));
      await b.commit();
    }
    await muatData(); sibuk(false); pergi('buku');
    toast(rekod.length+' bahagian buku teks diimport','jaya');
  }catch(e){ sibuk(false); toast('Gagal baca PDF: '+e.message,'salah'); }
}

function pecahkanMuka(muka, meta){
  const HAD = 2500;                       // aksara maksimum satu rekod
  const asas = { tahun:meta.tahun, subjek:meta.subjek, buku:meta.buku, pautan:meta.pautan, sumber:'pdf' };
  const rekod = [];
  const tolak = t => {
    if(t.kandungan.trim().length < 80) return;
    for(let i=0;i<t.kandungan.length;i+=HAD)
      rekod.push({ ...asas, bab:t.bab, unit:t.unit, tajuk:t.tajuk + (t.kandungan.length>HAD ? ' ('+(i/HAD+1)+')' : ''),
                   kandungan:t.kandungan.slice(i,i+HAD) });
  };

  if(meta.pecah === 'auto'){
    const kepala = /\b(UNIT|BAB|TEMA|MODUL)\s+([0-9]{1,2}|[IVX]{1,4})\b/i;
    let semasa = { bab:'', unit:'', tajuk:'Bahagian awal', kandungan:'' };
    muka.forEach((t, n) => {
      const m = t.slice(0,220).match(kepala);
      if(m){
        tolak(semasa);
        const jenis = m[1].toUpperCase(), no = m[2];
        semasa = { bab: jenis==='BAB'?no:'', unit: jenis!=='BAB'? jenis+' '+no : '',
                   tajuk: (jenis+' '+no+' — m/s '+(n+1)), kandungan:'' };
      }
      semasa.kandungan += ' ' + t;
    });
    tolak(semasa);
    if(rekod.length) return rekod;
  }

  const saiz = parseInt(meta.pecah) || 4;
  for(let i=0;i<muka.length;i+=saiz)
    tolak({ bab:'', unit:'', tajuk:`Muka surat ${i+1}–${Math.min(i+saiz, muka.length)}`,
            kandungan: muka.slice(i,i+saiz).join(' ') });
  return rekod;
}

/* ================= TETAPAN ================= */
function halTetapan(){
  const ai = tetapanAI();
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Profil guru</h3></div>
      <div class="grid2">
        <label class="fld"><span>Nama penuh</span><input id="ptNama" value="${esc(S.profil.nama||'')}"></label>
        <label class="fld"><span>E-mel</span><input value="${esc(S.user.email)}" disabled></label>
      </div>
      <div class="grid2">
        <label class="fld"><span>Jawatan</span><input id="ptJawatan" value="${esc(S.profil.jawatan||'')}" placeholder="Guru Akademik"></label>
        <label class="fld"><span>Opsyen</span><input id="ptOpsyen" value="${esc(S.profil.opsyen||'')}" placeholder="Bahasa Melayu"></label>
      </div>
      <label class="fld"><span>Nama pengesah RPH <em>(untuk ruang tandatangan)</em></span>
        <input id="ptPengesah" value="${esc(S.profil.pengesah||'')}" placeholder="Guru Besar / GPK Akademik"></label>
      <button class="btn btn-primary" onclick="simpanProfil()">Simpan profil</button>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Logo & tandatangan</h3><small>Untuk kepala cetakan RPH</small></div>
      <div class="grid2">
        <div>
          <span class="fld"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--teks-2);margin-bottom:6px">Logo sekolah ${['pemilik','admin'].includes(S.peranan)?'':'<em style="font-weight:400;color:var(--teks-3)">(admin sahaja)</em>'}</span></span>
          <div style="border:1px dashed var(--garis);border-radius:var(--r-sm);padding:14px;text-align:center;background:var(--bg);min-height:96px;display:grid;place-content:center">
            ${S.logo ? `<img src="${S.logo}" style="max-height:70px;max-width:100%">` : '<span style="color:var(--teks-3);font-size:12.5px">Belum ada logo</span>'}
          </div>
          ${['pemilik','admin'].includes(S.peranan) ? `<div class="toolbar" style="margin:10px 0 0">
            <button class="btn btn-sm" onclick="pilihLogo()">Muat naik logo</button>
            ${S.logo?`<button class="btn btn-sm btn-danger" onclick="buangLogo()">Buang</button>`:''}</div>` : ''}
        </div>
        <div>
          <span class="fld"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--teks-2);margin-bottom:6px">Tandatangan digital <em style="font-weight:400;color:var(--teks-3)">(peranti ini sahaja)</em></span></span>
          <div style="border:1px dashed var(--garis);border-radius:var(--r-sm);padding:14px;text-align:center;background:var(--bg);min-height:96px;display:grid;place-content:center">
            ${tandatanganSaya() ? `<img src="${tandatanganSaya()}" style="max-height:60px;max-width:100%">` : '<span style="color:var(--teks-3);font-size:12.5px">Belum ada tandatangan</span>'}
          </div>
          <div class="toolbar" style="margin:10px 0 0">
            <button class="btn btn-sm" onclick="pilihTtd()">Muat naik</button>
            ${tandatanganSaya()?`<button class="btn btn-sm btn-danger" onclick="buangTtd()">Buang</button>`:''}</div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin-top:12px">Imej dikecilkan automatik dalam pelayar sebelum disimpan — tiada Firebase Storage diperlukan, jadi projek kekal pada pelan Spark percuma.</p>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Enjin AI</h3><small>Disegerak ke akaun anda — sekali setup, semua peranti</small></div>
      <label class="fld"><span>Penyedia</span><select id="aiProv" onchange="tukarProv()">
        ${Object.entries(PENYEDIA).map(([k,v])=>`<option value="${k}" ${ai.prov===k?'selected':''}>${esc(v.nama)}</option>`).join('')}
      </select></label>
      <div id="aiNota" style="background:var(--biru-t);border-radius:var(--r-sm);padding:11px 13px;font-size:12.5px;color:var(--teks-2);margin-bottom:13px"></div>
      <label class="fld" id="aiBaseKotak"><span>Base URL</span><input id="aiBase" value="${esc(ai.baseUrl)}" placeholder="https://api.contoh.com/v1"></label>
      <label class="fld"><span>Model</span>
        <input id="aiModel" value="${esc(ai.model)}" list="lsModel">
        <datalist id="lsModel"></datalist></label>
      <label class="fld"><span>API Key</span><input id="aiKey" type="password" value="${esc(ai.key)}" placeholder="Tampal kunci API di sini"></label>
      <div class="toolbar" style="margin:0">
        <button class="btn btn-primary" onclick="simpanAI()">Simpan tetapan AI</button>
        <button class="btn" onclick="ujiAI()">Uji sambungan</button>
        <button class="btn" onclick="muatModel()">Muat senarai model</button>
      </div>
      <hr style="border:0;border-top:1px dashed var(--garis);margin:16px 0">
      <span style="display:block;font-size:12.5px;font-weight:650;color:var(--teks-2);margin-bottom:8px">
        Had kadar &amp; penjanaan pukal</span>
      <div class="grid2">
        <label class="fld"><span>Kelajuan <em>(permintaan/minit)</em></span>
          <select id="aiRpm">
            ${[[8,'8 — paling selamat'],[12,'12 — disyorkan (Gemini percuma)'],[15,'15 — had maksimum Gemini'],
               [25,'25 — Groq / Cerebras percuma'],[60,'60 — berbayar']]
              .map(([v,t])=>`<option value="${v}" ${tetapanKadar().rpm==v?'selected':''}>${t}</option>`).join('')}
          </select></label>
        <label class="fld"><span>Cuba semula bila gagal</span>
          <select id="aiCubaan">${[2,3,4,6].map(n=>`<option value="${n}" ${tetapanKadar().cubaan==n?'selected':''}>${n} kali</option>`).join('')}</select></label>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin:-4px 0 14px;line-height:1.55">
        Sistem menghantar permintaan satu demi satu mengikut kelajuan ini. Jika penyedia menolak
        (ralat 429), ia menunggu automatik dan mencuba semula — bukan terus gagal.</p>

      <span style="display:block;font-size:12.5px;font-weight:650;color:var(--teks-2);margin-bottom:8px">
        Penyedia sandaran <em style="font-weight:400;color:var(--teks-3)">(bila kuota utama habis)</em></span>
      <div class="grid2">
        <label class="fld"><span>Penyedia</span>
          <select id="sdProv"><option value="">— Tiada —</option>
            ${Object.entries(PENYEDIA).map(([k,v])=>`<option value="${k}" ${tetapanKadar().sandaran?.prov===k?'selected':''}>${esc(v.nama)}</option>`).join('')}
          </select></label>
        <label class="fld"><span>API Key sandaran</span>
          <input id="sdKey" type="password" value="${esc(tetapanKadar().sandaran?.key||'')}" placeholder="Kunci penyedia kedua"></label>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin:-4px 0 12px;line-height:1.55">
        Contoh: utama <b>Gemini</b> (1,500 permintaan/hari percuma), sandaran <b>Groq</b> atau
        <b>Cerebras</b> — dua-dua percuma. Bila kuota Gemini habis, sistem bertukar sendiri
        dan penjanaan diteruskan tanpa gagal.</p>

      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">
        Aplikasi ini statik (GitHub Pages), jadi panggilan AI dibuat terus dari pelayar.
        Sesetengah penyedia menyekat panggilan dari pelayar (CORS) — Gemini, Groq dan OpenRouter disahkan berfungsi.</p>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Aplikasi</h3></div>
      <div class="senarai">
        <div class="baris"><div class="baris-t"><b>Versi</b><small>${APP.versi}</small></div></div>
        <div class="baris"><div class="baris-t"><b>Sekolah</b><small>${esc(S.sekolah?.nama||'—')} (${esc(S.sekolah?.kod||'—')})</small></div></div>
        <div class="baris"><div class="baris-t"><b>Peranan</b><small style="text-transform:capitalize">${esc(S.peranan)}</small></div></div>
        <div class="baris"><div class="baris-t"><b>Kosongkan cache</b><small>Muat semula fail aplikasi terkini</small></div>
          <button class="btn btn-sm" onclick="kosongkanCache()">Bersihkan</button></div>
      </div>
    </div>

    <div class="kad" style="text-align:center;background:linear-gradient(160deg,#faf9ff,#f4f2fe);border-color:#e6e2fa">
      <img src="icons/icon-192.png" alt="" style="width:52px;height:52px;border-radius:13px;margin-bottom:9px">
      <h3 style="margin:0;font-size:16px">e-RPH AI</h3>
      <p style="font-size:12.5px;color:var(--teks-2);margin:3px 0 12px">RPH Pintar. PdP Lebih Terancang.</p>
      <p style="font-size:13px;color:var(--teks);margin:0;line-height:1.7">
        Direka &amp; dibangunkan oleh<br><b style="font-size:14.5px">ALIMIN BIN ABU BAKAR</b><br>
        <span style="font-size:12px;color:var(--teks-3)">SK Belukar, Machang, Kelantan</span></p>
      <p style="font-size:12px;color:var(--teks-3);margin-top:13px;padding-top:12px;border-top:1px solid var(--garis)">
        © 2026 Alimin bin Abu Bakar. <b>Hak cipta terpelihara.</b><br>
        Penggunaan tanpa kebenaran bertulis adalah dilarang.</p>
    </div>`;
  lukisNotaAI();
}
function pilihImej(fn){
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => { const f = i.files[0]; if(f) fn(f); };
  i.click();
}
function pilihLogo(){
  pilihImej(async f => {
    sibuk(true,'Memproses logo…');
    try{
      let d = await kecilkanImej(f, 400, 0.9);
      if(saizBase64(d) > 300) d = await kecilkanImej(f, 260, 0.8);
      if(saizBase64(d) > 700){ sibuk(false); return toast('Imej terlalu besar. Cuba fail lain.','salah'); }
      await simpanLogo(d);
      sibuk(false); pergi('tetapan'); toast('Logo disimpan ('+saizBase64(d)+' KB)','jaya');
    }catch(e){ sibuk(false); toast(e.message,'salah'); }
  });
}
function buangLogo(){
  sahkan('Buang logo sekolah? Semua guru akan terkesan.', async () => {
    sibuk(true,'Membuang…'); await padamLogo(); sibuk(false); pergi('tetapan'); toast('Logo dibuang');
  });
}
function pilihTtd(){
  pilihImej(async f => {
    sibuk(true,'Memproses tandatangan…');
    try{
      const d = await kecilkanImej(f, 320, 0.85);
      localStorage.setItem('erph_ttd_' + S.user.email, d);
      sibuk(false); pergi('tetapan'); toast('Tandatangan disimpan dalam peranti ini','jaya');
    }catch(e){ sibuk(false); toast(e.message,'salah'); }
  });
}
function buangTtd(){
  localStorage.removeItem('erph_ttd_' + S.user.email); pergi('tetapan'); toast('Tandatangan dibuang');
}

async function simpanProfil(){
  const d = { nama:$('#ptNama').value.trim(), jawatan:$('#ptJawatan').value.trim(),
              opsyen:$('#ptOpsyen').value.trim(), pengesah:$('#ptPengesah').value.trim() };
  sibuk(true,'Menyimpan…');
  await db.collection('pengguna').doc(S.user.email).set(d,{merge:true});
  S.profil = { ...S.profil, ...d };
  $('#uNama').textContent = d.nama; sibuk(false); toast('Profil disimpan','jaya');
}
function tetapanAI(){
  const t = JSON.parse(localStorage.getItem('erph_ai') || '{}');
  const prov = t.prov || 'gemini';
  const p = (typeof PENYEDIA !== 'undefined' ? PENYEDIA[prov] : null) || {};
  return { prov, key:t.key||'', model:t.model || p.model || '', baseUrl:t.baseUrl || p.base || '' };
}
function tukarProv(){
  const id = $('#aiProv').value, p = infoPenyedia(id);
  $('#aiModel').value = p.model || '';
  $('#aiBase').value = p.base || '';
  $('#lsModel').innerHTML = '';
  lukisNotaAI();
}
function lukisNotaAI(){
  const id = $('#aiProv').value, p = infoPenyedia(id);
  $('#aiNota').innerHTML = `${esc(p.nota||'')}${p.daftar?` <a href="${esc(p.daftar)}" target="_blank" rel="noopener">Dapatkan kunci →</a>`:''}`;
  $('#aiBaseKotak').style.display = (p.jenis === 'openai') ? '' : 'none';
}
function simpanAI(){
  // simpan tetapan kadar & sandaran
  if($('#aiRpm')){
    const sdProv = $('#sdProv').value, sdKey = $('#sdKey').value.trim();
    simpanKadar({ rpm:+$('#aiRpm').value, cubaan:+$('#aiCubaan').value,
      sandaran: (sdProv && sdKey) ? { prov:sdProv, key:sdKey,
        model:(PENYEDIA[sdProv]||{}).model || '', baseUrl:(PENYEDIA[sdProv]||{}).base || '' } : null });
  }
  const t = { prov:$('#aiProv').value, key:$('#aiKey').value.trim(),
              model:$('#aiModel').value.trim(), baseUrl:$('#aiBase').value.trim(), dikemas:Date.now() };
  localStorage.setItem('erph_ai', JSON.stringify(t));
  // segerak ke akaun — dibaca semula pada peranti lain semasa log masuk
  db.collection('pengguna').doc(S.user.email).collection('peribadi').doc('ai')
    .set({ ...t, dikemas:Date.now() }).catch(()=>{});
  toast('Tetapan AI disimpan & disegerak ke akaun','jaya');
}
async function muatAiAkaun(){
  try{
    const d = await db.collection('pengguna').doc(S.user.email).collection('peribadi').doc('ai').get();
    if(!d.exists) return;
    const jauh = d.data();
    const lokal = JSON.parse(localStorage.getItem('erph_ai') || '{}');
    // guna versi akaun jika peranti ini belum ada tetapan, atau versi akaun lebih baharu
    if(!lokal.key || (jauh.dikemas||0) > (lokal.dikemas||0)){
      localStorage.setItem('erph_ai', JSON.stringify({ prov:jauh.prov, key:jauh.key, model:jauh.model, baseUrl:jauh.baseUrl, dikemas:jauh.dikemas }));
    }
  }catch(e){}
}
async function ujiAI(){
  simpanAI(); sibuk(true,'Menguji sambungan AI…');
  try{ const r = await panggilAI('Jawab satu perkataan sahaja: OK'); sibuk(false); toast('Berjaya: '+r.trim().slice(0,40),'jaya'); }
  catch(e){ sibuk(false); modal('Ujian gagal', `<p style="font-size:13.5px;color:var(--merah)">${esc(e.message)}</p>
    <p style="font-size:12.5px;color:var(--teks-2);margin-top:10px">Semak API key, nama model dan Base URL. Jika ralat CORS, penyedia itu tidak membenarkan panggilan terus dari pelayar.</p>`); }
}
async function muatModel(){
  simpanAI(); sibuk(true,'Mendapatkan senarai model…');
  try{
    const senarai = await senaraiModel();
    sibuk(false);
    window._modelSenarai = senarai;
    $('#lsModel').innerHTML = senarai.map(m=>`<option value="${esc(m)}"></option>`).join('');
    modal('Pilih model', `<input placeholder="Cari model…" oninput="tapisModel(this.value)" style="margin-bottom:10px">
      <div id="mdSenarai" class="senarai" style="max-height:52vh;overflow:auto">
      ${senarai.map((m,i)=>`<div class="baris" onclick="pakaiModel(${i})" style="cursor:pointer">
        <div class="baris-t"><b style="font-size:13px">${esc(m)}</b></div>
        ${/:free|free$/i.test(m)?'<span class="pil hijau">Percuma</span>':''}</div>`).join('')}</div>`);
  }catch(e){ sibuk(false); toast(e.message,'salah'); }
}
function tapisModel(q){
  q = q.toLowerCase();
  Array.from($('#mdSenarai').children).forEach(el => el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none');
}
function pakaiModel(i){
  $('#aiModel').value = (window._modelSenarai||[])[i] || '';
  simpanAI(); tutupModal(); toast('Model dipilih','jaya');
}

async function kosongkanCache(){
  if('caches' in window){ const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
  if('serviceWorker' in navigator){ const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
  location.reload(true);
}
