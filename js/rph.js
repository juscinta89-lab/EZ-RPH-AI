/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* ================= e-RPH AI — RPH ================= */

function barisRph(r, ringkas){
  const w = { lengkap:'hijau', draf:'kuning' }[r.status] || 'kelabu';
  const [gelap, cerah] = warnaSubjek(r.subjek);
  return `<div class="baris baris-sj" style="--sj:${gelap};--sj-t:${cerah}">
    <span class="sj-jalur"></span>
    <div class="baris-t"><b>${esc(r.subjek)} <span class="sj-kelas">${esc(r.kelas)}</span></b>
      <small>${ringkas ? '' : tarikhCantik(r.tarikh)+' · '}${esc(r.mula)}-${esc(r.tamat)} · ${esc(r.tajuk||'Tiada tajuk')}</small></div>
    <span class="pil ${w}">${r.status === 'lengkap' ? 'Lengkap' : 'Draf'}</span>
    <button class="btn btn-sm" onclick="bukaRph('${r.id}')">Buka</button>
  </div>`;
}

/* ================= SENARAI RPH ================= */
function halRph(){
  $('#kandungan').innerHTML = `
    <div class="lekat"><div class="toolbar" style="margin:0">
      <input id="rCari" placeholder="Cari tajuk, subjek, kelas…" oninput="lukisRph()">
      <select id="rStatus" onchange="lukisRph()"><option value="">Semua status</option>
        <option value="lengkap">Lengkap</option><option value="draf">Draf</option></select>
      <select id="rSubjek" onchange="lukisRph()"><option value="">Semua subjek</option>
        ${[...new Set(S.rph.map(r=>r.subjek))].sort().map(s=>`<option>${esc(s)}</option>`).join('')}</select>
      <button class="btn btn-primary btn-sm" onclick="pergi('jana')">✨ Jana</button>
      <button class="btn btn-sm" onclick="pergi('cetak')">🖨️ Cetak</button>
    </div></div>
    <div id="rSenarai"></div>`;
  lukisRph();
}
function lukisRph(){
  const q = ($('#rCari')?.value||'').toLowerCase();
  const st = $('#rStatus')?.value || '', sj = $('#rSubjek')?.value || '';
  const hasil = S.rph.filter(r => (!st || r.status === st) && (!sj || r.subjek === sj) &&
    (!q || [r.tajuk,r.subjek,r.kelas,r.sp,r.tema,r.tarikh,r.minggu].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=> (b.tarikh+(b.mula||'')).localeCompare(a.tarikh+(a.mula||'')));   // terkini dahulu

  if(!hasil.length){
    $('#rSenarai').innerHTML = `<div class="kosong"><b>Tiada RPH dijumpai</b>Jana RPH pertama anda daripada jadual waktu.</div>`;
    return;
  }

  // Kumpul: minggu -> tarikh -> senarai
  const ikutMinggu = new Map();
  hasil.slice(0, 400).forEach(r => {
    const mg = r.minggu || mingguUntuk(r.tarikh) || 'Tanpa minggu';
    if(!ikutMinggu.has(mg)) ikutMinggu.set(mg, new Map());
    const hari = ikutMinggu.get(mg);
    if(!hari.has(r.tarikh)) hari.set(r.tarikh, []);
    hari.get(r.tarikh).push(r);
  });

  const TON = ['#4a2ae0','#16a37b','#e0781a','#1f6df5','#b0349c','#0f9aa8'];
  let html = ''; let n = 0;
  for(const [mg, hariMap] of ikutMinggu){
    const jumlah = [...hariMap.values()].reduce((j,a)=>j+a.length,0);
    const lengkap = [...hariMap.values()].flat().filter(r=>r.status==='lengkap').length;
    const ton = TON[n++ % TON.length];
    html += `<section class="mgg-kad" style="--ton:${ton}">
      <header class="mgg-kepala">
        <span class="mgg-tanda"></span>
        <b>${esc(mg)}</b>
        <span class="pil" style="background:${ton}1a;color:${ton}">${jumlah} RPH</span>
        ${lengkap<jumlah?`<span class="pil kuning">${jumlah-lengkap} draf</span>`:'<span class="pil hijau">Semua lengkap</span>'}
        <button class="btn btn-sm" style="margin-left:auto" onclick="cetakMinggu2('${esc(mg)}')">Cetak minggu</button>
      </header>
      ${[...hariMap].map(([tarikh, senarai]) => `
        <div class="hari-blok">
          <div class="grp-hari"><span class="hari-titik"></span>${tarikhCantik(tarikh)}
            <small>· ${senarai.length} RPH</small>
            <button class="btn btn-sm ikon-btn-kecil" title="Cetak hari ini" onclick="cetakHari('${tarikh}')">🖨️</button></div>
          <div class="senarai senarai-rapat">${senarai.sort((a,b)=>(a.mula||'').localeCompare(b.mula||''))
            .map(r => barisRph(r, true)).join('')}</div>
        </div>`).join('')}
    </section>`;
  }
  if(hasil.length > 400) html += '<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:12px">Menunjukkan 400 RPH terkini — guna carian untuk yang lain</p>';
  $('#rSenarai').innerHTML = html;
}
function cetakTapisan(){ pergi('cetak'); }
function cetakMinggu2(label){
  const senarai = S.rph.filter(r => (r.minggu || mingguUntuk(r.tarikh) || 'Tanpa minggu') === label);
  cetakBanyak(senarai);
}

/* ================= JANA RPH ================= */
function halJana(){
  const hariIni = tarikhISO();
  if(!S.jadual.length){
    $('#kandungan').innerHTML = `<div class="kosong"><b>Jadual waktu diperlukan</b>Sistem menjana RPH berdasarkan jadual waktu sebenar anda.<br><br>
      <button class="btn btn-primary" onclick="pergi('jadual')">Tetapkan jadual waktu</button></div>`; return;
  }
  const minggu = janaMinggu(S.takwim).filter(m => m.no);
  const mggIni = janaMinggu(S.takwim).find(m => hariIni >= m.mula && hariIni <= m.tamat);
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Jana satu RPH</h3><small>Pilih tarikh — sistem cari minggu & RPT sendiri</small></div>
      <div class="grid2">
        <label class="fld"><span>Tarikh</span><input id="jgTarikh" type="date" value="${hariIni}" onchange="segarJana()"></label>
        <label class="fld"><span>Minggu persekolahan</span>
          <div id="jgMingguPapar" style="padding:11px 13px;border:1px solid var(--garis);border-radius:var(--r-sm);background:var(--bg);font-weight:600">—</div></label>
      </div>
      <div id="jgSlot"></div>
      <div id="jgRpt"></div>
      <label class="fld"><span>Arahan khas kepada AI <em>(pilihan)</em></span>
        <input id="jgArahan" placeholder="Cth: banyakkan aktiviti kumpulan, murid tahap sederhana"></label>
      <button class="btn btn-primary btn-block" onclick="janaSatu()">✨ Jana RPH dengan AI</button>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Jana RPH seminggu</h3><small>Semua slot dalam minggu dipilih</small></div>
      <label class="fld"><span>Minggu persekolahan</span><select id="jgMinggu">
        ${minggu.map(m=>`<option value="${m.mula}" ${mggIni&&m.mula===mggIni.mula?'selected':''}>${m.label} (${m.mula} — ${m.tamat})</option>`).join('')
          || '<option value="">Takwim belum ditetapkan</option>'}</select></label>
      <label class="fld"><span>Tapis subjek <em>(pilihan)</em></span><select id="jgTapis">
        <option value="">Semua subjek</option>${S.subjek.map(s=>`<option>${esc(s.nama)}</option>`).join('')}</select></label>
      <button class="btn btn-ungu btn-block" onclick="janaMingguan()">✨ Jana RPH minggu ini</button>
      <p style="font-size:12px;color:var(--teks-3);margin-top:10px">Setiap slot mengikut baris RPT minggu berkenaan secara automatik. Slot yang sudah ada RPH dilangkau; semua hasil disimpan sebagai <b>draf</b>.</p>
    </div>`;
  segarJana();
}

function segarJana(){
  const t = $('#jgTarikh').value;
  const hari = namaHari(t);
  const mgg = mingguUntuk(t);
  const cuti = cutiPada(t);
  $('#jgMingguPapar').innerHTML = mgg
    ? `<span class="pil biru">${esc(mgg)}</span>${cuti ? ' <span class="pil merah">'+esc(cuti.nama)+'</span>' : ''}`
    : '<span style="color:var(--merah);font-weight:500">Takwim belum meliputi tarikh ini</span>';
  const slot = S.jadual.filter(x => x.hari === hari).sort((a,b)=> a.mula.localeCompare(b.mula));
  $('#jgSlot').innerHTML = `<label class="fld"><span>Slot PdP · ${hari}</span>
    ${slot.length ? `<select id="jgPilih" onchange="segarRptJana()">${slot.map(x=>`<option value="${x.id}">${esc(x.mula)}-${esc(x.tamat)} · ${esc(x.subjek)} · ${esc(x.kelas)} (${minit(x.mula,x.tamat)} min)</option>`).join('')}</select>`
      : `<div class="kosong" style="padding:16px">Tiada slot pada ${hari}.</div>`}</label>`;
  segarRptJana();
}

function segarRptJana(){
  const kotak = $('#jgRpt'); if(!kotak) return;
  const sel = $('#jgPilih');
  if(!sel){ kotak.innerHTML = ''; return; }
  const slot = S.jadual.find(x => x.id === sel.value);
  const t = $('#jgTarikh').value;
  const kelas = S.kelas.find(k => norma(k.nama) === norma(slot.kelas));
  const mgg = mingguUntuk(t);
  const rpt = rptUntuk(slot.subjek, kelas?.tahun || '', mgg);
  window._janaRpt = rpt.minggu;
  window._janaRptSemua = rpt.semua;

  /* Guru sering melangkau atau mendahului tajuk mengikut keadaan sebenar kelas,
     jadi seluruh RPT subjek ini boleh dipilih, bukan baris minggu semasa sahaja. */
  const nSekarang = noMinggu(mgg);
  const pilihanLain = rpt.semua.length ? `
    <details class="jg-lain" ${rpt.minggu.length ? '' : 'open'}>
      <summary>📚 Pilih tajuk daripada minggu lain <em>(${rpt.semua.length} baris RPT)</em></summary>
      <p class="jg-nota">Guna ini jika kelas anda mendahului atau ketinggalan daripada RPT.
        Minggu dalam RPH kekal ${esc(mgg || 'minggu semasa')}; hanya tajuk dan SP yang diambil dari baris lain.</p>
      <label class="fld" style="margin:0"><span>Baris RPT</span>
        <select id="jgRptLain" onchange="tandaRptLain()">
          <option value="">${rpt.minggu.length ? '— Ikut RPT minggu semasa —' : '— Tiada, saya taip tajuk sendiri —'}</option>
          ${rpt.semua.map((r,i) => {
            const n = noMinggu(r.minggu);
            const jauh = n && nSekarang ? (n > nSekarang ? ` · ${n-nSekarang} minggu ke hadapan`
                                        : n < nSekarang ? ` · ${nSekarang-n} minggu ke belakang` : ' · minggu ini') : '';
            return `<option value="${i}">${esc(r.minggu||'—')}${jauh} — ${esc((r.tajuk||r.tema||'Tanpa tajuk').slice(0,60))}</option>`;
          }).join('')}
        </select></label>
      <div id="jgRptLainInfo"></div>
    </details>` : '';

  const manual = `
    <details class="jg-lain jg-manual" id="jgManualBox" ontoggle="tandaRptManual()">
      <summary>✍️ Tulis sendiri — <em>Custom SK / SP</em></summary>
      <p class="jg-nota">Isi mana-mana ruang di bawah untuk mengatasi RPT sepenuhnya. AI akan
        membina objektif, kriteria kejayaan, aktiviti dan bahagian lain berdasarkan apa yang anda tulis.
        Biarkan kosong untuk terus mengikut RPT.</p>
      <label class="fld"><span>Tajuk / kemahiran</span>
        <input id="jgMTajuk" oninput="tandaRptManual()" placeholder="Cth: Ayat aktif dan ayat pasif"></label>
      <div class="grid2">
        <label class="fld"><span>Kod SK</span>
          <input id="jgMKodSk" oninput="tandaRptManual()" placeholder="Cth: 5.3"></label>
        <label class="fld"><span>Kod SP</span>
          <input id="jgMKodSp" oninput="tandaRptManual()" placeholder="Cth: 5.3.2"></label>
      </div>
      <label class="fld"><span>Standard Kandungan</span>
        <textarea id="jgMSk" rows="2" oninput="tandaRptManual()" placeholder="Salin daripada DSKP"></textarea></label>
      <label class="fld"><span>Standard Pembelajaran</span>
        <textarea id="jgMSp" rows="2" oninput="tandaRptManual()" placeholder="Salin daripada DSKP"></textarea></label>
      <label class="fld" style="margin-bottom:0"><span>Standard Prestasi / TP <em>(pilihan)</em></span>
        <input id="jgMTp" oninput="tandaRptManual()" placeholder="Cth: TP3"></label>
      <div id="jgManualInfo"></div>
    </details>`;

  if(!rpt.minggu.length){
    const sebab = rpt.semua.length
      ? `RPT ${esc(slot.subjek)} tiada baris untuk ${esc(mgg||'minggu ini')}`
      : `Tiada RPT untuk ${esc(slot.subjek)}`;
    kotak.innerHTML = `
      <div class="kad" style="background:var(--ungu-t);border-color:#ddd3fb;margin-bottom:13px">
        <b style="font-size:13.5px">${sebab}</b>
        <p style="font-size:12.5px;color:var(--teks-2);margin:6px 0 10px">Pilih baris RPT daripada minggu lain,
          tulis SK &amp; SP anda sendiri, atau biarkan kosong dan AI akan <b>mencadangkan</b> SK &amp; SP
          berdasarkan tajuk yang anda beri. Cadangan ditandakan jelas dalam RPH —
          <b>sila sahkan dengan DSKP rasmi</b> sebelum guna.</p>
        ${pilihanLain}
        ${manual}
        <label class="fld" style="margin:10px 0 0"><span>Tajuk / kemahiran untuk PdP ini</span>
          <input id="jgTajukManual" placeholder="Cth: Ayat aktif dan ayat pasif"></label>
        <button class="btn btn-sm" style="margin-top:8px" onclick="pergi('rpt')">📗 Atau muat naik RPT subjek ini</button>
      </div>`;
    return;
  }
  kotak.innerHTML = `<label class="fld"><span>Kandungan RPT ${esc(mgg)} — pilih fokus PdP</span></label>
    <div class="senarai" style="margin:-6px 0 10px">
    ${rpt.minggu.map((r,i)=>`
      <label class="baris" style="cursor:pointer;align-items:flex-start">
        <input type="radio" name="jgRptPilih" value="${i}" ${i===0?'checked':''} style="width:auto;margin-top:3px">
        <div class="baris-t">
          <b>${esc((r.tajuk||r.tema||'Tanpa tajuk').slice(0,80))}</b>
          <small>${r.kodSp?esc(r.kodSp)+' · ':''}${esc((r.sp||r.tema||'').slice(0,110))}${r.catatan?' · '+esc(r.catatan.slice(0,60)):''}</small>
        </div></label>`).join('')}
    </div>
    ${pilihanLain}
    ${manual}`;
}

/* Baca ruang manual. Pulangkan null jika guru tidak menulis apa-apa. */
function bacaRptManual(){
  const g = id => $('#'+id) ? $('#'+id).value.trim() : '';
  const d = { tajuk:g('jgMTajuk'), kodSk:g('jgMKodSk'), kodSp:g('jgMKodSp'),
              sk:g('jgMSk'), sp:g('jgMSp'), tp:g('jgMTp') };
  return Object.values(d).some(v => v) ? d : null;
}

/* Bila guru mula menulis sendiri, pilihan RPT dimalapkan supaya jelas mana
   yang akan digunakan. Semua ruang kosong = kembali ikut RPT. */
function tandaRptManual(){
  const d = bacaRptManual();
  const info = $('#jgManualInfo');
  document.querySelectorAll('input[name="jgRptPilih"]').forEach(x => {
    x.disabled = !!d;
    x.closest('.baris')?.style.setProperty('opacity', d ? '.45' : '1');
  });
  const lain = $('#jgRptLain');
  if(lain){ lain.disabled = !!d; lain.closest('.fld')?.style.setProperty('opacity', d ? '.45' : '1'); }
  if(!info) return;
  if(!d){ info.innerHTML = ''; return; }
  const kurang = [];
  if(!d.sp) kurang.push('Standard Pembelajaran');
  if(!d.sk) kurang.push('Standard Kandungan');
  info.innerHTML = `<div class="jg-terpilih">
    <b>${esc(d.tajuk || 'Tajuk belum diisi')}</b>
    <small>${d.kodSk?'SK '+esc(d.kodSk):''}${d.kodSp?' · SP '+esc(d.kodSp):''}${d.tp?' · '+esc(d.tp):''}</small>
    <small>${kurang.length
      ? `AI akan mencadangkan: ${kurang.join(' dan ')} — sahkan dengan DSKP sebelum guna.`
      : 'Semua standard diisi sendiri. AI hanya membina objektif, aktiviti dan bahagian lain.'}</small>
  </div>`;
}

/* Papar butiran baris RPT yang dipilih dari minggu lain, dan matikan pilihan
   radio minggu semasa supaya jelas mana satu yang akan digunakan. */
function tandaRptLain(){
  const s = $('#jgRptLain'); if(!s) return;
  const info = $('#jgRptLainInfo');
  const guna = s.value !== '';
  document.querySelectorAll('input[name="jgRptPilih"]').forEach(x => {
    x.disabled = guna;
    x.closest('.baris')?.style.setProperty('opacity', guna ? '.45' : '1');
  });
  if(!guna){ if(info) info.innerHTML = ''; return; }
  const r = (window._janaRptSemua||[])[+s.value];
  if(info && r) info.innerHTML = `<div class="jg-terpilih">
    <b>${esc(r.tajuk || r.tema || 'Tanpa tajuk')}</b>
    <small>${esc(r.minggu||'')}${r.kodSk?' · SK '+esc(r.kodSk):''}${r.kodSp?' · SP '+esc(r.kodSp):''}</small>
    ${r.sp ? `<small>${esc(String(r.sp).slice(0,160))}</small>` : ''}
  </div>`;
}

function infoKelas(nama){
  return S.kelas.find(k => norma(k.nama) === norma(nama)) || {};
}
function ctxDaripadaSlot(slot, tarikh, extra){
  const kelas = infoKelas(slot.kelas);
  return Object.assign({
    slotId:slot.id, tarikh, subjek:slot.subjek, kelas:slot.kelas,
    tahun:kelas.tahun || '', mula:slot.mula, tamat:slot.tamat,
    tempoh:minit(slot.mula, slot.tamat), minggu:mingguUntuk(tarikh),
    bilMurid:kelas.bilangan || null, tahapKelas:kelas.tahap || '', notaKelas:kelas.nota || ''
  }, extra||{});
}

async function janaSatu(){
  const sel = $('#jgPilih'); if(!sel) return toast('Tiada slot pada tarikh ini','salah');
  const slot = S.jadual.find(x => x.id === sel.value);

  /* Keutamaan: tulisan sendiri > baris minggu lain > baris minggu semasa > tiada */
  const manual = bacaRptManual();
  const lain = $('#jgRptLain');
  const dariLain = !manual && lain && lain.value !== '' ? (window._janaRptSemua||[])[+lain.value] : null;
  const idx = document.querySelector('input[name="jgRptPilih"]:checked');
  const dariMinggu = !manual && !dariLain && idx && window._janaRpt?.length
    ? window._janaRpt[+idx.value] : null;
  const fokus = manual || dariLain || dariMinggu;

  const tajukManual = $('#jgTajukManual') ? $('#jgTajukManual').value.trim() : '';
  const ctx = ctxDaripadaSlot(slot, $('#jgTarikh').value,
    { arahan:$('#jgArahan').value.trim(), rptFokus:fokus,
      tajuk: fokus ? (fokus.tajuk||fokus.tema||'') || tajukManual : tajukManual,
      cadangSp: manual ? !(manual.sk && manual.sp) : !fokus,
      rptManual: !!manual,
      rptMingguAsal: dariLain ? (dariLain.minggu || '') : '' });
  sibuk(true,'AI sedang membina RPH…');
  try{
    const rph = await janaRphAI(ctx);
    if(manual) rph.rptManual = true;                          // ditulis sendiri oleh guru
    if(dariLain) rph.rptMingguAsal = dariLain.minggu || '';   // tajuk dilangkau
    const ref = await rujuk('rph').add(rph);
    await muatRph(); sibuk(false);
    toast(manual ? 'RPH dijana guna SK/SP anda sendiri'
      : dariLain ? `RPH dijana guna tajuk ${labelMinggu(dariLain.minggu)}` : 'RPH dijana', 'jaya');
    bukaRph(ref.id);
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}
async function janaSlot(slotId, tarikh){
  const slot = S.jadual.find(x => x.id === slotId);
  const ctx = ctxDaripadaSlot(slot, tarikh);
  const rpt = rptUntuk(slot.subjek, ctx.tahun, ctx.minggu);
  if(rpt.minggu.length){ ctx.rptFokus = rpt.minggu[0]; ctx.tajuk = rpt.minggu[0].tajuk || rpt.minggu[0].tema || ''; }
  else ctx.cadangSp = true;
  sibuk(true,'AI sedang membina RPH…');
  try{
    const rph = await janaRphAI(ctx);
    const ref = await rujuk('rph').add(rph);
    await muatRph(); sibuk(false); toast('RPH dijana','jaya'); bukaRph(ref.id);
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}
function senaraiTugasMinggu(mula, tapis){
  const tugas = [];
  for(let i=0;i<7;i++){
    const d = new Date(mula+'T00:00:00'); d.setDate(d.getDate()+i);
    const iso = tarikhISO(d); if(cutiPada(iso)) continue;
    S.jadual.filter(x => x.hari === namaHari(iso) && (!tapis || norma(x.subjek) === norma(tapis)))
      .forEach(x => { if(!S.rph.some(r => r.tarikh === iso && r.slotId === x.id)) tugas.push({slot:x, tarikh:iso}); });
  }
  return tugas.sort((a,b)=> (a.tarikh+(a.slot.mula||'')).localeCompare(b.tarikh+(b.slot.mula||'')));
}

async function janaMingguan(){
  const mula = $('#jgMinggu').value; if(!mula) return toast('Tetapkan takwim dahulu','salah');
  const tugas = senaraiTugasMinggu(mula, $('#jgTapis').value);
  if(!tugas.length) return toast('Semua slot minggu ini sudah ada RPH','jaya');
  const { rpm } = tetapanKadar();
  const anggar = Math.ceil(tugas.length * (60/rpm) / 60);
  modal(`Jana ${tugas.length} RPH`, `
    <p style="font-size:13.5px;color:var(--teks-2);line-height:1.6">
      ${tugas.length} slot belum ada RPH. Sistem akan menjana satu demi satu dengan jeda
      supaya tidak melebihi had percuma penyedia AI.<br><br>
      <b>Anggaran masa: ${anggar < 2 ? 'kurang 2' : anggar} minit.</b>
      Setiap RPH disimpan sebaik siap — jika terhenti, anda boleh sambung semula tanpa kehilangan kerja.</p>
    <div class="kad" style="background:var(--bg);padding:12px;font-size:12.5px;color:var(--teks-2)">
      Kelajuan semasa: <b>${rpm} permintaan/minit</b> · ubah di Tetapan → Enjin AI jika sering gagal.</div>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="mulaJanaPukal('${mula}')">Mula jana</button>`);
}

let _janaHenti = false;
async function mulaJanaPukal(mula){
  tutupModal();
  const tugas = senaraiTugasMinggu(mula, $('#jgTapis')?.value || '');
  _janaHenti = false;
  const giliran = {};
  let siap = 0, gagal = 0, senaraiGagal = [];
  panelJana(true);

  for(let i = 0; i < tugas.length; i++){
    if(_janaHenti) break;
    const t = tugas[i];
    kemasJana(i, tugas.length, `${t.slot.subjek} · ${t.slot.kelas} · ${tarikhCantik(t.tarikh)}`, siap, gagal);
    try{
      const ctx = ctxDaripadaSlot(t.slot, t.tarikh);
      const rpt = rptUntuk(t.slot.subjek, ctx.tahun, ctx.minggu);
      if(rpt.minggu.length){
        const k = norma(t.slot.subjek)+'|'+norma(t.slot.kelas);
        const g = giliran[k] = (giliran[k]||0);
        ctx.rptFokus = rpt.minggu[Math.min(g, rpt.minggu.length-1)];
        ctx.tajuk = ctx.rptFokus.tajuk || ctx.rptFokus.tema || '';
        giliran[k]++;
      } else ctx.cadangSp = true;
      ctx.lapor = msg => kemasJana(i, tugas.length, msg, siap, gagal, true);
      const rph = await janaRphAI(ctx);
      await rujuk('rph').add(rph);            // simpan segera — tiada kerja hilang
      siap++;
    }catch(e){
      gagal++; senaraiGagal.push(`${t.slot.subjek} ${tarikhCantik(t.tarikh)}: ${e.message}`);
      if(/Had kadar AI dicapai/.test(e.message||'')){
        kemasJana(i, tugas.length, 'Had kadar dicapai — berhenti buat sementara', siap, gagal, true);
        break;
      }
    }
  }
  panelJana(false);
  await muatRph(); pergi('rph');
  if(senaraiGagal.length){
    modal('Laporan penjanaan', `
      <div class="stat-grid" style="margin-bottom:12px">
        <div class="stat h"><b>${siap}</b><small>Berjaya</small></div>
        <div class="stat m"><b>${gagal}</b><small>Gagal</small></div>
      </div>
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:8px">Slot yang gagal kekal kosong — tekan
        <b>Jana seminggu</b> semula untuk menyambung. Yang sudah siap tidak akan diulang.</p>
      <div style="max-height:34vh;overflow:auto;font-size:12px;color:var(--teks-2)">
        ${senaraiGagal.map(x=>`<div style="padding:5px 0;border-bottom:1px solid var(--garis)">${esc(x)}</div>`).join('')}</div>`,
      `<button class="btn btn-primary" onclick="tutupModal()">Faham</button>`);
  } else {
    toast(`${siap} RPH berjaya dijana`, 'jaya');
  }
}

function panelJana(tunjuk){
  let el = $('#janaPanel');
  if(!tunjuk){ el?.remove(); return; }
  if(el) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="jana-tirai" id="janaPanel">
      <div class="jana-kotak">
        <h3 style="margin-bottom:4px">Menjana RPH</h3>
        <p id="jpTeks" style="font-size:13px;color:var(--teks-2);min-height:36px">Bersedia…</p>
        <div class="jana-bar"><i id="jpBar" style="width:0%"></i></div>
        <div id="jpKira" style="font-size:12px;color:var(--teks-3);margin-top:8px"></div>
        <p style="font-size:11.5px;color:var(--teks-3);margin-top:12px;line-height:1.5">
          Biarkan tetingkap ini terbuka. Setiap RPH disimpan sebaik siap.</p>
        <button class="btn btn-danger btn-block" style="margin-top:12px" onclick="hentiJana()">Henti</button>
      </div>
    </div>`);
}
function kemasJana(i, jum, teks, siap, gagal, kekalNombor){
  const pk = Math.round((i / jum) * 100);
  if($('#jpBar')) $('#jpBar').style.width = pk + '%';
  if($('#jpTeks')) $('#jpTeks').textContent = kekalNombor ? teks : `${i+1}/${jum} · ${teks}`;
  if($('#jpKira')) $('#jpKira').innerHTML = `<b style="color:var(--hijau)">${siap} siap</b>${gagal?` · <b style="color:var(--merah)">${gagal} gagal</b>`:''} · ${jum-i-1} baki`;
}
function hentiJana(){ _janaHenti = true; toast('Akan berhenti selepas RPH semasa…'); }

/* ================= AUDIT PUKAL ================= */
const LABEL_MASALAH = {
  angka:'Bilangan murid salah', kelas:'Kelas tidak dikenali', sk:'Standard Kandungan',
  sp:'Standard Pembelajaran', objektif:'Objektif kosong', kriteria:'Kriteria kejayaan kosong',
  aktiviti:'Aktiviti terlalu ringkas', tajuk:'Tajuk kosong', bbm:'BBM kosong',
  pbd:'Pentaksiran kosong', amaran:'Amaran AI', rpt:'SP tidak sepadan RPT', refleksi:'Refleksi kosong',
  skSama:'SK sama dengan SP', skPanjang:'Standard terlalu panjang', kbat:'KBAT salah isi',
  emk:'EMK luar senarai', nilai:'Nilai Murni jadi ayat', pak21:'PAK-21 salah isi',
  objUkur:'Objektif tak terukur', masa:'Jumlah masa tak padan', refAwal:'Refleksi ditulis awal',
  ejaan:'Ejaan bukan baku', ulang:'RPH berulang', bentrok:'Jadual bertindih'
};

function halAudit(){
  const hasil = S.rph.map(r => ({ r, m: auditRph(r) }));
  const petaHasil = {}; hasil.forEach(x => petaHasil[x.r.id] = x);

  // RPH yang menyalin bulat RPH terdahulu kelas & subjek sama
  const ulang = semakUlangRph(S.rph);
  ulang.forEach((asal, id) => {
    if(petaHasil[id]) petaHasil[id].m.push({ kod:'ulang', berat:'sederhana', boleh:false,
      teks:`Aktiviti & BBM sama dengan RPH ${tarikhCantik(asal.tarikh)}` });
  });

  // Dua RPH bertindih masa pada tarikh yang sama
  const bentrok = semakBentrok(S.rph);
  bentrok.forEach(b => {
    [b.a, b.b].forEach(r => {
      if(petaHasil[r.id] && !petaHasil[r.id].m.some(p => p.kod==='bentrok'))
        petaHasil[r.id].m.push({ kod:'bentrok', berat:'tinggi', boleh:false, teks:b.teks });
    });
  });

  const bermasalah = hasil.filter(x => x.m.length);
  const kiraJenis = {};
  bermasalah.forEach(x => x.m.forEach(p => kiraJenis[p.kod] = (kiraJenis[p.kod]||0)+1));
  const bolehBaiki = bermasalah.filter(x => x.m.some(p => p.kod === 'angka')).length;
  const bolehKemas = bermasalah.filter(x => x.m.some(p => p.betul)).length;
  const pendua = cariPendua(S.rph);
  const jumBuang = pendua.reduce((n,p) => n + p.buang.length, 0);
  const idBuang = new Set(pendua.flatMap(p => p.buang.map(r => r.id)));
  const bolehKemasSemua = bermasalah.filter(x => !idBuang.has(x.r.id)
    && Object.keys(baikiMedanRph(x.r, x.m)).length).length;
  window._auditBentrok = bentrok;
  window._auditPendua = pendua;
  const berat = k => bermasalah.filter(x => x.m.some(p => p.berat === k)).length;
  window._auditHasil = hasil;

  $('#kandungan').innerHTML = `
    <div class="stat-grid">
      <div class="stat b"><b>${S.rph.length}</b><small>Jumlah RPH</small></div>
      <div class="stat h"><b>${S.rph.length - bermasalah.length}</b><small>Tiada isu</small></div>
      <div class="stat k"><b>${bermasalah.length}</b><small>Perlu semakan</small></div>
      <div class="stat m"><b>${berat('tinggi')}</b><small>Isu penting</small></div>
    </div>

    ${bolehBaiki ? `<div class="kad" style="background:#fdeaea;border-color:#f5cfcf">
      <div class="kad-h"><h3 style="color:#a33">${bolehBaiki} RPH dengan bilangan murid salah</h3></div>
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:12px">
        Angka murid dalam refleksi/kriteria tidak sepadan dengan data kelas anda.
        Sistem boleh membetulkan kesemuanya sekali gus mengikut senarai kelas.</p>
      <button class="btn btn-primary" onclick="baikiSemuaAngka()">🔧 Betulkan ${bolehBaiki} RPH sekali gus</button>
    </div>` : ''}

    ${bentrok.length ? `<div class="kad" style="background:#fdeaea;border-color:#f5cfcf">
      <div class="kad-h"><h3 style="color:#a33">${bentrok.length} pertindihan jadual</h3></div>
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:10px">
        Perkara ini perlu dibetulkan pada jadual waktu, bukan pada teks RPH.</p>
      <div style="display:grid;gap:6px">
        ${bentrok.slice(0,12).map(b => `<div style="font-size:12.5px;color:var(--teks-2)">
          <b>${tarikhCantik(b.tarikh)}</b> — ${esc(b.teks)}</div>`).join('')}
        ${bentrok.length>12 ? `<div style="font-size:12px;color:var(--teks-3)">…dan ${bentrok.length-12} lagi</div>`:''}
      </div>
    </div>` : ''}

    ${(pendua.length || bolehBaiki || bolehKemas) ? `<div class="kad" style="background:var(--ungu-t);border-color:#ddd3fb">
      <div class="kad-h"><h3 style="color:#5b3fbe">Pembersihan automatik</h3></div>
      <p style="font-size:13px;color:var(--teks-2);margin-bottom:12px">
        ${[ pendua.length ? `<b>${jumBuang} RPH pendua</b> boleh dipadam` : '',
            (bolehBaiki||bolehKemas) ? `<b>${bolehKemasSemua} RPH</b> boleh dibetulkan medannya` : ''
          ].filter(Boolean).join(' · ')}.
        Sistem akan tunjuk senarai penuh sebelum sebarang perubahan dibuat.</p>
      <button class="btn btn-primary" onclick="bersihAuto()">🧹 Semak & bersihkan automatik</button>
    </div>` : ''}

    ${!bermasalah.length ? `<div class="kad" style="text-align:center;padding:30px">
      <div style="font-size:38px">✅</div>
      <h3 style="margin:8px 0 4px">Semua RPH bersih</h3>
      <p style="font-size:13px;color:var(--teks-2)">Tiada isu dikesan dalam ${S.rph.length} RPH anda.</p></div>` : `

    <div class="kad">
      <div class="kad-h"><h3>Ringkasan isu</h3></div>
      <div class="toolbar" style="margin:0">
        <button class="btn btn-sm" onclick="tapisAudit('')">Semua (${bermasalah.length})</button>
        ${Object.entries(kiraJenis).sort((a,b)=>b[1]-a[1]).map(([k,n])=>
          `<button class="btn btn-sm" onclick="tapisAudit('${k}')">${LABEL_MASALAH[k]||k} (${n})</button>`).join('')}
      </div>
    </div>
    <div id="auditSenarai"></div>`}`;
  if(bermasalah.length) tapisAudit('');
}

function tapisAudit(kod){
  const hasil = (window._auditHasil||[]).filter(x => x.m.length && (!kod || x.m.some(p => p.kod === kod)))
    .sort((a,b) => (b.tarikh||b.r.tarikh).localeCompare(a.tarikh||a.r.tarikh));
  const warna = { tinggi:'var(--merah)', sederhana:'var(--kuning)', rendah:'var(--teks-3)' };
  $('#auditSenarai').innerHTML = hasil.slice(0,200).map(({r,m}) => {
    const [gelap, cerah] = warnaSubjek(r.subjek);
    const paling = m.some(p=>p.berat==='tinggi') ? 'tinggi' : m.some(p=>p.berat==='sederhana') ? 'sederhana' : 'rendah';
    return `<div class="kad" style="padding:13px;border-left:4px solid ${warna[paling]}">
      <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
        <span class="sj-bulat" style="--w:${gelap};background:${gelap}"></span>
        <b style="font-size:14px">${esc(r.subjek)}</b>
        <span style="font-size:12.5px;color:var(--teks-2)">${esc(r.kelas)}</span>
        <span class="pil kelabu">${tarikhCantik(r.tarikh)}</span>
        <span class="pil ${r.status==='lengkap'?'hijau':'kuning'}">${r.status==='lengkap'?'Lengkap':'Draf'}</span>
        <button class="btn btn-sm" style="margin-left:auto" onclick="bukaRph('${r.id}')">Buka & baiki</button>
      </div>
      <div style="margin-top:9px;display:grid;gap:5px">
        ${m.map(p=>`<div style="display:flex;gap:7px;font-size:12.5px;color:${warna[p.berat]}">
          <span>${p.berat==='tinggi'?'⛔':p.berat==='sederhana'?'⚠️':'○'}</span>
          <span style="color:var(--teks-2)">${esc(p.teks)}</span></div>`).join('')}
      </div></div>`;
  }).join('') + (hasil.length>200 ? `<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:10px">Menunjukkan 200 daripada ${hasil.length}</p>` : '');
}

/* ============ PEMBERSIHAN AUTOMATIK ============ */
function bersihAuto(){
  const hasil = window._auditHasil || [];
  const pendua = window._auditPendua || [];
  const bentrok = window._auditBentrok || [];
  const idBuang = new Set(pendua.flatMap(p => p.buang.map(r => r.id)));

  const baiki = hasil.filter(x => x.m.length && !idBuang.has(x.r.id))
    .map(x => ({ ...x, ubah: baikiMedanRph(x.r, x.m) }))
    .filter(x => Object.keys(x.ubah).length);

  const perluAi = hasil.filter(x => !idBuang.has(x.r.id)
    && x.m.some(p => ISU_PERLU_AI.includes(p.kod)));

  const takAuto = hasil.filter(x => !idBuang.has(x.r.id)
    && x.m.some(p => ISU_TAK_AUTO.includes(p.kod)));

  const jumBuang = pendua.reduce((n,p) => n + p.buang.length, 0);

  if(!jumBuang && !baiki.length && !perluAi.length)
    return toast('Tiada apa-apa yang boleh dibersihkan automatik','jaya');

  window._bersih = { pendua, baiki, perluAi };

  const senaraiPendua = pendua.slice(0,8).map(p =>
    `<div style="font-size:12.5px;color:var(--teks-2);padding:5px 0;border-bottom:1px solid var(--garis)">
      <b>${esc(p.simpan.subjek)}</b> · ${esc(p.simpan.kelas)} · ${tarikhCantik(p.simpan.tarikh)}
      ${p.simpan.mula?`· ${esc(p.simpan.mula)}`:''}
      <span style="color:var(--teks-3)"> — simpan 1, padam ${p.buang.length}</span>
    </div>`).join('');

  modal('Pembersihan automatik', `
    ${jumBuang ? `<div class="kad" style="padding:12px;margin-bottom:12px">
      <b style="font-size:13.5px">1 · Padam ${jumBuang} RPH pendua</b>
      <p style="font-size:12.5px;color:var(--teks-2);margin:6px 0 8px">
        Rekod bertindan pada slot yang sama. Yang paling lengkap dikekalkan.</p>
      ${senaraiPendua}
      ${pendua.length>8?`<div style="font-size:12px;color:var(--teks-3);padding-top:6px">…dan ${pendua.length-8} slot lagi</div>`:''}
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px">
        <input type="checkbox" id="bsPendua" checked> Padam pendua</label>
    </div>` : ''}

    ${baiki.length ? `<div class="kad" style="padding:12px;margin-bottom:12px">
      <b style="font-size:13.5px">2 · Betulkan medan dalam ${baiki.length} RPH</b>
      <p style="font-size:12.5px;color:var(--teks-2);margin:6px 0 8px">
        Ejaan bukan baku, KBAT salah isi, EMK/Nilai Murni yang jadi ayat,
        bilangan murid tidak sepadan, dan refleksi yang ditulis sebelum tarikh PdP.
        Tiada panggilan AI — pantas dan percuma.</p>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px">
        <input type="checkbox" id="bsBaiki" checked> Betulkan medan</label>
    </div>` : ''}

    ${perluAi.length ? `<div class="kad" style="padding:12px;margin-bottom:12px">
      <b style="font-size:13.5px">3 · Jana semula ${perluAi.length} RPH dengan AI</b>
      <p style="font-size:12.5px;color:var(--teks-2);margin:6px 0 8px">
        Untuk isu yang perlu pertimbangan: SK sama dengan SP, standard disalin bulat
        daripada DSKP, objektif tak terukur, jumlah masa tak padan, dan RPH yang
        menyalin hari sebelumnya. Refleksi sedia ada dikekalkan.
        <b>Menggunakan kuota AI dan mengambil masa.</b></p>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px">
        <input type="checkbox" id="bsAi"> Jana semula dengan AI</label>
    </div>` : ''}

    ${(takAuto.length || bentrok.length) ? `<div class="kad" style="background:#fdf3dd;border-color:#f0dcae;padding:12px">
      <b style="font-size:13.5px;color:#8a6106">Perlu perhatian abang sendiri</b>
      <p style="font-size:12.5px;color:var(--teks-2);margin-top:6px">
        ${[ bentrok.length?`${bentrok.length} pertindihan jadual (betulkan di jadual waktu)`:'',
            takAuto.length?`${takAuto.length} RPH dengan standard atau aktiviti kosong (perlu RPT dilengkapkan)`:''
          ].filter(Boolean).join(' · ')}.
        Perkara ini tidak disentuh oleh pembersihan automatik.</p>
    </div>` : ''}`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="jalankanBersih()">Jalankan</button>`);
}

async function jalankanBersih(){
  const buatPendua = $('#bsPendua')?.checked, buatBaiki = $('#bsBaiki')?.checked,
        buatAi = $('#bsAi')?.checked;
  const { pendua, baiki, perluAi } = window._bersih || {};
  tutupModal();
  if(!buatPendua && !buatBaiki && !buatAi) return toast('Tiada tindakan dipilih');

  const kira = { padam:0, baiki:0, jana:0, gagal:0 };
  try{
    /* 1 — padam pendua */
    if(buatPendua && pendua?.length){
      const buang = pendua.flatMap(p => p.buang);
      for(let i = 0; i < buang.length; i += 300){
        sibuk(true, `Memadam pendua ${kira.padam}/${buang.length}…`);
        const b = db.batch();
        buang.slice(i, i+300).forEach(r => b.delete(rujuk('rph').doc(r.id)));
        await b.commit(); kira.padam += Math.min(300, buang.length - i);
      }
    }

    /* 2 — betulkan medan */
    if(buatBaiki && baiki?.length){
      for(let i = 0; i < baiki.length; i += 300){
        sibuk(true, `Membetulkan medan ${kira.baiki}/${baiki.length}…`);
        const b = db.batch();
        baiki.slice(i, i+300).forEach(({r, ubah}) =>
          b.update(rujuk('rph').doc(r.id), { ...ubah, dikemas: Date.now() }));
        await b.commit(); kira.baiki += Math.min(300, baiki.length - i);
      }
    }

    /* 3 — jana semula dengan AI (satu demi satu, refleksi dikekalkan) */
    if(buatAi && perluAi?.length){
      const idPadam = new Set((buatPendua && pendua ? pendua.flatMap(p=>p.buang) : []).map(r => r.id));
      const sasar = perluAi.filter(x => !idPadam.has(x.r.id));
      for(let i = 0; i < sasar.length; i++){
        const r = sasar[i].r;
        sibuk(true, `AI menjana semula ${i+1}/${sasar.length} · ${r.subjek} ${r.kelas}…`);
        try{
          const baru = await janaRphAI({ slotId:r.slotId, tarikh:r.tarikh, subjek:r.subjek,
            kelas:r.kelas, tahun:r.tahun, mula:r.mula, tamat:r.tamat,
            tempoh:r.tempoh || minit(r.mula, r.tamat), minggu:r.minggu, tajuk:r.tajuk });
          delete baru.dicipta; delete baru.status;
          baru.refleksi = r.refleksi || '';      // kekalkan refleksi guru
          await rujuk('rph').doc(r.id).update({ ...baru, dikemas: Date.now() });
          kira.jana++;
        }catch(e){ kira.gagal++; }
      }
    }

    await muatRph(); sibuk(false); pergi('audit');
    toast([ kira.padam?`${kira.padam} pendua dipadam`:'',
            kira.baiki?`${kira.baiki} dibetulkan`:'',
            kira.jana?`${kira.jana} dijana semula`:'',
            kira.gagal?`${kira.gagal} gagal`:'' ].filter(Boolean).join(' · '),
          kira.gagal ? 'salah' : 'jaya');
  }catch(e){
    sibuk(false); await muatRph(); pergi('audit');
    toast('Berhenti: '+e.message, 'salah');
  }
}

async function baikiSemuaAngka(){
  const sasar = (window._auditHasil||[]).filter(x => x.m.some(p => p.kod === 'angka'));
  if(!sasar.length) return toast('Tiada yang perlu dibaiki','jaya');
  sahkan(`Betulkan bilangan murid dalam ${sasar.length} RPH mengikut data kelas? Tindakan ini tidak boleh dibatalkan.`, async () => {
    let siap = 0;
    for(let i = 0; i < sasar.length; i += 300){
      sibuk(true, `Membetulkan ${siap}/${sasar.length}…`);
      const b = db.batch();
      sasar.slice(i, i+300).forEach(({r,m}) => {
        const jum = m.find(p => p.kod==='angka')?.jum;
        if(!jum) return;
        const ubah = {};
        ['refleksi','kriteria','objektif'].forEach(f => { if(r[f]) ubah[f] = betulTeksAngka(r[f], jum); });
        if(r.aktiviti) ubah.aktiviti = betulTeksAngka(r.aktiviti, jum);
        b.update(rujuk('rph').doc(r.id), ubah);
      });
      await b.commit(); siap += Math.min(300, sasar.length - i);
    }
    await muatRph(); sibuk(false); pergi('audit');
    toast(`${sasar.length} RPH dibetulkan`, 'jaya');
  });
}
function betulTeksAngka(teks, jum){
  return String(teks)
    .replace(/(\d{1,3})\s*(daripada|dari|\/)\s*(\d{1,3})(\s*(?:orang\s*)?murid)/gi,
      (m,a,b,c,d) => `${Math.min(+a, jum)} ${b} ${jum}${d}`)
    .replace(/(seramai|kesemua|semua)\s*(\d{1,3})(\s*(?:orang\s*)?murid)/gi,
      (m,a,b,c) => `${a} ${jum}${c}`);
}

/* ================= KALENDAR ================= */
let kalBulan = new Date().getMonth(), kalTahun = new Date().getFullYear();
function halKalendar(){
  const pertama = new Date(kalTahun, kalBulan, 1);
  const jumlah = new Date(kalTahun, kalBulan+1, 0).getDate();
  const kosong = pertama.getDay();
  const hariIni = tarikhISO();
  let sel = '';
  for(let i=0;i<kosong;i++) sel += '<div class="kal-sel kosong"></div>';
  let jLengkap=0, jDraf=0, jBelum=0;
  for(let d=1; d<=jumlah; d++){
    const iso = tarikhISO(new Date(kalTahun, kalBulan, d));
    const rphHari = S.rph.filter(r => r.tarikh === iso);
    const slotHari = S.jadual.filter(s => s.hari === namaHari(iso));
    const cuti = cutiPada(iso);
    const lengkap = rphHari.filter(r=>r.status==='lengkap').length;
    const draf = rphHari.filter(r=>r.status==='draf').length;
    const belum = cuti ? 0 : Math.max(0, slotHari.length - rphHari.length);
    if(!cuti){ jLengkap+=lengkap; jDraf+=draf; jBelum+=belum; }

    let kelas = 'kal-sel';
    let isi = '';
    if(cuti){
      kelas += ' kal-cuti';
      isi = `<span class="kal-cuti-txt">${esc((cuti.nama||'Cuti').split(' ').slice(-2).join(' '))}</span>`;
    } else if(slotHari.length === 0){
      kelas += ' kal-takde';
    } else {
      if(belum === 0 && rphHari.length) kelas += ' kal-siap';
      else if(rphHari.length) kelas += ' kal-separa';
      else kelas += ' kal-belum';
      isi = `<span class="kal-dot">
        ${'<i class="d-h"></i>'.repeat(Math.min(lengkap,5))}
        ${'<i class="d-k"></i>'.repeat(Math.min(draf,5))}
        ${'<i class="d-m"></i>'.repeat(Math.min(belum,5))}</span>
        <span class="kal-kira">${rphHari.length}/${slotHari.length}</span>`;
    }
    if(iso === hariIni) kelas += ' ini';
    sel += `<div class="${kelas}" onclick="lihatHari('${iso}')" title="${cuti?esc(cuti.nama):(slotHari.length?rphHari.length+' daripada '+slotHari.length+' RPH siap':'Tiada slot PdP')}">
      <span class="kal-no">${d}</span>${isi}</div>`;
  }
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kal-navi">
        <button class="btn btn-sm bulat" onclick="geserBulan(-1)">‹</button>
        <div style="text-align:center">
          <h3 style="margin:0">${BULAN[kalBulan]} ${kalTahun}</h3>
          <small style="color:var(--teks-3);font-size:12px">${jLengkap} lengkap · ${jDraf} draf · ${jBelum} belum</small>
        </div>
        <button class="btn btn-sm bulat" onclick="geserBulan(1)">›</button>
      </div>
      <div class="kal">${HARI.map(h=>`<div class="kal-hari">${h.slice(0,3)}</div>`).join('')}${sel}</div>
      <div class="kal-legend">
        <span><i class="d-h"></i> Lengkap</span>
        <span><i class="d-k"></i> Draf</span>
        <span><i class="d-m"></i> Belum dibuat</span>
        <span><i class="d-c"></i> Cuti</span>
        <button class="btn btn-sm" style="margin-left:auto" onclick="kalHariIni()">Hari ini</button>
      </div>
    </div>`;
}
function kalHariIni(){
  const d = new Date(); kalBulan = d.getMonth(); kalTahun = d.getFullYear();
  halKalendar(); lihatHari(tarikhISO());
}
function geserBulan(n){ kalBulan += n; if(kalBulan<0){kalBulan=11;kalTahun--;} if(kalBulan>11){kalBulan=0;kalTahun++;} halKalendar(); }
function lihatHari(iso){
  const rphHari = S.rph.filter(r => r.tarikh === iso);
  const slotHari = S.jadual.filter(s => s.hari === namaHari(iso)).sort((a,b)=>a.mula.localeCompare(b.mula));
  const cuti = cutiPada(iso);
  modal(tarikhCantik(iso), cuti ? `<div class="kosong"><b>${esc(cuti.nama)}</b>Tiada sesi PdP.</div>` :
    (slotHari.length ? slotHari.map(s => {
      const r = rphHari.find(x => x.slotId === s.id);
      return `<div class="slot"><div class="slot-masa">${esc(s.mula)}<br>${esc(s.tamat)}</div>
        <div class="slot-info"><b>${esc(s.subjek)}</b><small>${esc(s.kelas)}</small></div>
        <div class="slot-aksi">${r ? `<button class="btn btn-sm" onclick="tutupModal();bukaRph('${r.id}')">Buka</button>`
            : `<button class="btn btn-sm btn-primary" onclick="tutupModal();janaSlot('${s.id}','${iso}')">✨ Jana</button>`}</div></div>`;
    }).join('') : '<div class="kosong">Tiada slot PdP pada hari ini.</div>'),
    (S.rph.some(r=>r.tarikh===iso) ? `<button class="btn" onclick="tutupModal()">Tutup</button>
      <button class="btn btn-primary" onclick="tutupModal();cetakHari('${iso}')">🖨️ Cetak semua RPH hari ini</button>` : null));
}

/* ================= EDITOR RPH ================= */
function bukaRph(id){ S.editRphId = id; window._stdManual = false; window._stdSumberMinggu = ''; pergi('editor'); }

function rte(id, isi, tinggi){
  return `<div class="rte-bar">
    <button type="button" onclick="cmd('bold')"><b>B</b></button>
    <button type="button" onclick="cmd('italic')"><i>I</i></button>
    <button type="button" onclick="cmd('insertUnorderedList')">• Senarai</button>
    <button type="button" onclick="cmd('insertOrderedList')">1. Nombor</button>
    <button type="button" onclick="cmd('removeFormat')">Buang format</button>
  </div><div class="rte" id="${id}" contenteditable="true" style="min-height:${tinggi||130}px">${isi||''}</div>`;
}
function cmd(c){ document.execCommand(c,false,null); }

function halEditor(){
  const r = S.rph.find(x => x.id === S.editRphId);
  if(!r){ pergi('rph'); return; }
  const q = semakKualiti(r);
  const warna = q.peratus >= 85 ? 'hijau' : q.peratus >= 60 ? 'kuning' : 'merah';
  $('#subTajuk').textContent = `${r.subjek} · ${r.kelas} · ${tarikhCantik(r.tarikh)}`;

  $('#kandungan').innerHTML = `<div class="dua-lajur">
    <div>
      <div class="kad">
        <div class="kad-h"><h3>Maklumat sesi</h3>
          <span class="pil ${r.status==='lengkap'?'hijau':'kuning'}">${r.status==='lengkap'?'Lengkap':'Draf'}</span></div>
        <div class="grid3">
          <label class="fld"><span>Tarikh</span><input id="eTarikh" type="date" value="${esc(r.tarikh)}"></label>
          <label class="fld"><span>Masa mula</span><input id="eMula" type="time" value="${esc(r.mula)}"></label>
          <label class="fld"><span>Masa tamat</span><input id="eTamat" type="time" value="${esc(r.tamat)}"></label>
        </div>
        <div class="grid3">
          <label class="fld"><span>Subjek</span><input id="eSubjek" value="${esc(r.subjek)}"></label>
          <label class="fld"><span>Kelas</span><input id="eKelas" value="${esc(r.kelas)}"></label>
          <label class="fld"><span>Minggu</span><input id="eMinggu" value="${esc(r.minggu||'')}"></label>
        </div>
        <div class="grid2">
          <label class="fld"><span>Tema</span><input id="eTema" value="${esc(r.tema||'')}"></label>
          <label class="fld"><span>Tajuk</span><input id="eTajuk" value="${esc(r.tajuk||'')}"></label>
        </div>
      </div>

      <div class="kad">
        <div class="seksyen-tajuk" style="margin-top:0;border:0;padding:0">Standard kurikulum</div>
        <div class="grid2">
          <label class="fld"><span>Kod SK</span><input id="eKodSk" value="${esc(r.kodSk||'')}"></label>
          <label class="fld"><span>Kod SP</span><input id="eKodSp" value="${esc(r.kodSp||'')}"></label>
        </div>
        <label class="fld"><span>Standard Kandungan</span><textarea id="eSk">${esc(r.sk||'')}</textarea></label>
        <label class="fld"><span>Standard Pembelajaran</span><textarea id="eSp">${esc(r.sp||'')}</textarea></label>
        <label class="fld"><span>Standard Prestasi</span><textarea id="eTp">${esc(r.tp||'')}</textarea></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="pilihRpt()">📗 Ambil daripada RPT</button>
          <button class="btn btn-sm btn-ungu" onclick="janaDariStandard()"
            title="Jana semula seluruh RPH berdasarkan SK/SP di atas">✨ Jana baru ikut SK/SP ini</button>
        </div>

        <div class="seksyen-tajuk">Objektif & kriteria</div>
        <label class="fld"><span>Objektif pembelajaran <em>(satu baris satu objektif)</em></span><textarea id="eObjektif">${esc(r.objektif||'')}</textarea></label>
        <label class="fld"><span>Kriteria kejayaan</span><textarea id="eKriteria">${esc(r.kriteria||'')}</textarea></label>

        <div class="seksyen-tajuk">Aktiviti pembelajaran</div>
        ${rte('eAktiviti', r.aktiviti, 240)}
        <div class="grid2" style="margin-top:14px">
          <label class="fld"><span>Aktiviti pengayaan</span><textarea id="ePengayaan">${esc(stripHtml(r.pengayaan||''))}</textarea></label>
          <label class="fld"><span>Aktiviti pemulihan</span><textarea id="ePemulihan">${esc(stripHtml(r.pemulihan||''))}</textarea></label>
        </div>
        <label class="fld"><span>Penutup</span><textarea id="ePenutup">${esc(stripHtml(r.penutup||''))}</textarea></label>

        <div class="seksyen-tajuk">Elemen PdP</div>
        <div class="grid2">
          <label class="fld"><span>Kaedah / strategi</span><input id="eStrategi" value="${esc(r.strategi||'')}"></label>
          <label class="fld"><span>PAK21</span><input id="ePak21" value="${esc(r.pak21||'')}"></label>
          <label class="fld"><span>KBAT</span><input id="eKbat" value="${esc(r.kbat||'')}"></label>
          <label class="fld"><span>EMK</span><input id="eEmk" value="${esc(r.emk||'')}"></label>
          <label class="fld"><span>Nilai murni</span><input id="eNilai" value="${esc(r.nilai||'')}"></label>
          <label class="fld"><span>BBM / bahan</span><input id="eBbm" value="${esc(r.bbm||'')}"></label>
        </div>
        <label class="fld"><span>Pentaksiran</span><textarea id="ePentaksiran">${esc(r.pentaksiran||'')}</textarea></label>

        <div class="seksyen-tajuk">Refleksi</div>
        <label class="fld"><span>Refleksi selepas PdP</span><textarea id="eRefleksi">${esc(r.refleksi||'')}</textarea></label>
        <button class="btn btn-sm btn-ungu" onclick="janaRefleksi()">✨ Jana refleksi</button>
      </div>

      <div class="toolbar" style="margin-top:14px">
        <button class="btn btn-primary" onclick="simpanRph('lengkap')">Simpan sebagai lengkap</button>
        <button class="btn" onclick="simpanRph('draf')">Simpan draf</button>
        <button class="btn" onclick="cetakRph()">🖨️ Cetak / PDF</button>
        <button class="btn btn-ungu" onclick="modalLatihan()">📝 Jana soalan latihan</button>
      ${driveSedia() ? `<button class="btn" onclick="simpanRphKeDrive()">📁 Simpan ke Drive</button>` : ''}
        <button class="btn" onclick="salinRph()">📋 Salin ke tarikh lain</button>
        <button class="btn btn-danger" onclick="padamRph()">Padam</button>
      </div>
    </div>

    <div>
      <div class="kad ai-panel">
        <div class="kad-h"><h3>Semakan kualiti</h3><span class="pil ${warna}">${q.peratus}%</span></div>
        ${q.cek.map(c=>`<div style="display:flex;gap:8px;font-size:12.5px;padding:3px 0;color:${c[1]?'var(--teks-2)':'var(--merah)'}">
          <span>${c[1]?'✓':'✕'}</span><span>${c[0]}</span></div>`).join('')}
        ${(() => { const a = semakAngkaMurid(r);
          return a.ok ? '' : `<p style="margin-top:10px;font-size:12px;background:#fdeaea;color:#a33;padding:9px;border-radius:8px">
            ⚠️ RPH menyebut <b>${esc(a.salah.join(', '))}</b> murid tetapi kelas ini ada <b>${a.jum}</b> murid.
            <button class="btn btn-sm" style="margin-top:7px" onclick="betulkanAngka(${a.jum})">Betulkan automatik</button></p>`; })()}
        ${r.amaran ? `<p style="margin-top:10px;font-size:12px;background:#fdf3dd;color:#8a6106;padding:9px;border-radius:8px">⚠️ ${esc(r.amaran)}</p>` : ''}
        <p style="font-size:11px;color:var(--teks-3);margin-top:10px">Semakan ini bantuan sistem sahaja, bukan pengesahan rasmi KPM.</p>
      </div>

    </div>
  </div>

  <button class="ai-fab" onclick="bukaAiDrawer()" title="AI Assistant">✨</button>
  <div class="ai-tirai" id="aiTirai" onclick="tutupAiDrawer()"></div>
  <div class="ai-drawer" id="aiDrawer">
    <div class="kad-h" style="margin-bottom:10px"><h3>✨ AI Assistant</h3>
      <button class="icon-btn" onclick="tutupAiDrawer()">✕</button></div>
    <div class="ai-cadang">
      ${['Pendekkan aktiviti','Sesuaikan untuk murid lemah','Tambah aktiviti KBAT','Jadikan lebih PAK21','Buat versi 30 minit','Objektif lebih terukur','Tambah aktiviti pemulihan']
        .map(t=>`<button onclick="aiUbah('${t}')">${t}</button>`).join('')}
    </div>
    <label class="fld"><span>Arahan sendiri</span><textarea id="aiArahan" placeholder="Cth: tukar set induksi kepada permainan teka kata" style="min-height:70px"></textarea></label>
    <button class="btn btn-ungu btn-block" onclick="aiUbah()">Jalankan arahan</button>
    <button class="btn btn-block" style="margin-top:8px" onclick="janaSemula()">🔄 Jana semula keseluruhan</button>
  </div>`;
}

function bukaAiDrawer(){ $('#aiDrawer').classList.add('buka'); $('#aiTirai').classList.add('buka'); }
function tutupAiDrawer(){ $('#aiDrawer').classList.remove('buka'); $('#aiTirai').classList.remove('buka'); }

function editorTerbuka(){ return !!document.getElementById('eTarikh'); }

function bacaEditor(){
  const g = id => $('#'+id) ? $('#'+id).value.trim() : '';
  if(!editorTerbuka()) return {};          // dipanggil di luar editor — jangan meletup
  return {
    tarikh:g('eTarikh'), hari:namaHari(g('eTarikh')), mula:g('eMula'), tamat:g('eTamat'),
    tempoh:minit(g('eMula'),g('eTamat')), subjek:g('eSubjek'), kelas:g('eKelas'), minggu:g('eMinggu'),
    tema:g('eTema'), tajuk:g('eTajuk'), kodSk:g('eKodSk'), kodSp:g('eKodSp'), sk:g('eSk'), sp:g('eSp'), tp:g('eTp'),
    objektif:g('eObjektif'), kriteria:g('eKriteria'), aktiviti:$('#eAktiviti')?.innerHTML || '',
    pengayaan:g('ePengayaan'), pemulihan:g('ePemulihan'), penutup:g('ePenutup'),
    strategi:g('eStrategi'), pak21:g('ePak21'), kbat:g('eKbat'), emk:g('eEmk'), nilai:g('eNilai'),
    bbm:g('eBbm'), pentaksiran:g('ePentaksiran'), refleksi:g('eRefleksi'), dikemas:Date.now()
  };
}
async function simpanRph(status){
  const d = { ...bacaEditor(), status };
  // Asal-usul standard direkod supaya Semakan RPH tahu guru memang sengaja
  // menggunakan SK/SP daripada minggu lain atau tulisan sendiri.
  if(window._stdManual) d.rptManual = true;
  if(window._stdSumberMinggu) d.rptMingguAsal = window._stdSumberMinggu;
  sibuk(true,'Menyimpan…');
  const lama = S.rph.find(x => x.id === S.editRphId);
  await rujuk('rph').doc(S.editRphId).collection('versi').add({ ...lama, disimpan:Date.now() }).catch(()=>{});
  await rujuk('rph').doc(S.editRphId).update(d);
  await muatRph(); sibuk(false); halEditor(); toast('RPH disimpan','jaya');
}
/* ================= SOALAN LATIHAN ================= */
function modalLatihan(){
  const r = { ...S.rph.find(x => x.id === S.editRphId), ...bacaEditor() };
  if(!r.objektif || r.objektif.trim().length < 10)
    return toast('Isi objektif pembelajaran dahulu — soalan dijana daripadanya','salah');

  const sedia = r.latihan;
  modal('Jana soalan latihan', `
    <div style="font-size:12.5px;color:var(--teks-2);margin-bottom:12px">
      Soalan dijana daripada objektif pembelajaran RPH ini —
      <b>${esc(r.subjek)} · ${esc(r.kelas)}${r.tajuk ? ' · '+esc(r.tajuk) : ''}</b>.</div>

    ${sedia ? `<div class="kad" style="background:var(--ungu-t);border-color:#ddd3fb;padding:11px;margin-bottom:13px;font-size:12.5px">
      Sudah ada latihan tersimpan: <b>${esc(sedia.tajuk||JENIS_LATIHAN[sedia.jenis]?.label||'Latihan')}</b>.
      Menjana yang baharu akan menggantikannya.
      <button class="btn btn-sm" style="margin-top:8px" onclick="tutupModal();lihatLatihan()">Lihat yang sedia ada</button>
    </div>` : ''}

    <label class="fld"><span>Jenis latihan</span>
      <select id="ltJenis" onchange="ubahJenisLatihan()">
        <optgroup label="Latihan bertulis">
          ${Object.entries(JENIS_LATIHAN).filter(([,v]) => !v.main)
            .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </optgroup>
        <optgroup label="Permainan">
          ${Object.entries(JENIS_LATIHAN).filter(([,v]) => v.main)
            .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </optgroup>
      </select></label>

    <label class="fld" id="ltBilBaris"><span>Bilangan soalan <em>(minimum 10)</em></span>
      <select id="ltBil"><option selected>10</option><option>12</option><option>15</option><option>20</option></select></label>

    <label class="fld"><span>Aras kesukaran</span>
      <select id="ltAras">
        <option value="mudah">Mudah — untuk murid pemulihan</option>
        <option value="sederhana" selected>Sederhana — untuk majoriti murid</option>
        <option value="kbat">KBAT — untuk murid pengayaan</option>
      </select></label>

    <label class="fld" id="ltGambarBaris" style="display:none"><span>Gambar untuk setiap item</span>
      <select id="ltGambar">
        <option value="emoji">Emoji besar berwarna</option>
        <option value="kosong">Kotak kosong — saya tampal gambar sendiri</option>
      </select></label>

    <label class="baris" style="cursor:pointer;align-items:flex-start;margin-bottom:13px">
      <input type="checkbox" id="ltSemak" checked style="width:auto;margin-top:3px">
      <div class="baris-t"><b>Semak jawapan dengan AI</b>
        <small>Pusingan kedua menyemak tatabahasa, logik kata hubung dan pengiraan.
        Mengambil masa tambahan dan satu panggilan AI lagi.</small></div></label>

    <label class="fld"><span>Arahan khas anda <em>(pilihan)</em></span>
      <textarea id="ltArahan" rows="3"
        placeholder="Cth: Fokus pada penukaran unit sahaja. Guna nama murid kelas saya. Elakkan soalan berayat panjang."></textarea></label>

    <p style="font-size:11.5px;color:var(--teks-3);margin-top:4px" id="ltNota"></p>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="janaLatihan()">✨ Jana</button>`);
  ubahJenisLatihan();
}

function ubahJenisLatihan(){
  const j = $('#ltJenis')?.value;
  const main = JENIS_LATIHAN[j]?.main;
  if($('#ltBilBaris')) $('#ltBilBaris').style.display = main ? 'none' : '';
  if($('#ltGambarBaris')) $('#ltGambarBaris').style.display = j === 'gambarAyat' ? '' : 'none';
  if($('#ltNota')) $('#ltNota').textContent = main
    ? 'AI membekalkan istilah dan klu; susun atur grid dibina oleh aplikasi supaya sentiasa sah.'
    : j === 'padanan'
      ? 'Dua lajur bersebelahan — murid memadankan dengan melukis garisan.'
      : 'Setiap soalan disertakan jawapan dan huraian ringkas untuk rujukan guru.';
}

async function janaLatihan(){
  const jenis = $('#ltJenis').value, aras = $('#ltAras').value;
  const bilangan = $('#ltBil') ? +$('#ltBil').value : 8;
  const arahanGuru = $('#ltArahan') ? $('#ltArahan').value.trim() : '';
  const gambar = $('#ltGambar') ? $('#ltGambar').value : 'emoji';
  const semak = $('#ltSemak') ? $('#ltSemak').checked : true;
  tutupModal();
  const r = { ...S.rph.find(x => x.id === S.editRphId), ...bacaEditor() };
  sibuk(true, 'AI sedang menyediakan latihan…');
  try{
    const latihan = await janaSoalanAI({ jenis, aras, bilangan, arahanGuru, gambar, semak,
      subjek:r.subjek, kelas:r.kelas, tajuk:r.tajuk, sk:r.sk, sp:r.sp, objektif:r.objektif,
      lapor: t => sibuk(true, t) });
    await rujuk('rph').doc(S.editRphId).update({ latihan, dikemas: Date.now() });
    await muatRph(); sibuk(false);
    lihatLatihan();
    const n = latihan.pembetulan?.length || 0;
    toast(latihan.semakanGagal ? latihan.semakanGagal
      : n ? `Latihan siap · AI membetulkan ${n} jawapan`
          : latihan.disemak ? 'Latihan siap · semakan AI tiada isu' : 'Latihan siap dijana',
      latihan.semakanGagal ? 'salah' : 'jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}

function lihatLatihan(){
  const r = S.rph.find(x => x.id === S.editRphId);
  const L = r?.latihan;
  if(!L) return toast('Belum ada latihan untuk RPH ini');
  modal(L.tajuk || 'Latihan', `
    <div class="lt-pratonton">${htmlLatihan(r, L, false)}</div>`,
    `<button class="btn" onclick="tutupModal()">Tutup</button>
     <button class="btn" onclick="cetakLatihan(true)">🖨️ Cetak + skema</button>
     <button class="btn btn-primary" onclick="cetakLatihan(false)">🖨️ Cetak lembaran murid</button>`);
}

function cetakLatihan(denganSkema){
  const r = S.rph.find(x => x.id === S.editRphId);
  if(!r?.latihan) return toast('Belum ada latihan');
  tutupModal();
  keluarkanCetak(htmlLatihan(r, r.latihan, denganSkema) + notaCetak());
}

/* ---------- Paparan & cetakan lembaran ---------- */
function htmlLatihan(r, L, skema){
  const kepala = `<div class="lt-kepala">
    <div class="lt-sekolah">${esc((S.sekolah?.nama||'').toUpperCase())}</div>
    <h2>${esc(L.tajuk || 'Lembaran Kerja')}</h2>
    <div class="lt-meta">${esc(r.subjek)} · ${esc(r.kelas)}${r.tajuk?' · '+esc(r.tajuk):''}
      &nbsp;|&nbsp; ${ARAS_LATIHAN[L.aras]?.split('—')[0].trim() || ''}</div>
    <div class="lt-nama">Nama: ______________________________ &nbsp;&nbsp; Tarikh: ______________</div>
    ${L.arahan ? `<p class="lt-arahan"><b>Arahan:</b> ${esc(L.arahan)}</p>` : ''}
  </div>`;

  if(L.jenis === 'silangKata') return kepala + htmlSilangKata(L, skema);
  if(L.jenis === 'cariKata')   return kepala + htmlCariKata(L, skema);
  if(L.jenis === 'gambarAyat') return kepala + htmlGambarAyat(L, skema);
  if(L.jenis === 'padanan')    return kepala + htmlPadanan(L, skema);

  const bank = L.bankPerkataan?.length ? `<div class="lt-bank"><b>Bank perkataan:</b>
    ${L.bankPerkataan.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';

  const ruang = s => {
    if(L.jenis === 'subjektif') return `<div class="lt-kerja"><small>Jalan kerja:</small></div>
      <div class="lt-akhir">Jawapan: ______________________</div>`;
    if(s.pilihan?.length) return `<div class="lt-pilihan">${s.pilihan.map(p => `<div>${esc(p)}</div>`).join('')}</div>`;
    return `<div class="lt-jawab">${'_'.repeat(L.jenis==='struktur'?60:34)}</div>`;
  };

  const soalan = (L.soalan||[]).map(s => `<div class="lt-soalan">
    <div class="lt-s"><b>${s.no}.</b> ${esc(s.soalan)}${s.markah?` <em>[${s.markah} markah]</em>`:''}</div>
    ${ruang(s)}
  </div>`).join('');

  return kepala + bank + `<div class="lt-senarai">${soalan}</div>` + (skema ? htmlSkema(L) : '');
}

/* Padanan sebenar: dua lajur bersebelahan, murid melukis garisan dari kiri ke
   kanan. Lajur kanan dikocok supaya jawapan tidak sebaris dengan soalannya. */
function htmlPadanan(L, skema){
  const item = L.soalan || [];
  const kanan = (L.padananKanan && L.padananKanan.length === item.length)
    ? L.padananKanan : item.map(x => x.jawapan);
  const huruf = i => String.fromCharCode(65 + i);

  const kiri = item.map(s => `<div class="pd-kad">
      <span class="pd-no">${s.no}</span><span class="pd-teks">${esc(s.soalan)}</span>
      <i class="pd-titik"></i></div>`).join('');
  const kananHtml = kanan.map((x,i) => `<div class="pd-kad pd-kanan">
      <i class="pd-titik"></i><span class="pd-no">${huruf(i)}</span>
      <span class="pd-teks">${esc(x)}</span></div>`).join('');

  const skemaHtml = skema ? `<div class="lt-skema"><h3>SKEMA JAWAPAN <small>(untuk guru sahaja)</small></h3>
    ${item.map(s => `<div class="lt-sk"><b>${s.no}.</b> ${esc(s.soalan)} —
      <b>${huruf(kanan.indexOf(s.jawapan))}. ${esc(s.jawapan)}</b></div>`).join('')}</div>` : '';

  return `<div class="pd-grid"><div class="pd-lajur">${kiri}</div>
    <div class="pd-lajur">${kananHtml}</div></div>${skemaHtml}`;
}

function htmlGambarAyat(L, skema){
  const kosong = L.gambar === 'kosong';
  const item = (L.soalan||[]).map(s => `<div class="lt-gambar">
    <div class="lt-kotak${kosong ? ' lt-kotak-kosong' : ''}">
      ${kosong ? '<em>Tampal<br>gambar</em>' : `
        ${s.latar ? `<span class="gm-latar">${esc(s.latar)}</span>` : ''}
        <span class="gm-emoji">${esc(s.emoji||'🖼️')}</span>`}
    </div>
    <div class="lt-tulis">
      <div class="lt-s"><b>${s.no}.</b>${s.kataBantu?.length
        ? ` <em>Kata bantu: ${s.kataBantu.map(esc).join(', ')}</em>` : ''}</div>
      <div class="lt-baris"></div><div class="lt-baris"></div>
    </div>
  </div>`).join('');

  return `<div class="lt-gambar-senarai">${item}</div>
    ${skema ? `<div class="lt-skema"><h3>CONTOH JAWAPAN <small>(untuk guru)</small></h3>
      ${(L.soalan||[]).map(s => `<div class="lt-sk"><b>${s.no}.</b>
        ${esc(s.perihal||'')} — <em>${esc(s.jawapan||'')}</em></div>`).join('')}</div>` : ''}`;
}

function htmlSkema(L){
  const langkah = s => s.langkah?.length
    ? `<div class="lt-langkah">${s.langkah.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
  const nota = L.semakanGagal
    ? `<div class="lt-semak lt-semak-gagal"><b>⚠ ${esc(L.semakanGagal)}</b>
         Sila semak jawapan secara manual sebelum diedarkan.</div>`
    : L.disemak
      ? `<div class="lt-semak"><b>✓ Disemak semula oleh AI</b>${
          L.pembetulan?.length
            ? `<ul>${L.pembetulan.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
            : ' Tiada pembetulan diperlukan.'}</div>`
      : '';
  return `<div class="lt-skema"><h3>SKEMA JAWAPAN <small>(untuk guru sahaja)</small></h3>
    ${(L.soalan||[]).map(s => `<div class="lt-sk">
      <b>${s.no}.</b> ${esc(s.jawapan||'-')}${s.markah?` <em>[${s.markah}m]</em>`:''}${langkah(s)}${s.huraian?` <em>— ${esc(s.huraian)}</em>`:''}</div>`).join('')}
    ${nota}
  </div>`;
}

function htmlSilangKata(L, skema){
  const g = L.grid; if(!g) return '';
  const sel = barisKeSel(g);
  const baris = sel.map((b,ri) => `<tr>${b.map((ch,ci) => {
    if(!ch) return '<td class="lt-kosong"></td>';
    const no = g.nombor[ri+','+ci];
    return `<td class="lt-sel">${no?`<i>${no}</i>`:''}${skema?esc(ch):''}</td>`;
  }).join('')}</tr>`).join('');

  const klu = arah => (g.kunci||[]).filter(k => k.mendatar === arah)
    .map(k => `<li><b>${k.no}.</b> ${esc(k.klu)} <em>(${k.perkataan.length} huruf)</em>${skema?` — <b>${esc(k.perkataan)}</b>`:''}</li>`).join('');

  return `<table class="lt-grid">${baris}</table>
    <div class="lt-klu">
      <div><h4>Melintang</h4><ul>${klu(true)}</ul></div>
      <div><h4>Menegak</h4><ul>${klu(false)}</ul></div>
    </div>`;
}

function htmlCariKata(L, skema){
  const g = L.grid; if(!g) return '';
  const tanda = new Set();
  if(skema) (g.kunci||[]).forEach(k => {
    for(let i=0;i<k.perkataan.length;i++) tanda.add((k.r+k.dr*i)+','+(k.c+k.dc*i));
  });
  const baris = barisKeSel(g).map((b,ri) => `<tr>${b.map((ch,ci) =>
    `<td class="lt-sel${tanda.has(ri+','+ci)?' lt-jumpa':''}">${esc(ch||'')}</td>`).join('')}</tr>`).join('');
  const arah = (g.arah || 3) <= 2
    ? 'Perkataan tersembunyi mendatar (kiri ke kanan) dan menegak (atas ke bawah) sahaja.'
    : 'Perkataan tersembunyi mendatar (kiri ke kanan), menegak (atas ke bawah) dan serong ke bawah.';
  return `<table class="lt-grid lt-cari">${baris}</table>
    <p class="lt-arah">${arah}</p>
    <div class="lt-senarai-kata"><b>Cari perkataan ini:</b>
      ${(L.kata||[]).map(k => `<span>${esc(k.perkataan)}</span>`).join('')}</div>
    ${skema ? `<div class="lt-skema"><h3>KLU ISTILAH <small>(untuk guru)</small></h3>
      ${(L.kata||[]).map(k => `<div class="lt-sk"><b>${esc(k.perkataan)}</b> — ${esc(k.klu)}</div>`).join('')}</div>` : ''}`;
}

function padamRph(){
  sahkan('Padam RPH ini secara kekal?', async () => {
    sibuk(true,'Memadam…'); await rujuk('rph').doc(S.editRphId).delete();
    await muatRph(); sibuk(false); pergi('rph'); toast('RPH dipadam');
  });
}
function salinRph(){
  modal('Salin RPH', `
    <label class="fld"><span>Tarikh baharu</span><input id="slTarikh" type="date" value="${tarikhISO()}"></label>
    <label class="fld"><span>Kelas</span><select id="slKelas">${S.kelas.map(k=>`<option>${esc(k.nama)}</option>`).join('')}</select></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="buatSalinan()">Salin</button>`);
}
async function buatSalinan(){
  const r = S.rph.find(x => x.id === S.editRphId);
  const t = $('#slTarikh').value;
  const baru = { ...r, tarikh:t, hari:namaHari(t), kelas:$('#slKelas').value, minggu:mingguUntuk(t),
                 status:'draf', dicipta:Date.now(), dikemas:Date.now() };
  delete baru.id;
  sibuk(true,'Menyalin…'); const ref = await rujuk('rph').add(baru);
  await muatRph(); sibuk(false); tutupModal(); bukaRph(ref.id); toast('RPH disalin','jaya');
}
async function pilihRpt(){
  const subjek = $('#eSubjek').value, minggu = $('#eMinggu').value;
  let d = rptUntuk(subjek, '', minggu).semua;
  if(!d.length){
    sibuk(true,'Memuatkan RPT…'); d = await muatRptSubjek(subjek, ''); sibuk(false);
  }
  window._rptPilih = d.sort((a,b)=> noMinggu(a.minggu) - noMinggu(b.minggu));
  const n = noMinggu(minggu);
  modal('Pilih baris RPT', d.length
    ? `<input placeholder="Cari minggu atau tajuk…" oninput="tapisRpt(this.value)" style="margin-bottom:10px">
       <div id="rptSenarai" class="senarai">${window._rptPilih.slice(0,300).map((x,i)=>`
        <div class="baris" onclick="pakaiRpt(${i})" style="cursor:pointer;${noMinggu(x.minggu)===n?'border-color:var(--biru);background:var(--biru-t)':''}">
          <span class="pil ${noMinggu(x.minggu)===n?'biru':'kelabu'}">M${esc(x.minggu||'-')}</span>
          <div class="baris-t"><b>${esc((x.tajuk||x.tema||'').slice(0,70))}</b>
          <small>${esc(x.kodSp||'')} ${esc((x.sp||'').slice(0,80))}</small></div></div>`).join('')}</div>`
    : `<div class="kosong"><b>Tiada RPT untuk subjek ini</b>Muat naik RPT di menu RPT dahulu.</div>`);
}
function tapisRpt(q){
  q = q.toLowerCase();
  Array.from($('#rptSenarai').children).forEach(el => el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none');
}
function pakaiRpt(i){
  const x = (window._rptPilih || [])[i]; if(!x) return;
  $('#eKodSk').value = x.kodSk||''; $('#eSk').value = x.sk||'';
  $('#eKodSp').value = x.kodSp||''; $('#eSp').value = x.sp||''; $('#eTp').value = x.tp||'';
  if(!$('#eTajuk').value) $('#eTajuk').value = x.tajuk||'';
  if(!$('#eTema').value) $('#eTema').value = x.tema||'';
  // Rekod dari minggu mana standard ini diambil, supaya Semakan RPH tidak
  // menandakannya "SP tidak sepadan RPT" sedangkan guru memang sengaja memilihnya.
  window._stdSumberMinggu = noMinggu(x.minggu) === noMinggu($('#eMinggu').value)
    ? '' : (x.minggu || '');
  tutupModal();
  toast(window._stdSumberMinggu
    ? `Standard ${labelMinggu(x.minggu)} dimasukkan — tekan "Jana baru" untuk bina semula RPH`
    : 'Maklumat RPT dimasukkan','jaya');
}

/* Jana semula seluruh RPH berdasarkan SK/SP yang ada dalam editor sekarang.
   Berbeza daripada janaSemula(): fungsi ini TIDAK merujuk RPT minggu semasa —
   ia mengikut standard yang guru pilih atau tulis sendiri, walau daripada
   minggu mana sekalipun. Refleksi dan maklumat slot dikekalkan. */
async function janaDariStandard(){
  const r = { ...S.rph.find(x => x.id === S.editRphId), ...bacaEditor() };
  if(!String(r.sp||'').trim() && !String(r.sk||'').trim())
    return toast('Isi Standard Kandungan atau Standard Pembelajaran dahulu','salah');

  sahkan(`Jana semula RPH ini berdasarkan SK/SP di atas?\n\n` +
    `Objektif, kriteria kejayaan, aktiviti, KBAT, PAK-21, PBD, BBM, pemulihan dan pengayaan ` +
    `akan diganti. Refleksi anda dikekalkan. Perubahan belum disimpan sehingga anda tekan Simpan.`,
    async () => {
      sibuk(true,'AI menjana RPH baharu…');
      try{
        const fokus = { kodSk:r.kodSk, kodSp:r.kodSp, sk:r.sk, sp:r.sp, tp:r.tp,
                        tajuk:r.tajuk, tema:r.tema };
        const baru = await janaRphAI({
          slotId:r.slotId, tarikh:r.tarikh, subjek:r.subjek, kelas:r.kelas, tahun:r.tahun,
          mula:r.mula, tamat:r.tamat, tempoh:r.tempoh || minit(r.mula,r.tamat),
          minggu:r.minggu, tajuk:r.tajuk || r.tema,
          rptFokus:fokus, rptManual:true, cadangSp:!(r.sk && r.sp)
        });
        const set = (id,v) => { if(v != null && $('#'+id)) $('#'+id).value = v; };
        set('eTajuk', baru.tajuk); set('eTema', baru.tema);
        set('eObjektif', baru.objektif); set('eKriteria', baru.kriteria);
        if(baru.aktiviti) $('#eAktiviti').innerHTML = baru.aktiviti;
        set('ePenutup', stripHtml(baru.penutup||''));
        set('ePemulihan', stripHtml(baru.pemulihan||'')); set('ePengayaan', stripHtml(baru.pengayaan||''));
        set('eStrategi', baru.strategi); set('ePak21', baru.pak21); set('eKbat', baru.kbat);
        set('eEmk', baru.emk); set('eNilai', baru.nilai); set('eBbm', baru.bbm);
        set('ePentaksiran', baru.pentaksiran);
        window._stdManual = true;                    // ditulis semasa simpan
        sibuk(false);
        toast('RPH baharu dijana. Semak dan tekan Simpan.','jaya');
      }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
    });
}

/* ---------- AI dalam editor ---------- */
async function aiUbah(arahanCepat){
  const arahan = arahanCepat || $('#aiArahan').value.trim();
  if(!arahan) return toast('Tulis arahan untuk AI','salah');
  const r = { ...S.rph.find(x=>x.id===S.editRphId), ...bacaEditor() };
  sibuk(true,'AI sedang mengubah suai…');
  try{
    const p = `Ini RPH sedia ada dalam JSON:
${JSON.stringify({ tajuk:r.tajuk, sk:r.sk, sp:r.sp, objektif:r.objektif, kriteria:r.kriteria,
  aktiviti:r.aktiviti, pengayaan:r.pengayaan, pemulihan:r.pemulihan, penutup:r.penutup,
  strategi:r.strategi, pak21:r.pak21, kbat:r.kbat, emk:r.emk, nilai:r.nilai, bbm:r.bbm, pentaksiran:r.pentaksiran })}

Tempoh PdP: ${r.tempoh} minit. Subjek ${r.subjek}, ${r.kelas}.
ARAHAN GURU: ${arahan}

Ubah HANYA bahagian yang berkaitan dengan arahan. Kekalkan Standard Kandungan dan Standard Pembelajaran seperti asal tanpa sebarang perubahan.
Balas JSON sahaja dengan medan yang sama (medan yang tidak diubah dikembalikan seperti asal).`;
    const j = ambilJSON(await panggilAiSelamat(p));
    const set = (id,v) => { if(v != null && $('#'+id)) $('#'+id).value = v; };
    set('eTajuk', j.tajuk); set('eObjektif', Array.isArray(j.objektif)?j.objektif.join('\n'):j.objektif);
    set('eKriteria', Array.isArray(j.kriteria)?j.kriteria.join('\n'):j.kriteria);
    if(j.aktiviti) $('#eAktiviti').innerHTML = j.aktiviti;
    set('ePengayaan', stripHtml(j.pengayaan)); set('ePemulihan', stripHtml(j.pemulihan)); set('ePenutup', stripHtml(j.penutup));
    set('eStrategi', j.strategi); set('ePak21', j.pak21); set('eKbat', j.kbat); set('eEmk', j.emk);
    set('eNilai', j.nilai); set('eBbm', j.bbm); set('ePentaksiran', j.pentaksiran);
    sibuk(false); tutupAiDrawer(); toast('AI selesai. Semak dan simpan.','jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}
async function janaSemula(){
  const r = S.rph.find(x=>x.id===S.editRphId);
  sibuk(true,'AI menjana semula RPH…');
  try{
    const baru = await janaRphAI({ slotId:r.slotId, tarikh:r.tarikh, subjek:r.subjek, kelas:r.kelas,
      tahun:r.tahun, mula:r.mula, tamat:r.tamat, tempoh:minit(r.mula,r.tamat), minggu:r.minggu, tajuk:r.tajuk });
    delete baru.dicipta;
    await rujuk('rph').doc(S.editRphId).update({ ...baru, status:'draf' });
    await muatRph(); sibuk(false); halEditor(); toast('RPH dijana semula','jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}
function betulkanAngka(jum){
  ['eRefleksi','eKriteria','eObjektif'].forEach(id => {
    const el = $('#'+id); if(!el) return;
    el.value = String(el.value)
      .replace(/(\d{1,3})\s*(daripada|dari|\/)\s*(\d{1,3})(\s*(?:orang\s*)?murid)/gi,
        (m,a,b,c,d) => `${Math.min(+a, jum)} ${b} ${jum}${d}`)
      .replace(/(seramai|kesemua|semua)\s*(\d{1,3})(\s*(?:orang\s*)?murid)/gi,
        (m,a,b,c) => `${a} ${jum}${c}`);
  });
  const ed = $('#eAktiviti');
  if(ed) ed.innerHTML = ed.innerHTML.replace(/(\d{1,3})\s*(daripada|dari)\s*(\d{1,3})(\s*(?:orang\s*)?murid)/gi,
    (m,a,b,c,d) => `${Math.min(+a, jum)} ${b} ${jum}${d}`);
  toast('Angka dibetulkan kepada '+jum+' murid','jaya');
  if(typeof halEditor === "function") setTimeout(halEditor, 60);
}

function janaRefleksi(){
  const r = bacaEditor();
  const k = infoKelas(r.kelas);
  const jum = k.bilangan || 0;
  const cadang = jum ? [Math.round(jum*0.9), Math.round(jum*0.75), Math.round(jum*0.5)] : [];
  const belumSampai = r.tarikh && r.tarikh > tarikhISO();
  modal('Jana refleksi', `
    ${belumSampai ? `<div class="kad" style="background:#fdeaea;border-color:#f5cfcf;padding:11px;margin-bottom:13px;font-size:12.5px;color:#a33">
      RPH ini bertarikh <b>${tarikhCantik(r.tarikh)}</b> — belum diajar.
      Refleksi sepatutnya ditulis selepas PdP. Teruskan hanya jika anda pasti.</div>` : ''}
    ${jum ? `<div class="kad" style="background:var(--ungu-t);border-color:#ddd3fb;padding:11px;margin-bottom:13px;font-size:12.5px;color:var(--teks-2)">
      Kelas <b>${esc(r.kelas)}</b> mempunyai <b>${jum} murid</b>${k.tahap?` · tahap ${esc(k.tahap)}`:''}.
      Refleksi akan menggunakan angka sebenar ini.</div>`
      : `<div class="kad" style="background:#fdf3dd;border-color:#f0dcae;padding:11px;margin-bottom:13px;font-size:12.5px;color:#8a6106">
      Bilangan murid untuk kelas <b>${esc(r.kelas||'—')}</b> belum ditetapkan.
      Isi di menu <b>Kelas</b> supaya refleksi tepat.</div>`}
    <label class="fld"><span>Keadaan sebenar PdP</span><select id="rfPilih">
      <option>Semua murid menguasai objektif</option>
      <option>Sebahagian besar murid menguasai</option>
      <option>Ramai murid belum menguasai</option>
      <option>Aktiviti berjaya dan murid aktif</option>
      <option>Aktiviti perlu ditambah baik</option>
      <option>PdP tidak dapat dijalankan</option></select></label>
    <label class="fld"><span>Bilangan murid menguasai daripada ${jum||'—'}</span>
      <input id="rfBil" type="number" min="0" max="${jum||999}" value="${cadang[0]||''}" placeholder="${jum?'Cth: '+cadang[0]:'Bilangan'}">
      ${cadang.length?`<span style="display:flex;gap:6px;margin-top:7px">${cadang.map(n=>
        `<button type="button" class="btn btn-sm" onclick="$('#rfBil').value=${n}">${n}/${jum}</button>`).join('')}</span>`:''}
    </label>
    <label class="fld"><span>Catatan tambahan</span><textarea id="rfNota" style="min-height:70px"></textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="jalankanRefleksi()">✨ Jana</button>`);
}
async function jalankanRefleksi(){
  const pilih = $('#rfPilih').value, bil = $('#rfBil').value.trim(), nota = $('#rfNota').value.trim();
  tutupModal(); sibuk(true,'AI menulis refleksi…');
  try{
    const r = bacaEditor();
    const k = infoKelas(r.kelas);
    const jum = k.bilangan || null;
    const menguasai = bil ? Math.min(+bil, jum || +bil) : null;
    const p = `Tulis satu refleksi RPH profesional (2-4 ayat, Bahasa Melayu baku, gaya rekod rasmi guru KPM).

MAKLUMAT KELAS SEBENAR — WAJIB PATUH
Kelas: ${r.kelas}${k.tahun?' ('+k.tahun+')':''}
Jumlah murid dalam kelas ini: ${jum ?? 'tidak dinyatakan'}
${k.tahap?'Tahap pencapaian kelas: '+k.tahap:''}
${k.nota?'Nota guru tentang kelas ini: '+k.nota:''}
${menguasai!=null && jum ? `Bilangan menguasai objektif: ${menguasai} daripada ${jum} murid.` : ''}

PERATURAN ANGKA (PALING PENTING)
- Gunakan HANYA angka ${jum ?? '(tiada)'} sebagai jumlah murid. JANGAN reka atau anggar angka lain.
${menguasai!=null && jum ? `- Tulis dengan tepat "${menguasai} daripada ${jum} orang murid".` : '- Jika bilangan tidak diberi, tulis secara umum tanpa angka.'}
${k.tahap||k.nota ? '- Sesuaikan nada refleksi dengan tahap dan nota kelas di atas (contoh: kelas lemah perlu bimbingan lanjutan, bukan pengayaan sahaja).' : ''}

Objektif: ${r.objektif}
Aktiviti: ${stripHtml(r.aktiviti).slice(0,400)}
Keadaan sebenar: ${pilih}${nota?'. Catatan guru: '+nota:''}
Balas teks refleksi sahaja tanpa tajuk atau markdown.`;
    $('#eRefleksi').value = (await panggilAiSelamat(p)).trim();
    sibuk(false); toast('Refleksi dijana','jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}

/* ---------- Cetak / PDF ---------- */
function kodTeks(kod, teks){
  const k = (kod||'').trim(), t = (teks||'').trim();
  if(!t) return k || '-';
  if(!k || t.startsWith(k) || k.length > 18 || k === t) return t;
  return k + ' ' + t;
}
function senaraiNombor(t){
  return (t||'').split('\n').map(x=>x.trim()).filter(Boolean)
    .map((x,i)=> /^\d+[.)]/.test(x) ? esc(x) : (i+1)+'. '+esc(x)).join('<br>') || '-';
}

function pecahAktiviti(html){
  // Pisahkan blok "Set Induksi" daripada langkah utama jika boleh dikesan
  const t = String(html||'');
  if(!/Set\s*Induksi/i.test(t)) return { starter:'', utama:t };
  // cari permulaan "Langkah 1" tanpa mengira tag <b>/<strong> di dalamnya
  const m = t.match(/<(p|h\d|div)[^>]*>(?:\s|<[^>]+>)*Langkah\s*1/i);
  if(m){
    const i = t.indexOf(m[0]);
    if(i > 0) return { starter: t.slice(0, i), utama: t.slice(i) };
  }
  return { starter:'', utama:t };
}

function htmlRph(r, tunjukSemakan){
  const p = v => { const t = String(v||'').trim(); return (t && t !== '-') ? esc(t) : '-'; };
  const nilai = v => { const t = String(v||'').trim(); return (t && t !== '-') ? t : ''; };
  const [gelap, cerah] = warnaSubjek(r.subjek);
  const kelasInfo = S.kelas.find(k => norma(k.nama) === norma(r.kelas));
  const bil = kelasInfo?.bilangan || '____';
  const tempoh = r.tempoh || minit(r.mula, r.tamat);
  const obj = (r.objektif||'').split('\n').map(x=>x.trim().replace(/^\d+[.)]\s*/,'')).filter(x=>x && x!=='-');
  const kk  = (r.kriteria||'').split('\n').map(x=>x.trim().replace(/^\d+[.)]\s*/,'')).filter(x=>x && x!=='-');
  const akt = pecahAktiviti(r.aktiviti);
  const th = `style="background:${cerah}"`;
  const band = (t, span) => `<tr class="pd-band" style="background:${gelap}"><td colspan="${span||6}">${t}</td></tr>`;
  const refleksiKanan = r.refleksi ? esc(r.refleksi) : `
    ___ / ${bil} murid dapat mencapai objektif pembelajaran dengan baik dan diberi latihan pengayaan.<br><br>
    ___ / ${bil} murid dapat mencapai objektif pembelajaran dengan bimbingan dan diberi latihan pengukuhan.<br><br>
    ___ / ${bil} murid tidak dapat mencapai objektif pembelajaran dan diberi latihan pemulihan.<br><br>
    <b>PdPC pada hari ini:</b>
    <table style="width:100%;border-collapse:collapse;margin-top:2pt">
      <tr><td style="border:1px solid #444;padding:1.6pt 3pt">Memuaskan</td><td style="border:1px solid #444;width:9mm"></td></tr>
      <tr><td style="border:1px solid #444;padding:1.6pt 3pt">Tidak memuaskan</td><td style="border:1px solid #444"></td></tr>
    </table>`;

  return `
  ${(S.logo || S.sekolah?.logo) ? `<div class="lp-kepala"><img src="${S.logo || esc(S.sekolah.logo)}">
    <div><b>${esc((S.sekolah?.nama||'').toUpperCase())}</b></div></div>` : ''}
  <table class="pd-tbl">
    <colgroup><col style="width:34mm"><col style="width:56mm"><col style="width:16mm"><col style="width:34mm"><col style="width:16mm"><col></colgroup>
    ${band('<div style="text-align:center;font-size:9.5pt">RANCANGAN PENGAJARAN HARIAN (PdPC)</div>')}
    <tr><th ${th}>MATA PELAJARAN</th>
        <td colspan="5" style="background:${cerah}"><b>${p(r.subjek).toUpperCase()} ${nilai(r.tahun)?esc(r.tahun.toUpperCase()):''}</b></td></tr>
    <tr><th ${th}>TEMA</th><td>${p(r.tema)}</td>
        <th ${th}>KELAS</th><td><b>${p(r.kelas)}</b></td>
        <th ${th}>MINGGU</th><td>${p((r.minggu||'').replace('Minggu ',''))}</td></tr>
    <tr><th ${th}>UNIT / TOPIK</th><td>${p(r.tajuk)}</td>
        <th ${th}>MASA</th><td>${esc(r.mula)} – ${esc(r.tamat)}</td>
        <th ${th}>TARIKH</th><td>${esc(r.tarikh)}</td></tr>
    <tr><th ${th}>TEMPOH</th><td>${tempoh} minit</td>
        <th ${th}>HARI</th><td>${esc(namaHari(r.tarikh))}</td>
        <th ${th}>TAHUN</th><td>${p(r.tahun)}</td></tr>
    <tr><th ${th}>Kod SK</th><td style="text-align:center"><b>${p(r.kodSk)}</b></td>
        <th ${th}>Kod SP</th><td style="text-align:center"><b>${p(r.kodSp)}</b></td>
        <th ${th}>Nilai Murni</th><td>${p(r.nilai)}</td></tr>
    <tr><th ${th}>Std. Kandungan</th><td colspan="3">${p(r.sk)}</td>
        <th ${th}>EMK</th><td>${p(r.emk)}</td></tr>
    <tr><th ${th}>Std. Pembelajaran</th><td colspan="3">${p(r.sp)}</td>
        <th ${th}>TP</th><td>${p(r.tp)}</td></tr>
    ${band('ASPIRASI MURID')}
    <tr><td colspan="6" style="padding:0"><table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${['Pengetahuan','Kemahiran Berfikir','Kemahiran Memimpin','Kemahiran Dwibahasa','Etika dan Kerohanian','Identiti Nasional']
        .map((x,i)=>`<td style="${i<5?'border-right:1px solid #444;':''}padding:1.6pt 3pt;font-size:7.6pt;text-align:center">☐ ${x}</td>`).join('')}</tr>
    </table></td></tr>
    <tr class="pd-band" style="background:${gelap}"><td colspan="3">OBJEKTIF PEMBELAJARAN (OP)</td>
        <td colspan="3">KRITERIA KEJAYAAN (KK)</td></tr>
    <tr><td colspan="3">Pada akhir PdPC, murid dapat:<br>${obj.map((x,i)=>(i+1)+'. '+esc(x)).join('<br>')||'-'}</td>
        <td colspan="3">Murid berjaya:<br>${kk.map((x,i)=>(i+1)+'. '+esc(x)).join('<br>')||'-'}</td></tr>
    <tr><th ${th}>Strategi / Kaedah</th><td colspan="2">${p(r.strategi)}</td>
        <th ${th}>BBM / SUMBER</th><td colspan="2">${p(r.bbm)}</td></tr>
    <tr class="pd-band" style="background:${gelap}"><td colspan="4">STRATEGI PEMBELAJARAN DAN PEMUDAHCARAAN</td>
        <td colspan="2">IMPAK / REFLEKSI</td></tr>
    <tr class="pd-boleh">
      <td colspan="4" style="padding:0">
        ${akt.starter?`<div class="pd-sek">Pengenalan:-</div><div class="pd-isi2">${akt.starter}</div>`:''}
        <div class="pd-sek">Aktiviti:-</div><div class="pd-isi2">${akt.utama||'-'}</div>
        <div class="pd-sek">Penutup:-</div><div class="pd-isi2">${paparPenutup(r.penutup) || "-"}</div>
      </td>
      <td colspan="2" class="pd-ref">${refleksiKanan}</td></tr>
    <tr><th ${th}>KBAT</th><td>${p(r.kbat)}</td>
        <th ${th}>PAK-21</th><td>${p(r.pak21)}</td>
        <th ${th}>PBD</th><td>${p(r.pentaksiran)}</td></tr>
    ${band('TINDAKAN SUSULAN UNTUK MURID')}
    <tr><th ${th}>Pemulihan</th><td>${p(r.pemulihan)}</td>
        <th ${th}>Pengukuhan</th><td>-</td>
        <th ${th}>Pengayaan</th><td>${p(r.pengayaan)}</td></tr>
    ${band('REFLEKSI / TINDAKAN')}
    <tr><td colspan="6" style="padding:0"><table style="width:100%;border-collapse:collapse">
      ${['PdPC akan diteruskan dengan topik baharu.','PdPC akan diulang semula pada pembelajaran akan datang.',
         'PdPC tidak dilaksanakan kerana: ________________________________________']
        .map(x=>`<tr><td style="border-bottom:1px solid #444;width:8mm;text-align:center;padding:1.6pt">☐</td>
          <td style="border-bottom:1px solid #444;padding:1.6pt 3pt">${x}</td></tr>`).join('')}
    </table></td></tr>
  </table>
  ${tunjukSemakan === false ? '' : `
  <table class="pd-tbl lp-semakan">
    <colgroup><col style="width:26mm"><col><col style="width:60mm"></colgroup>
    <tr><th style="background:#cfe3f7;text-align:center;vertical-align:middle;font-size:9pt">SEMAKAN</th>
      <td>${ttdDisediakan()}</td>
      <td>${ttdDisemak()}</td></tr>
  </table>`}`;
}

const WARNA_SUBJEK = [
  [/melayu|\bbm\b/i,       ['#f9c97e','#fdeeda']],
  [/inggeris|english/i,     ['#9ec5f5','#e7f0fd']],
  [/matematik/i,            ['#a7c9f2','#e3edfb']],
  [/sains/i,                ['#9edcb2','#e4f6ea']],
  [/jasmani|\bpj\b/i,      ['#f5a9a9','#fde7e7']],
  [/kesihatan|\bpk\b/i,    ['#f5b9d0','#fdeaf2']],
  [/seni|psv/i,             ['#c9b3f0','#efe9fc']],
  [/muzik/i,                ['#f5e07e','#fcf6d9']],
  [/islam|arab/i,           ['#8fd4c8','#e2f5f1']],
  [/moral|sivik|sejarah/i,  ['#d9c49a','#f5ede0']],
  [/reka bentuk|rbt|teknologi/i, ['#b8d4a8','#eaf4e4']]
];
function warnaSubjek(nama){
  for(const [rx, w] of WARNA_SUBJEK) if(rx.test(nama||'')) return w;
  return ['#c9cfdd','#eceff5'];
}

function gayaCetak(){ return localStorage.getItem('erph_gaya_cetak') || 'padat'; }
function setGayaCetak(g){ localStorage.setItem('erph_gaya_cetak', g); }

function kepalaHari(tarikh){
  return `<table class="pd-tbl pd-hari">
    <tr>
      <td style="width:34mm"><b>${esc((S.profil.nama||'').toUpperCase())}</b><br>${esc(S.profil.jawatan||'Guru')}</td>
      <td style="text-align:center"><b>${esc((S.sekolah?.nama||'').toUpperCase())}</b><br>RANCANGAN PENGAJARAN HARIAN</td>
      <td style="width:52mm"><b>TARIKH:</b> ${esc(tarikh)}<br>
        <b>HARI:</b> ${esc(namaHari(tarikh).toUpperCase())} &nbsp; <b>MINGGU:</b> ${esc((mingguUntuk(tarikh)||'').replace('Minggu ','M'))}</td>
    </tr></table>`;
}

function htmlRphPadat(r, noKelas){
  const p = v => { const t = String(v||'').trim(); return (t && t !== '-') ? esc(t) : '-'; };
  const nilai = v => { const t = String(v||'').trim(); return (t && t !== '-') ? t : ''; };
  const [gelap, cerah] = warnaSubjek(r.subjek);
  const kelasInfo = S.kelas.find(k => norma(k.nama) === norma(r.kelas));
  const bil = kelasInfo?.bilangan || '____';
  const tempoh = r.tempoh || minit(r.mula, r.tamat);
  const obj = (r.objektif||'').split('\n').map(x=>x.trim().replace(/^\d+[.)]\s*/,'')).filter(x=>x && x!=='-');
  const kk  = (r.kriteria||'').split('\n').map(x=>x.trim().replace(/^\d+[.)]\s*/,'')).filter(x=>x && x!=='-');
  const akt = pecahAktiviti(r.aktiviti);
  const refleksi = r.refleksi ? esc(r.refleksi)
    : `____ / ${bil} murid dapat mencapai objektif pembelajaran dan diberi latihan pengayaan.<br><br>
       ____ / ${bil} murid dapat mencapai objektif dengan bimbingan dan diberi latihan pengukuhan.<br><br>
       ____ / ${bil} murid tidak dapat mencapai objektif dan diberi latihan pemulihan.`;
  const band = t => `<tr class="pd-band" style="background:${gelap}"><td colspan="6">${t}</td></tr>`;
  return `<table class="pd-tbl pd-blok">
    <colgroup><col style="width:21mm"><col style="width:47mm"><col style="width:15mm"><col style="width:34mm"><col style="width:15mm"><col></colgroup>
    <tr class="pd-band" style="background:${gelap}">
      <td colspan="4"><b>KELAS ${noKelas} · ${p(r.subjek).toUpperCase()}</b></td>
      <td colspan="2" style="text-align:right">RANCANGAN PENGAJARAN HARIAN</td></tr>
    <tr><th style="background:${cerah}">Tema / Unit</th><td>${p(r.tema)}</td>
        <th style="background:${cerah}">Kelas</th><td><b>${p(r.kelas)}</b></td>
        <th style="background:${cerah}">Minggu</th><td>${p((r.minggu||'').replace('Minggu ','M'))}</td></tr>
    <tr><th style="background:${cerah}">Tajuk</th><td>${p(r.tajuk)}</td>
        <th style="background:${cerah}">Masa</th><td>${esc(r.mula)} – ${esc(r.tamat)}</td>
        <th style="background:${cerah}">Tempoh</th><td>${tempoh} minit</td></tr>
    <tr><th style="background:${cerah}">Kod SK / SP</th><td><b>${p(r.kodSk)}</b> / <b>${p(r.kodSp)}</b>${nilai(r.tp)?' · '+esc(r.tp):''}</td>
        <th style="background:${cerah}">Nilai Murni</th><td>${p(r.nilai)}</td>
        <th style="background:${cerah}">EMK</th><td>${p(r.emk)}</td></tr>
    <tr><th style="background:${cerah}">Std. Kandungan</th><td colspan="5">${p(r.sk)}</td></tr>
    <tr><th style="background:${cerah}">Std. Pembelajaran</th><td colspan="5">${p(r.sp)}</td></tr>
    ${band('OBJEKTIF PEMBELAJARAN (OP)')}
    <tr><td colspan="6">Pada akhir PdP, murid dapat:<br>${obj.map((x,i)=>(i+1)+'. '+esc(x)).join('<br>')||'-'}</td></tr>
    ${kk.length?band('KRITERIA KEJAYAAN (KK)')+`<tr><td colspan="6">Murid berjaya:<br>${kk.map((x,i)=>(i+1)+'. '+esc(x)).join('<br>')}</td></tr>`:''}
    <tr><th style="background:${cerah}">BBM / Sumber</th><td colspan="3">${p(r.bbm)}</td>
        <th style="background:${cerah}">Strategi</th><td>${p(r.strategi)}</td></tr>
    <tr class="pd-band" style="background:${gelap}"><td colspan="4">STRATEGI PdP &amp; PEMUDAHCARAAN</td>
        <td colspan="2">IMPAK / REFLEKSI</td></tr>
    <tr class="pd-boleh">
      <td colspan="4" style="padding:0">
        ${akt.starter?`<div class="pd-sek">Pengenalan / Set Induksi</div><div class="pd-isi2">${akt.starter}</div>`:''}
        <div class="pd-sek">Aktiviti</div><div class="pd-isi2">${akt.utama||'-'}</div>
        ${nilai(r.penutup)?`<div class="pd-sek">Penutup</div><div class="pd-isi2">${paparPenutup(r.penutup)}</div>`:''}
      </td>
      <td colspan="2" class="pd-ref">${refleksi}<br><br><b>Intervensi:</b><br>______________________</td></tr>
    <tr><th style="background:${cerah}">KBAT</th><td>${p(r.kbat)}</td>
        <th style="background:${cerah}">PAK-21</th><td>${p(r.pak21)}</td>
        <th style="background:${cerah}">PBD</th><td>${p(r.pentaksiran)}</td></tr>
    ${band('TINDAKAN SUSULAN UNTUK MURID')}
    <tr><th style="background:${cerah}">Pemulihan</th><td colspan="2">${p(r.pemulihan)}</td>
        <th style="background:${cerah}">Pengayaan</th><td colspan="2">${p(r.pengayaan)}</td></tr>
  </table>`;
}

/* Nama pengesah dipapar di atas, jawatan di bawah. Jawatan diambil daripada
   medan berasingan; format lama "Nama / Jawatan" masih disokong. */
function pengesahBaris(){
  const t = String(S.profil.pengesah||'').trim();
  const jawatanBerasingan = String(S.profil.jawatanPengesah||'').trim();
  if(!t) return { nama:'', jawatan:jawatanBerasingan };
  if(jawatanBerasingan) return { nama:t, jawatan:jawatanBerasingan };
  const p = t.split(/\s*[\/|·]\s*/);
  return { nama: p[0]||'', jawatan: p.slice(1).join(' / ') };
}
/* Blok tandatangan format surat rasmi:
     Disediakan oleh,
       (ruang tandatangan)
     NAMA PENUH
     (Jawatan)                                                          */
function blokTtd(label, nama, jawatan, imej){
  return `<div class="ttd-blok">
    <div class="ttd-label">${esc(label)},</div>
    <div class="ttd-ruang">${imej ? `<img src="${imej}" class="ttd">` : ''}</div>
    <div class="ttd-nama">${esc(String(nama||'').toUpperCase()) || '&nbsp;'}</div>
    ${jawatan ? `<div class="ttd-jawatan">(${esc(jawatan)})</div>` : ''}
  </div>`;
}
function ttdDisediakan(){
  return blokTtd('Disediakan oleh', S.profil.nama, S.profil.jawatan || 'Guru', tandatanganSaya());
}
function ttdDisemak(){
  const g = pengesahBaris();
  return blokTtd('Disemak oleh', g.nama, g.jawatan, '');
}

/* Sesetengah RPH lama menyimpan HTML mentah dalam medan penutup (daripada versi
   awal penjana AI). Teks biasa dilepaskan seperti biasa; pembersihan hanya
   berlaku apabila tag HTML benar-benar dikesan, supaya paparan RPH lain tidak
   berubah sedikit pun. */
function paparPenutup(nilaiPenutup){
  const t = String(nilaiPenutup || '');
  if(!/<\s*(p|ol|ul|li|br|div)[\s>/]/i.test(t)) return esc(t);
  const bersih = t
    .replace(/<\/(p|div|li|ol|ul|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .split('\n').map(x => x.trim()).filter(Boolean).join('\n');
  return esc(bersih).replace(/\n/g, '<br>');
}

function blokPengesah(){
  const g = pengesahBaris();
  return `<b>${esc(g.nama)}</b>${g.jawatan ? `<br>${esc(g.jawatan)}` : ''}`;
}

function semakanHari(){
  return `<table class="pd-tbl pd-blok"><tr>
    <th style="width:24mm;background:#cfe3f7;vertical-align:middle">SEMAKAN</th>
    <td>${ttdDisediakan()}</td>
    <td style="width:60mm">${ttdDisemak()}</td>
  </tr></table>`;
}

function notaCetak(){
  return `<div class="cetak-nota">Dijana oleh e-RPH AI · © 2026 Alimin bin Abu Bakar</div>`;
}
function keluarkanCetak(html){
  let box = document.getElementById('cetak');
  if(!box){ box = document.createElement('div'); box.id = 'cetak'; document.body.appendChild(box); }
  box.innerHTML = html;
  setTimeout(()=> window.print(), 150);
}

function cetakRph(){ cetakRphId(S.editRphId); }

/* Cetak satu RPH. Boleh dipanggil dari editor mahupun dari pratonton dashboard —
   suntingan yang belum disimpan hanya diambil apabila editor benar-benar terbuka. */
function cetakRphId(id){
  const asal = S.rph.find(x => x.id === id);
  if(!asal) return toast('RPH tidak dijumpai','salah');
  const r = (editorTerbuka() && S.editRphId === id) ? { ...asal, ...bacaEditor() } : asal;
  keluarkanCetak(badanCetakRph(r) + notaCetak());
}

/* Satu sumber untuk kedua-dua cetakan dan pratonton, supaya tidak boleh terpesong. */
function badanCetakRph(r){
  return gayaCetak() === 'penuh'
    ? htmlRph(r, true)
    : kepalaHari(r.tarikh) + htmlRphPadat(r, 1) + semakanHari();
}

/* Cetak banyak RPH — satu RPH satu muka surat.
   Kotak SEMAKAN hanya pada RPH terakhir bagi setiap hari. */
function cetakBanyak(senarai){
  if(!senarai.length) return toast('Tiada RPH untuk dicetak','salah');
  const susun = [...senarai].sort((a,b)=> (a.tarikh+(a.mula||'')).localeCompare(b.tarikh+(b.mula||'')));
  if(gayaCetak() === 'penuh'){
    const akhirHari = {};
    susun.forEach((r,i) => akhirHari[r.tarikh] = i);
    keluarkanCetak(susun.map((r,i) =>
      `<div style="${i ? 'page-break-before:always;' : ''}">${htmlRph(r, akhirHari[r.tarikh] === i)}</div>`).join('') + notaCetak());
    return;
  }
  /* Gaya padat: mengalir berterusan, tiada muka surat dibazir */
  let html = ''; let hariSemasa = ''; let noKelas = 0; let pertama = true;
  susun.forEach(r => {
    if(r.tarikh !== hariSemasa){
      if(hariSemasa) html += semakanHari();
      html += `<div style="${pertama ? '' : 'page-break-before:always;'}">${kepalaHari(r.tarikh)}</div>`;
      hariSemasa = r.tarikh; noKelas = 0; pertama = false;
    }
    noKelas++;
    html += htmlRphPadat(r, noKelas);
  });
  html += semakanHari() + notaCetak();
  keluarkanCetak(html);
}
function halCetak(){
  const hariIni = tarikhISO();
  const minggu = janaMinggu(S.takwim).filter(m => m.no);
  const mggIni = minggu.find(m => hariIni >= m.mula && hariIni <= m.tamat);
  window._cetakPilih = new Set();
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Gaya cetakan</h3></div>
      <div class="toolbar" style="margin:0">
        <label class="baris" style="cursor:pointer;flex:1">
          <input type="radio" name="gayaC" value="padat" ${gayaCetak()==='padat'?'checked':''} onchange="setGayaCetak('padat')" style="width:auto">
          <div class="baris-t"><b>Padat (jimat kertas)</b><small>Beberapa RPH satu muka surat, mengalir berterusan — gaya buku rekod KPM</small></div></label>
        <label class="baris" style="cursor:pointer;flex:1">
          <input type="radio" name="gayaC" value="penuh" ${gayaCetak()==='penuh'?'checked':''} onchange="setGayaCetak('penuh')" style="width:auto">
          <div class="baris-t"><b>Lesson Plan penuh</b><small>Satu RPH satu muka surat berwarna</small></div></label>
      </div>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Cetak pantas</h3></div>
      <div class="toolbar" style="margin:0">
        <button class="btn btn-primary" onclick="cetakHari('${hariIni}')">🖨️ Hari ini (${S.rph.filter(r=>r.tarikh===hariIni).length})</button>
        ${typeof driveSedia === 'function' && driveSedia() ? `<button class="btn btn-ungu" onclick="pergi('drive')">📁 Simpan ke Drive</button>` : ''}
        ${mggIni?`<button class="btn btn-ungu" onclick="cetakMinggu('${mggIni.mula}')">🖨️ ${esc(mggIni.label)} penuh</button>`:''}
      </div>
    </div>

    <div class="lekat"><div class="toolbar" style="margin:0">
      <input id="cpTarikh" type="date" onchange="lukisCetak()" title="Tapis tarikh">
      <select id="cpMinggu" onchange="lukisCetak()"><option value="">Semua minggu</option>
        ${minggu.map(m=>`<option value="${m.mula}|${m.tamat}" ${mggIni&&m.mula===mggIni.mula?'selected':''}>${m.label}</option>`).join('')}</select>
      <select id="cpSubjek" onchange="lukisCetak()"><option value="">Semua subjek</option>
        ${[...new Set(S.rph.map(r=>r.subjek))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select>
      <select id="cpStatus" onchange="lukisCetak()"><option value="">Semua status</option>
        <option value="lengkap">Lengkap</option><option value="draf">Draf</option></select>
    </div></div>

    <div class="toolbar">
      <button class="btn btn-sm" onclick="tandaCetak(true)">☑ Tanda semua</button>
      <button class="btn btn-sm" onclick="tandaCetak(false)">☐ Buang semua</button>
      <button class="btn btn-primary" style="margin-left:auto" onclick="cetakDitanda()">🖨️ Cetak yang ditanda (<span id="cpKira">0</span>)</button>
    </div>
    <div id="cpSenarai"></div>
    <p style="font-size:12px;color:var(--teks-3);margin-top:12px">
      Satu RPH satu muka surat (kandungan panjang bersambung kemas ke muka berikutnya).
      Kotak SEMAKAN dicetak sekali pada RPH terakhir setiap hari.
      Semasa mencetak: A4 · Portrait · Skala 100% · tanda <b>Background graphics</b> · buang <b>Headers and footers</b>.</p>`;
  lukisCetak();
}
function senaraiCetakTapis(){
  const t = $('#cpTarikh')?.value || '';
  const mg = $('#cpMinggu')?.value || '';
  const sj = $('#cpSubjek')?.value || '', st = $('#cpStatus')?.value || '';
  let hasil = S.rph.filter(r => (!sj || r.subjek === sj) && (!st || r.status === st));
  if(t) hasil = hasil.filter(r => r.tarikh === t);
  else if(mg){ const [m1,m2] = mg.split('|'); hasil = hasil.filter(r => r.tarikh >= m1 && r.tarikh <= m2); }
  return hasil.sort((a,b)=> (a.tarikh+(a.mula||'')).localeCompare(b.tarikh+(b.mula||'')));
}
function lukisCetak(){
  const hasil = senaraiCetakTapis();
  window._cetakSenarai = hasil;
  // kumpul ikut tarikh
  const ikutHari = new Map();
  hasil.forEach(r => { if(!ikutHari.has(r.tarikh)) ikutHari.set(r.tarikh, []); ikutHari.get(r.tarikh).push(r); });
  let html = '';
  for(const [tarikh, senarai] of ikutHari){
    html += `<div class="grp-hari">${tarikhCantik(tarikh)} <small>· ${esc(mingguUntuk(tarikh)||'')}</small>
      <label style="margin-left:auto;display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer">
        <input type="checkbox" onchange="tandaHariCetak('${tarikh}',this.checked)" style="width:auto">Semua hari ini</label></div>
      <div class="senarai">${senarai.map(r=>`
        <label class="baris" style="cursor:pointer">
          <input type="checkbox" class="cpKotak" data-id="${r.id}" data-tarikh="${r.tarikh}"
            ${window._cetakPilih.has(r.id)?'checked':''} onchange="ubahCetakPilih('${r.id}',this.checked)" style="width:auto">
          <div class="baris-t"><b>${esc(r.subjek)} · ${esc(r.kelas)}</b>
            <small>${esc(r.mula)}-${esc(r.tamat)} · ${esc((r.tajuk||'').slice(0,60))}</small></div>
          <span class="pil ${r.status==='lengkap'?'hijau':'kuning'}">${r.status==='lengkap'?'Lengkap':'Draf'}</span>
        </label>`).join('')}</div>`;
  }
  $('#cpSenarai').innerHTML = html || '<div class="kosong"><b>Tiada RPH untuk tapisan ini</b></div>';
  kiraCetakPilih();
}
function ubahCetakPilih(id, on){ on ? window._cetakPilih.add(id) : window._cetakPilih.delete(id); kiraCetakPilih(); }
function tandaHariCetak(tarikh, on){
  $$('.cpKotak').forEach(c => { if(c.dataset.tarikh === tarikh){ c.checked = on; ubahCetakPilih(c.dataset.id, on); } });
}
function tandaCetak(on){
  (window._cetakSenarai||[]).forEach(r => on ? window._cetakPilih.add(r.id) : window._cetakPilih.delete(r.id));
  $$('.cpKotak').forEach(c => c.checked = on);
  kiraCetakPilih();
}
function kiraCetakPilih(){ const el = $('#cpKira'); if(el) el.textContent = window._cetakPilih.size; }
function cetakDitanda(){
  const senarai = S.rph.filter(r => window._cetakPilih.has(r.id));
  if(!senarai.length) return toast('Tanda sekurang-kurangnya satu RPH','salah');
  cetakBanyak(senarai);
}

function cetakMingguModal(){
  const minggu = janaMinggu(S.takwim).filter(m => m.no);
  const hariIni = tarikhISO();
  const mggIni = minggu.find(m => hariIni >= m.mula && hariIni <= m.tamat);
  if(!minggu.length) return toast('Tetapkan takwim dahulu','salah');
  modal('Cetak RPH seminggu', `
    <label class="fld"><span>Minggu persekolahan</span><select id="cmMinggu" onchange="kiraCetakMinggu()">
      ${minggu.map(m=>`<option value="${m.mula}" ${mggIni&&m.mula===mggIni.mula?'selected':''}>${m.label} (${m.mula} — ${m.tamat})</option>`).join('')}
    </select></label>
    <label class="fld"><span>Tapis subjek <em>(pilihan)</em></span>
      <select id="cmSubjek" onchange="kiraCetakMinggu()"><option value="">Semua subjek</option>
        ${[...new Set(S.rph.map(r=>r.subjek))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
    <label class="fld"><span>Status</span>
      <select id="cmStatus" onchange="kiraCetakMinggu()">
        <option value="">Lengkap dan draf</option>
        <option value="lengkap">Lengkap sahaja</option></select></label>
    <div id="cmKira" class="kad" style="background:var(--bg);padding:12px;margin-top:4px"></div>
    <p style="font-size:12px;color:var(--teks-3);margin-top:10px">
      Satu RPH satu muka surat. Kotak <b>SEMAKAN</b> dicetak sekali sahaja pada RPH terakhir setiap hari.</p>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="jalankanCetakMinggu()">🖨️ Cetak</button>`);
  kiraCetakMinggu();
}
function senaraiCetakMinggu(){
  const mula = $('#cmMinggu').value, sj = $('#cmSubjek').value, st = $('#cmStatus').value;
  const m = janaMinggu(S.takwim).find(w => w.mula === mula);
  if(!m) return [];
  return S.rph.filter(r => r.tarikh >= m.mula && r.tarikh <= m.tamat
      && (!sj || r.subjek === sj) && (!st || r.status === st))
    .sort((a,b)=> (a.tarikh+(a.mula||'')).localeCompare(b.tarikh+(b.mula||'')));
}
function kiraCetakMinggu(){
  const senarai = senaraiCetakMinggu();
  const hari = {};
  senarai.forEach(r => hari[r.tarikh] = (hari[r.tarikh]||0)+1);
  $('#cmKira').innerHTML = senarai.length
    ? `<b style="font-size:13.5px">${senarai.length} RPH · ${senarai.length} muka surat</b>
       <div style="margin-top:8px">${Object.entries(hari).sort().map(([t,n])=>`
         <div style="display:flex;font-size:12.5px;padding:3px 0;color:var(--teks-2)">
           <span style="flex:1">${tarikhCantik(t)}</span><span class="pil kelabu">${n} RPH</span></div>`).join('')}</div>`
    : '<span style="color:var(--merah);font-size:13px">Tiada RPH untuk pilihan ini</span>';
}
function jalankanCetakMinggu(){
  const senarai = senaraiCetakMinggu();
  if(!senarai.length) return toast('Tiada RPH untuk dicetak','salah');
  tutupModal();
  setTimeout(()=> cetakBanyak(senarai), 200);
}

function cetakHari(iso){
  cetakBanyak(S.rph.filter(r => r.tarikh === iso).sort((a,b)=> (a.mula||'').localeCompare(b.mula||'')));
}
function cetakMinggu(mula){
  const m = janaMinggu(S.takwim).find(w => w.mula === mula);
  if(!m) return toast('Minggu tidak dijumpai','salah');
  cetakBanyak(S.rph.filter(r => r.tarikh >= m.mula && r.tarikh <= m.tamat)
    .sort((a,b)=> (a.tarikh+a.mula).localeCompare(b.tarikh+b.mula)));
}

/* ================= LAPORAN ================= */
function halLaporan(){
  const minggu = janaMinggu(S.takwim).filter(m=>m.no);
  const ikut = (arr, kunci) => {
    const m = {}; arr.forEach(r => m[r[kunci]||'—'] = (m[r[kunci]||'—']||0)+1);
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };
  const spGuna = new Set(S.rph.map(r => (r.sp||'').trim()).filter(Boolean));
  const spSemua = S.rpt.filter(d => d.sp);
  const spBelum = spSemua.filter(d => !spGuna.has(d.sp.trim()));

  $('#kandungan').innerHTML = `
    <div class="stat-grid">
      <div class="stat b"><b>${S.rph.length}</b><small>Jumlah RPH</small></div>
      <div class="stat h"><b>${S.rph.filter(r=>r.status==='lengkap').length}</b><small>Lengkap</small></div>
      <div class="stat k"><b>${S.rph.filter(r=>r.status==='draf').length}</b><small>Draf</small></div>
      <div class="stat"><b>${spSemua.length ? Math.round((spSemua.length-spBelum.length)/spSemua.length*100) : 0}%</b><small>Liputan RPT</small></div>
    </div>

    <div class="kad"><div class="kad-h"><h3>RPH mengikut minggu</h3></div>
      <div class="tbl-scroll"><table><tr><th>Minggu</th><th>Tarikh</th><th>Lengkap</th><th>Draf</th></tr>
      ${minggu.map(m => { const a = S.rph.filter(r => r.tarikh >= m.mula && r.tarikh <= m.tamat);
        return `<tr><td>${m.label}</td><td>${m.mula}</td>
          <td>${a.filter(r=>r.status==='lengkap').length}</td><td>${a.filter(r=>r.status==='draf').length}</td></tr>`; }).join('')
        || '<tr><td colspan="4">Takwim belum ditetapkan</td></tr>'}</table></div></div>

    <div class="kad"><div class="kad-h"><h3>RPH mengikut subjek</h3></div>
      <div class="tbl-scroll"><table><tr><th>Subjek</th><th>Jumlah</th></tr>
      ${ikut(S.rph,'subjek').map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">Tiada data</td></tr>'}</table></div></div>

    <div class="kad"><div class="kad-h"><h3>Standard Pembelajaran belum digunakan</h3><small>${spBelum.length} SP</small></div>
      ${spBelum.length ? `<div class="senarai">${spBelum.slice(0,50).map(d=>`<div class="baris">
        <span class="pil kelabu">M${esc(d.minggu||'-')}</span><div class="baris-t">
        <b>${esc(d.tajuk||d.tema||'')} — ${esc(d.kodSp||'')}</b><small>${esc(d.subjek)} ${esc(d.tahun||'')}</small></div></div>`).join('')}</div>`
        : '<div class="kosong">Semua baris RPT telah dijadikan RPH, atau RPT belum dimuat naik.</div>'}</div>

    <div class="toolbar"><button class="btn" onclick="eksportCsv()">⬇️ Muat turun senarai RPH (CSV)</button></div>`;
}
function eksportCsv(){
  const kepala = ['tarikh','hari','minggu','subjek','kelas','mula','tamat','tajuk','kodSp','sp','status'];
  const baris = S.rph.map(r => kepala.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','));
  const blob = new Blob(['\ufeff'+kepala.join(',')+'\n'+baris.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'rph-'+tarikhISO()+'.csv'; a.click();
}
