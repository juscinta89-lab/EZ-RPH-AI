const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname,'..','js',name),'utf8');
const sample = subjek => ({
  subjek, tarikh:'2026-09-23', minggu:'Minggu 12', tahun:'Tahun 4', kelas:'4 Amanah',
  mula:'08:00', tamat:'09:00', tempoh:60, tajuk:'Reading Comprehension',
  objektif:'Identify 3 main ideas', kriteria:'Identify 3 main ideas correctly',
  aktiviti:'<p>Set Induction (5 minutes)</p><p>Step 1 (20 minutes)</p>',
  refleksi:'', nilai:'Cooperation'
});

test('English RPH prompt and system instruction override Malay defaults', async () => {
  const calls = [];
  const c = vm.createContext({
    console, setTimeout, clearTimeout, AbortController,
    localStorage:{getItem:()=>null,setItem:()=>{}},
    S:{user:{email:'teacher@test'},profil:{nama:'Teacher'},kelas:[],buku:[],rph:[],tetapanAI:{}},
    namaHari:()=> 'Rabu', norma:x=>String(x||'').toLowerCase(),
    rptUntuk:()=>({minggu:[],sekitar:[]})
  });
  vm.runInContext(read('ai.js'),c);
  c.panggilAiSelamat = async (prompt,system) => {
    calls.push({prompt,system});
    return JSON.stringify({objektif:['Identify 3 ideas'],aktiviti:'<p>Step 1 (60 minutes)</p>',tajuk:'Reading'});
  };
  const r = await c.janaRphAI({...sample('Bahasa Inggeris'),lapor:()=>{}});
  assert.match(calls[0].prompt,/OVERRIDING LANGUAGE REQUIREMENT FOR ENGLISH LESSONS/);
  assert.match(calls[0].system,/entire English lesson plan in English/);
  assert.equal(r.hari,'Wednesday');
  await c.janaRphAI({...sample('Bahasa Melayu'),lapor:()=>{}});
  assert.doesNotMatch(calls[1].prompt,/OVERRIDING LANGUAGE REQUIREMENT/);
  assert.equal(calls[1].system,null);
});

test('both RPH print layouts localize English labels and dates', () => {
  const c = vm.createContext({
    console, window:{}, localStorage:{getItem:()=>null},
    S:{kelas:[],profil:{nama:'Teacher'},sekolah:{nama:'School'},logo:''},
    rphBahasaInggeris:s=>/^(?:bahasa\s+inggeris|english|bi)(?:\s|$)/i.test(String(s||'')),
    tarikhCantik:()=> 'Rabu, 23 September 2026', namaHari:()=> 'Rabu',
    mingguUntuk:()=> 'Minggu 12', minit:()=>60,
    norma:x=>String(x||'').toLowerCase(),
    esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
    tandatanganSaya:()=>''
  });
  vm.runInContext(read('rph.js'),c);
  const en = sample('Bahasa Inggeris');
  const full = c.htmlRph(en,true);
  const compact = c.kepalaHariRph(en)+c.htmlRphPadat(en,1)+c.semakanHari(en);
  for(const output of [full,compact]){
    assert.match(output,/DAILY LESSON PLAN/);
    assert.match(output,/Wednesday, 23 September 2026/);
    assert.match(output,/LEARNING OBJECTIVES/);
    assert.match(output,/SUCCESS CRITERIA/);
    assert.match(output,/REVIEW/);
    assert.doesNotMatch(output,/RANCANGAN PENGAJARAN HARIAN|MINGGU|TARIKH|Nilai Murni|murid dapat/);
  }
  const bm = c.htmlRphPadat(sample('Bahasa Melayu'),1);
  assert.match(bm,/RANCANGAN PENGAJARAN HARIAN/);
  assert.match(bm,/Murid berjaya/);
  let printed = '';
  c.keluarkanCetak = html => { printed = html; };
  c.cetakBanyak([en,sample('Bahasa Melayu')]);
  assert.equal((printed.match(/DAILY LESSON PLAN/g)||[]).length,2);
  assert.equal((printed.match(/RANCANGAN PENGAJARAN HARIAN/g)||[]).length,2);
  assert.match(printed,/Prepared by/);
});
