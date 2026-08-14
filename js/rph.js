/* ================= e-RPH AI — RPH ================= */

function barisRph(r){
  const w = { lengkap:'hijau', draf:'kuning' }[r.status] || 'kelabu';
  return `<div class="baris">
    <div class="baris-t"><b>${esc(r.subjek)} · ${esc(r.kelas)}</b>
      <small>${tarikhCantik(r.tarikh)} · ${esc(r.mula)}-${esc(r.tamat)} · ${esc(r.tajuk||'Tiada tajuk')}</small></div>
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

  let html = '';
  for(const [mg, hariMap] of ikutMinggu){
    const jumlah = [...hariMap.values()].reduce((j,a)=>j+a.length,0);
    const lengkap = [...hariMap.values()].flat().filter(r=>r.status==='lengkap').length;
    html += `<div class="grp-minggu">📘 ${esc(mg)}
      <span class="pil ungu">${jumlah} RPH</span>
      ${lengkap<jumlah?`<span class="pil kuning">${jumlah-lengkap} draf</span>`:'<span class="pil hijau">Semua lengkap</span>'}</div>`;
    for(const [tarikh, senarai] of hariMap){
      html += `<div class="grp-hari">${tarikhCantik(tarikh)}
        <small>· ${senarai.length} RPH</small>
        <button class="btn btn-sm" style="margin-left:auto" onclick="cetakHari('${tarikh}')">🖨️</button></div>
        <div class="senarai">${senarai.sort((a,b)=>(a.mula||'').localeCompare(b.mula||'')).map(barisRph).join('')}</div>`;
    }
  }
  if(hasil.length > 400) html += '<p style="text-align:center;color:var(--teks-3);font-size:12px;padding:12px">Menunjukkan 400 RPH terkini — guna carian untuk yang lain</p>';
  $('#rSenarai').innerHTML = html;
}
function cetakTapisan(){ pergi('cetak'); }

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
  if(!rpt.minggu.length){
    const sebab = rpt.semua.length
      ? `RPT ${esc(slot.subjek)} tiada baris untuk ${esc(mgg||'minggu ini')}`
      : `Tiada RPT untuk ${esc(slot.subjek)}`;
    kotak.innerHTML = `
      <div class="kad" style="background:var(--ungu-t);border-color:#ddd3fb;margin-bottom:13px">
        <b style="font-size:13.5px">${sebab}</b>
        <p style="font-size:12.5px;color:var(--teks-2);margin:6px 0 10px">AI akan <b>mencadangkan</b> SK & SP yang paling sesuai
          berdasarkan tajuk yang anda beri, tahun dan minggu pembelajaran. Cadangan ini ditandakan jelas dalam RPH —
          <b>sila sahkan dengan DSKP rasmi</b> sebelum guna.</p>
        <label class="fld" style="margin:0"><span>Tajuk / kemahiran untuk PdP ini</span>
          <input id="jgTajukManual" placeholder="Cth: Ayat aktif dan ayat pasif"></label>
        <button class="btn btn-sm" style="margin-top:8px" onclick="pergi('rpt')">📗 Atau muat naik RPT subjek ini</button>
      </div>`;
    return;
  }
  kotak.innerHTML = `<label class="fld"><span>Kandungan RPT ${esc(mgg)} — pilih fokus PdP</span></label>
    <div class="senarai" style="margin:-6px 0 14px">
    ${rpt.minggu.map((r,i)=>`
      <label class="baris" style="cursor:pointer;align-items:flex-start">
        <input type="radio" name="jgRptPilih" value="${i}" ${i===0?'checked':''} style="width:auto;margin-top:3px">
        <div class="baris-t">
          <b>${esc((r.tajuk||r.tema||'Tanpa tajuk').slice(0,80))}</b>
          <small>${r.kodSp?esc(r.kodSp)+' · ':''}${esc((r.sp||r.tema||'').slice(0,110))}${r.catatan?' · '+esc(r.catatan.slice(0,60)):''}</small>
        </div></label>`).join('')}
    </div>`;
}

function ctxDaripadaSlot(slot, tarikh, extra){
  const kelas = S.kelas.find(k => norma(k.nama) === norma(slot.kelas));
  return Object.assign({
    slotId:slot.id, tarikh, subjek:slot.subjek, kelas:slot.kelas,
    tahun:kelas?.tahun || '', mula:slot.mula, tamat:slot.tamat,
    tempoh:minit(slot.mula, slot.tamat), minggu:mingguUntuk(tarikh)
  }, extra||{});
}

async function janaSatu(){
  const sel = $('#jgPilih'); if(!sel) return toast('Tiada slot pada tarikh ini','salah');
  const slot = S.jadual.find(x => x.id === sel.value);
  const idx = document.querySelector('input[name="jgRptPilih"]:checked');
  const fokus = idx && window._janaRpt && window._janaRpt.length ? window._janaRpt[+idx.value] : null;
  const tajukManual = $('#jgTajukManual') ? $('#jgTajukManual').value.trim() : '';
  const ctx = ctxDaripadaSlot(slot, $('#jgTarikh').value,
    { arahan:$('#jgArahan').value.trim(), rptFokus:fokus,
      tajuk: fokus ? (fokus.tajuk||fokus.tema||'') : tajukManual,
      cadangSp: !fokus });
  sibuk(true,'AI sedang membina RPH…');
  try{
    const rph = await janaRphAI(ctx);
    const ref = await rujuk('rph').add(rph);
    await muatRph(); sibuk(false); toast('RPH dijana','jaya'); bukaRph(ref.id);
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
async function janaMingguan(){
  const mula = $('#jgMinggu').value; if(!mula) return toast('Tetapkan takwim dahulu','salah');
  const tapis = $('#jgTapis').value;
  const tugas = [];
  for(let i=0;i<7;i++){
    const d = new Date(mula+'T00:00:00'); d.setDate(d.getDate()+i);
    const iso = tarikhISO(d); if(cutiPada(iso)) continue;
    S.jadual.filter(x => x.hari === namaHari(iso) && (!tapis || norma(x.subjek) === norma(tapis)))
      .forEach(x => { if(!S.rph.some(r => r.tarikh === iso && r.slotId === x.id)) tugas.push({slot:x, tarikh:iso}); });
  }
  if(!tugas.length) return toast('Semua slot minggu ini sudah ada RPH','jaya');
  // agih baris RPT minggu itu mengikut giliran slot subjek yang sama (kesinambungan)
  const giliran = {};
  let siap = 0, gagal = 0;
  for(const t of tugas){
    sibuk(true,`Menjana ${siap+gagal+1}/${tugas.length} · ${t.slot.subjek} ${t.tarikh}…`);
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
      const rph = await janaRphAI(ctx);
      await rujuk('rph').add(rph); siap++;
    }catch(e){ gagal++; }
  }
  await muatRph(); sibuk(false); pergi('rph');
  toast(`${siap} RPH dijana${gagal?', '+gagal+' gagal':''}`, gagal?'salah':'jaya');
}

/* ================= KALENDAR ================= */
let kalBulan = new Date().getMonth(), kalTahun = new Date().getFullYear();
function halKalendar(){
  const pertama = new Date(kalTahun, kalBulan, 1);
  const jumlah = new Date(kalTahun, kalBulan+1, 0).getDate();
  const kosong = pertama.getDay();
  let sel = '';
  for(let i=0;i<kosong;i++) sel += '<div class="kal-sel kosong"></div>';
  for(let d=1; d<=jumlah; d++){
    const iso = tarikhISO(new Date(kalTahun, kalBulan, d));
    const rphHari = S.rph.filter(r => r.tarikh === iso);
    const slotHari = S.jadual.filter(s => s.hari === namaHari(iso));
    const cuti = cutiPada(iso);
    let dots = '';
    if(!cuti){
      const lengkap = rphHari.filter(r=>r.status==='lengkap').length;
      const draf = rphHari.filter(r=>r.status==='draf').length;
      const belum = Math.max(0, slotHari.length - rphHari.length);
      dots = '<i class="d-h"></i>'.repeat(Math.min(lengkap,4)) + '<i class="d-k"></i>'.repeat(Math.min(draf,4)) + '<i class="d-m"></i>'.repeat(Math.min(belum,4));
    }
    sel += `<div class="kal-sel ${iso===tarikhISO()?'ini':''}" onclick="lihatHari('${iso}')" title="${cuti?esc(cuti.nama):''}">
      <span style="${cuti?'color:var(--teks-3)':''}">${d}</span><span class="kal-dot">${dots}</span></div>`;
  }
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h">
        <button class="btn btn-sm" onclick="geserBulan(-1)">‹</button>
        <h3 style="text-align:center">${BULAN[kalBulan]} ${kalTahun}</h3>
        <button class="btn btn-sm" onclick="geserBulan(1)">›</button>
      </div>
      <div class="kal">${HARI.map(h=>`<div class="kal-hari">${h.slice(0,3)}</div>`).join('')}${sel}</div>
      <div class="toolbar" style="margin:14px 0 0;font-size:12px;color:var(--teks-2)">
        <span><i class="kal-dot"><i class="d-h" style="display:inline-block"></i></i> Lengkap</span>
        <span><i class="d-k" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Draf</span>
        <span><i class="d-m" style="display:inline-block;width:8px;height:8px;border-radius:50%"></i> Belum dibuat</span>
      </div>
    </div>`;
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
        ${r ? `<button class="btn btn-sm" onclick="tutupModal();bukaRph('${r.id}')">Buka</button>`
            : `<button class="btn btn-sm btn-primary" onclick="tutupModal();janaSlot('${s.id}','${iso}')">✨ Jana</button>`}</div>`;
    }).join('') : '<div class="kosong">Tiada slot PdP pada hari ini.</div>'),
    (S.rph.some(r=>r.tarikh===iso) ? `<button class="btn" onclick="tutupModal()">Tutup</button>
      <button class="btn btn-primary" onclick="tutupModal();cetakHari('${iso}')">🖨️ Cetak semua RPH hari ini</button>` : null));
}

/* ================= EDITOR RPH ================= */
function bukaRph(id){ S.editRphId = id; pergi('editor'); }

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
        <button class="btn btn-sm" onclick="pilihRpt()">📗 Ambil daripada RPT</button>

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
        <button class="btn" onclick="salinRph()">📋 Salin ke tarikh lain</button>
        <button class="btn btn-danger" onclick="padamRph()">Padam</button>
      </div>
    </div>

    <div>
      <div class="kad ai-panel">
        <div class="kad-h"><h3>Semakan kualiti</h3><span class="pil ${warna}">${q.peratus}%</span></div>
        ${q.cek.map(c=>`<div style="display:flex;gap:8px;font-size:12.5px;padding:3px 0;color:${c[1]?'var(--teks-2)':'var(--merah)'}">
          <span>${c[1]?'✓':'✕'}</span><span>${c[0]}</span></div>`).join('')}
        ${r.amaran ? `<p style="margin-top:10px;font-size:12px;background:#fdf3dd;color:#8a6106;padding:9px;border-radius:8px">⚠️ ${esc(r.amaran)}</p>` : ''}
        <p style="font-size:11px;color:var(--teks-3);margin-top:10px">Semakan ini bantuan sistem sahaja, bukan pengesahan rasmi KPM.</p>
      </div>

      <div class="kad">
        <div class="kad-h"><h3>✨ AI Assistant</h3></div>
        <div class="ai-cadang">
          ${['Pendekkan aktiviti','Sesuaikan untuk murid lemah','Tambah aktiviti KBAT','Jadikan lebih PAK21','Buat versi 30 minit','Objektif lebih terukur','Tambah aktiviti pemulihan']
            .map(t=>`<button onclick="aiUbah('${t}')">${t}</button>`).join('')}
        </div>
        <label class="fld"><span>Arahan sendiri</span><textarea id="aiArahan" placeholder="Cth: tukar set induksi kepada permainan teka kata" style="min-height:70px"></textarea></label>
        <button class="btn btn-ungu btn-block" onclick="aiUbah()">Jalankan arahan</button>
        <button class="btn btn-block" style="margin-top:8px" onclick="janaSemula()">🔄 Jana semula keseluruhan</button>
      </div>
    </div>
  </div>`;
}

function bacaEditor(){
  const g = id => $('#'+id) ? $('#'+id).value.trim() : '';
  return {
    tarikh:g('eTarikh'), hari:namaHari($('#eTarikh').value), mula:g('eMula'), tamat:g('eTamat'),
    tempoh:minit(g('eMula'),g('eTamat')), subjek:g('eSubjek'), kelas:g('eKelas'), minggu:g('eMinggu'),
    tema:g('eTema'), tajuk:g('eTajuk'), kodSk:g('eKodSk'), kodSp:g('eKodSp'), sk:g('eSk'), sp:g('eSp'), tp:g('eTp'),
    objektif:g('eObjektif'), kriteria:g('eKriteria'), aktiviti:$('#eAktiviti').innerHTML,
    pengayaan:g('ePengayaan'), pemulihan:g('ePemulihan'), penutup:g('ePenutup'),
    strategi:g('eStrategi'), pak21:g('ePak21'), kbat:g('eKbat'), emk:g('eEmk'), nilai:g('eNilai'),
    bbm:g('eBbm'), pentaksiran:g('ePentaksiran'), refleksi:g('eRefleksi'), dikemas:Date.now()
  };
}
async function simpanRph(status){
  const d = { ...bacaEditor(), status };
  sibuk(true,'Menyimpan…');
  const lama = S.rph.find(x => x.id === S.editRphId);
  await rujuk('rph').doc(S.editRphId).collection('versi').add({ ...lama, disimpan:Date.now() }).catch(()=>{});
  await rujuk('rph').doc(S.editRphId).update(d);
  await muatRph(); sibuk(false); halEditor(); toast('RPH disimpan','jaya');
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
  tutupModal(); toast('Maklumat RPT dimasukkan','jaya');
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
    const j = ambilJSON(await panggilAI(p));
    const set = (id,v) => { if(v != null && $('#'+id)) $('#'+id).value = v; };
    set('eTajuk', j.tajuk); set('eObjektif', Array.isArray(j.objektif)?j.objektif.join('\n'):j.objektif);
    set('eKriteria', Array.isArray(j.kriteria)?j.kriteria.join('\n'):j.kriteria);
    if(j.aktiviti) $('#eAktiviti').innerHTML = j.aktiviti;
    set('ePengayaan', stripHtml(j.pengayaan)); set('ePemulihan', stripHtml(j.pemulihan)); set('ePenutup', stripHtml(j.penutup));
    set('eStrategi', j.strategi); set('ePak21', j.pak21); set('eKbat', j.kbat); set('eEmk', j.emk);
    set('eNilai', j.nilai); set('eBbm', j.bbm); set('ePentaksiran', j.pentaksiran);
    sibuk(false); toast('AI selesai. Semak dan simpan.','jaya');
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
function janaRefleksi(){
  modal('Jana refleksi', `
    <label class="fld"><span>Keadaan sebenar PdP</span><select id="rfPilih">
      <option>Semua murid menguasai objektif</option>
      <option>Sebahagian besar murid menguasai</option>
      <option>Ramai murid belum menguasai</option>
      <option>Aktiviti berjaya dan murid aktif</option>
      <option>Aktiviti perlu ditambah baik</option>
      <option>PdP tidak dapat dijalankan</option></select></label>
    <label class="fld"><span>Bilangan murid menguasai <em>(pilihan)</em></span><input id="rfBil" placeholder="Cth: 28/32"></label>
    <label class="fld"><span>Catatan tambahan</span><textarea id="rfNota" style="min-height:70px"></textarea></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="jalankanRefleksi()">✨ Jana</button>`);
}
async function jalankanRefleksi(){
  const pilih = $('#rfPilih').value, bil = $('#rfBil').value.trim(), nota = $('#rfNota').value.trim();
  tutupModal(); sibuk(true,'AI menulis refleksi…');
  try{
    const r = bacaEditor();
    const p = `Tulis satu refleksi RPH profesional (2-4 ayat, Bahasa Melayu baku, gaya rekod rasmi guru KPM).
Objektif: ${r.objektif}
Aktiviti: ${stripHtml(r.aktiviti).slice(0,400)}
Keadaan sebenar: ${pilih}${bil?' ('+bil+' murid menguasai)':''}${nota?'. Catatan: '+nota:''}
Balas teks refleksi sahaja tanpa tajuk atau markdown.`;
    $('#eRefleksi').value = (await panggilAI(p)).trim();
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
  const p = v => esc(String(v||'').trim() || '-');
  const tempoh = r.tempoh || minit(r.mula, r.tamat);
  const kelasInfo = S.kelas.find(k => norma(k.nama) === norma(r.kelas));
  const bilMurid = kelasInfo?.bilangan || '';
  const akt = pecahAktiviti(r.aktiviti);
  const objektif = senaraiNombor(r.objektif);
  const kriteria = senaraiNombor(r.kriteria);
  return `
  <div class="lp-kepala">
    ${(S.logo || S.sekolah?.logo) ? `<img src="${S.logo || esc(S.sekolah.logo)}">` : ''}
    <div><b>${esc((S.sekolah?.nama||'').toUpperCase())}</b>
    ${S.sekolah?.alamat||S.sekolah?.kod ? `<br><span>${esc(S.sekolah?.alamat||'')}${S.sekolah?.kod?' · '+esc(S.sekolah.kod):''}</span>` : ''}</div>
  </div>

  <div class="lp-bar">RANCANGAN PENGAJARAN HARIAN / <i>LESSON PLAN</i></div>

  <table class="lp-tbl">
    <colgroup><col style="width:26mm"><col style="width:74mm"><col style="width:20mm"><col></colgroup>
    <tr>
      <th rowspan="3" style="text-align:center;vertical-align:middle">Mata Pelajaran<br><b class="lp-subjek">${p(r.subjek).toUpperCase()}</b></th>
      <td class="lp-tgh"><b>Tema:</b> ${p(r.tema)}</td>
      <th>Kelas</th><td>${p(r.kelas)}</td></tr>
    <tr><td class="lp-tgh"><b>Tajuk:</b> ${p(r.tajuk)}</td>
      <th>Hari / Tarikh</th><td>${esc(namaHari(r.tarikh))}, ${tarikhCantik(r.tarikh).split(', ')[1]||r.tarikh}</td></tr>
    <tr><td class="lp-tgh"><b>Minggu:</b> ${p(r.minggu)}</td>
      <th>Masa</th><td>${esc(r.mula)} – ${esc(r.tamat)} (${tempoh} minit)</td></tr>
  </table>

  <table class="lp-tbl">
    <colgroup><col style="width:26mm"><col><col style="width:42mm"></colgroup>
    <tr><th colspan="2" class="lp-sub">Kod Standard Pembelajaran / <i>Learning Standard</i></th>
        <th class="lp-sub">EMK / <i>Cross Curricular</i></th></tr>
    <tr><th>SK</th><td>${esc(kodTeks(r.kodSk, r.sk))}</td>
        <td rowspan="2" style="text-align:center;vertical-align:middle">${p(r.emk)}<br><br><b>Nilai Murni:</b><br>${p(r.nilai)}</td></tr>
    <tr><th>SP</th><td>${esc(kodTeks(r.kodSp, r.sp))}${r.tp&&r.tp!=='-'?'<br><b>TP:</b> '+esc(r.tp):''}</td></tr>
  </table>

  <table class="lp-tbl">
    <colgroup><col style="width:50%"><col></colgroup>
    <tr><th class="lp-sub">Objektif Pembelajaran / <i>Learning Objectives</i></th>
        <th class="lp-sub">Kriteria Kejayaan / <i>Success Criteria</i></th></tr>
    <tr><td>Pada akhir PdP, murid dapat:<br>${objektif}</td>
        <td>Murid dapat:<br>${kriteria}</td></tr>
    <tr><th class="lp-sub">Strategi · PAK21 · KBAT</th><th class="lp-sub">BBM / <i>Resources</i></th></tr>
    <tr><td>${p(r.strategi)}${r.pak21&&r.pak21!=='-'?' · '+esc(r.pak21):''}${r.kbat&&r.kbat!=='-'?' · '+esc(r.kbat):''}</td>
        <td>${p(r.bbm)}</td></tr>
  </table>

  <table class="lp-tbl">
    <colgroup><col><col style="width:46mm"></colgroup>
    <tr><th class="lp-bar2">Rangka Pengajaran / <i>Lesson Outline</i></th>
        <th class="lp-bar2">Impak / Refleksi</th></tr>
    <tr class="lp-pecah">
      <td style="padding:0">
        ${akt.starter ? `<div class="lp-seksyen">Set Induksi / <i>Starter</i></div>
        <div class="lp-isi">${akt.starter}</div>
        <div class="lp-seksyen">Aktiviti Utama / <i>Main Activities</i></div>` :
        `<div class="lp-seksyen">Aktiviti PdP / <i>Activities</i></div>`}
        <div class="lp-isi">${akt.utama || '-'}</div>
        <div class="lp-seksyen">Penutup / <i>Plenary</i></div>
        <div class="lp-isi">${p(r.penutup)}</div>
        <div class="lp-seksyen">Pentaksiran</div>
        <div class="lp-isi">${p(r.pentaksiran)}</div>
      </td>
      <td class="lp-refleksi">
        ${r.refleksi
          ? esc(r.refleksi)
          : `☐ ___ / ${bilMurid||'___'} orang murid dapat menguasai objektif pembelajaran dan diberi latihan pengayaan / pengukuhan.
             <br><br>☐ ___ / ${bilMurid||'___'} orang murid tidak menguasai objektif dan diberi latihan pemulihan.
             <br><br>☐ Aktiviti PdP ditangguhkan kerana:<br><br>_______________________`}
      </td>
    </tr>
  </table>

  <table class="lp-tbl">
    <colgroup><col style="width:50%"><col></colgroup>
    <tr><th class="lp-sub">Pemulihan / <i>Remedial</i></th>
        <th class="lp-sub">Pengayaan / <i>Enrichment</i></th></tr>
    <tr><td>${p(r.pemulihan)}</td><td>${p(r.pengayaan)}</td></tr>
  </table>

  ${tunjukSemakan === false ? '' : `
  <table class="lp-tbl lp-semakan">
    <colgroup><col style="width:26mm"><col><col style="width:60mm"></colgroup>
    <tr><th class="lp-sub2">SEMAKAN</th>
      <td>Disediakan oleh:${tandatanganSaya() ? `<br><img src="${tandatanganSaya()}" class="ttd">` : '<br><br><br>'}
        <b>${esc(S.profil.nama||'')}</b><br>${esc(S.profil.jawatan||'Guru')}</td>
      <td>Disemak oleh:<br><br><br><b>${esc(S.profil.pengesah||'')}</b></td></tr>
  </table>`}`;
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
  const p = v => esc(String(v||'').trim() || '-');
  const kelasInfo = S.kelas.find(k => norma(k.nama) === norma(r.kelas));
  const bil = kelasInfo?.bilangan || '___';
  const obj = (r.objektif||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const objHtml = obj.map(x=>`• Murid dapat ${esc(x.replace(/^\d+[.)]\s*/,'').replace(/^Murid dapat\s*/i,''))}`).join('<br>') || '-';
  const refleksi = r.refleksi
    ? esc(r.refleksi)
    : obj.map(x=>`____ / ${bil} murid dapat ${esc(x.replace(/^\d+[.)]\s*/,'').replace(/^Murid dapat\s*/i,''))}`).join('<br>') || `____ / ${bil} murid mencapai objektif.`;
  return `<table class="pd-tbl pd-blok">
    <colgroup><col style="width:24mm"><col></colgroup>
    <tr class="pd-strip"><td colspan="2"><b>KELAS ${noKelas}</b> · ${esc(r.mula)}–${esc(r.tamat)} ·
      <b>${p(r.subjek).toUpperCase()}</b> · ${p(r.kelas)} ${r.tahun&&!norma(r.kelas).includes(norma(r.tahun))?'('+esc(r.tahun)+')':''}</td></tr>
    <tr><th>Tema / Tajuk</th><td>${[r.tema,r.tajuk].map(x=>(x||'').trim()).filter(Boolean).join(' · ')||'-'}</td></tr>
    <tr><th>Std. Kandungan</th><td>${esc(kodTeks(r.kodSk, r.sk))}</td></tr>
    <tr><th>Std. Pembelajaran</th><td>${esc(kodTeks(r.kodSp, r.sp))}${r.tp?' &nbsp;<b>TP:</b> '+esc(r.tp):''}</td></tr>
    <tr><th>Objektif</th><td>Pada akhir PdP, murid dapat:<br>${obj.map(x=>'• '+esc(x.replace(/^\d+[.)]\s*/,''))).join('<br>')||'-'}</td></tr>
    <tr><th>Aktiviti</th><td>${r.aktiviti||'-'}${r.penutup?'<b>Penutup:</b> '+p(r.penutup):''}</td></tr>
    <tr><th>EMK · BBM · Taksir</th><td>${p(r.emk)}${r.nilai&&r.nilai!=='-'?' · '+esc(r.nilai):''} &nbsp;|&nbsp; ${p(r.bbm)} &nbsp;|&nbsp; ${p(r.pentaksiran)}</td></tr>
    <tr><th>Refleksi</th><td class="pd-ref">${refleksi}<br><b>Intervensi:</b> _______________</td></tr>
  </table>`;
}

function semakanHari(){
  return `<table class="pd-tbl pd-blok"><tr>
    <th style="width:24mm;background:#cfe3f7">SEMAKAN</th>
    <td>Disediakan oleh: <b>${esc(S.profil.nama||'')}</b>${tandatanganSaya()?` <img src="${tandatanganSaya()}" style="height:22pt;vertical-align:middle">`:''}</td>
    <td style="width:60mm">Disemak oleh: <b>${esc(S.profil.pengesah||'')}</b><br><br></td>
  </tr></table>`;
}

function keluarkanCetak(html){
  let box = document.getElementById('cetak');
  if(!box){ box = document.createElement('div'); box.id = 'cetak'; document.body.appendChild(box); }
  box.innerHTML = html;
  setTimeout(()=> window.print(), 150);
}

function cetakRph(){
  const r = { ...S.rph.find(x=>x.id===S.editRphId), ...bacaEditor() };
  if(gayaCetak() === 'penuh') return keluarkanCetak(htmlRph(r));
  keluarkanCetak(kepalaHari(r.tarikh) + htmlRphPadat(r, 1) + semakanHari());
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
      `<div style="${i ? 'page-break-before:always;' : ''}">${htmlRph(r, akhirHari[r.tarikh] === i)}</div>`).join(''));
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
  html += semakanHari();
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
