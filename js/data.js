/* ================= e-RPH AI — DATA & HALAMAN ASAS ================= */

function rujuk(sub){ return db.collection('sekolah').doc(S.sid).collection(sub); }

async function muatData(){
  if(!S.sid) return;
  const tahun = new Date().getFullYear();
  const [k, sj, jd, dk, bk, tw] = await Promise.all([
    rujuk('kelas').get(),
    rujuk('subjek').get(),
    rujuk('jadual').doc(S.user.email).get(),
    rujuk('dskp').get(),
    rujuk('buku').get(),
    rujuk('takwim').doc(String(tahun)).get()
  ]);
  S.kelas  = k.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.subjek = sj.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (a.nama||'').localeCompare(b.nama||''));
  S.jadual = jd.exists ? (jd.data().slot || []) : [];
  S.dskp   = dk.docs.map(d => ({id:d.id, ...d.data()}));
  S.buku   = bk.docs.map(d => ({id:d.id, ...d.data()}));
  S.takwim = tw.exists ? tw.data() : null;
  await muatRph();
}

async function muatRph(){
  let q = rujuk('rph');
  q = (S.peranan === 'guru') ? q.where('emel','==',S.user.email) : q;
  const snap = await q.get();
  S.rph = snap.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=> (b.tarikh||'').localeCompare(a.tarikh||''));
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
    ['DSKP', S.dskp.length > 0, 'dskp'],
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
function halDskp(){
  const subjekUnik = [...new Set(S.dskp.map(d => d.subjek))].sort();
  $('#kandungan').innerHTML = `
    <div class="toolbar">
      <input id="dsCari" placeholder="Cari SK, SP atau tajuk…" oninput="lukisDskp()">
      <select id="dsSubjek" onchange="lukisDskp()"><option value="">Semua subjek</option>
        ${subjekUnik.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
      <button class="btn btn-primary" onclick="formDskp()">+ Tambah</button>
      <button class="btn" onclick="importDskp()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-dskp.xlsx',TEMPLAT.dskp)">⬇️ Templat</button>
    </div>
    <div class="kad" style="margin-bottom:14px">
      <p style="font-size:12.5px;color:var(--teks-2)">Format CSV DSKP (baris pertama diabaikan jika ia tajuk):<br>
      <code>tahun,subjek,bidang,tajuk,kod_sk,standard_kandungan,kod_sp,standard_pembelajaran,tp</code></p>
    </div>
    <div id="dsSenarai"></div>`;
  lukisDskp();
}
function lukisDskp(){
  const q = ($('#dsCari')?.value || '').toLowerCase();
  const sj = $('#dsSubjek')?.value || '';
  const hasil = S.dskp.filter(d =>
    (!sj || d.subjek === sj) &&
    (!q || JSON.stringify(d).toLowerCase().includes(q)));
  $('#dsSenarai').innerHTML = hasil.length ? `<div class="senarai">${hasil.slice(0,300).map(d => `
    <div class="baris"><div class="baris-t">
      <b>${esc(d.kodSp||d.kodSk||'—')} · ${esc(d.sp||d.sk||'')}</b>
      <small>${esc(d.subjek)} ${esc(d.tahun)} · ${esc(d.bidang||'')} ${d.tajuk?'· '+esc(d.tajuk):''}</small></div>
      <button class="btn btn-sm" onclick="formDskp('${d.id}')">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="hapusItem('dskp','${d.id}')">✕</button></div>`).join('')}
    ${hasil.length>300?'<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:10px">Menunjukkan 300 daripada '+hasil.length+' rekod</p>':''}</div>`
    : `<div class="kosong"><b>Tiada rekod DSKP</b>Import CSV DSKP atau tambah Standard Pembelajaran secara manual.<br>
       <small>AI tidak akan mencipta Standard Pembelajaran sendiri.</small></div>`;
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
  pilihFail('.csv,.txt', async teks => {
    let rows = parseCSV(teks);
    if(rows[0] && /tahun/i.test(rows[0][0])) rows = rows.slice(1);
    rows = rows.filter(r => r.length >= 8 && r[1]);
    if(!rows.length) return toast('Tiada baris sah dijumpai','salah');
    sibuk(true,'Mengimport '+rows.length+' rekod…');
    for(let i=0;i<rows.length;i+=400){
      const b = db.batch();
      rows.slice(i,i+400).forEach(r => b.set(rujuk('dskp').doc(), {
        tahun:r[0], subjek:r[1], bidang:r[2], tajuk:r[3], kodSk:r[4], sk:r[5], kodSp:r[6], sp:r[7], tp:r[8]||'' }));
      await b.commit();
    }
    await muatData(); sibuk(false); pergi('dskp'); toast(rows.length+' rekod DSKP diimport','jaya');
  });
}

/* ================= BUKU TEKS ================= */
function halBuku(){
  $('#kandungan').innerHTML = `
    <div class="toolbar"><button class="btn btn-primary" onclick="formBuku()">+ Tambah bab/unit</button>
      <button class="btn" onclick="importBuku()">📥 Import Excel/CSV</button>
      <button class="btn" onclick="templatExcel('templat-bukuteks.xlsx',TEMPLAT.buku)">⬇️ Templat</button></div>
    <div class="kad" style="margin-bottom:14px"><p style="font-size:12.5px;color:var(--teks-2)">
      Format CSV: <code>tahun,subjek,buku,bab,unit,tajuk,kandungan</code><br>
      Masukkan hanya bahan yang anda ada hak untuk gunakan. AI hanya merujuk kandungan yang dimasukkan di sini.</p></div>
    <div class="senarai">${S.buku.length ? S.buku.map(b => `
      <div class="baris"><div class="baris-t"><b>${esc(b.tajuk||b.unit||'—')}</b>
        <small>${esc(b.subjek)} ${esc(b.tahun)} · ${esc(b.buku||'')} ${b.bab?'· Bab '+esc(b.bab):''} ${b.unit?'· '+esc(b.unit):''}</small></div>
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
    <label class="fld"><span>Ringkasan kandungan</span><textarea id="fbIsi" placeholder="Isi pelajaran, aktiviti dalam buku, latihan…">${esc(b.kandungan||'')}</textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanBuku('${id||''}')">Simpan</button>`);
}
async function simpanBuku(id){
  const d = { tahun:$('#fbTahun').value.trim(), subjek:$('#fbSubjek').value.trim(), buku:$('#fbBuku').value.trim(),
    bab:$('#fbBab').value.trim(), unit:$('#fbUnit').value.trim(), tajuk:$('#fbTajuk').value.trim(), kandungan:$('#fbIsi').value.trim() };
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
