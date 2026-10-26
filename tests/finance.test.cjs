'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),L=require('../dist/logic.js');
const C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
const program=id=>C.programs.find(p=>p.id===id);
const profile=(degree,cycle)=>({...L.defaultProfile(C),degree,cycle});

test('CIE has its own two-referee and English-form rules rather than inheriting Hong Kong requirements',()=>{
  const cie=L.requirementsFor(program('cuhksz-sse-cie'),profile('PhD',C.cycle));
  assert.match(cie.find(i=>i.label.includes('推荐人')).text,/不能把意向导师列作这两位之一/);
  const english=cie.find(i=>i.label.startsWith('英语'));
  assert.match(english.text,/含Home Edition/);assert.ok(english.sourceIds.includes('cuhksz-cie'));
  assert.ok(cie.every(i=>!i.sourceIds.some(id=>id.startsWith('cuhk-gs'))));
  const hk=L.requirementsFor(program('cuhk-cse-rpg'),profile('PhD',C.cycle));
  assert.match(hk.find(i=>i.label.startsWith('博士：')).text,/三份/);
  assert.doesNotMatch(L.requirementsFor(program('cuhksz-sse-cie'),profile('MPhil',C.cycle)).map(i=>i.label).join(' '),/博士：/);
});

test('a previous academic-year studentship is not promoted to the selected new intake amount',()=>{
  const aid=program('cuhk-cse-rpg').finances.find(i=>i.kind==='studentship');
  assert.equal(L.financeRates(aid,profile('MPhil','2027/28')).matched.length,0);
  assert.equal(L.financeRates(aid,profile('PhD','2026/27 Spring')).matched[0].value,229200);
  assert.match(L.financeRateText(aid.rates[0]),/2026\/27学年/);
});

test('Guangzhou 2027 intake tuition cannot leak to the earlier spring intake or erase PGS conditions',()=>{
  const tuition=program('hkust-gz-phd-entry').finances.find(i=>i.kind==='tuition');
  const fall=L.financeRates(tuition,profile('PhD','2027/28'));
  assert.equal(fall.matched.length,1);assert.equal(fall.matched[0].value,60000);assert.match(fall.matched[0].condition,/有PGS/);
  const spring=L.financeRates(tuition,profile('PhD','2026/27 Spring'));
  assert.equal(spring.matched.length,0);assert.ok(spring.reference.some(r=>r.value===40000));
  assert.match(L.financeRateText(spring.reference.find(r=>r.value===150000)),/未注明轮次.*自费/);
  assert.equal(L.financeRates(tuition,profile('PhD','')).matched.length,0);
});

test('currency and monthly, yearly, academic-year and application units are kept without net-cost calculation',()=>{
  const gz=program('hkust-gz-phd-entry').finances.find(i=>i.kind==='studentship');
  assert.match(L.financeRateText(gz.rates[0]),/CNY 15,000 \/ 月/);
  assert.equal(L.financeRates(gz,profile('PhD',C.cycle)).matched.length,0);
  const rbm=program('hkust-gz-rbm').finances.find(i=>i.kind==='studentship');
  assert.match(L.financeRateText(rbm.rates[0]),/CNY 120,000 \/ 年/);
  const fee=program('cuhksz-sse-cie').finances[0];assert.match(L.financeRateText(fee.rates[0]),/CNY 600 \/ 次申请/);
  const hk=program('cuhk-cse-rpg').finances.find(i=>i.kind==='tuition');assert.match(L.financeRateText(hk.rates[0]),/HKD 49,500 \/ 学年/);
  assert.deepEqual(L.financesFor({finances:[gz]},profile('MPhil',C.cycle)),[]);
});

test('programme studentships support MPhil without weakening the separate HKPFS campus and degree contract',()=>{
  for(const id of ['cuhk-cse-rpg','hkust-gz-rbm'])assert.ok(L.financesFor(program(id),profile('MPhil',C.cycle)).some(i=>i.kind==='studentship'));
  assert.equal(L.fundingFor(C,profile('MPhil',C.cycle)).length,0);
  assert.equal(L.fundingFor(C,{...profile('PhD',C.cycle),universityIds:['cuhksz','hkustgz']}).length,0);
  assert.equal(L.fundingFor(C,{...profile('PhD',C.cycle),universityIds:['cuhk']}).length,1);
});
