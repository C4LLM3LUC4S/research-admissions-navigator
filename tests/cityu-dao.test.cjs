'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../data/catalog.json'),P=require('../data/research/cityu-dao-census-20261028.json'),L=require('../dist/logic.js');
const old=require('../data/snapshots/2e3ad63bcdd5ec6457293679bf408499b603a0b2845af9ee2f753ba586052b86.json');
const profile=q=>({...L.defaultProfile(C),universityIds:['cityu'],researchQuery:q});
test('three observed DAO categories retain all49 identities and16 unresolved research leads',()=>{
 assert.deepEqual(P.staffEntries.map(e=>e.profileLeads.length),[29,7,13]);
 const leads=P.staffEntries.flatMap(e=>e.profileLeads);
 assert.equal(new Set(leads.map(e=>e.url)).size,49);assert.equal(leads.filter(e=>e.facultyId).length,33);
 assert.equal(leads.filter(e=>e.profileBodyStatus==='body_read').length,43);
 assert.equal(leads.filter(e=>!e.facultyId).length,16);
 assert.ok(leads.every(e=>/^(Prof\.|Dr\.|Ms\.|Mr\.|Miss )/.test(e.name)));
 assert.equal(P.directories[0].coverageComplete,false);assert.match(P.directories[0].coverageNotes,/杰出访问教授入口未读到/);
});
test('web-reader text receipts do not pretend to be raw HTTP bodies',()=>{
 for(const r of [...P.sources,...P.staffEntries.flatMap(e=>e.profileLeads).filter(e=>e.profileBodyStatus==='body_read')]){
  assert.equal(r.readMethod,'web_reader');assert.equal(r.receiptKind,'web_reader_returned_text');
  assert.match(r.readReceiptSha256,/^[a-f0-9]{64}$/);assert.equal(r.bodySha256,undefined);
 }
});
test('all old identities, sources, dates and programme rules survive unchanged',()=>{
 for(const key of ['faculty','programs','sources'])for(const r of old[key])assert.deepEqual(C[key].find(n=>n.id===r.id),r,r.id);
 assert.equal(C.faculty.length,1056);assert.equal(C.programs.length,34);
 assert.ok(!C.programs.some(p=>p.id==='cityu-dao-rpg'));
});
test('Chinese research terms lead to corresponding reviewed statements',()=>{
 for(const [q,id] of [['经验贝叶斯','lilundu'],['供应链韧性','czhan34'],['排队经济学','jwang657'],['强化学习','jydong7'],['教育评估','cmfrayue']])
  assert.ok(L.facultyFor(C,profile(q)).some(f=>f.id==='cityu-dao-'+id),q);
 assert.ok(!L.facultyFor(C,profile('Index')).some(f=>f.id==='cityu-dao-msycchan'));
});
test('teaching, visiting and assistant labels never imply supervision or an intake',()=>{
 const f=id=>P.faculty.find(f=>f.id==='cityu-dao-'+id);
 assert.equal(f('yzhan273').directoryRole,'兼任、荣誉与访问');assert.equal(f('mssallyt').directoryRole,'教学与助教');
 for(const r of P.faculty){assert.equal(r.availability.state,'unknown');assert.equal(r.availability.cycle,null);assert.match(r.identityNote,/不等于已确认/);}
 assert.match(f('swhshum').applicationNotes[0].text,/Interim Dean/);
});
test('personal links remain exact and qualification conflicts do not become school policy',()=>{
 const du=P.faculty.find(f=>f.id==='cityu-dao-lilundu');
 assert.ok(du.extraLinks.some(l=>l.url==='https://github.com/dulilun'&&l.bodyStatus==='body_read'));
 assert.match(du.applicationNotes[0].text,/未注明年度/);assert.match(du.applicationNotes[0].text,/不能择低值/);
 assert.ok(du.applicationNotes[0].sourceIds.includes('cityu-dao-undated-admission-20261028'));
 const he=P.faculty.find(f=>f.id==='cityu-dao-jingyuhe');assert.equal(he.extraLinks[0].url,'http://www.jingyuhe.com');assert.equal(he.extraLinks[0].bodyStatus,'not_read');
 const tongue=P.faculty.find(f=>f.id==='cityu-dao-twang533');assert.match(tongue.applicationNotes[0].text,/不能直接当作2027/);
});
test('new and old favourites, task and Chinese query survive a portable backup',()=>{
 const state={profile:profile('供应链韧性'),shortlist:['cityu-jun-wang','cityu-dao-czhan34'],tasks:[{id:'task-dao',text:'先核对具体研究学位、轮次和指导资格',done:false,programId:null,facultyId:'cityu-dao-czhan34'}]};
 const file=L.portable(C,state),restored=L.parsePortable(JSON.stringify(file),C);
 assert.deepEqual(restored.shortlist,state.shortlist);assert.equal(restored.profile.researchQuery,'供应链韧性');assert.equal(restored.tasks[0].facultyId,'cityu-dao-czhan34');
});
