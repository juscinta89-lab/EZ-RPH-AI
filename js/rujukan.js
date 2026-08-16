/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 */

/* ================= BAHAN RUJUKAN =================
   Dua bahagian:
   1. Pautan rujukan — dibuka guru dalam pelayar (AI tidak boleh membacanya).
   2. Panduan sekolah — teks yang guru tampal sendiri; teks INI dihantar
      kepada AI dalam setiap penjanaan supaya RPH mengikut kehendak sekolah. */

const RUJUKAN_ASAS = [
  { nama:'Dashboard Rujukan RPH (Looker Studio)',
    url:'https://datastudio.google.com/u/0/reporting/19d52769-d10b-40c7-a11b-720cf7186ca9/page/p_cpue3fjz4c',
    nota:'Papan maklumat rujukan yang dikongsi sekolah' },
  { nama:'DSKP & RPT rasmi — Bahagian Pembangunan Kurikulum',
    url:'https://bpk.moe.gov.my/index.php/terbitan-bpk/kurikulum-sekolah-rendah',
    nota:'Sumber rasmi KPM untuk semak SK/SP' },
  { nama:'Portal DELIMa KPM', url:'https://sites.google.com/moe-dl.edu.my/dbook/', nota:'Buku teks digital' }
];

function halRujukan(){
  const senarai = S.rujukan?.length ? S.rujukan : RUJUKAN_ASAS;
  const panduan = S.tetapanAI?.panduan || '';
  const boleh = ['pemilik','admin'].includes(S.peranan);
  $('#kandungan').innerHTML = `
    <div class="kad">
      <div class="kad-h"><h3>Pautan rujukan</h3>
        ${boleh?'<button class="btn btn-sm" onclick="formRujukan()">+ Tambah pautan</button>':''}</div>
      <div class="senarai">${senarai.map((x,i)=>`
        <div class="baris">
          <div class="baris-t"><b>${esc(x.nama)}</b><small>${esc(x.nota||new URL(x.url).hostname)}</small></div>
          <a class="btn btn-sm btn-primary" href="${esc(x.url)}" target="_blank" rel="noopener">Buka</a>
          ${boleh && S.rujukan?.length ? `<button class="btn btn-sm btn-danger" onclick="hapusRujukan(${i})">✕</button>`:''}
        </div>`).join('')}</div>
      <p style="font-size:12px;color:var(--teks-3);margin-top:11px;line-height:1.55">
        Pautan ini dibuka dalam pelayar untuk rujukan guru. AI <b>tidak boleh</b> membaca kandungan
        laman luar — untuk itu, gunakan bahagian di bawah.</p>
    </div>

    <div class="kad">
      <div class="kad-h"><h3>Panduan sekolah untuk AI</h3>
        <span class="pil ${panduan?'hijau':'kelabu'}">${panduan?'Aktif':'Kosong'}</span></div>
      <p style="font-size:13px;color:var(--teks-2);line-height:1.6;margin-bottom:11px">
        Tampal di sini apa-apa arahan, format atau contoh daripada bahan rujukan sekolah anda —
        contohnya kehendak pentadbir, senarai EMK yang digalakkan, atau gaya penulisan aktiviti.
        Teks ini <b>dihantar kepada AI setiap kali RPH dijana</b>, jadi hasilnya mengikut kehendak sekolah.</p>
      <label class="fld"><span>Panduan / arahan tetap</span>
        <textarea id="rjPanduan" style="min-height:150px" ${boleh?'':'disabled'}
          placeholder="Contoh:&#10;- Setiap RPH mesti ada elemen PAK-21 yang dinyatakan dengan jelas.&#10;- Aktiviti kumpulan tidak melebihi 5 orang.&#10;- Gunakan istilah 'murid', bukan 'pelajar'.&#10;- Refleksi mesti menyebut tindakan susulan.">${esc(panduan)}</textarea></label>
      ${boleh?`<button class="btn btn-primary" onclick="simpanPanduan()">Simpan panduan</button>
        <button class="btn" onclick="$('#rjPanduan').value='';simpanPanduan()">Kosongkan</button>`
        :'<p style="font-size:12px;color:var(--teks-3)">Hanya pentadbir sekolah boleh mengubah panduan ini.</p>'}
    </div>`;
}

function formRujukan(){
  modal('Tambah pautan rujukan', `
    <label class="fld"><span>Nama</span><input id="rjNama" placeholder="Cth: Panduan RPH Sekolah"></label>
    <label class="fld"><span>Pautan (URL)</span><input id="rjUrl" placeholder="https://..."></label>
    <label class="fld"><span>Nota ringkas</span><input id="rjNota" placeholder="Pilihan"></label>`,
    `<button class="btn" onclick="tutupModal()">Batal</button>
     <button class="btn btn-primary" onclick="simpanRujukan()">Simpan</button>`);
}
async function simpanRujukan(){
  const nama = $('#rjNama').value.trim(), url = $('#rjUrl').value.trim(), nota = $('#rjNota').value.trim();
  if(!nama || !url) return toast('Isi nama dan pautan','salah');
  if(!/^https?:\/\//i.test(url)) return toast('Pautan mesti bermula dengan https://','salah');
  const senarai = [...(S.rujukan?.length ? S.rujukan : RUJUKAN_ASAS), { nama, url, nota }];
  sibuk(true,'Menyimpan…');
  await rujuk('tetapan').doc('rujukan').set({ senarai });
  S.rujukan = senarai; sibuk(false); tutupModal(); pergi('rujukan'); toast('Pautan ditambah','jaya');
}
function hapusRujukan(i){
  sahkan('Padam pautan ini?', async () => {
    const senarai = (S.rujukan||[]).filter((_,x)=> x !== i);
    await rujuk('tetapan').doc('rujukan').set({ senarai });
    S.rujukan = senarai; pergi('rujukan'); toast('Dipadam');
  });
}
async function simpanPanduan(){
  const teks = $('#rjPanduan').value.trim();
  sibuk(true,'Menyimpan…');
  await rujuk('tetapan').doc('ai').set({ panduan: teks }, { merge:true });
  S.tetapanAI = { ...(S.tetapanAI||{}), panduan: teks };
  sibuk(false); pergi('rujukan');
  toast(teks ? 'Panduan disimpan — AI akan mengikutnya' : 'Panduan dikosongkan','jaya');
}
