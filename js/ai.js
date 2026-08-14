/* ================= e-RPH AI — ENJIN AI ================= */

async function panggilAI(prompt, sistem){
  const t = tetapanAI();
  if(!t.key) throw new Error('API key belum ditetapkan. Buka Tetapan > Enjin AI.');
  const sys = sistem || 'Anda pembantu guru Malaysia yang pakar kurikulum KPM. Jawab dalam Bahasa Melayu baku.';

  if(t.prov === 'gemini'){
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${t.model}:generateContent?key=${encodeURIComponent(t.key)}`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        systemInstruction:{ parts:[{text:sys}] },
        contents:[{ role:'user', parts:[{text:prompt}] }],
        generationConfig:{ temperature:0.6, maxOutputTokens:8192 }
      })
    });
    const j = await r.json();
    if(j.error) throw new Error(j.error.message);
    return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  }

  if(t.prov === 'openai'){
    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+t.key},
      body: JSON.stringify({ model:t.model, temperature:0.6,
        messages:[{role:'system',content:sys},{role:'user',content:prompt}] })
    });
    const j = await r.json();
    if(j.error) throw new Error(j.error.message);
    return j.choices?.[0]?.message?.content || '';
  }

  const r = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':t.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({ model:t.model, max_tokens:8000, system:sys, messages:[{role:'user',content:prompt}] })
  });
  const j = await r.json();
  if(j.error) throw new Error(j.error.message);
  return (j.content||[]).map(c => c.text || '').join('');
}

function ambilJSON(teks){
  let t = String(teks).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a) t = t.slice(a, b+1);
  return JSON.parse(t);
}

/* ---------- Kumpul konteks daripada pangkalan data ---------- */
function kontekBuku(subjek, tahun){
  const s = (subjek||'').toLowerCase();
  return S.buku.filter(x => (x.subjek||'').toLowerCase() === s).slice(0,40);
}
function rphSebelum(subjek, kelas, tarikh, n){
  return S.rph.filter(r => r.subjek === subjek && r.kelas === kelas && r.tarikh < tarikh)
              .sort((a,b)=> b.tarikh.localeCompare(a.tarikh)).slice(0, n||3);
}

/* ---------- Bina prompt RPH ---------- */
function barisRpt(r){
  return `- Minggu ${r.minggu||'-'} | Tema/Bidang: ${r.tema||'-'} | Tajuk: ${r.tajuk||'-'}\n` +
         `  SK [${r.kodSk||'-'}]: ${r.sk||'-'}\n  SP [${r.kodSp||'-'}]: ${r.sp||'-'}` +
         (r.tp?`\n  TP: ${r.tp}`:'') + (r.catatan?`\n  Catatan RPT: ${r.catatan}`:'');
}
function promptRph(ctx){
  const rpt = rptUntuk(ctx.subjek, ctx.tahun, ctx.minggu);
  const rptTeks = rpt.minggu.length
    ? rpt.minggu.map(barisRpt).join('\n')
    : 'TIADA BARIS RPT UNTUK MINGGU INI.';
  const rptSekitar = rpt.sekitar.length
    ? rpt.sekitar.map(barisRpt).join('\n') : 'Tiada.';
  const buku = kontekBuku(ctx.subjek, ctx.tahun);
  const bukuTeks = buku.length
    ? buku.map(b => `- ${b.buku||'Buku Teks'} | Bab ${b.bab||'-'} | ${b.unit||''} | ${b.tajuk||''}${b.pautan?' | pautan: '+b.pautan:''}: ${(b.kandungan||'').slice(0,300)}`).join('\n')
    : 'TIADA RUJUKAN BUKU TEKS DALAM PANGKALAN DATA.';
  const lalu = rphSebelum(ctx.subjek, ctx.kelas, ctx.tarikh, 3);
  const laluTeks = lalu.length
    ? lalu.map(r => `- ${r.tarikh}: ${r.tajuk||'-'} | SP: ${(r.sp||'').slice(0,120)} | Aktiviti: ${stripHtml(r.aktiviti||'').slice(0,200)}`).join('\n')
    : 'Tiada RPH terdahulu direkodkan.';
  const kelasInfo = S.kelas.find(k => k.nama === ctx.kelas) || {};

  return `Bina satu Rancangan Pengajaran Harian (RPH) KPM yang lengkap dan profesional.

MAKLUMAT SESI
Tarikh: ${ctx.tarikh} (${namaHari(ctx.tarikh)})
Minggu persekolahan: ${ctx.minggu || '-'}
Mata pelajaran: ${ctx.subjek}
Tahun/Tingkatan: ${ctx.tahun || '-'}
Kelas: ${ctx.kelas} (${kelasInfo.bilangan||'-'} murid, tahap ${kelasInfo.tahap||'campuran'})${kelasInfo.nota?'\nNota kelas: '+kelasInfo.nota:''}
Masa: ${ctx.mula} - ${ctx.tamat}
Tempoh sebenar: ${ctx.tempoh} minit
${ctx.tajuk ? 'Tajuk dikehendaki guru: '+ctx.tajuk : ''}
${ctx.arahan ? 'Arahan khas guru: '+ctx.arahan : ''}

RPT MINGGU INI — SUMBER RASMI, GUNA TEPAT SEPERTI DI BAWAH
${rptTeks}

RPT MINGGU BERHAMPIRAN (konteks kesinambungan sahaja, jangan guna standardnya)
${rptSekitar}

RUJUKAN BUKU TEKS DALAM SISTEM
${bukuTeks}

RPH TERDAHULU (untuk kesinambungan, jangan ulang aktiviti yang sama tanpa sebab)
${laluTeks}

PERATURAN WAJIB
1. JANGAN cipta, ubah atau reka nombor/teks Standard Kandungan atau Standard Pembelajaran. Salin TEPAT daripada baris RPT minggu ini di atas, termasuk kod SK/SP dan tajuk.
2. Jika tiada baris RPT untuk minggu ini, isi medan sk/sp dengan "Sila lengkapkan RPT bagi minggu ini" dan senaraikan dalam "amaran". Jangan ambil standard daripada minggu lain.
3. Aktiviti mesti muat dalam ${ctx.tempoh} minit. Nyatakan anggaran minit setiap langkah, jumlahnya mesti ${ctx.tempoh} minit.
4. Jangan dakwa kandungan buku teks yang tiada dalam senarai di atas.
5. Objektif mesti terukur dan selari dengan SP. Pentaksiran mesti selari dengan objektif.
6. Bahasa Melayu baku, sesuai untuk dokumen rasmi sekolah.

Balas HANYA objek JSON tanpa markdown, mengikut skema ini:
{
 "tema":"", "tajuk":"",
 "kodSk":"", "sk":"", "kodSp":"", "sp":"", "tp":"",
 "objektif":["","",""],
 "kriteria":["",""],
 "aktiviti":"<p>Set Induksi (5 minit)</p><ol><li>…</li></ol><p>Langkah 1 (15 minit)</p>…",
 "pengayaan":"", "pemulihan":"", "penutup":"",
 "strategi":"", "pak21":"", "kbat":"", "emk":"", "nilai":"", "bbm":"", "pentaksiran":"",
 "amaran":["senaraikan apa-apa maklumat rasmi yang tiada dalam pangkalan data"]
}
Medan "aktiviti", "pengayaan", "pemulihan", "penutup" gunakan HTML ringkas (p, ul, ol, li, b).`;
}
function stripHtml(h){ const d = document.createElement('div'); d.innerHTML = h||''; return d.textContent || ''; }

/* ---------- Jana satu RPH ---------- */
async function janaRphAI(ctx){
  const jawapan = await panggilAI(promptRph(ctx));
  const j = ambilJSON(jawapan);
  return {
    emel:S.user.email, guru:S.profil.nama||'', slotId:ctx.slotId||'',
    tarikh:ctx.tarikh, hari:namaHari(ctx.tarikh), minggu:ctx.minggu||'',
    subjek:ctx.subjek, kelas:ctx.kelas, tahun:ctx.tahun||'',
    mula:ctx.mula, tamat:ctx.tamat, tempoh:ctx.tempoh,
    tema:j.tema||'', tajuk:j.tajuk||ctx.tajuk||'',
    kodSk:j.kodSk||'', sk:j.sk||'', kodSp:j.kodSp||'', sp:j.sp||'', tp:j.tp||'',
    objektif:(j.objektif||[]).join('\n'), kriteria:(j.kriteria||[]).join('\n'),
    aktiviti:j.aktiviti||'', pengayaan:j.pengayaan||'', pemulihan:j.pemulihan||'', penutup:j.penutup||'',
    strategi:j.strategi||'', pak21:j.pak21||'', kbat:j.kbat||'', emk:j.emk||'', nilai:j.nilai||'',
    bbm:j.bbm||'', pentaksiran:j.pentaksiran||'', refleksi:'',
    amaran:(j.amaran||[]).join(' · '),
    status:'draf', dicipta:Date.now(), dikemas:Date.now()
  };
}

/* ---------- Semakan kualiti (tanpa AI, pantas) ---------- */
function semakKualiti(r){
  const cek = [
    ['Subjek diisi', !!r.subjek],
    ['Kelas diisi', !!r.kelas],
    ['Tarikh sah', !!r.tarikh],
    ['Minggu persekolahan dikenal pasti', !!r.minggu],
    ['Masa & tempoh betul', r.tempoh > 0],
    ['Standard Kandungan tersedia', !!r.sk && !/lengkapkan rpt|belum tersedia/i.test(r.sk)],
    ['Standard Pembelajaran tersedia', !!r.sp && !/lengkapkan rpt|belum tersedia/i.test(r.sp)],
    ['SP sepadan dengan RPT minggu ini', !!S.rpt.find(d => d.sp && r.sp && d.sp.trim() === r.sp.trim()
        && d.subjek === r.subjek && noMinggu(d.minggu) === noMinggu(r.minggu))],
    ['Objektif pembelajaran ada', (r.objektif||'').trim().length > 10],
    ['Kriteria kejayaan ada', (r.kriteria||'').trim().length > 5],
    ['Aktiviti PdP ada', stripHtml(r.aktiviti).length > 60],
    ['Pentaksiran diisi', (r.pentaksiran||'').trim().length > 3],
    ['BBM diisi', (r.bbm||'').trim().length > 3],
    ['EMK / KBAT / PAK21 diisi', !!(r.emk||r.kbat||r.pak21)]
  ];
  const lulus = cek.filter(c => c[1]).length;
  return { peratus: Math.round(lulus/cek.length*100), cek };
}
