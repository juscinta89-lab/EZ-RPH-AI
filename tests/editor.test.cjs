const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/rph.js','utf8');
const ai=fs.readFileSync(__dirname+'/../js/ai.js','utf8');
function setup(file=source){
 const elements=new Map(),timers=new Map();let nextTimer=0;
 const main={_html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=v;elements.delete('#semakanEditor');if(v.includes('id="semakanEditor"'))elements.set('#semakanEditor',{innerHTML:''});}};
 elements.set('#kandungan',main);elements.set('#subTajuk',{});
 const r={id:'r1',tarikh:'2026-09-06',subjek:'Matematik',kelas:'4A',mula:'08:00',tamat:'09:00',tempoh:60,objektif:['Mengenal pasti pecahan'],aktiviti:'Bincangkan pecahan',kriteria:['Menjawab soalan'],status:'draf'};
 const S={rph:[r],rpt:[],kelas:[],hal:'rph',editRphId:null};
 const c=vm.createContext({S,window:{},console:{error(){},warn(){}},Date,Set,Map,
  $:s=>elements.get(s),esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  tarikhCantik:s=>s,stripHtml:s=>String(s||'').replace(/<[^>]*>/g,''),norma:s=>String(s||'').toLowerCase(),noMinggu:s=>s,
  tutupModal:()=>{c.closed=true},toast:m=>{c.message=m},
  setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id),
  IK_KIRI:'',IK_KANAN:'',IK_LAGI:'',IK_SILANG:'',IK_TANDA:'',IKON_MATA:'',IKON_PENSEL:''});
 vm.runInContext(ai,c);vm.runInContext(file,c);
 c.stripHtml=s=>String(s||'').replace(/<[^>]*>/g,'');
 c.pergi=hal=>{S.hal=hal;if(hal==='editor')c.halEditor()};
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}};
 return {c,S,main,elements,flush};
}
test('one Edit call renders legacy array-valued RPH without mutating saved data',()=>{
 const {c,S,main,flush}=setup();const before=JSON.stringify(S.rph);
 c.bukaRph('r1');assert.match(main.innerHTML,/id="eTarikh"/);assert.match(main.innerHTML,/Mengenal pasti pecahan/);assert.equal(c.closed,true);
 flush();assert.equal(JSON.stringify(S.rph),before);assert.equal(S.hal,'editor');
});
test('quality checker failure cannot prevent opening or remove the form',()=>{
 const {c,main,elements,flush}=setup();c.semakKualiti=()=>{throw new Error('Malformed imported standard')};
 c.bukaRph('r1');assert.match(main.innerHTML,/id="eAktiviti"/);flush();assert.match(elements.get('#semakanEditor').innerHTML,/belum tersedia/);assert.match(main.innerHTML,/id="eTarikh"/);
});
test('opening another RPH cancels earlier audit and keeps current record',()=>{
 const {c,S,elements,flush}=setup();S.rph.push({...S.rph[0],id:'r2',tajuk:'RPH kedua'});let checked=[];c.semakKualiti=r=>{checked.push(r.id);return {peratus:100,cek:[]}};
 c.bukaRph('r1');c.bukaRph('r2');flush();assert.deepEqual(checked,['r2']);assert.equal(S.editRphId,'r2');assert.match(elements.get('#semakanEditor').innerHTML,/100%/);
});
test('navigating away prevents deferred audit from overwriting next page',()=>{
 const {c,S,main,flush}=setup();c.semakKualiti=()=>{throw new Error('must not run')};c.bukaRph('r1');S.hal='rph';main.innerHTML='Senarai';flush();assert.equal(main.innerHTML,'Senarai');
});
test('missing record reports error and preserves existing screen',()=>{
 const {c,S,main}=setup();main.innerHTML='Senarai';c.bukaRph('missing');assert.match(c.message,/tidak dijumpai/);assert.equal(main.innerHTML,'Senarai');assert.equal(S.hal,'rph');
});
test('unexpected render exception gives visible recovery action',()=>{
 const {c,main}=setup();c.halEditor=()=>{throw new Error('fail')};c.bukaRph('r1');assert.match(main.innerHTML,/role="alert"/);assert.match(main.innerHTML,/Kembali ke RPH Saya/);
});
test('single Edit button handler opens form',()=>{
 const {c,S,main}=setup();const html=c.barisRph(S.rph[0]);const handler=html.match(/aria-label="Edit RPH"\s+onclick="([^"]+)"/)[1];c.event={stopPropagation(){}};vm.runInContext(handler,c);assert.match(main.innerHTML,/id="eTarikh"/);
});
test('selected RPT replaces old topic and drives regeneration',async()=>{
 const {c,S,elements}=setup();
 S.editRphId='r1';S.rph[0].subjek='Bahasa Inggeris';S.rph[0].tahun='Tahun 4';S.rph[0].tajuk='Old Animals';
 const ids=['eKodSk','eSk','eKodSp','eSp','eTp','eTajuk','eTema','eMinggu','eObjektif','eKriteria','ePenutup','ePemulihan','ePengayaan','eStrategi','ePak21','eKbat','eEmk','eNilai','eBbm','ePentaksiran','eAktiviti'];
 ids.forEach(id=>elements.set('#'+id,{value:'',innerHTML:''}));
 elements.get('#eMinggu').value='Minggu 10';
 const chosen={minggu:'Minggu 8',tahun:'Tahun 4',tajuk:'Where Are You From?',tema:'World of Self, Family and Friends',kodSk:'1.2',sk:'Understand meaning in familiar contexts',kodSp:'1.2.2',sp:'Understand with support specific information and details of longer simple texts'};
 c.window._rptPilih=[chosen];
 c.pakaiRpt(0);
 assert.equal(elements.get('#eTajuk').value,chosen.tajuk);
 assert.equal(elements.get('#eTema').value,chosen.tema);
 let received;
 c.bacaEditor=()=>({subjek:'Bahasa Inggeris',tarikh:'2026-09-06',kelas:'4A',tahun:'Tahun 4',minggu:'Minggu 10',mula:'08:00',tamat:'09:00',tempoh:60,
  tajuk:elements.get('#eTajuk').value,tema:elements.get('#eTema').value,kodSk:elements.get('#eKodSk').value,sk:elements.get('#eSk').value,kodSp:elements.get('#eKodSp').value,sp:elements.get('#eSp').value,tp:elements.get('#eTp').value});
 c.sibuk=()=>{};c.sahkan=(_message,fn)=>{c.confirmPromise=fn()};
 c.janaRphAI=async ctx=>{received=ctx;return {tajuk:ctx.tajuk,tema:ctx.rptFokus.tema,kodSk:ctx.rptFokus.kodSk,sk:ctx.rptFokus.sk,kodSp:ctx.rptFokus.kodSp,sp:ctx.rptFokus.sp,objektif:'Identify 3 countries',kriteria:'Name 3 countries',aktiviti:'<p>Pre-lesson</p>'}};
 await c.janaDariStandard();await c.confirmPromise;
 assert.equal(received.tajuk,chosen.tajuk);
 assert.equal(received.tajukAsal,'Old Animals');
 assert.equal(received.rptManual,false);
 assert.equal(received.rptMingguAsal,'Minggu 8');
 assert.equal(received.rptFokus.kodSp,'1.2.2');
 assert.equal(elements.get('#eObjektif').value,'Identify 3 countries');
 assert.equal(c.window._stdManual,false);
});
test('RPT picker excludes a different year and accepts equivalent year labels',async()=>{
 const {c,S,elements}=setup();S.editRphId='r1';S.rph[0].tahun='Tahun 4';
 elements.set('#eSubjek',{value:'Bahasa Inggeris'});elements.set('#eMinggu',{value:'Minggu 8'});elements.set('#eKelas',{value:'4A'});
 const rows=[{tahun:'4',minggu:'Minggu 8',tajuk:'My Week'},{tahun:'Tahun 5',minggu:'Minggu 8',tajuk:'Free Time'}];
 c.rptUntuk=()=>({semua:rows});c.modal=(_title,html)=>{c.pickerHtml=html};
 await c.pilihRpt();
 assert.match(c.pickerHtml,/My Week/);
 assert.doesNotMatch(c.pickerHtml,/Free Time/);
});
test('English editor shows English lesson field labels',()=>{
 const {c,S,main}=setup();S.rph[0].subjek='Bahasa Inggeris';S.rph[0].minggu='Minggu 8';
 c.bukaRph('r1');
 assert.match(main.innerHTML,/Learning objectives/);
 assert.match(main.innerHTML,/Success criteria/);
 assert.match(main.innerHTML,/Learning activities/);
 assert.match(main.innerHTML,/value="Week 8"/);
 assert.doesNotMatch(main.innerHTML,/Objektif pembelajaran <em>/);
});
