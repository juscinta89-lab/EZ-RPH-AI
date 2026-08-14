/* ================= e-RPH AI — DATA & HALAMAN ASAS ================= */

function rujuk(sub){ return db.collection('sekolah').doc(S.sid).collection(sub); }

async function muatData(){
  if(!S.sid) return;
  const tahun = new Date().getFullYear();
  const [k, sj, jd, bk, tw, ada] = await Promise.all([
    rujuk('kelas').get(),
    rujuk('subjek').get(),
    rujuk('jadual').doc(S.user.email).get(),
    rujuk('buku').get(),
    rujuk('takwim').doc(String(tahun)).get(),
    rujuk('dskp').limit(1).get()
  ]);
  S.dskpAda = !ada.empty;
  S.kelas  = k.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.subjek = sj.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.jadual = jd.exists ? (jd.data().slot || []) : [];
  S.buku   = bk.docs.map(d => ({id:d.id, ...d.data()}));
  S.takwim = tw.exists ? tw.data() : null;
  await muatDskpJadual();
  await muatRph();
}

async function muatRph(){
  let q = rujuk('rph');
  q = (S.peranan === 'guru') ? q.where('emel','==',S.user.email) : q;
  const snap = await q.get();
  S.rph = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (b.tarikh||'').localeCompare(a.tarikh||''));
}

/* ---------- DSKP dimuat mengikut keperluan (koleksi boleh sangat besar) ---------- */
async function muatDskpJadual(){
  const subj = [...new Set(S.jadual.map(x => x.subjek).filter(Boolean))];
  S.dskp = [];
  for(let i=0;i<subj.length;i+=10){
    const q = await rujuk('dskp').where('subjek','in', subj.slice(i,i+10)).limit(3000).get();
    S.dskp.push(...q.docs.map(d => ({id:d.id, ...d.data()})));
  }
}
async function muatDskpSubjek(subjek, tahun){
  if(!subjek) return [];
  let q = rujuk('dskp').where('subjek','==',subjek);
  if(tahun) q = q.where('tahun','==',tahun);
  const snap = await q.limit(1500).get();
  const hasil = snap.docs.map(d => ({id:d.id, ...d.data()}));
  const idAda = new Set(S.dskp.map(x=>x.id));
  hasil.forEach(x => { if(!idAda.has(x.id)) S.dskp.push(x); });   // cache untuk AI & semakan
  return hasil;
}

/* ---------- Minggu persekolahan ---------- */
function janaMinggu(tw){
  if(!tw || !tw.mula || !tw.tamat) return [];
  const mulaHari = tw.mulaHari === 'isnin' ? 1 : 0;      // 0=Ahad, 1=Isnin
  const d = new Date(tw.mula + 'T00:00:00');
  while(d.getDay() !== mulaHari) d.setDate(d.getDate() - 1);
  const akhir = new Date(tw.tamat + 'T00:00:00');
  const cuti = (tw.cuti || []);
  const senarai = []; let no = 0; let guard = 0;
  while(d <= akhir && guard++ < 80){
    const m = new Date(d), h = new Date(d); h.setDate(h.getDate() + 6);
    const c = cuti.find(x => tarikhISO(m) <= x.tamat && tarikhISO(h) >= x.mula &&
                             tarikhISO(m) >= x.mula && tarikhISO(h) <= x.tamat);
    if(c) senarai.push({ no:null, label:c.nama || 'Cuti', mula:tarikhISO(m), tamat:tarikhISO(h) });
    else  senarai.push({ no:++no, label:'Minggu '+no, mula:tarikhISO(m), tamat:tarikhISO(h) });
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
  dskp:   ['tahun','subjek','bidang','tajuk','kod_sk','standard_kandungan','kod_sp','standard_pembelajaran','tp'],
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
    ['DSKP', !!S.dskpAda, 'dskp'],
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
    <div class="senarai">${S.kelas.length ? S.kelas.map(k => `
      <div class="baris">
        <div class="baris-t"><b>${esc(k.nama)}</b><small>${esc(k.tahap||'')} · ${k.bilangan||0} murid${k.nota?' · '+esc(k.nota):''}</small></div>
        <button class="btn btn-sm" onclick="formKelas('${k.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="hapusItem('kelas','${k.id}')">Padam</button>
      </div>`).join('') : `<div class="kosong"><b>Belum ada kelas</b>Tambah kelas yang anda ajar, contoh: Tahun 6 Amanah.</div>`}
    </div>`;
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
    <div class="senarai">${S.subjek.length ? S.subjek.map(s => `
      <div class="baris">
        <div class="baris-t"><b>${esc(s.nama)}</b><small>${esc(s.peringkat||'—')}${s.kod?' · '+esc(s.kod):''}</small></div>
        <button class="btn btn-sm" onclick="formSubjek('${s.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="hapusItem('subjek','${s.id}')">Padam</button>
      </div>`).join('') : `<div class="kosong"><b>Belum ada subjek</b>Tambah sendiri atau muat senarai pratetap.</div>`}
    </div>`;
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
    sibuk(true,'Memadam…'); await rujuk(koleksi).doc(id).delete(); await muatData();
    sibuk(false); pergi(S.hal); toast('Rekod dipadam');
  });
}

/* ================= TAKWIM ================= */
function halTakwim(){
  const tahun = new Date().getFullYear();
  const tw = S.takwim;
  const minggu = janaMinggu(tw);
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Takwim ${tahun}</h3><small>${minggu.filter(m=>m.no).length} minggu persekolahan</small></div>
      ${!tw ? `<div class="kosong"><b>Takwim belum ditetapkan</b>Sila masukkan atau import takwim rasmi KPM bagi tahun berkenaan.</div>` : ''}
      <div class="grid2">
        <label class="fld"><span>Tarikh mula sesi</span><input id="twMula" type="date" value="${esc(tw?.mula||'')}"></label>
        <label class="fld"><span>Tarikh akhir sesi</span><input id="twTamat" type="date" value="${esc(tw?.tamat||'')}"></label>
      </div>
      <label class="fld"><span>Hari mula minggu <em>(Ahad untuk KEL/TRG/JHR/KDH)</em></span>
        <select id="twHari"><option value="ahad" ${tw?.mulaHari!=='isnin'?'selected':''}>Ahad</option>
        <option value="isnin" ${tw?.mulaHari==='isnin'?'selected':''}>Isnin</option></select></label>
      <button class="btn btn-primary" onclick="simpanTakwim()">Simpan takwim</button>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Cuti & tiada PdP</h3>
        <button class="btn btn-sm" onclick="formCuti()">+ Tambah</button>
        <button class="btn btn-sm" onclick="importCuti()">📥 Import Excel/CSV</button>
        <button class="btn btn-sm" onclick="templatExcel('templat-cuti.xlsx',TEMPLAT.cuti,[['Cuti Penggal 1','2026-03-21','2026-03-29']])">⬇️ Templat</button></div>
      ${(tw?.cuti||[]).length ? `<div class="senarai">${tw.cuti.sort((a,b)=>a.mula.localeCompare(b.mula)).map((c,i)=>`
        <div class="baris"><div class="baris-t"><b>${esc(c.nama)}</b><small>${tarikhCantik(c.mula)} — ${tarikhCantik(c.tamat)}</small></div>
        <button class="btn btn-sm btn-danger" onclick="hapusCuti(${i})">✕</button></div>`).join('')}</div>`
        : `<div class="kosong">Tiada rekod cuti. Tambah cuti penggal, cuti perayaan atau cuti umum.</div>`}
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">Format CSV: <code>nama,mula(YYYY-MM-DD),tamat(YYYY-MM-DD)</code></p>
    </div>

    ${minggu.length ? `<div class="kad"><div class="kad-h"><h3>Minggu persekolahan</h3></div>
      <div class="tbl-scroll"><table><tr><th>Minggu</th><th>Mula</th><th>Tamat</th></tr>
      ${minggu.map(m=>`<tr><td>${m.no?`<span class="pil biru">${m.label}</span>`:`<span class="pil kelabu">${esc(m.label)}</span>`}</td>
        <td>${m.mula}</td><td>${m.tamat}</td></tr>`).join('')}</table></div></div>` : ''}`;
}
async function simpanTakwim(){
  const tahun = String(new Date().getFullYear());
  const d = { tahun, mula:$('#twMula').value, tamat:$('#twTamat').value, mulaHari:$('#twHari').value, cuti:(S.takwim?.cuti||[]) };
  if(!d.mula || !d.tamat) return toast('Isi tarikh mula dan akhir sesi','salah');
  sibuk(true,'Menyimpan…'); await rujuk('takwim').doc(tahun).set(d,{merge:true});
  await muatData(); sibuk(false); pergi('takwim'); toast('Takwim disimpan','jaya');
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
  const tahun = String(new Date().getFullYear());
  const cuti = [...(S.takwim?.cuti||[]), c];
  await rujuk('takwim').doc(tahun).set({ tahun, cuti },{merge:true});
  await muatData(); tutupModal(); pergi('takwim'); toast('Cuti ditambah','jaya');
}
function hapusCuti(i){
  sahkan('Padam rekod cuti ini?', async () => {
    const cuti = (S.takwim.cuti||[]).filter((_,x)=> x !== i);
    await rujuk('takwim').doc(String(new Date().getFullYear())).set({ cuti },{merge:true});
    await muatData(); pergi('takwim'); toast('Cuti dipadam');
  });
}
function importCuti(){
  pilihFail('.csv,.txt', async teks => {
    const rows = parseCSV(teks).filter(r => r.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(r[1]));
    if(!rows.length) return toast('Format CSV tidak dikenali','salah');
    const cuti = [...(S.takwim?.cuti||[]), ...rows.map(r => ({nama:r[0], mula:r[1], tamat:r[2]}))];
    sibuk(true,'Mengimport…');
    await rujuk('takwim').doc(String(new Date().getFullYear())).set({ tahun:String(new Date().getFullYear()), cuti },{merge:true});
    await muatData(); sibuk(false); pergi('takwim'); toast(rows.length+' rekod cuti diimport','jaya');
  });
}

/* ================= DSKP ================= */
let dskpHasil = [];
function halDskp(){
  const sjJadual = [...new Set(S.jadual.map(x=>x.subjek).filter(Boolean))];
  const senaraiSubjek = [...new Set([...sjJadual, ...S.subjek.map(x=>x.nama)])].sort();
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Cari DSKP</h3><small>${S.dskpAda ? 'Pangkalan data tersedia' : 'Pangkalan data kosong'}</small></div>
      <div class="toolbar" style="margin:0">
        <select id="dsSubjek"><option value="">— Pilih subjek —</option>
          ${senaraiSubjek.map(x=>`<option ${sjJadual.includes(x)?'selected':''}>${esc(x)}</option>`).join('')}</select>
        <select id="dsTahun"><option value="">Semua tahun</option>
          ${['Prasekolah','Tahun 1','Tahun 2','Tahun 3','Tahun 4','Tahun 5','Tahun 6'].map(x=>`<option>${x}</option>`).join('')}</select>
        <button class="btn btn-primary" onclick="cariDskp()">Papar</button>
      </div>
      <div class="toolbar" style="margin:12px 0 0">
        <input id="dsCari" placeholder="Tapis SK, SP atau tajuk…" oninput="lukisDskp()">
        <button class="btn" onclick="formDskp()">+ Tambah</button>
        <button class="btn" onclick="importDskp()">📥 Import Excel/CSV</button>
        <button class="btn" onclick="templatExcel('templat-dskp.xlsx',TEMPLAT.dskp)">⬇️ Templat</button>
      </div>
    </div>
    <div id="dsSenarai"><div class="kosong"><b>Pilih subjek untuk mula</b>DSKP dimuat mengikut subjek supaya app kekal pantas walaupun ada puluhan ribu rekod.</div></div>`;
}
async function cariDskp(){
  const sj = $('#dsSubjek').value, th = $('#dsTahun').value;
  if(!sj) return toast('Pilih subjek dahulu','salah');
  sibuk(true,'Memuatkan DSKP…');
  dskpHasil = await muatDskpSubjek(sj, th);
  sibuk(false); lukisDskp();
  if(!dskpHasil.length) toast('Tiada rekod untuk pilihan ini','salah');
}
function lukisDskp(){
  const q = ($('#dsCari')?.value || '').toLowerCase();
  const hasil = dskpHasil.filter(d => !q || JSON.stringify(d).toLowerCase().includes(q));
  $('#dsSenarai').innerHTML = hasil.length ? `<div class="senarai">${hasil.slice(0,300).map(d => `
    <div class="baris"><div class="baris-t">
      <b>${esc(d.kodSp||d.kodSk||'—')} ${esc((d.sp||d.sk||'').slice(0,120))}</b>
      <small>${esc(d.subjek)} ${esc(d.tahun)} · ${esc(d.bidang||'')} ${d.tajuk?'· '+esc(d.tajuk):''}</small></div>
      <button class="btn btn-sm" onclick="formDskp('${d.id}')">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="hapusItem('dskp','${d.id}')">✕</button></div>`).join('')}
    ${hasil.length>300?'<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:10px">Menunjukkan 300 daripada '+hasil.length+' rekod</p>':''}</div>`
    : `<div class="kosong"><b>Tiada rekod dipaparkan</b>Pilih subjek dan tekan Papar, atau import fail DSKP.</div>`;
}

function formDskp(id){
  const d = S.dskp.find(x => x.id === id) || {};
  modal(id?'Edit DSKP':'Tambah DSKP', `
    <div class="grid2">
      <label class="fld"><span>Tahun / Tingkatan</span><input id="fdTahun" value="${esc(d.tahun||'')}" placeholder="Tahun 6"></label>
      <label class="fld"><span>Subjek</span><input id="fdSubjek" value="${esc(d.subjek||'')}" placeholder="Bahasa Melayu" list="lsSubjek">
        <datalist id="lsSubjek">${S.subjek.map(s=>`<option>${esc(s.nama)}</option>`).join('')}</datalist></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>Bidang</span><input id="fdBidang" value="${esc(d.bidang||'')}"></label>
      <label class="fld"><span>Tajuk</span><input id="fdTajuk" value="${esc(d.tajuk||'')}"></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>Kod SK</span><input id="fdKodSk" value="${esc(d.kodSk||'')}" placeholder="1.1"></label>
      <label class="fld"><span>Kod SP</span><input id="fdKodSp" value="${esc(d.kodSp||'')}" placeholder="1.1.1"></label>
    </div>
    <label class="fld"><span>Standard Kandungan</span><textarea id="fdSk">${esc(d.sk||'')}</textarea></label>
    <label class="fld"><span>Standard Pembelajaran</span><textarea id="fdSp">${esc(d.sp||'')}</textarea></label>
    <label class="fld"><span>Standard Prestasi (TP)</span><textarea id="fdTp" placeholder="TP1: … TP2: …">${esc(d.tp||'')}</textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanDskp('${id||''}')">Simpan</button>`);
}
async function simpanDskp(id){
  const d = { tahun:$('#fdTahun').value.trim(), subjek:$('#fdSubjek').value.trim(), bidang:$('#fdBidang').value.trim(),
    tajuk:$('#fdTajuk').value.trim(), kodSk:$('#fdKodSk').value.trim(), kodSp:$('#fdKodSp').value.trim(),
    sk:$('#fdSk').value.trim(), sp:$('#fdSp').value.trim(), tp:$('#fdTp').value.trim() };
  if(!d.subjek || !d.sp) return toast('Subjek dan Standard Pembelajaran diperlukan','salah');
  sibuk(true,'Menyimpan…');
  id ? await rujuk('dskp').doc(id).update(d) : await rujuk('dskp').add(d);
  await muatData(); sibuk(false); tutupModal(); pergi('dskp'); toast('DSKP disimpan','jaya');
}
function importDskp(){
  pilihFail('.csv,.txt', teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /tahun/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r.length >= 8 && r[1] && r[7]);
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    window._dskpRows = rows;
    const kira = {};
    rows.forEach(r => kira[r[1]] = (kira[r[1]]||0) + 1);
    const senarai = Object.entries(kira).sort((a,b)=> b[1]-a[1]);
    const guna = new Set(S.jadual.map(x=>x.subjek));
    modal('Pilih subjek untuk diimport', `
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:12px">
        Fail ini ada <b>${rows.length}</b> baris daripada <b>${senarai.length}</b> subjek.
        Import subjek yang diajar di sekolah anda sahaja — setiap baris jadi satu dokumen Firestore.</p>
      <div class="toolbar" style="margin-bottom:10px">
        <button class="btn btn-sm" onclick="tandaSubjek(true)">Tanda semua</button>
        <button class="btn btn-sm" onclick="tandaSubjek(false)">Buang semua</button></div>
      <div style="max-height:44vh;overflow:auto">${senarai.map(([nama,n],i)=>`
        <label style="display:flex;gap:9px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--garis);font-size:13.5px">
          <input type="checkbox" class="dsPilih" value="${esc(nama)}" ${guna.has(nama)?'checked':''} style="width:auto">
          <span style="flex:1">${esc(nama)}</span>
          <span class="pil kelabu">${n}</span></label>`).join('')}</div>
      <p id="dsKiraan" style="margin-top:10px;font-size:12.5px;color:var(--teks-3)"></p>`,
      `<button class="btn" onclick="tutupModal()">Batal</button>
       <button class="btn btn-primary" onclick="jalankanImportDskp()">Import subjek dipilih</button>`);
  });
}
function tandaSubjek(on){ $$('.dsPilih').forEach(c => c.checked = on); }

async function jalankanImportDskp(){
  const pilih = new Set($$('.dsPilih').filter(c => c.checked).map(c => c.value));
  if(!pilih.size) return toast('Tanda sekurang-kurangnya satu subjek','salah');
  const rows = (window._dskpRows||[]).filter(r => pilih.has(r[1]));
  if(!rows.length) return toast('Tiada baris untuk subjek dipilih','salah');
  tutupModal();
  if(rows.length > 8000 && !confirm(rows.length+' rekod akan ditulis ke Firestore. Ini mungkin mengambil masa dan menggunakan kuota harian. Teruskan?')) return;
  let siap = 0;
  for(let i=0;i<rows.length;i+=400){
    sibuk(true,`Mengimport ${siap}/${rows.length} rekod…`);
    const b = db.batch();
    rows.slice(i,i+400).forEach(r => b.set(rujuk('dskp').doc(), {
      tahun:(r[0]||'').trim(), subjek:(r[1]||'').trim(), bidang:(r[2]||'').trim(), tajuk:(r[3]||'').trim(),
      kodSk:(r[4]||'').trim(), sk:(r[5]||'').trim(), kodSp:(r[6]||'').trim(), sp:(r[7]||'').trim(), tp:(r[8]||'').trim() }));
    await b.commit(); siap += Math.min(400, rows.length - i);
  }
  S.dskpAda = true;
  await muatDskpJadual(); sibuk(false); pergi('dskp');
  toast(rows.length+' rekod DSKP diimport','jaya');
}

/* ================= BUKU TEKS ================= */
function halBuku(){
  $('#kandungan').innerHTML = `
    <div class="toolbar"><button class="btn btn-primary" onclick="formBuku()">+ Tambah bab/unit</button>
      <button class="btn btn-ungu" onclick="formPdfBuku()">📄 Import PDF buku teks</button>
      <button class="btn" onclick="importBuku()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-bukuteks.xlsx',TEMPLAT.buku)">⬇️ Templat</button></div>
    <div class="kad" style="margin-bottom:14px"><p style="font-size:12.5px;color:var(--teks-2)">
      Format CSV: <code>tahun,subjek,buku,bab,unit,tajuk,kandungan</code><br>
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
      <div class="kad-h"><h3>Enjin AI</h3><small>Kunci disimpan dalam peranti ini sahaja</small></div>
      <label class="fld"><span>Penyedia</span><select id="aiProv" onchange="tukarProv()">
        <option value="gemini" ${ai.prov==='gemini'?'selected':''}>Google Gemini</option>
        <option value="openai" ${ai.prov==='openai'?'selected':''}>OpenAI</option>
        <option value="claude" ${ai.prov==='claude'?'selected':''}>Anthropic Claude</option>
      </select></label>
      <label class="fld"><span>Model</span><input id="aiModel" value="${esc(ai.model)}"></label>
      <label class="fld"><span>API Key</span><input id="aiKey" type="password" value="${esc(ai.key)}" placeholder="Tampal kunci API di sini"></label>
      <div class="toolbar" style="margin:0">
        <button class="btn btn-primary" onclick="simpanAI()">Simpan tetapan AI</button>
        <button class="btn" onclick="ujiAI()">Uji sambungan</button>
      </div>
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">Aplikasi ini statik (GitHub Pages), jadi panggilan AI dibuat terus dari pelayar. Gunakan kunci berkuota terhad dan jangan kongsi peranti.</p>
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
    </div>`;
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
  const model = { gemini:'gemini-2.0-flash', openai:'gpt-4o-mini', claude:'claude-sonnet-4-6' };
  return { prov:t.prov||'gemini', key:t.key||'', model:t.model || model[t.prov||'gemini'] };
}
function tukarProv(){
  const m = { gemini:'gemini-2.0-flash', openai:'gpt-4o-mini', claude:'claude-sonnet-4-6' };
  $('#aiModel').value = m[$('#aiProv').value];
}
function simpanAI(){
  localStorage.setItem('erph_ai', JSON.stringify({ prov:$('#aiProv').value, key:$('#aiKey').value.trim(), model:$('#aiModel').value.trim() }));
  toast('Tetapan AI disimpan','jaya');
}
async function ujiAI(){
  sibuk(true,'Menguji sambungan AI…');
  try{ const r = await panggilAI('Jawab satu perkataan sahaja: OK'); sibuk(false); toast('AI bersambung: '+r.slice(0,40),'jaya'); }
  catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}
async function kosongkanCache(){
  if('caches' in window){ const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
  if('serviceWorker' in navigator){ const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
  location.reload(true);
}
