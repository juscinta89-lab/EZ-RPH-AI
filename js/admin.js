/* ================= e-RPH AI — PANEL PENTADBIR ================= */

async function halAdmin(){
  if(!['pemilik','admin'].includes(S.peranan)){
    $('#kandungan').innerHTML = '<div class="kosong"><b>Akses terhad</b>Halaman ini untuk pentadbir sahaja.</div>'; return;
  }
  $('#kandungan').innerHTML = '<div class="kad"><div class="spin"></div></div>';
  const pemilik = S.peranan === 'pemilik';
  const [sekolahSnap, penggunaSnap] = await Promise.all([
    pemilik ? db.collection('sekolah').get() : db.collection('sekolah').doc(S.sid).get(),
    pemilik ? db.collection('pengguna').get() : db.collection('pengguna').where('sekolahId','==',S.sid).get()
  ]);
  const sekolah = pemilik ? sekolahSnap.docs.map(d=>({id:d.id,...d.data()}))
                          : [{ id:sekolahSnap.id, ...sekolahSnap.data() }];
  const pengguna = penggunaSnap.docs.map(d=>({id:d.id,...d.data()}));
  window._pgList = pengguna;

  $('#kandungan').innerHTML = `
    ${pemilik ? `<div class="stat-grid">
      <div class="stat b"><b>${sekolah.length}</b><small>Sekolah</small></div>
      <div class="stat h"><b>${pengguna.length}</b><small>Pengguna</small></div>
      <div class="stat k"><b>${pengguna.filter(p=>!p.sekolahId).length}</b><small>Belum ada sekolah</small></div>
      <div class="stat"><b>${APP.versi}</b><small>Versi aplikasi</small></div>
    </div>` : ''}

    <div class="kad">
      <div class="kad-h"><h3>Sekolah</h3>
        ${pemilik?'<button class="btn btn-sm btn-primary" onclick="formSekolah()">+ Tambah sekolah</button>':''}</div>
      <div class="senarai">${sekolah.map(s=>`
        <div class="baris"><div class="baris-t"><b>${esc(s.nama||'(tanpa nama)')}</b>
          <small>Kod: ${esc(s.kod||'—')} · ${esc(s.daerah||'')} ${esc(s.negeri||'')} ${s.id===S.sid?' · aktif':''}</small></div>
          ${s.aktif===false?'<span class="pil merah">Nyahaktif</span>':'<span class="pil hijau">Aktif</span>'}
          <button class="btn btn-sm" onclick="formSekolah('${s.id}')">Edit</button>
          ${pemilik && s.id!==S.sid?`<button class="btn btn-sm" onclick="tukarSekolah('${s.id}')">Masuk</button>`:''}
        </div>`).join('')}</div>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Pengguna</h3><small>${pengguna.length} akaun</small></div>
      <div class="tbl-scroll"><table>
        <tr><th>Nama</th><th>E-mel</th><th>Peranan</th><th>Sekolah</th><th>Langganan</th><th></th></tr>
        ${pengguna.map((p,i)=>`<tr>
          <td>${esc(p.nama||'—')}</td><td style="font-size:12px">${esc(p.emel||p.id)}</td>
          <td><span class="pil ${p.peranan==='pemilik'?'ungu':p.peranan==='admin'?'biru':'kelabu'}">${esc(p.peranan||'guru')}</span></td>
          <td style="font-size:12px">${esc((sekolah.find(s=>s.id===p.sekolahId)||{}).nama || '—')}</td>
          <td>${pilLanggan(p)}</td>
          <td><button class="btn btn-sm" onclick="formPengguna(${i})">Urus</button></td>
        </tr>`).join('')}
      </table></div>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Data sekolah semasa</h3></div>
      <div class="stat-grid">
        <div class="stat"><b>${S.kelas.length}</b><small>Kelas</small></div>
        <div class="stat"><b>${S.subjek.length}</b><small>Subjek</small></div>
        <div class="stat"><b>${S.rpt.length}</b><small>Baris RPT</small></div>
        <div class="stat"><b>${S.buku.length}</b><small>Rujukan buku teks</small></div>
      </div>
      <div class="toolbar" style="margin:0">
        <button class="btn" onclick="pergi('rpt')">Urus RPT</button>
        <button class="btn" onclick="pergi('buku')">Urus buku teks</button>
        <button class="btn" onclick="pergi('takwim')">Urus takwim</button>
        <button class="btn" onclick="sandarData()">⬇️ Sandaran JSON</button>
      </div>
    </div>`;
}

function formSekolah(id){
  const isEdit = !!id;
  const s = isEdit ? {} : {};
  const isi = async () => {
    if(!isEdit) return;
    const d = (await db.collection('sekolah').doc(id).get()).data() || {};
    ['nama','kod','negeri','daerah','alamat','logo'].forEach(k => { if($('#sk_'+k)) $('#sk_'+k).value = d[k]||''; });
    if($('#sk_aktif')) $('#sk_aktif').value = d.aktif === false ? 'tidak' : 'ya';
  };
  modal(isEdit ? 'Edit sekolah' : 'Tambah sekolah', `
    <label class="fld"><span>Nama sekolah</span><input id="sk_nama" placeholder="SK Belukar"></label>
    <div class="grid2">
      <label class="fld"><span>Kod sekolah</span><input id="sk_kod" placeholder="DBA2164" style="text-transform:uppercase"></label>
      <label class="fld"><span>Negeri</span><input id="sk_negeri" placeholder="Terengganu"></label>
    </div>
    <div class="grid2">
      <label class="fld"><span>Daerah</span><input id="sk_daerah" placeholder="Kemaman"></label>
      <label class="fld"><span>Status</span><select id="sk_aktif"><option value="ya">Aktif</option><option value="tidak">Nyahaktif</option></select></label>
    </div>
    <label class="fld"><span>Alamat</span><input id="sk_alamat"></label>
    <label class="fld"><span>URL logo <em>(pilihan — atau muat naik terus di Tetapan)</em></span><input id="sk_logo" placeholder="https://…"></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button><button class="btn btn-primary" onclick="simpanSekolah('${id||''}')">Simpan</button>`);
  isi();
}
async function simpanSekolah(id){
  const d = { nama:$('#sk_nama').value.trim(), kod:$('#sk_kod').value.trim().toUpperCase(),
    negeri:$('#sk_negeri').value.trim(), daerah:$('#sk_daerah').value.trim(),
    alamat:$('#sk_alamat').value.trim(), logo:$('#sk_logo').value.trim(), aktif:$('#sk_aktif').value === 'ya' };
  if(!d.nama || !d.kod) return toast('Nama dan kod sekolah diperlukan','salah');
  sibuk(true,'Menyimpan…');
  if(id) await db.collection('sekolah').doc(id).set(d,{merge:true});
  else {
    const ref = await db.collection('sekolah').add({ ...d, dicipta:Date.now(), pemilik:S.user.email });
    if(!S.sid){ await db.collection('pengguna').doc(S.user.email).set({ sekolahId:ref.id },{merge:true}); S.sid = ref.id; }
  }
  if(id === S.sid) S.sekolah = { ...S.sekolah, ...d };
  sibuk(false); tutupModal(); toast('Sekolah disimpan','jaya'); location.reload();
}
async function tukarSekolah(id){
  sibuk(true,'Menukar sekolah…');
  await db.collection('pengguna').doc(S.user.email).set({ sekolahId:id },{merge:true});
  location.reload();
}
function pilLanggan(p){
  if(p.peranan === 'pemilik') return '<span class="pil ungu">Pemilik</span>';
  const st = statusLanggan(p);
  if(st.jenis === 'tiada')  return '<span class="pil kelabu">Tanpa had</span>';
  if(st.jenis === 'tamat')  return '<span class="pil merah">Tamat '+esc(st.tarikh)+'</span>';
  if(st.jenis === 'hampir') return '<span class="pil kuning">'+st.baki+' hari lagi</span>';
  return '<span class="pil hijau">Hingga '+esc(st.tarikh)+'</span>';
}

function formPengguna(i){
  const p = (window._pgList || [])[i]; if(!p) return;
  db.collection('sekolah').get().then(sn => {
    const sekolah = sn.docs.map(d=>({id:d.id,...d.data()}));
    modal('Urus pengguna', `
      <p style="margin-bottom:14px"><b>${esc(p.nama||'—')}</b><br><small style="color:var(--teks-3)">${esc(p.emel||p.id)}</small></p>
      <label class="fld"><span>Peranan</span><select id="pgPeranan">
        ${['guru','admin','pemilik'].map(r=>`<option value="${r}" ${p.peranan===r?'selected':''}>${r}</option>`).join('')}
      </select></label>
      <label class="fld"><span>Sekolah</span><select id="pgSekolah"><option value="">— Tiada —</option>
        ${sekolah.map(s=>`<option value="${s.id}" ${p.sekolahId===s.id?'selected':''}>${esc(s.nama)} (${esc(s.kod||'')})</option>`).join('')}
      </select></label>
      <label class="fld"><span>Status akaun</span><select id="pgAktif">
        <option value="ya" ${p.aktif!==false?'selected':''}>Aktif</option>
        <option value="tidak" ${p.aktif===false?'selected':''}>Nyahaktif</option></select></label>
      ${S.peranan === 'pemilik' ? `
      <div style="border-top:1px dashed var(--garis);margin:6px 0 14px;padding-top:14px">
        <span style="display:block;font-size:12.5px;font-weight:600;color:var(--teks-2);margin-bottom:6px">Tempoh langganan</span>
        <div class="toolbar" style="margin:0 0 10px">
          <button class="btn btn-sm" onclick="tambahLanggan(1)">+1 bulan</button>
          <button class="btn btn-sm" onclick="tambahLanggan(3)">+3 bulan</button>
          <button class="btn btn-sm" onclick="tambahLanggan(6)">+6 bulan</button>
          <button class="btn btn-sm" onclick="tambahLanggan(12)">+1 tahun</button>
          <button class="btn btn-sm" onclick="$('#pgLanggan').value=''">Tanpa had</button>
        </div>
        <label class="fld" style="margin:0"><span>Tamat pada <em>(kosongkan = tanpa had)</em></span>
          <input id="pgLanggan" type="date" value="${esc(p.langganTamat||'')}"></label>
        <p style="font-size:12px;color:var(--teks-3);margin-top:8px">
          Selepas tarikh ini pengguna tidak boleh log masuk sehingga langganan dilanjutkan.
          Data mereka kekal selamat.</p>
      </div>` : ''}`,
      `<button class="btn" onclick="tutupModal()">Batal</button>
       <button class="btn btn-primary" onclick="simpanPengguna('${p.id}')">Simpan</button>`);
  });
}
function tambahLanggan(bulan){
  const inp = $('#pgLanggan');
  const asas = (inp.value && inp.value >= tarikhISO()) ? new Date(inp.value+'T00:00:00') : new Date();
  asas.setMonth(asas.getMonth() + bulan);
  inp.value = tarikhISO(asas);
}
async function simpanPengguna(id){
  const d = { peranan:$('#pgPeranan').value, sekolahId:$('#pgSekolah').value || null, aktif:$('#pgAktif').value === 'ya' };
  if(S.peranan === 'pemilik' && $('#pgLanggan')) d.langganTamat = $('#pgLanggan').value || null;
  sibuk(true,'Menyimpan…');
  await db.collection('pengguna').doc(id).set(d,{merge:true});
  sibuk(false); tutupModal(); halAdmin(); toast('Pengguna dikemas kini','jaya');
}
function sandarData(){
  const data = { sekolah:S.sekolah, kelas:S.kelas, subjek:S.subjek, jadual:S.jadual,
                 takwim:S.takwim, rpt:S.rpt, buku:S.buku, rph:S.rph, tarikh:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'sandaran-erph-'+tarikhISO()+'.json'; a.click();
  toast('Sandaran dimuat turun','jaya');
}
