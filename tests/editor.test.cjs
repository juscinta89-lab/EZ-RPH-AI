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
