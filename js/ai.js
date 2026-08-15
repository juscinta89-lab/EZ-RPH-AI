/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* ================= e-RPH AI — ENJIN AI ================= */

/* ---------- Penyedia AI ----------
   Sebarang perkhidmatan yang serasi OpenAI boleh digunakan dengan menetapkan baseUrl. */
const PENYEDIA = {
  gemini:     { nama:'Google Gemini', jenis:'gemini', model:'gemini-2.0-flash',
                nota:'Free tier: ~15 permintaan/minit, 1,500/hari. Paling sesuai untuk sekolah.',
                daftar:'https://aistudio.google.com/apikey' },
  groq:       { nama:'Groq', jenis:'openai', base:'https://api.groq.com/openai/v1', model:'llama-3.3-70b-versatile',
                nota:'Free tier laju (~30 permintaan/minit). Model Llama & Qwen.',
                daftar:'https://console.groq.com/keys' },
  openrouter: { nama:'OpenRouter', jenis:'openai', base:'https://openrouter.ai/api/v1', model:'meta-llama/llama-3.3-70b-instruct:free',
                nota:'Model berakhiran ":free" percuma sepenuhnya (had 50–1000/hari).',
                daftar:'https://openrouter.ai/keys' },
  cerebras:   { nama:'Cerebras', jenis:'openai', base:'https://api.cerebras.ai/v1', model:'llama-3.3-70b',
                nota:'Free tier sangat laju, ~1 juta token/hari.',
                daftar:'https://cloud.cerebras.ai' },
  mistral:    { nama:'Mistral AI', jenis:'openai', base:'https://api.mistral.ai/v1', model:'mistral-small-latest',
                nota:'Free tier melalui La Plateforme.',
                daftar:'https://console.mistral.ai/api-keys' },
  deepseek:   { nama:'DeepSeek', jenis:'openai', base:'https://api.deepseek.com/v1', model:'deepseek-chat',
                nota:'Berbayar tetapi antara termurah di pasaran.',
                daftar:'https://platform.deepseek.com' },
  openai:     { nama:'OpenAI', jenis:'openai', base:'https://api.openai.com/v1', model:'gpt-4o-mini',
                nota:'Berbayar mengikut penggunaan.',
                daftar:'https://platform.openai.com/api-keys' },
  claude:     { nama:'Anthropic Claude', jenis:'claude', model:'claude-sonnet-4-6',
                nota:'Berbayar. Kualiti penulisan RPH paling baik.',
                daftar:'https://console.anthropic.com' },
  ollama:     { nama:'Ollama (komputer sendiri)', jenis:'openai', base:'http://localhost:11434/v1', model:'llama3.1',
                nota:'Betul-betul percuma & tanpa had, tetapi hanya berfungsi jika app dibuka melalui http://localhost, bukan GitHub Pages (pelayar sekat campuran HTTP/HTTPS).',
                daftar:'https://ollama.com' },
  custom:     { nama:'Lain-lain (serasi OpenAI)', jenis:'openai', base:'', model:'',
                nota:'Masukkan Base URL perkhidmatan anda, contoh: https://api.contoh.com/v1',
                daftar:'' }
};

function infoPenyedia(id){ return PENYEDIA[id] || PENYEDIA.gemini; }

function alamatAsas(){
  const t = tetapanAI();
  const p = infoPenyedia(t.prov);
  let b = (t.baseUrl || p.base || '').trim().replace(/\/+$/,'');
  if(b && !/\/v\d+$/.test(b) && !/openai\/v1$/.test(b)) { /* biarkan seperti diberi pengguna */ }
  return b;
}

/* ================= PENGURUSAN HAD KADAR =================
   Free tier setiap penyedia ada had permintaan seminit (RPM).
   Sistem ini menghantar permintaan satu demi satu dengan jeda,
   dan mengendalikan ralat 429 secara automatik. */

function tetapanKadar(){
  const t = JSON.parse(localStorage.getItem('erph_kadar') || '{}');
  return { rpm: t.rpm || 12, cubaan: t.cubaan || 4, sandaran: t.sandaran || null };
}
function simpanKadar(t){ localStorage.setItem('erph_kadar', JSON.stringify(t)); }

let _kaliAkhir = 0;
async function jedaKadar(){
  const { rpm } = tetapanKadar();
  const selang = Math.ceil(60000 / Math.max(1, rpm));       // ms antara permintaan
  const perlu = _kaliAkhir + selang - Date.now();
  if(perlu > 0) await tidur(perlu);
  _kaliAkhir = Date.now();
}
function tidur(ms){ return new Promise(r => setTimeout(r, ms)); }

function adalahHadKadar(e){
  const m = String(e?.message || e || '');
  return /429|rate limit|quota|RESOURCE_EXHAUSTED|too many requests/i.test(m);
}
function adalahKuotaHarian(e){
  const m = String(e?.message || e || '');
  return /per day|daily limit|quota exceeded.*day|PerDay/i.test(m);
}
function sarananTunggu(e){
  // Gemini kembalikan retryDelay dalam mesej ralat, contoh: "retryDelay":"38s"
  const m = String(e?.message || '').match(/retryDelay"?\s*:\s*"?(\d+)s/i);
  return m ? (+m[1] + 1) * 1000 : null;
}

/* Panggilan AI dengan jeda, cuba semula & tukar penyedia sandaran */
async function panggilAiSelamat(prompt, sistem, lapor){
  const { cubaan, sandaran } = tetapanKadar();
  let tunggu = 5000;
  for(let i = 1; i <= cubaan; i++){
    try{
      await jedaKadar();
      return await panggilAI(prompt, sistem);
    }catch(e){
      const akhir = i === cubaan;
      if(!adalahHadKadar(e)) throw e;                      // ralat lain — terus lempar

      // Kuota harian habis → terus cuba penyedia sandaran
      if(adalahKuotaHarian(e) && sandaran?.key){
        lapor?.('Kuota harian penyedia utama habis — bertukar ke penyedia sandaran…');
        return await panggilAiPenyedia(sandaran, prompt, sistem);
      }
      if(akhir){
        if(sandaran?.key){
          lapor?.('Had kadar berterusan — mencuba penyedia sandaran…');
          return await panggilAiPenyedia(sandaran, prompt, sistem);
        }
        throw new Error('Had kadar AI dicapai. Kurangkan kelajuan dalam Tetapan > Enjin AI, atau tetapkan penyedia sandaran.');
      }
      const t = sarananTunggu(e) || tunggu;
      lapor?.(`Had kadar dicapai — menunggu ${Math.round(t/1000)} saat sebelum cuba lagi (${i}/${cubaan})…`);
      await tidur(t);
      tunggu = Math.min(tunggu * 2, 60000);                 // backoff eksponen
    }
  }
}

/* Panggil penyedia tertentu (untuk sandaran) tanpa mengubah tetapan utama */
async function panggilAiPenyedia(cfg, prompt, sistem){
  const asal = localStorage.getItem('erph_ai');
  try{
    localStorage.setItem('erph_ai', JSON.stringify(cfg));
    _kaliAkhir = 0;
    return await panggilAI(prompt, sistem);
  } finally {
    if(asal) localStorage.setItem('erph_ai', asal);
  }
}

async function panggilAI(prompt, sistem){
  const t = tetapanAI();
  const p = infoPenyedia(t.prov);
  if(!t.key && t.prov !== 'ollama') throw new Error('API key belum ditetapkan. Buka Tetapan > Enjin AI.');
  const sys = sistem || 'Anda pembantu guru Malaysia yang pakar kurikulum KPM. Jawab dalam Bahasa Melayu baku.';

  try{
    if(p.jenis === 'gemini'){
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
      return (j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');
    }

    if(p.jenis === 'claude'){
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':t.key,'anthropic-version':'2023-06-01',
                 'anthropic-dangerous-direct-browser-access':'true'},
        body: JSON.stringify({ model:t.model, max_tokens:8000, system:sys, messages:[{role:'user',content:prompt}] })
      });
      const j = await r.json();
      if(j.error) throw new Error(j.error.message);
      return (j.content||[]).map(c => c.text || '').join('');
    }

    /* Serasi OpenAI — Groq, OpenRouter, Cerebras, Mistral, DeepSeek, Ollama, dll. */
    const base = alamatAsas();
    if(!base) throw new Error('Base URL belum ditetapkan untuk penyedia ini.');
    const kepala = { 'Content-Type':'application/json' };
    if(t.key) kepala['Authorization'] = 'Bearer ' + t.key;
    if(t.prov === 'openrouter'){ kepala['HTTP-Referer'] = location.origin; kepala['X-Title'] = 'e-RPH AI'; }
    const r = await fetch(base + '/chat/completions',{
      method:'POST', headers:kepala,
      body: JSON.stringify({ model:t.model, temperature:0.6, max_tokens:8000,
        messages:[{role:'system',content:sys},{role:'user',content:prompt}] })
    });
    const teks = await r.text();
    let j; try{ j = JSON.parse(teks); }catch(e){ throw new Error('Balasan tidak sah daripada pelayan: ' + teks.slice(0,120)); }
    if(j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return j.choices?.[0]?.message?.content || '';

  }catch(e){
    if(e instanceof TypeError && /fetch|network/i.test(e.message||'')){
      throw new Error('Sambungan disekat pelayar (CORS) atau tiada internet. Penyedia ini mungkin tidak membenarkan panggilan terus dari pelayar — cuba Gemini, Groq atau OpenRouter.');
    }
    throw e;
  }
}

/* Senarai model daripada penyedia serasi OpenAI */
async function senaraiModel(){
  const t = tetapanAI(), p = infoPenyedia(t.prov);
  if(p.jenis !== 'openai') throw new Error('Senarai model hanya untuk penyedia serasi OpenAI.');
  const base = alamatAsas();
  const kepala = {}; if(t.key) kepala['Authorization'] = 'Bearer ' + t.key;
  const r = await fetch(base + '/models', { headers:kepala });
  const j = await r.json();
  if(j.error) throw new Error(j.error.message || 'Gagal mendapatkan senarai model');
  return (j.data || []).map(x => x.id).sort();
}

function ambilJSON(teks){
  let t = String(teks).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a) t = t.slice(a, b+1);
  return JSON.parse(t);
}

/* ---------- Kumpul konteks daripada pangkalan data ---------- */
function kontekBuku(subjek, tahun){
  const sn = norma(subjek);
  return S.buku.filter(x => norma(x.subjek) === sn).slice(0,40);
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
  let fokus = ctx.rptFokus || null;
  let lain = rpt.minggu.filter(r => !fokus || r.id !== fokus.id);
  const rptTeks = fokus
    ? barisRpt(fokus) + (lain.length ? '\n\nBARIS LAIN MINGGU INI (rujukan sahaja):\n' + lain.map(barisRpt).join('\n') : '')
    : (rpt.minggu.length ? rpt.minggu.map(barisRpt).join('\n') : 'TIADA BARIS RPT UNTUK MINGGU INI.');
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
  const kelasInfo = S.kelas.find(k => norma(k.nama) === norma(ctx.kelas)) || {};
  const bilMurid = kelasInfo.bilangan || ctx.bilMurid || null;

  const panduan = (S.tetapanAI?.panduan || '').trim();

  return `Bina satu Rancangan Pengajaran Harian (RPH) KPM yang lengkap dan profesional.
${panduan ? `
PANDUAN WAJIB SEKOLAH INI — PATUHI SEPENUHNYA
${panduan}
` : ''}

MAKLUMAT SESI
Tarikh: ${ctx.tarikh} (${namaHari(ctx.tarikh)})
Minggu persekolahan: ${ctx.minggu || '-'}
Mata pelajaran: ${ctx.subjek}
Tahun/Tingkatan: ${ctx.tahun || '-'}
Kelas: ${ctx.kelas}
Jumlah murid dalam kelas ini: ${bilMurid ?? 'tidak dinyatakan'}
Tahap pencapaian kelas: ${kelasInfo.tahap || 'campuran'}${kelasInfo.nota?'\nNota guru tentang kelas ini: '+kelasInfo.nota:''}
Masa: ${ctx.mula} - ${ctx.tamat}
Tempoh sebenar: ${ctx.tempoh} minit
${ctx.tajuk ? 'Tajuk dikehendaki guru: '+ctx.tajuk : ''}
${ctx.arahan ? 'Arahan khas guru: '+ctx.arahan : ''}

${fokus ? 'BARIS RPT DIPILIH GURU — INI FOKUS PdP, GUNA SK/SP/TAJUK TEPAT DARIPADANYA' : 'RPT MINGGU INI — SUMBER RASMI, GUNA TEPAT SEPERTI DI BAWAH'}
${rptTeks}

RPT MINGGU BERHAMPIRAN (konteks kesinambungan sahaja, jangan guna standardnya)
${rptSekitar}

RUJUKAN BUKU TEKS DALAM SISTEM
${bukuTeks}

RPH TERDAHULU (untuk kesinambungan, jangan ulang aktiviti yang sama tanpa sebab)
${laluTeks}

PERATURAN WAJIB
0. MAKLUMAT KELAS ADALAH DATA SEBENAR — WAJIB DIPATUHI:
   ${bilMurid ? `- Kelas ini ada TEPAT ${bilMurid} orang murid. Setiap kali menyebut bilangan murid (dalam kriteria kejayaan, refleksi, atau aktiviti kumpulan), guna angka ${bilMurid} sahaja. JANGAN sekali-kali reka angka lain seperti 30, 32 atau 35.
   - Bilangan kumpulan mesti munasabah untuk ${bilMurid} murid (contoh: ${Math.max(2,Math.round(bilMurid/5))} kumpulan bagi ${bilMurid} murid).`
   : '- Bilangan murid tidak dinyatakan. Jangan sebut sebarang angka bilangan murid; tulis secara umum sahaja.'}
   ${kelasInfo.tahap ? `- Tahap kelas ialah "${kelasInfo.tahap}". Sesuaikan kesukaran aktiviti, sokongan guru dan sasaran kriteria kejayaan dengan tahap ini.` : ''}
   ${kelasInfo.nota ? `- Guru mencatat tentang kelas ini: "${kelasInfo.nota}". Aktiviti dan tindakan susulan MESTI mengambil kira perkara ini secara khusus.` : ''}
1. JANGAN cipta, ubah atau reka nombor/teks Standard Kandungan atau Standard Pembelajaran apabila RPT tersedia. Salin TEPAT daripada baris RPT minggu ini di atas, termasuk kod SK/SP dan tajuk.
${ctx.cadangSp ? `2. MOD CADANGAN: RPT tidak tersedia untuk sesi ini. Cadangkan SATU pasangan SK dan SP yang paling tepat daripada DSKP KPM sebenar bagi subjek "${ctx.subjek}" ${ctx.tahun||''}${ctx.tajuk?', selari dengan tajuk "'+ctx.tajuk+'"':''}, dengan mengambil kira ini ialah ${ctx.minggu||'pertengahan tahun'}. Gunakan nombor kod dan ayat standard sebenar seperti dalam dokumen DSKP rasmi — bukan rekaan. Jika anda tidak pasti ayat tepat sesuatu standard, berikan yang paling hampir dan WAJIB masukkan dalam "amaran": "SK/SP adalah cadangan AI — sila sahkan dengan DSKP rasmi sebelum digunakan".`
: `2. Jika tiada baris RPT untuk minggu ini, isi medan sk/sp dengan "Sila lengkapkan RPT bagi minggu ini" dan senaraikan dalam "amaran". Jangan ambil standard daripada minggu lain.`}
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
  const jawapan = await panggilAiSelamat(promptRph(ctx), null, ctx.lapor);
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
/* Kesan angka bilangan murid yang tidak sepadan dengan data kelas */
function semakAngkaMurid(r){
  const k = S.kelas.find(x => norma(x.nama) === norma(r.kelas));
  const jum = k?.bilangan;
  if(!jum) return { ok:true, jum:null };
  const teks = [r.refleksi, r.kriteria, r.objektif, stripHtml(r.aktiviti||'')].join(' ');
  // cari corak "N daripada M murid" atau "M orang murid"
  const salah = new Set();
  let m;
  const rx1 = /(\d{1,3})\s*(?:daripada|dari|\/)\s*(\d{1,3})\s*(?:orang\s*)?murid/gi;
  while((m = rx1.exec(teks))){ if(+m[2] !== jum) salah.add(m[2]); }
  const rx2 = /(?:seramai|kesemua|semua)\s*(\d{1,3})\s*(?:orang\s*)?murid/gi;
  while((m = rx2.exec(teks))){ if(+m[1] !== jum) salah.add(m[1]); }
  return { ok: salah.size === 0, jum, salah:[...salah] };
}

/* ============ AUDIT PUKAL SEMUA RPH ============ */
function auditRph(r){
  const m = [];
  const angka = semakAngkaMurid(r);
  if(!angka.ok) m.push({ kod:'angka', berat:'tinggi', boleh:true,
    teks:`Menyebut ${angka.salah.join(', ')} murid — kelas ini ada ${angka.jum} murid`, jum:angka.jum });

  const kelasAda = S.kelas.some(k => norma(k.nama) === norma(r.kelas));
  if(r.kelas && !kelasAda) m.push({ kod:'kelas', berat:'sederhana', boleh:false,
    teks:`Kelas "${r.kelas}" tiada dalam senarai kelas` });

  const kosong = t => !String(t||'').trim() || String(t).trim() === '-';
  const pemegang = t => /sila lengkapkan|belum tersedia|tidak dinyatakan|lorem|xxx|tbd/i.test(String(t||''));

  if(kosong(r.sk) || pemegang(r.sk)) m.push({ kod:'sk', berat:'tinggi', boleh:false, teks:'Standard Kandungan kosong atau tidak sah' });
  if(kosong(r.sp) || pemegang(r.sp)) m.push({ kod:'sp', berat:'tinggi', boleh:false, teks:'Standard Pembelajaran kosong atau tidak sah' });
  if(kosong(r.objektif)) m.push({ kod:'objektif', berat:'tinggi', boleh:false, teks:'Objektif pembelajaran kosong' });
  if(kosong(r.kriteria)) m.push({ kod:'kriteria', berat:'rendah', boleh:false, teks:'Kriteria kejayaan kosong' });
  if(stripHtml(r.aktiviti||'').trim().length < 120) m.push({ kod:'aktiviti', berat:'tinggi', boleh:false, teks:'Aktiviti PdP terlalu ringkas atau kosong' });
  if(kosong(r.tajuk)) m.push({ kod:'tajuk', berat:'rendah', boleh:false, teks:'Tajuk tidak diisi' });
  if(kosong(r.bbm)) m.push({ kod:'bbm', berat:'rendah', boleh:false, teks:'BBM/Sumber tidak diisi' });
  if(kosong(r.pentaksiran)) m.push({ kod:'pbd', berat:'rendah', boleh:false, teks:'Pentaksiran tidak diisi' });

  if(r.amaran) m.push({ kod:'amaran', berat:'sederhana', boleh:false, teks:'Amaran AI: '+String(r.amaran).slice(0,90) });

  // SP tidak sepadan dengan RPT minggu berkenaan
  if(r.kodSp && r.subjek && r.minggu){
    const kelas = S.kelas.find(k => norma(k.nama) === norma(r.kelas));
    const rpt = (typeof rptUntuk === 'function') ? rptUntuk(r.subjek, kelas?.tahun || '', r.minggu) : { minggu:[] };
    if(rpt.minggu && rpt.minggu.length){
      const adaKod = rpt.minggu.some(x => String(x.kodSp||'').trim() === String(r.kodSp).trim());
      if(!adaKod) m.push({ kod:'rpt', berat:'sederhana', boleh:false,
        teks:`Kod SP ${r.kodSp} tiada dalam RPT ${r.minggu}` });
    }
  }

  // Refleksi kosong hanya masalah untuk tarikh yang sudah lepas
  if(kosong(r.refleksi) && r.tarikh < tarikhISO())
    m.push({ kod:'refleksi', berat:'rendah', boleh:false, teks:'Refleksi belum ditulis (tarikh sudah lepas)' });

  return m;
}

function semakKualiti(r){
  const angka = semakAngkaMurid(r);
  const cek = [
    ['Subjek diisi', !!r.subjek],
    ['Kelas diisi', !!r.kelas],
    ['Bilangan murid tepat' + (angka.jum ? ` (${angka.jum} murid)` : ''), angka.ok],
    ['Tarikh sah', !!r.tarikh],
    ['Minggu persekolahan dikenal pasti', !!r.minggu],
    ['Masa & tempoh betul', r.tempoh > 0],
    ['Standard Kandungan tersedia', !!r.sk && !/lengkapkan rpt|belum tersedia/i.test(r.sk)],
    ['Standard Pembelajaran tersedia', !!r.sp && !/lengkapkan rpt|belum tersedia/i.test(r.sp)],
    ['SP sepadan dengan RPT minggu ini', !!S.rpt.find(d => d.sp && r.sp && d.sp.trim() === r.sp.trim()
        && norma(d.subjek) === norma(r.subjek) && noMinggu(d.minggu) === noMinggu(r.minggu))],
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
