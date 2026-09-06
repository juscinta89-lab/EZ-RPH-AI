const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function env(fetch){
 const data=new Map([['erph_ai',JSON.stringify({prov:'openai',key:'primary',model:'test'})]]);
 const c=vm.createContext({fetch,AbortController,setTimeout,clearTimeout,console,location:{origin:'https://test.local'},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},tetapanAI:()=>JSON.parse(data.get('erph_ai')),S:{user:{email:'teacher@test'},profil:{nama:'Guru'}},namaHari:()=> 'Isnin'});
 vm.runInContext(fs.readFileSync(__dirname+'/../js/ai.js','utf8'),c);return {c,data};
}
const response=(body,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(body)});
test('fallback does not mutate primary credentials',async()=>{
 const {c,data}=env(async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer backup');assert.match(url,/groq/);return response({choices:[{message:{content:'Berjaya'}}]});});
 assert.equal(await c.panggilAiPenyedia({prov:'groq',key:'backup',model:'test'},'hello'),'Berjaya');assert.equal(JSON.parse(data.get('erph_ai')).key,'primary');
});
test('HTTP status remains available for retry detection',async()=>{
 const {c}=env(async()=>response({error:{message:'Busy'}},429));await assert.rejects(c.panggilAI('hello'),/429/);
});
test('empty and truncated results are rejected',()=>{const {c}=env();assert.throws(()=>c.teksAiSah(''),/jawapan/);assert.throws(()=>c.teksAiSah('partial','length'),/terpotong/);});
test('timeouts abort stalled network requests',async()=>{const {c}=env((u,o)=>new Promise((r,reject)=>o.signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'})))));await assert.rejects(c.fetchAi('test',{},5),/terlalu lama/);});
test('malformed provider data has actionable error',async()=>{const {c}=env(async()=>({ok:false,status:502,text:async()=>'<html>Bad gateway</html>'}));await assert.rejects(c.panggilAI('hello'),/502.*JSON/);});
test('corrupt rate settings recover safely',()=>{const {c,data}=env();data.set('erph_kadar','broken');assert.equal(c.tetapanKadar().rpm,12);data.set('erph_kadar','{"cubaan":-2,"rpm":-5}');assert.equal(c.tetapanKadar().cubaan,1);assert.equal(c.tetapanKadar().rpm,1);});
test('string objectives accepted and incomplete RPH rejected',async()=>{const {c}=env();c.promptRph=()=>'';c.panggilAiSelamat=async()=>JSON.stringify({objektif:'Satu\nDua',kriteria:'Tepat',aktiviti:'Aktiviti kelas',amaran:'Semak'});const r=await c.janaRphAI({});assert.equal(r.objektif,'Satu\nDua');assert.equal(r.amaran,'Semak');c.panggilAiSelamat=async()=>'{"objektif":[]}';await assert.rejects(c.janaRphAI({}),/tidak lengkap/);});
