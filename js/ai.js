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

/* ---------- Piawai medan RPH (rujukan bersama prompt + audit) ---------- */
const EMK_SAH = ['Kreativiti & Inovasi','Nilai Murni','Sains & Teknologi','TMK',
  'Keusahawanan','Kelestarian Global','Kelestarian Alam Sekitar',
  'Patriotisme & Kewarganegaraan','Pendidikan Kewangan','Bahasa'];

const KBAT_SAH = ['Mengaplikasi','Menganalisis','Menilai','Mencipta'];

const PAK21_SAH = ['Think-Pair-Share','Gallery Walk','Round Table','Hot Seat',
  'Traffic Lights','Jigsaw','Placemat','Rally Robin','Peer Tutoring',
  'Three Stray One Stay','Numbered Heads Together','Fan-N-Pick','Team Word Web',
  'Carousel','Role Play','Stesen Pembelajaran'];

/* Perkataan yang kerap keluar tetapi bukan Bahasa Melayu baku */
const EJAAN_SALAH = {
  'berbasis':'berasaskan', 'mereview':'mengulas', 'sessi':'sesi',
  'menggunapakai':'menggunakan', 'kommunikasi':'komunikasi',
  'mayoriti':'majoriti', 'demostrasi':'demonstrasi', 'aktifitas':'aktiviti',
  'merefleksikan':'membuat refleksi', 'kemampuan':'keupayaan',
  'mempersembahkan':'membentangkan', 'perternakan':'penternakan'
};

function betulEjaan(teks){
  let t = String(teks||'');
  for(const [salah, betul] of Object.entries(EJAAN_SALAH)){
    t = t.replace(new RegExp('\\b'+salah+'\\b','gi'), m =>
      m[0] === m[0].toUpperCase() ? betul[0].toUpperCase()+betul.slice(1) : betul);
  }
  return t;
}
/* Petakan isi medan KBAT yang salah kepada aras KBAT yang sah */
function betulKbat(asal){
  const t = String(asal||'').toLowerCase();
  if(KBAT_SAH.some(k => t.startsWith(k.toLowerCase()))) return String(asal).trim();
  let aras = 'Mengaplikasi';
  if(/cipta|hasil|reka|inovasi|kreativ/.test(t)) aras = 'Mencipta';
  else if(/menilai|penilaian|nilai|justifi|wajar/.test(t)) aras = 'Menilai';
  else if(/analis|banding|beza|kaji|selesai.*masalah|masalah/.test(t)) aras = 'Menganalisis';
  const nota = String(asal||'').trim().replace(/[.\s]+$/,'');
  return nota && nota.length <= 40 ? `${aras} (${nota.replace(/^./, c => c.toLowerCase())})` : aras;
}
function cariEjaanSalah(teks){
  const t = String(teks||'').toLowerCase();
  return Object.keys(EJAAN_SALAH).filter(s => new RegExp('\\b'+s+'\\b').test(t));
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
function labelMinggu(m){
  const t = String(m||'').trim();
  if(!t) return '-';
  return /^minggu\b/i.test(t) ? t : 'Minggu ' + t;
}
function barisRpt(r){
  return `- ${labelMinggu(r.minggu)} | Tema/Bidang: ${r.tema||'-'} | Tajuk: ${r.tajuk||'-'}\n` +
         `  SK [${r.kodSk||'-'}]: ${r.sk||'-'}\n  SP [${r.kodSp||'-'}]: ${r.sp||'-'}` +
         (r.tp?`\n  TP: ${r.tp}`:'') + (r.catatan?`\n  Catatan RPT: ${r.catatan}`:'');
}
function promptRph(ctx){
  const rpt = rptUntuk(ctx.subjek, ctx.tahun, ctx.minggu);
  let fokus = ctx.rptFokus || null;
  /* Jika guru menulis sendiri atau mengambil tajuk daripada minggu lain, baris
     minggu semasa TIDAK disertakan langsung — jika disertakan, AI cenderung
     kembali kepadanya dan mengabaikan pilihan guru. */
  const rptSendiri = !!ctx.rptManual;
  const dariMingguLain = !!ctx.rptMingguAsal;
  const abaiMingguIni = rptSendiri || dariMingguLain;
  let lain = abaiMingguIni ? [] : rpt.minggu.filter(r => !fokus || r.id !== fokus.id);
  const rptTeks = fokus
    ? barisRpt(fokus) + (lain.length ? '\n\nBARIS LAIN MINGGU INI (rujukan sahaja):\n' + lain.map(barisRpt).join('\n') : '')
    : (rpt.minggu.length ? rpt.minggu.map(barisRpt).join('\n') : 'TIADA BARIS RPT UNTUK MINGGU INI.');
  const rptSekitar = abaiMingguIni ? 'Tidak berkaitan — guru telah menetapkan fokus PdP secara khusus.'
    : (rpt.sekitar.length ? rpt.sekitar.map(barisRpt).join('\n') : 'Tiada.');
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

${rptSendiri
  ? `SK / SP DITULIS SENDIRI OLEH GURU — INI SUMBER MUKTAMAD
Guru telah menetapkan fokus PdP secara manual. Salin medan yang diisi di bawah
TEPAT SEPERTI TERTULIS ke dalam RPH — jangan ubah ayat, jangan ringkaskan, jangan
gantikan dengan mana-mana baris RPT. Ruang yang dibiarkan kosong sahaja boleh anda
cadangkan sendiri, dan cadangan itu WAJIB dinyatakan dalam medan "amaran".`
  : dariMingguLain
  ? `BARIS RPT DIPILIH GURU DARIPADA ${labelMinggu(ctx.rptMingguAsal).toUpperCase()} — GURU SENGAJA MELANGKAU/MENDAHULUI RPT
Kelas ini tidak mengikut turutan RPT kerana keadaan sebenar di sekolah. Gunakan SK, SP, kod dan
tajuk DARIPADA BARIS DI BAWAH SAHAJA. JANGAN gantikan dengan tajuk ${labelMinggu(ctx.minggu) || 'minggu semasa'}.
Medan "minggu" dalam RPH tetap ${labelMinggu(ctx.minggu)} kerana itulah minggu sesi PdP ini berlangsung.`
  : (fokus ? 'BARIS RPT DIPILIH GURU — INI FOKUS PdP, GUNA SK/SP/TAJUK TEPAT DARIPADANYA'
           : 'RPT MINGGU INI — SUMBER RASMI, GUNA TEPAT SEPERTI DI BAWAH')}
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

PERATURAN SETIAP MEDAN — PATUHI SATU PERSATU

"sk" dan "sp"
- WAJIB berbeza antara satu sama lain. Jika RPT memberi ayat yang sama untuk kedua-duanya,
  ambil ayat SK yang lebih umum dan SP yang lebih spesifik.
- Maksimum 30 patah perkataan setiap satu. Jika baris RPT mengandungi senarai panjang
  berbilang kemahiran, ambil SATU sahaja yang berkaitan tajuk minggu ini — jangan salin
  keseluruhan blok DSKP.

"objektif" (2 hingga 3 item)
- Setiap item bermula dengan kata kerja: Mengenal pasti, Membina, Melakukan, Menyelesaikan,
  Menyatakan, Menganalisis, Menghasilkan.
- JANGAN mulakan dengan "Murid dapat" atau "Pada akhir pembelajaran" — templat cetakan
  sudah ada ayat pembuka itu.
- Sekurang-kurangnya satu objektif mesti mengandungi kuantiti yang boleh diukur:
  "sekurang-kurangnya 3 ayat", "4 daripada 5 soalan", "2 peraturan keselamatan".

"kriteria" (bilangan sama dengan objektif)
- Mesti perkara yang boleh DILIHAT atau DISEMAK: hasil kerja, lakuan, pembentangan.
- JANGAN salin semula objektif dan tambah "dengan betul". Itu bukan kriteria kejayaan.

"nilai" (Nilai Murni)
- 2 hingga 4 kata nama sahaja dipisah koma. Contoh: "Kerjasama, Ketelitian, Kesyukuran".
- JANGAN tulis ayat. "Guru mengintegrasikan nilai kerjasama" adalah SALAH.

"emk"
- Pilih 1 atau 2 sahaja daripada senarai ini, tulis persis seperti tertera:
  ${EMK_SAH.join(' | ')}
- JANGAN tulis ayat penuh.

"kbat"
- WAJIB bermula dengan SATU daripada: ${KBAT_SAH.join(' | ')}
- Tambah kurungan penjelasan pendek. Contoh: "Menganalisis (membanding jenis ayat)".
- "Penggunaan teknologi", "Konstruktivisme", "Pembelajaran Berasaskan Masalah", "TMK" dan
  "Kemahiran Berfikir Aras Tinggi" adalah SALAH untuk medan ini — itu strategi atau nama
  umum, bukan aras KBAT.

"pak21"
- Nama teknik yang khusus, contoh: ${PAK21_SAH.slice(0,8).join(', ')}.
- "Kerjasama", "Komunikasi", "Kolaborasi" adalah SALAH untuk medan ini — itu nilai, bukan
  teknik PAK-21. Nilai tersebut sepatutnya masuk dalam medan "nilai".

"pentaksiran" (PBD)
- Format: instrumen + aras. Contoh: "Lembaran kerja (TP4)", "Senarai semak pemerhatian (TP3)".
- "Pentaksiran berterusan" sahaja tidak mencukupi.

"bbm"
- Bahan sebenar yang guru boleh sediakan, dengan kuantiti atau muka surat jika ada.
  Contoh: "Tilam gimnastik (5 unit), kon penanda (10 unit), wisel".

"strategi"
- Nama pendekatan sahaja: Pembelajaran Terbeza, Pembelajaran Masteri,
  Pembelajaran Berasaskan Masalah, Pembelajaran Kontekstual, Pembelajaran Koperatif.

"aktiviti"
- Setiap langkah nyatakan apa yang GURU buat dan apa yang MURID buat.
- Aktiviti mesti khusus kepada tajuk. "Murid berlatih dalam kumpulan kecil" terlalu kabur —
  nyatakan mereka berlatih apa dan guna bahan apa.

BAHASA — perkataan berikut DILARANG, guna gantian:
${Object.entries(EJAAN_SALAH).map(([a,b]) => `  ${a} -> ${b}`).join('\n')}

KEPELBAGAIAN
Jika ada RPH terdahulu disenaraikan di atas untuk kelas dan subjek yang sama, RPH ini WAJIB
berbeza pada sekurang-kurangnya TIGA perkara: set induksi, bahan bantu mengajar, teknik
PAK-21, dan aktiviti langkah kedua. Standard Pembelajaran boleh sama jika RPT menetapkan
begitu, tetapi pelaksanaan mesti maju ke hadapan — bukan salinan hari sebelumnya.

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
  // Bersihkan ejaan bukan baku sebelum disimpan
  ['tema','tajuk','sk','sp','aktiviti','pengayaan','pemulihan','penutup',
   'strategi','pak21','kbat','emk','nilai','bbm','pentaksiran'].forEach(f => {
    if(typeof j[f] === 'string') j[f] = betulEjaan(j[f]);
  });
  ['objektif','kriteria'].forEach(f => {
    if(Array.isArray(j[f])) j[f] = j[f].map(betulEjaan);
  });
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

  /* ---- Kualiti medan ---- */
  const kata = t => String(t||'').trim().split(/\s+/).filter(Boolean).length;

  if(!kosong(r.sk) && !kosong(r.sp) && String(r.sk).trim() === String(r.sp).trim())
    m.push({ kod:'skSama', berat:'tinggi', boleh:false,
      teks:'Standard Kandungan dan Standard Pembelajaran isi yang sama' });

  if(kata(r.sk) > 40 || kata(r.sp) > 45)
    m.push({ kod:'skPanjang', berat:'sederhana', boleh:false,
      teks:'Standard terlalu panjang — nampak disalin bulat daripada DSKP' });

  if(r.kbat && !KBAT_SAH.some(k => String(r.kbat).trim().toLowerCase().startsWith(k.toLowerCase())))
    m.push({ kod:'kbat', berat:'sederhana', boleh:true, betul:'kbat',
      teks:`KBAT "${String(r.kbat).slice(0,40)}" bukan aras KBAT — guna ${KBAT_SAH.join('/')}` });

  if(r.emk && (kata(r.emk) > 7 || /^(guru|murid)\s/i.test(String(r.emk).trim())))
    m.push({ kod:'emk', berat:'rendah', boleh:false,
      teks:'EMK ditulis sebagai ayat — patut nama elemen sahaja' });
  else if(r.emk && !EMK_SAH.some(e => norma(r.emk).includes(norma(e))))
    m.push({ kod:'emk', berat:'rendah', boleh:false,
      teks:`EMK "${String(r.emk).slice(0,40)}" tiada dalam senarai rasmi` });

  if(r.nilai && (kata(r.nilai) > 8 || /^(guru|murid)\s/i.test(String(r.nilai).trim())))
    m.push({ kod:'nilai', berat:'rendah', boleh:false,
      teks:'Nilai Murni ditulis sebagai ayat — patut kata nama sahaja' });

  if(r.pak21 && /^(kerjasama|komunikasi|kolaborasi|kerja sama)/i.test(String(r.pak21).trim()))
    m.push({ kod:'pak21', berat:'rendah', boleh:false,
      teks:'PAK-21 patut nama teknik (Gallery Walk, Think-Pair-Share), bukan nilai' });

  if(!kosong(r.objektif) && !/\d|sekurang-kurangnya/i.test(String(r.objektif)))
    m.push({ kod:'objUkur', berat:'sederhana', boleh:false,
      teks:'Tiada objektif yang boleh diukur — tiada kuantiti dinyatakan' });

  /* Jumlah minit dalam aktiviti vs tempoh sebenar */
  if(r.tempoh > 0 && r.aktiviti){
    const teksAkt = stripHtml(r.aktiviti);
    const minit = [...teksAkt.matchAll(/\((\d{1,3})\s*minit\)/gi)].map(x => +x[1]);
    const jumlah = minit.reduce((a,b) => a+b, 0);
    if(minit.length >= 2 && Math.abs(jumlah - r.tempoh) > 5)
      m.push({ kod:'masa', berat:'sederhana', boleh:false,
        teks:`Jumlah masa langkah ${jumlah} minit, tempoh sesi ${r.tempoh} minit` });
  }

  /* Refleksi ditulis untuk tarikh yang belum sampai */
  if(!kosong(r.refleksi) && r.tarikh > tarikhISO())
    m.push({ kod:'refAwal', berat:'sederhana', boleh:false,
      teks:'Refleksi sudah ditulis untuk tarikh yang belum berlaku' });

  /* Ejaan bukan baku */
  const salahEja = cariEjaanSalah([r.sk, r.sp, r.objektif, r.kriteria, r.refleksi,
    r.nilai, r.emk, r.kbat, r.pak21, r.strategi, r.pemulihan, r.pengayaan,
    stripHtml(r.aktiviti||''), stripHtml(r.penutup||'')].join(' '));
  if(salahEja.length) m.push({ kod:'ejaan', berat:'rendah', boleh:true, betul:'ejaan',
    teks:`Ejaan bukan baku: ${salahEja.slice(0,4).map(s => `${s} → ${EJAAN_SALAH[s]}`).join(', ')}` });

  // SP tidak sepadan dengan RPT minggu berkenaan.
  // Dilangkau jika guru menulis SK/SP sendiri atau sengaja mengambil tajuk minggu lain.
  if(r.kodSp && r.subjek && r.minggu && !r.rptMingguAsal && !r.rptManual){
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

/* ---------- Bentrok jadual: dua RPH bertindih pada tarikh sama ---------- */
function minitJam(t){
  const p = String(t||'').match(/(\d{1,2})[:.](\d{2})/);
  return p ? (+p[1])*60 + (+p[2]) : null;
}
function semakBentrok(senarai){
  const ikutTarikh = {};
  (senarai || S.rph).forEach(r => {
    if(!r.tarikh || !r.mula || !r.tamat) return;
    (ikutTarikh[r.tarikh] = ikutTarikh[r.tarikh] || []).push(r);
  });
  const isu = [];
  for(const [tarikh, senaraiHari] of Object.entries(ikutTarikh)){
    for(let i = 0; i < senaraiHari.length; i++){
      for(let j = i+1; j < senaraiHari.length; j++){
        const a = senaraiHari[i], b = senaraiHari[j];
        const a1 = minitJam(a.mula), a2 = minitJam(a.tamat);
        const b1 = minitJam(b.mula), b2 = minitJam(b.tamat);
        if(a1 == null || a2 == null || b1 == null || b2 == null) continue;
        if(!(a1 < b2 && b1 < a2)) continue;
        const samaKelas = norma(a.kelas) === norma(b.kelas);
        const teks = samaKelas
          ? `${a.kelas}: ${a.subjek} dan ${b.subjek} bertindih pada ${a.mula}`
          : `Guru dijadualkan di dua kelas serentak pada ${a.mula}: ${a.kelas} (${a.subjek}) dan ${b.kelas} (${b.subjek})`;
        isu.push({ tarikh, a, b, samaKelas, teks });
      }
    }
  }
  return isu.sort((x,y) => y.tarikh.localeCompare(x.tarikh));
}

/* ---------- RPH berulang: set induksi + BBM + aktiviti sama ---------- */
function capRph(r){
  const bersih = s => String(s||'').toLowerCase().replace(/\W+/g,' ').trim();
  const akt = stripHtml(r.aktiviti||'').replace(/\s+/g,' ').trim();
  return [bersih(r.bbm), bersih(akt.slice(0,260))].join('|');
}
function semakUlangRph(senarai){
  const kump = {};
  (senarai || S.rph).forEach(r => {
    if(!r.subjek || !r.kelas) return;
    const kunci = norma(r.subjek)+'|'+norma(r.kelas);
    (kump[kunci] = kump[kunci] || []).push(r);
  });
  const ulang = new Map();
  for(const senaraiKelas of Object.values(kump)){
    const cap = {};
    senaraiKelas.slice().sort((a,b) => String(a.tarikh).localeCompare(b.tarikh)).forEach(r => {
      const c = capRph(r);
      if(c.length < 40) return;
      // Rekod pada tarikh yang sama ialah pendua slot, bukan isi berulang —
      // biar cariPendua() yang uruskan supaya tidak ditanda dua kali.
      if(cap[c] && cap[c].tarikh !== r.tarikh) ulang.set(r.id, cap[c]);
      else if(!cap[c]) cap[c] = r;
    });
  }
  return ulang;   // Map: id RPH => RPH asal yang disalin
}

/* ---------- Pendua sebenar: rekod sama tersimpan berkali-kali ---------- */
/* Berbeza daripada semakUlangRph(): ini rekod bertindan pada slot yang SAMA,
   bukan isi serupa pada tarikh berlainan. Hanya jenis ini selamat dipadam. */
function skorLengkap(r){
  let s = 0;
  ['sk','sp','objektif','kriteria','tajuk','bbm','pentaksiran','strategi',
   'pak21','kbat','emk','nilai','pemulihan','pengayaan'].forEach(f => {
    if(String(r[f]||'').trim().length > 2) s += 1;
  });
  s += Math.min(6, Math.floor(stripHtml(r.aktiviti||'').length / 200));
  if(String(r.refleksi||'').trim()) s += 3;
  if(r.status === 'lengkap') s += 2;
  return s;
}
function cariPendua(senarai){
  const kump = {};
  (senarai || S.rph).forEach(r => {
    if(!r.tarikh || !r.subjek || !r.kelas) return;
    const kunci = [r.tarikh, norma(r.subjek), norma(r.kelas), r.mula||'', r.tamat||''].join('|');
    (kump[kunci] = kump[kunci] || []).push(r);
  });
  const set = [];
  for(const senaraiSlot of Object.values(kump)){
    if(senaraiSlot.length < 2) continue;
    const isih = senaraiSlot.slice().sort((a,b) =>
      skorLengkap(b) - skorLengkap(a) || (b.dikemas||0) - (a.dikemas||0));
    set.push({ simpan: isih[0], buang: isih.slice(1) });
  }
  return set.sort((a,b) => String(b.simpan.tarikh).localeCompare(a.simpan.tarikh));
}

/* ---------- Pembetulan medan tanpa AI ---------- */
/* Pulangkan objek perubahan sahaja; kosong bermakna tiada apa boleh dibetulkan. */
function baikiMedanRph(r, isu){
  const ubah = {};
  const MEDAN = ['tema','tajuk','sk','sp','objektif','kriteria','aktiviti','pengayaan',
                 'pemulihan','penutup','strategi','pak21','emk','nilai','bbm',
                 'pentaksiran','refleksi'];

  if(isu.some(p => p.kod === 'ejaan'))
    MEDAN.forEach(f => {
      if(!r[f]) return;
      const baharu = betulEjaan(r[f]);
      if(baharu !== r[f]) ubah[f] = baharu;
    });

  if(isu.some(p => p.kod === 'kbat') && r.kbat){
    const baharu = betulKbat(r.kbat);
    if(baharu !== r.kbat) ubah.kbat = baharu;
  }

  // EMK ditulis sebagai ayat: cari elemen rasmi yang disebut di dalamnya
  if(isu.some(p => p.kod === 'emk') && r.emk){
    const jumpa = EMK_SAH.filter(e => norma(r.emk).includes(norma(e)));
    if(jumpa.length) ubah.emk = jumpa.slice(0,2).join(', ');
  }

  // Nilai Murni ditulis sebagai ayat: cabut kata nama nilai yang dikenali
  if(isu.some(p => p.kod === 'nilai') && r.nilai){
    const NILAI = ['Kerjasama','Kerajinan','Kesyukuran','Ketelitian','Keyakinan diri',
      'Kejujuran','Hormat-menghormati','Bertanggungjawab','Berdisiplin','Kesabaran',
      'Keberanian','Kesungguhan','Kreativiti','Empati','Kasih sayang','Toleransi'];
    const jumpa = NILAI.filter(n => norma(r.nilai).includes(norma(n.split('-')[0].slice(0,7))));
    if(jumpa.length) ubah.nilai = jumpa.slice(0,4).join(', ');
  }

  // Refleksi ditulis untuk tarikh yang belum sampai: kosongkan
  if(isu.some(p => p.kod === 'refAwal')) ubah.refleksi = '';

  // Bilangan murid tidak sepadan data kelas
  const angka = isu.find(p => p.kod === 'angka');
  if(angka?.jum){
    ['refleksi','kriteria','objektif','aktiviti'].forEach(f => {
      const asal = ubah[f] ?? r[f];
      if(!asal) return;
      const baharu = betulTeksAngka(asal, angka.jum);
      if(baharu !== (r[f] ?? '')) ubah[f] = baharu;
      else delete ubah[f];
    });
  }

  // Buang medan yang akhirnya tidak berubah langsung
  Object.keys(ubah).forEach(f => { if(ubah[f] === (r[f] ?? '')) delete ubah[f]; });

  return ubah;
}

/* Isu yang tidak boleh dibaiki secara automatik langsung */
const ISU_TAK_AUTO = ['bentrok','sk','sp','rpt','kelas','aktiviti','objektif','kriteria'];
/* Isu yang perlu AI jana semula RPH */
const ISU_PERLU_AI = ['skSama','skPanjang','objUkur','masa','ulang','pak21'];

/* ================= SOALAN LATIHAN ================= */

const JENIS_LATIHAN = {
  objektif:   { label:'Aneka pilihan (A–D)',            main:false },
  subjektif:  { label:'Subjektif — tunjuk jalan kerja', main:false },
  struktur:   { label:'Soalan struktur',                main:false },
  isiTempat:  { label:'Isi tempat kosong',              main:false },
  padanan:    { label:'Padanan',                        main:false },
  gambarAyat: { label:'Bina ayat berdasarkan gambar',   main:false },
  silangKata: { label:'Silang kata',                    main:true  },
  cariKata:   { label:'Cari perkataan',                 main:true  }
};

const ARAS_LATIHAN = {
  mudah:     'Aras rendah (Mengingat & Memahami) — untuk murid pemulihan.',
  sederhana: 'Aras sederhana (Memahami & Mengaplikasi) — untuk majoriti murid.',
  kbat:      'Aras tinggi KBAT (Menganalisis, Menilai, Mencipta) — untuk murid pengayaan.'
};

/* ---------- Semakan jawapan ---------- */
/* Model yang menjana soalan cenderung menerima jawapannya sendiri. Pusingan
   kedua ini memaksanya menyemak semula sebagai PEMERIKSA, bukan penulis —
   itu menangkap kesilapan logik dan tatabahasa yang terlepas pada pusingan
   pertama, terutamanya susunan sebab-akibat dalam ayat majmuk. */
function promptSemakSoalan(ctx, L){
  const tahunNombor = (String(ctx.kelas||'').match(/\b([1-6])\b/) || [])[1] || '4';
  return `Anda pemeriksa kertas soalan sekolah rendah Malaysia. Tugas anda MENYEMAK,
bukan menulis soalan baharu. Bersikap tegas seperti ketua panitia yang menyemak kertas rakan.

KONTEKS
  Subjek : ${ctx.subjek}
  Kelas  : ${ctx.kelas} (Tahun ${tahunNombor})
  Tajuk  : ${ctx.tajuk || '-'}
  Standard Pembelajaran : ${ctx.sp || '-'}

SOALAN YANG PERLU DISEMAK:
${JSON.stringify({ tajuk:L.tajuk, arahan:L.arahan, jenis:L.jenis, soalan:L.soalan }, null, 1)}

SEMAK SETIAP ITEM TERHADAP PERKARA INI:

1. TATABAHASA — jawapan mesti gramatis mengikut Bahasa Melayu baku.
   Semak imbuhan, kata sendi, susunan subjek-predikat dan ejaan.

2. LOGIK KATA HUBUNG — ini kesilapan paling kerap, periksa dengan teliti:
   - "supaya / agar / untuk" menyatakan TUJUAN. Perbuatan datang dahulu, tujuan kemudian.
     SALAH : "Aiman ingin menjadi petani moden supaya dia belajar bersungguh-sungguh."
     BETUL : "Aiman belajar bersungguh-sungguh supaya dia menjadi petani moden."
   - "kerana / sebab" menyatakan SEBAB. Kesan dahulu, sebab kemudian.
   - "sehingga / lalu" menyatakan AKIBAT yang berlaku selepasnya.
   - "walaupun / meskipun" menyatakan PERTENTANGAN.
   - "sambil / semasa" menyatakan dua perbuatan SERENTAK oleh pelaku yang sama.
   - "manakala / sedangkan" membandingkan dua perkara BERBEZA.
   Jika hubungan logik terbalik, betulkan susunan klausa.

3. PADAN DENGAN KEHENDAK SOALAN — jika soalan meminta ayat majmuk pancangan
   keterangan, jawapan mesti benar-benar ayat majmuk pancangan keterangan.
   Jika label jenis ayat tidak sepadan dengan ayat itu, betulkan label ATAU ayat.

4. PENGIRAAN — untuk soalan matematik, kira semula dari awal.
   Semak nilai, unit dan penukaran unit. Jangan percaya jawapan asal.

5. JAWAPAN TUNGGAL — untuk aneka pilihan, pastikan hanya SATU pilihan betul
   dan pengecoh lain benar-benar salah.

6. KESESUAIAN UMUR — perbendaharaan kata sesuai untuk murid Tahun ${tahunNombor}.

PULANGKAN JSON SAHAJA:
{
  "soalan": [ ...senarai penuh selepas dibetulkan, susunan dan medan sama seperti asal... ],
  "pembetulan": [ "No 15: susunan klausa 'supaya' terbalik — tujuan diletakkan sebelum perbuatan" ],
  "bersih": true
}

- "soalan" mesti mengandungi SEMUA item, termasuk yang tidak diubah.
- "pembetulan" senaraikan setiap perubahan dalam satu ayat pendek. Kosongkan jika tiada.
- "bersih" ialah true jika tiada apa-apa yang perlu dibetulkan.
- JANGAN tambah atau buang soalan. Bilangan mesti kekal sama.`;
}

async function semakSoalanAI(ctx, L){
  const j = ambilJSON(await panggilAiSelamat(promptSemakSoalan(ctx, L), null, ctx.lapor));
  if(!Array.isArray(j.soalan) || j.soalan.length !== L.soalan.length){
    L.semakanGagal = 'Semakan tidak lengkap — soalan asal dikekalkan.';
    return L;
  }
  L.soalan = j.soalan.map((s,i) => ({ ...L.soalan[i], ...s, no:i+1 }));
  L.pembetulan = (j.pembetulan||[]).map(betulEjaan).filter(Boolean);
  L.disemak = true;
  return L;
}

function promptSoalan(ctx){
  const permainan = ctx.jenis === 'silangKata' || ctx.jenis === 'cariKata';
  const tahunNombor = (String(ctx.kelas||'').match(/\b([1-6])\b/) || [])[1] || '4';

  const asas = `Anda guru sekolah rendah Malaysia yang menyediakan bahan latihan murid.
Pulangkan SATU objek JSON sahaja. Tiada teks pengenalan, tiada pagar kod markdown.

KONTEKS PELAJARAN
  Subjek              : ${ctx.subjek}
  Kelas / Tahun       : ${ctx.kelas} (Tahun ${tahunNombor})
  Tajuk               : ${ctx.tajuk || '-'}
  Standard Kandungan  : ${ctx.sk || '-'}
  Standard Pembelajaran: ${ctx.sp || '-'}
  Objektif pembelajaran:
${(ctx.objektif||'').split('\n').filter(Boolean).map(o => '    - '+o).join('\n') || '    -'}

ARAS: ${ARAS_LATIHAN[ctx.aras] || ARAS_LATIHAN.sederhana}
${ctx.arahanGuru ? `
ARAHAN KHAS DARIPADA GURU — PATUHI INI DAHULU SEBELUM PERATURAN LAIN:
${ctx.arahanGuru}
Jika arahan ini bercanggah dengan cadangan lazim, ikut arahan guru.
Jangan langgar peraturan keselamatan atau kesesuaian umur.` : ''}

PERATURAN WAJIB
1. Soalan mesti menguji objektif pembelajaran di atas — bukan topik lain dalam subjek yang sama.
2. Bahasa dan panjang ayat mesti sesuai untuk murid Tahun ${tahunNombor}. Ayat pendek, perkataan biasa.
3. Konteks setempat Malaysia (nama Ali, Siti, Muthu, Lee; ringgit; buah tempatan; sekolah kebangsaan).
4. Bahasa Melayu baku. JANGAN guna: berbasis, mereview, sessi, menggunapakai, kemampuan.
5. Setiap soalan mesti ada jawapan yang betul dan boleh disemak.
6. JANGAN reka fakta buku teks atau nombor muka surat.`;

  if(!permainan){
    const bentuk = {
      objektif: `"soalan": [ { "no":1, "soalan":"...", "pilihan":["A. ...","B. ...","C. ...","D. ..."], "jawapan":"B", "huraian":"kenapa B betul, satu ayat" } ]
- Semua pengecoh mesti munasabah. JANGAN buat pengecoh yang jelas mengarut.
- Sebarkan jawapan betul secara rawak antara A, B, C dan D.`,
      subjektif: `"soalan": [ { "no":1, "soalan":"...", "markah":2, "jawapan":"jawapan akhir dengan unit", "langkah":["ayat matematik atau langkah 1","langkah 2"], "huraian":"" } ]
- Setiap soalan mesti soalan berayat yang memerlukan murid MENGIRA, bukan sekadar mengingat.
- "langkah" ialah jalan kerja penuh untuk skema guru: tulis ayat matematik sebenar
  (contoh: "3 kg 250 g = 3 250 g", "3 250 g − 850 g = 2 400 g").
- Jawapan akhir mesti disertakan unit yang betul.
- Campurkan soalan satu langkah dan dua langkah. Sekurang-kurangnya 3 soalan dua langkah.`,
      struktur: `"soalan": [ { "no":1, "soalan":"...", "markah":2, "jawapan":"jawapan penuh yang diterima", "huraian":"skema pemarkahan ringkas" } ]
- Campurkan soalan 1 markah dan 2 markah.`,
      isiTempat: `"soalan": [ { "no":1, "soalan":"Ayat dengan ______ sebagai tempat kosong.", "jawapan":"perkataan", "huraian":"" } ]
- Sediakan juga "bankPerkataan": senarai semua jawapan dalam susunan rawak sebagai bantuan murid.`,
      padanan: `"soalan": [ { "no":1, "soalan":"item LAJUR KIRI", "jawapan":"item LAJUR KANAN yang sepadan", "huraian":"" } ]
- Ini latihan memadan DUA LAJUR. Murid melukis garisan dari kiri ke kanan.
- Lajur kiri dan lajur kanan mestilah PASANGAN PENDEK, bukan soalan dan ayat jawapan.
  BETUL  : kiri "kuku"        kanan "jari"
  BETUL  : kiri "batu"        kanan "nisan"
  BETUL  : kiri "Tulang"      kanan "Kalsium"
  SALAH  : kiri "Contoh bahan ketagihan yang disedut dan menghasilkan asap beracun"  kanan "Rokok"
- Setiap item maksimum 4 patah perkataan. Kalau lebih panjang, ia bukan padanan.
- Setiap jawapan mesti unik dan hanya sepadan dengan satu item kiri sahaja.`,
      gambarAyat: `"soalan": [ { "no":1, "emoji":"👦🎣🐟", "latar":"🌊", "perihal":"Seorang budak lelaki memancing ikan di tepi sungai.", "kataBantu":["memancing","sungai","ikan"], "jawapan":"Ali memancing ikan di tepi sungai.", "huraian":"" } ]
- "emoji" ialah 2 hingga 4 emoji yang disusun membentuk SATU PEMANDANGAN, bukan satu objek.
  Mulakan dengan watak (👦 👧 👨‍🌾 👩‍🏫 dsb), diikuti perbuatan atau alat, kemudian objek.
  Contoh baik: "👩‍🌾🥭🌳"  "👦🚲🏫"  "👧📚🪑"  "👨‍🍳🍲🔥"
- "latar" ialah SATU emoji latar belakang sahaja (🌊 🌳 🏫 🏠 ☀️ 🌾) atau "" jika tiada.
- "perihal" ialah keterangan gambar untuk rujukan guru, satu ayat sahaja.
- "kataBantu" ialah 3 perkataan panduan untuk murid bina ayat.
- "jawapan" ialah satu contoh ayat lengkap yang betul dari segi tatabahasa.
- Situasi mesti pelbagai, berkaitan tajuk pelajaran, dan mudah dikenali murid sekolah rendah.`
    }[ctx.jenis];

    return `${asas}

Jana TEPAT ${Math.max(10, ctx.bilangan)} soalan jenis: ${JENIS_LATIHAN[ctx.jenis].label}.
Bilangan minimum ialah 10 soalan. JANGAN pulangkan kurang daripada itu.

FORMAT JSON:
{
  "tajuk": "Tajuk lembaran kerja yang ringkas",
  "arahan": "Satu ayat arahan untuk murid",
  ${bentuk}
}`;
  }

  /* Permainan: AI hanya bekalkan perkataan + klu. Susun atur grid dibuat oleh aplikasi. */
  const had = ctx.jenis === 'silangKata' ? 10 : 12;
  return `${asas}

Jana istilah untuk permainan ${JENIS_LATIHAN[ctx.jenis].label} berdasarkan pelajaran di atas.

PERATURAN ISTILAH
- Antara 6 hingga ${had} perkataan.
- Setiap perkataan 3 hingga 11 huruf, SATU perkataan sahaja (tiada ruang, tiada tanda sempang).
- Huruf besar semua, tanpa tanda baca dan tanpa nombor.
- Perkataan mesti istilah sebenar daripada tajuk pelajaran ini, bukan perkataan am.
- Klu mesti pendek (bawah 12 patah perkataan) dan tidak menyebut perkataan jawapan itu sendiri.

FORMAT JSON:
{
  "tajuk": "Tajuk permainan",
  "arahan": "Satu ayat arahan untuk murid",
  "kata": [ { "perkataan":"JISIM", "klu":"Ukuran berat sesuatu objek" } ]
}`;
}

async function janaSoalanAI(ctx){
  const j = ambilJSON(await panggilAiSelamat(promptSoalan(ctx), null, ctx.lapor));
  j.jenis = ctx.jenis; j.aras = ctx.aras;

  if(ctx.jenis === 'silangKata' || ctx.jenis === 'cariKata'){
    const kata = (j.kata||[])
      .map(k => ({ perkataan: String(k.perkataan||'').toUpperCase().replace(/[^A-Z]/g,''),
                   klu: betulEjaan(k.klu||'') }))
      .filter(k => k.perkataan.length >= 3 && k.perkataan.length <= 11);
    if(kata.length < 4) throw new Error('AI tidak menghasilkan cukup perkataan yang sah');
    j.kata = kata;
    j.grid = ctx.jenis === 'silangKata' ? binaSilangKata(kata) : binaCariPerkataan(kata, ctx.aras);
  }else{
    if(ctx.jenis === 'padanan'){
      // Susunan lajur kanan dikocok supaya bukan sekadar sebaris dengan lajur kiri
      const jw = (j.soalan||[]).map(x => x.jawapan);
      const kocok = jw.slice().sort(() => Math.random() - .5);
      j.padananKanan = kocok;
    }
    if(ctx.jenis === 'gambarAyat') j.gambar = ctx.gambar || 'emoji';
    j.soalan = (j.soalan||[]).map((s,i) => ({ ...s, no:i+1,
      soalan: betulEjaan(s.soalan||''), huraian: betulEjaan(s.huraian||''),
      perihal: betulEjaan(s.perihal||''), jawapan: betulEjaan(s.jawapan||'') }));
    if(!j.soalan.length) throw new Error('AI tidak menghasilkan soalan');
    if(j.soalan.length < 10) j.amaran = `AI hanya menghasilkan ${j.soalan.length} soalan, bukan 10.`;
  }
  j.tajuk = betulEjaan(j.tajuk||''); j.arahan = betulEjaan(j.arahan||'');
  j.dijana = Date.now();

  // Pusingan semakan — hanya untuk latihan bertulis; permainan tiada jawapan berayat
  if(ctx.semak !== false && j.soalan?.length){
    if(ctx.lapor) ctx.lapor('AI menyemak jawapan…');
    try{ await semakSoalanAI(ctx, j); }
    catch(e){ j.semakanGagal = 'Semakan gagal: ' + e.message; }
  }
  return j;
}

/* ---------- Susun atur silang kata ---------- */
/* Perkataan pertama diletak mendatar di tengah, selebihnya disilang pada huruf
   yang sepadan. Perkataan yang tidak dapat disilang dengan sah akan digugurkan. */
function binaSilangKata(kata){
  /* Susunan perkataan menentukan berapa banyak yang berjaya disilang, jadi kita
     cuba banyak susunan dan simpan yang paling banyak berjaya diletak. */
  let terbaik = null;
  for(let cuba = 0; cuba < 60; cuba++){
    const susun = cuba === 0
      ? kata.slice().sort((a,b) => b.perkataan.length - a.perkataan.length)
      : kata.slice().sort(() => Math.random() - .5);
    const hasil = cubaSilangKata(susun);
    if(!terbaik || hasil.kunci.length > terbaik.kunci.length
       || (hasil.kunci.length === terbaik.kunci.length && hasil.luas < terbaik.luas))
      terbaik = hasil;
    if(terbaik.kunci.length === kata.length) break;
  }
  terbaik.gugur = kata.length - terbaik.kunci.length;
  return terbaik;
}

function cubaSilangKata(isih){
  const N = 21;
  const grid = Array.from({length:N}, () => Array(N).fill(null));
  const letak = [];

  const bolehLetak = (p, r, c, mendatar) => {
    let silang = 0;
    for(let i = 0; i < p.length; i++){
      const rr = mendatar ? r : r+i, cc = mendatar ? c+i : c;
      if(rr < 0 || cc < 0 || rr >= N || cc >= N) return -1;
      const ada = grid[rr][cc];
      if(ada){
        if(ada !== p[i]) return -1;
        silang++;
      }else{
        // jiran sisi mesti kosong supaya tiada perkataan tak sengaja
        const j1 = mendatar ? grid[rr-1]?.[cc] : grid[rr]?.[cc-1];
        const j2 = mendatar ? grid[rr+1]?.[cc] : grid[rr]?.[cc+1];
        if(j1 || j2) return -1;
      }
    }
    // hujung depan & belakang mesti kosong
    const sebelum = mendatar ? grid[r]?.[c-1] : grid[r-1]?.[c];
    const selepas = mendatar ? grid[r]?.[c+p.length] : grid[r+p.length]?.[c];
    if(sebelum || selepas) return -1;
    return silang;
  };
  const tulis = (p, r, c, mendatar) => {
    for(let i = 0; i < p.length; i++){
      if(mendatar) grid[r][c+i] = p[i]; else grid[r+i][c] = p[i];
    }
  };

  const pertama = isih[0].perkataan;
  const r0 = 10, c0 = Math.max(0, 10 - (pertama.length >> 1));
  tulis(pertama, r0, c0, true);
  letak.push({ ...isih[0], r:r0, c:c0, mendatar:true });

  for(const k of isih.slice(1)){
    let terbaik = null;
    for(let i = 0; i < k.perkataan.length; i++){
      for(const sedia of letak){
        for(let j = 0; j < sedia.perkataan.length; j++){
          if(sedia.perkataan[j] !== k.perkataan[i]) continue;
          const mendatar = !sedia.mendatar;
          const r = mendatar ? (sedia.mendatar ? sedia.r : sedia.r + j) : (sedia.mendatar ? sedia.r - i : sedia.r);
          const c = mendatar ? (sedia.mendatar ? sedia.c - i : sedia.c) : (sedia.mendatar ? sedia.c + j : sedia.c);
          const skor = bolehLetak(k.perkataan, r, c, mendatar);
          if(skor > 0 && (!terbaik || skor > terbaik.skor)) terbaik = { r, c, mendatar, skor };
        }
      }
    }
    if(terbaik){
      tulis(k.perkataan, terbaik.r, terbaik.c, terbaik.mendatar);
      letak.push({ ...k, r:terbaik.r, c:terbaik.c, mendatar:terbaik.mendatar });
    }
  }

  // potong grid kepada kawasan berisi sahaja
  let r1=N, r2=-1, c1=N, c2=-1;
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(grid[r][c]){
    r1=Math.min(r1,r); r2=Math.max(r2,r); c1=Math.min(c1,c); c2=Math.max(c2,c);
  }
  const sel = grid.slice(r1, r2+1).map(baris => baris.slice(c1, c2+1));
  const kunci = letak.map(k => ({ ...k, r:k.r-r1, c:k.c-c1 }))
    .sort((a,b) => a.r-b.r || a.c-b.c);
  // nombor petunjuk pada sel permulaan
  const nombor = {}; let n = 0;
  kunci.forEach(k => {
    const kk = k.r+','+k.c;
    if(!nombor[kk]) nombor[kk] = ++n;
    k.no = nombor[kk];
  });
  return { baris: selKeBaris(sel), lebar: sel[0].length, nombor, kunci,
           luas: sel.length * sel[0].length };
}

/* Firestore tidak menyokong array dalam array, jadi grid disimpan sebagai
   senarai baris teks. Titik '.' bermaksud petak kosong. */
function selKeBaris(sel){ return sel.map(b => b.map(c => c || '.').join('')); }
function barisKeSel(g){
  return (g?.baris || []).map(b => b.split('').map(ch => ch === '.' ? null : ch));
}

/* ---------- Susun atur cari perkataan ---------- */
/* Arah dihadkan mengikut aras. Murid sekolah rendah membaca kiri ke kanan dan
   atas ke bawah sahaja; perkataan songsang menjadikannya hampir mustahil dicari. */
function arahCariKata(aras){
  const kanan = [0,1], bawah = [1,0], serong = [1,1];
  if(aras === 'mudah') return [kanan, bawah];
  if(aras === 'kbat')  return [kanan, bawah, serong];
  return [kanan, bawah, serong];
}

function binaCariPerkataan(kata, aras){
  const ARAH = arahCariKata(aras);
  const panjang = Math.max(...kata.map(k => k.perkataan.length));
  const N = Math.min(16, Math.max(10, panjang + 3, Math.ceil(Math.sqrt(kata.length * 12))));
  const grid = Array.from({length:N}, () => Array(N).fill(null));
  const letak = [];

  for(const k of kata.slice().sort((a,b) => b.perkataan.length - a.perkataan.length)){
    const p = k.perkataan;
    let siap = false;
    for(let cuba = 0; cuba < 400 && !siap; cuba++){
      const [dr,dc] = ARAH[Math.floor(Math.random()*ARAH.length)];
      const r = Math.floor(Math.random()*N), c = Math.floor(Math.random()*N);
      const rAkhir = r + dr*(p.length-1), cAkhir = c + dc*(p.length-1);
      if(rAkhir<0||cAkhir<0||rAkhir>=N||cAkhir>=N) continue;
      let ok = true;
      for(let i=0;i<p.length;i++){
        const ada = grid[r+dr*i][c+dc*i];
        if(ada && ada !== p[i]){ ok = false; break; }
      }
      if(!ok) continue;
      for(let i=0;i<p.length;i++) grid[r+dr*i][c+dc*i] = p[i];
      letak.push({ ...k, r, c, dr, dc });
      siap = true;
    }
  }
  const HURUF = 'ABCDEFGHIJKLMNOPRSTUVW';
  for(let r=0;r<N;r++) for(let c=0;c<N;c++)
    if(!grid[r][c]) grid[r][c] = HURUF[Math.floor(Math.random()*HURUF.length)];
  return { baris: selKeBaris(grid), lebar: N, kunci: letak,
           gugur: kata.length - letak.length, arah: ARAH.length };
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
