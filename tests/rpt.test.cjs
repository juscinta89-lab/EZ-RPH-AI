const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('RPT matching accepts Year 4 / Tahun 4 / 4 without mixing Year 5',async()=>{
  const rows=[
    {subjek:'Bahasa Inggeris',tahun:'4',minggu:'Minggu 8',tajuk:'My Week'},
    {subjek:'Bahasa Inggeris',tahun:'Tahun 5',minggu:'Week 8',tajuk:'Free Time'}
  ];
  const c=vm.createContext({S:{rpt:rows},norma:x=>String(x||'').trim().toLowerCase()});
  vm.runInContext(fs.readFileSync(__dirname+'/../js/data.js','utf8'),c);
  assert.equal(c.rptUntuk('Bahasa Inggeris','Tahun 4','Week 8').minggu[0].tajuk,'My Week');
  assert.equal(c.rptUntuk('Bahasa Inggeris','Year 5','Minggu 8').minggu[0].tajuk,'Free Time');
  assert.equal((await c.muatRptSubjek('Bahasa Inggeris','Tahun 4')).length,1);
});
