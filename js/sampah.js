/*!
 * e-RPH AI — Kitar Semula
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 */

/* RPH yang dipadam tidak terus hilang. Ia dipindahkan ke koleksi "sampah"
   selama 30 hari supaya guru boleh pulihkan jika tersilap. Selepas 30 hari
   ia dibuang sendiri semasa app dimuat. */

const SAMPAH_HARI = 30;

function tarikhTolak(hari){
  const d = new Date();
  d.setDate(d.getDate() - hari);
  return d.toISOString().slice(0,10);
}

/* Pindahkan senarai RPH ke kitar semula. Digunakan oleh SEMUA laluan padam
   supaya tiada satu pun jalan yang memusnahkan kerja guru terus. */
async function buangKeSampah(senarai, sebab){
  if(!senarai?.length) return 0;
  let siap = 0;
  for(let i = 0; i < senarai.length; i += 200){
    const b = db.batch();
    senarai.slice(i, i+200).forEach(r => {
      const { id, ...isi } = r;
      b.set(rujuk('sampah').doc(id), {
        ...isi, idAsal:id, sebab: sebab || 'Dipadam',
        dipadamPada: Date.now(), dipadamTarikh: tarikhISO()
      });
      b.delete(rujuk('rph').doc(id));
    });
    await b.commit();
    siap += Math.min(200, senarai.length - i);
  }
  return siap;
}

async function muatSampah(){
  try{
    const snap = await rujuk('sampah').orderBy('dipadamPada','desc').limit(400).get();
    S.sampah = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }catch(e){ S.sampah = []; }
  return S.sampah;
}

/* Buang kekal apa-apa yang melebihi 30 hari. Dipanggil sekali semasa muat data. */
async function bersihSampahLama(){
  const had = Date.now() - SAMPAH_HARI * 86400000;
  try{
    const snap = await rujuk('sampah').where('dipadamPada','<', had).limit(300).get();
    if(snap.empty) return 0;
    const b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    return snap.size;
  }catch(e){ return 0; }
}

async function pulihkanRph(id){
  const r = (S.sampah||[]).find(x => x.id === id);
  if(!r) return toast('Rekod tidak dijumpai','salah');
  sibuk(true,'Memulihkan…');
  try{
    const { idAsal, sebab, dipadamPada, dipadamTarikh, ...isi } = r;
    await rujuk('rph').doc(idAsal || id).set({ ...isi, dikemas: Date.now() });
    await rujuk('sampah').doc(id).delete();
    await muatRph(); await muatSampah();
    sibuk(false); pergi('sampah');
    toast('RPH dipulihkan','jaya');
  }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
}

async function pulihkanSemua(){
  const senarai = S.sampah || [];
  if(!senarai.length) return;
  sahkan(`Pulihkan kesemua ${senarai.length} RPH dalam kitar semula?`, async () => {
    sibuk(true,'Memulihkan…');
    try{
      for(let i = 0; i < senarai.length; i += 200){
        const b = db.batch();
        senarai.slice(i, i+200).forEach(r => {
          const { id, idAsal, sebab, dipadamPada, dipadamTarikh, ...isi } = r;
          b.set(rujuk('rph').doc(idAsal || id), { ...isi, dikemas: Date.now() });
          b.delete(rujuk('sampah').doc(id));
        });
        await b.commit();
      }
      await muatRph(); await muatSampah();
      sibuk(false); pergi('sampah'); toast(`${senarai.length} RPH dipulihkan`,'jaya');
    }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
  });
}

async function kosongkanSampah(){
  const senarai = S.sampah || [];
  if(!senarai.length) return;
  sahkan(`Buang kekal ${senarai.length} RPH daripada kitar semula?\n\nSelepas ini ia TIDAK boleh dipulihkan.`, async () => {
    sibuk(true,'Membuang…');
    try{
      for(let i = 0; i < senarai.length; i += 300){
        const b = db.batch();
        senarai.slice(i, i+300).forEach(r => b.delete(rujuk('sampah').doc(r.id)));
        await b.commit();
      }
      await muatSampah(); sibuk(false); pergi('sampah'); toast('Kitar semula dikosongkan','jaya');
    }catch(e){ sibuk(false); toast('Gagal: '+e.message,'salah'); }
  });
}

function halSampah(){
  const senarai = S.sampah || [];
  const hariBaki = r => Math.max(0, SAMPAH_HARI - Math.floor((Date.now() - (r.dipadamPada||0)) / 86400000));

  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Kitar semula</h3>
        <small>${senarai.length} RPH</small></div>
      <p style="font-size:12.5px;color:var(--teks-2)">
        RPH yang dipadam disimpan di sini selama <b>${SAMPAH_HARI} hari</b> sebelum dibuang sendiri.
        Anda boleh pulihkan bila-bila masa dalam tempoh itu.</p>
      ${senarai.length ? `<div class="toolbar" style="margin:12px 0 0">
        <button class="btn" onclick="pulihkanSemua()"><span class="ik">${IK_PULIH}</span> Pulihkan semua</button>
        <button class="btn btn-danger" onclick="kosongkanSampah()">🗑️ Kosongkan</button>
      </div>` : ''}
    </div>

    <div class="senarai">
      ${senarai.length ? senarai.map(r => `
        <div class="baris">
          <div class="baris-t">
            <b>${esc(r.subjek||'—')} · ${esc(r.kelas||'—')}</b>
            <small>${r.tarikh?tarikhCantik(r.tarikh):'—'}${r.mula?' · '+esc(r.mula):''}
              &nbsp;·&nbsp; ${esc(r.sebab||'Dipadam')}
              &nbsp;·&nbsp; ${hariBaki(r)} hari lagi</small>
          </div>
          <button class="btn btn-sm btn-primary" onclick="pulihkanRph('${r.id}')">Pulihkan</button>
        </div>`).join('')
      : `<div class="kosong"><b>Kitar semula kosong</b>RPH yang anda padam akan muncul di sini
         selama ${SAMPAH_HARI} hari sebelum dibuang kekal.</div>`}
    </div>`;
}
