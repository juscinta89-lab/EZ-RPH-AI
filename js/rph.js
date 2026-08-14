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
    <div class="toolbar">
      <input id="rCari" placeholder="Cari tajuk, subjek, kelas, SP…" oninput="lukisRph()">
      <select id="rStatus" onchange="lukisRph()"><option value="">Semua status</option>
        <option value="lengkap">Lengkap</option><option value="draf">Draf</option></select>
      <select id="rSubjek" onchange="lukisRph()"><option value="">Semua subjek</option>
        ${[...new Set(S.rph.map(r=>r.subjek))].map(s=>`<option>${esc(s)}</option>`).join('')}</select>
      <button class="btn btn-primary" onclick="pergi('jana')">✨ Jana baharu</button>
      <button class="btn" onclick="cetakTapisan()">🖨️ Cetak hasil tapisan</button>
    </div>
    <div id="rSenarai"></div>`;
  lukisRph();
}
function lukisRph(){
  const q = ($('#rCari')?.value||'').toLowerCase();
  const st = $('#rStatus')?.value || '', sj = $('#rSubjek')?.value || '';
  const hasil = S.rph.filter(r => (!st || r.status === st) && (!sj || r.subjek === sj) &&
    (!q || [r.tajuk,r.subjek,r.kelas,r.sp,r.tema,r.tarikh,r.minggu].join(' ').toLowerCase().includes(q)));
  $('#rSenarai').innerHTML = hasil.length
    ? `<div class="senarai">${hasil.map(barisRph).join('')}</div>`
    : `<div class="kosong"><b>Tiada RPH dijumpai</b>Jana RPH pertama anda daripada jadual waktu.</div>`;
}

function cetakTapisan(){
  const q = ($('#rCari')?.value||'').toLowerCase();
  const st = $('#rStatus')?.value || '', sj = $('#rSubjek')?.value || '';
  const hasil = S.rph.filter(r => (!st || r.status === st) && (!sj || r.subjek === sj) &&
    (!q || [r.tajuk,r.subjek,r.kelas,r.sp,r.tema,r.tarikh,r.minggu].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=> (a.tarikh+a.mula).localeCompare(b.tarikh+b.mula));
  if(hasil.length > 20) return sahkan(hasil.length+' RPH akan dicetak (satu muka surat setiap satu). Teruskan?', ()=> cetakBanyak(hasil));
  cetakBanyak(hasil);
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
  if(!rpt.semua.length){
    kotak.innerHTML = `<div class="kosong" style="padding:14px;margin-bottom:13px"><b>Tiada RPT untuk ${esc(slot.subjek)}</b>
      Muat naik RPT subjek ini dahulu supaya AI ikut perancangan sebenar.
      <br><br><button class="btn btn-sm" onclick="pergi('rpt')">Buka menu RPT</button></div>`;
    return;
  }
  if(!rpt.minggu.length){
    kotak.innerHTML = `<div class="kosong" style="padding:14px;margin-bottom:13px"><b>RPT ${esc(slot.subjek)} tiada baris untuk ${esc(mgg||'minggu ini')}</b>
      Semak nombor minggu dalam RPT atau tarikh mula takwim.</div>`;
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
  const fokus = idx && window._janaRpt ? window._janaRpt[+idx.value] : null;
  const ctx = ctxDaripadaSlot(slot, $('#jgTarikh').value,
    { arahan:$('#jgArahan').value.trim(), rptFokus:fokus, tajuk:fokus?(fokus.tajuk||fokus.tema||''):'' });
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
      }
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

function htmlRph(r){
  const p = v => esc(String(v||'').trim() || '-');
  const tempoh = r.tempoh || minit(r.mula, r.tamat);
  const temaTajuk = [r.tema, r.tajuk].map(x=>(x||'').trim()).filter(Boolean).join(' · ') || '-';
  return `
  <div class="cetak-h">
    ${(S.logo || S.sekolah?.logo) ? `<img src="${S.logo || esc(S.sekolah.logo)}">` : ''}
    <div><b>${esc((S.sekolah?.nama||'').toUpperCase())}</b><br>
    <span>${esc(S.sekolah?.alamat||'')}${S.sekolah?.kod?' · '+esc(S.sekolah.kod):''}</span></div>
  </div>
  <div class="cetak-tajuk">RANCANGAN PENGAJARAN HARIAN</div>
  <table class="cetak-tbl">
    <colgroup><col style="width:30mm"><col><col style="width:30mm"><col></colgroup>
    <tr><th>Tarikh / Hari</th><td>${tarikhCantik(r.tarikh)}</td><th>Minggu</th><td>${p(r.minggu)}</td></tr>
    <tr><th>Mata Pelajaran</th><td>${p(r.subjek)}</td><th>Kelas</th><td>${p(r.kelas)}</td></tr>
    <tr><th>Masa</th><td>${esc(r.mula)} – ${esc(r.tamat)} (${tempoh} minit)</td>
        <th>Tema / Tajuk</th><td>${esc(temaTajuk)}</td></tr>
    <tr><th>Standard Kandungan</th><td colspan="3">${esc(kodTeks(r.kodSk, r.sk))}</td></tr>
    <tr><th>Standard Pembelajaran</th><td colspan="3">${esc(kodTeks(r.kodSp, r.sp))}</td></tr>
    <tr><th>Standard Prestasi</th><td>${p(r.tp)}</td><th>Strategi PdP</th><td>${p(r.strategi)}</td></tr>
    <tr><th>Objektif Pembelajaran</th><td>Pada akhir PdP, murid dapat:<br>${senaraiNombor(r.objektif)}</td>
        <th>Kriteria Kejayaan</th><td>${senaraiNombor(r.kriteria)}</td></tr>
    <tr><th>Aktiviti PdP</th><td colspan="3">${r.aktiviti||'-'}</td></tr>
    <tr><th>Pengayaan</th><td>${p(r.pengayaan)}</td><th>Pemulihan</th><td>${p(r.pemulihan)}</td></tr>
    <tr><th>Penutup</th><td>${p(r.penutup)}</td><th>BBM</th><td>${p(r.bbm)}</td></tr>
    <tr><th>PAK21 / KBAT</th><td>${p(r.pak21)} · ${p(r.kbat)}</td>
        <th>EMK / Nilai</th><td>${p(r.emk)} · ${p(r.nilai)}</td></tr>
    <tr><th>Pentaksiran</th><td colspan="3">${p(r.pentaksiran)}</td></tr>
    <tr><th>Refleksi</th><td colspan="3" style="min-height:26pt;height:26pt">${esc(r.refleksi||'')}</td></tr>
  </table>
  <div class="tandatangan">
    <div>Disediakan oleh:${tandatanganSaya() ? `<br><img src="${tandatanganSaya()}" class="ttd">` : '<br><br>'}
      <br>${esc(S.profil.nama||'')}<br>${esc(S.profil.jawatan||'Guru')}</div>
    <div>Disemak oleh:<br><br><br>${esc(S.profil.pengesah||'')}</div>
  </div>`;
}

function keluarkanCetak(html){
  let box = document.getElementById('cetak');
  if(!box){ box = document.createElement('div'); box.id = 'cetak'; document.body.appendChild(box); }
  box.innerHTML = html;
  setTimeout(()=> window.print(), 150);
}

function cetakRph(){
  const r = { ...S.rph.find(x=>x.id===S.editRphId), ...bacaEditor() };
  keluarkanCetak(htmlRph(r));
}

/* Cetak banyak RPH — satu RPH satu muka surat */
function cetakBanyak(senarai){
  if(!senarai.length) return toast('Tiada RPH untuk dicetak','salah');
  keluarkanCetak(senarai.map((r,i) =>
    `<div style="${i ? 'page-break-before:always;' : ''}">${htmlRph(r)}</div>`).join(''));
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
