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

test('English RPH uses its own English prompt and system instruction', async () => {
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
  assert.match(calls[0].prompt,/Create one complete Malaysian KPM English daily lesson plan/);
  assert.match(calls[0].prompt,/Pre-lesson \/ Lesson development \/ Post-lesson/);
  assert.doesNotMatch(calls[0].prompt,/Set Induksi \(5 minit\)|Setiap item bermula dengan kata kerja:/);
  assert.match(calls[0].system,/entire English lesson plan in English/);
  assert.equal(r.hari,'Wednesday');
  c.rptUntuk=()=>({minggu:[{tajuk:'Old Week Topic',kodSp:'9.9'}],sekitar:[]});
  const selected=c.promptRph({...sample('Bahasa Inggeris'),tajuk:'Amazing Animals',
    rptFokus:{tajuk:'Amazing Animals',kodSp:'1.2.2',sp:'Understand with support specific information and details of longer simple texts'},rptMingguAsal:'Minggu 8'});
  assert.match(selected,/Amazing Animals/);
  assert.match(selected,/1\.2\.2/);
  assert.doesNotMatch(selected,/Old Week Topic|9\.9/);
  await c.janaRphAI({...sample('Bahasa Melayu'),lapor:()=>{}});
  assert.doesNotMatch(calls[1].prompt,/Create one complete Malaysian KPM English daily lesson plan/);
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

test('mixed Malay objectives are corrected before an English RPH is returned', async () => {
  const calls=[];
  const c=vm.createContext({
    console,setTimeout,clearTimeout,AbortController,
    localStorage:{getItem:()=>null,setItem:()=>{}},
    S:{user:{email:'teacher@test'},profil:{nama:'Teacher'},kelas:[],buku:[],rph:[],tetapanAI:{}},
    namaHari:()=> 'Rabu',norma:x=>String(x||'').toLowerCase(),
    rptUntuk:()=>({minggu:[],sekitar:[]})
  });
  vm.runInContext(read('ai.js'),c);
  c.panggilAiSelamat=async (prompt,system)=>{
    calls.push({prompt,system});
    return JSON.stringify(calls.length===1
      ? {tajuk:'Amazing Animals',objektif:['Mengenal pasti 4 animals'],aktiviti:'<p>Set Induction (5 minutes)</p>'}
      : {tajuk:'Amazing Animals',objektif:['Identify 4 animals'],aktiviti:'<p>Pre-lesson (5 minutes)</p>'});
  };
  const focus={tajuk:'Amazing Animals',kodSk:'1.2',kodSp:'1.2.2',
    sk:'Understand meaning in a variety of familiar contexts',
    sp:'Understand with support specific information and details of longer simple texts'};
  const result=await c.janaRphAI({...sample('Bahasa Inggeris'),tajuk:focus.tajuk,rptFokus:focus});
  assert.equal(calls.length,2);
  assert.match(calls[1].prompt,/Rewrite ONLY the Malay-language wording/);
  assert.equal(result.objektif,'Identify 4 animals');
  assert.equal(result.kodSp,'1.2.2');
  assert.equal(result.sp,focus.sp);
});

test('old topic is regenerated and cannot be saved again', async () => {
  const c=vm.createContext({
    console,setTimeout,clearTimeout,AbortController,
    localStorage:{getItem:()=>null,setItem:()=>{}},
    S:{user:{email:'teacher@test'},profil:{nama:'Teacher'},kelas:[],buku:[],rph:[],tetapanAI:{}},
    namaHari:()=> 'Rabu',norma:x=>String(x||'').toLowerCase(),
    rptUntuk:()=>({minggu:[],sekitar:[]})
  });
  vm.runInContext(read('ai.js'),c);
  let n=0;
  c.panggilAiSelamat=async ()=>JSON.stringify({tajuk:++n===1?'Old Topic':'New Topic',
    objektif:['Identify 3 ideas'],aktiviti:'<p>Pre-lesson (5 minutes)</p>'});
  const result=await c.janaRphAI({...sample('English'),tajuk:'New Topic',tajukAsal:'Old Topic'});
  assert.equal(n,2);
  assert.equal(result.tajuk,'New Topic');
  c.panggilAiSelamat=async ()=>JSON.stringify({tajuk:'Old Topic',
    objektif:['Identify 3 ideas'],aktiviti:'<p>Pre-lesson (5 minutes)</p>'});
  await assert.rejects(c.janaRphAI({...sample('English'),tajuk:'New Topic',tajukAsal:'Old Topic'}),/masih mengulang tajuk lama/);
  let requests=0;
  c.panggilAiSelamat=async ()=>JSON.stringify(++requests===1
    ? {tajuk:'New Topic',objektif:['Describe 3 animals'],aktiviti:'<p>Pre-lesson (5 minutes)</p>'}
    : {tajuk:'New Topic',objektif:['Describe 3 countries'],aktiviti:'<p>Pre-lesson (5 minutes)</p>'});
  const changed=await c.janaRphAI({...sample('English'),tajuk:'New Topic',tajukAsal:'Amazing Animals'});
  assert.equal(requests,2);
  assert.equal(changed.objektif,'Describe 3 countries');
});
