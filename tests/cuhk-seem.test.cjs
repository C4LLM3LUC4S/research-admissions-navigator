'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/cuhk-seem-census-20261028.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/efed3de25c92f9a0eb2074222c9ec081348710ff6a6bcb9e8993e5e862315029.json');
const profile=(q,degree='PhD')=>({...L.defaultProfile(C),degree,universityIds:['cuhk'],researchQuery:q});

test('SEEM keeps980 prior records, cross-department IDs and the person without a research statement',()=>{
 for(const f of old.faculty)assert.deepEqual(C.faculty.find(x=>x.id===f.id),f);
 for(const p of old.programs)assert.deepEqual(C.programs.find(x=>x.id===p.id),p);
 assert.equal(P.faculty.length,33);assert.deepEqual(P.staffEntries.map(x=>x.profileLeads.length),[24,1,11]);
 const all=P.staffEntries.flatMap(x=>x.profileLeads);
 assert.equal(all.find(x=>x.name.includes('CHENG, Hong')).facultyId,'cuhk-cse-census-004');
 assert.equal(all.find(x=>x.name.includes('LEE, Ho Man')).facultyId,'cuhk-cse-census-027');
 const chan=all.find(x=>x.name.includes('CHAN, Chun Kwong'));assert.equal(chan.facultyId,null);assert.equal(chan.profileBodyStatus,'body_read');
 assert.ok(P.directories.every(x=>x.coverageComplete===false));
 assert.ok(P.faculty.every(x=>x.availability.state==='unknown'&&x.availability.cycle===null));
 assert.match(P.faculty.find(x=>x.id==='cuhk-seem-32').identityNote,/荣休|荣誉菜单/);
});

test('a source-bound observed HTTPS return makes the original HTTP personal link usable without guessing',()=>{
 const f=P.faculty.find(x=>x.id==='cuhk-seem-01'),original=f.extraLinks.find(x=>x.url.startsWith('http:'));
 assert.ok(original);assert.equal(original.url,'http://www1.se.cuhk.edu.hk/~nchenweb/');
 assert.ok(L.facultyLinks(C,f).some(x=>x.url==='https://www1.se.cuhk.edu.hk/~nchenweb/'));
 const source=C.sources.find(s=>s.id===original.sourceId);assert.equal(source.originalUrl,original.url);assert.equal(source.retrievedUrl,source.url);
 for(const change of [s=>s.originalUrl='http://another.example/',s=>s.parentSourceId='another-person',s=>s.retrievedUrl='https://wrong.example/',s=>s.url=s.retrievedUrl='javascript:alert(1)']){
  const altered=structuredClone(C),s=altered.sources.find(x=>x.id===source.id);change(s);
  assert.ok(!L.facultyLinks(altered,f).some(x=>x.url==='https://www1.se.cuhk.edu.hk/~nchenweb/'));
 }
 const pending=structuredClone(f);pending.extraLinks[0].bodyStatus='not_read';assert.equal(L.facultyLinks(C,pending).length,0);
 const guessed=structuredClone(f);guessed.extraLinks[0].sourceId='nonexistent';assert.equal(L.facultyLinks(C,guessed).length,0);
 const nguyen=P.faculty.find(x=>x.id==='cuhk-seem-16'),target=C.sources.find(s=>s.id===nguyen.extraLinks[0].sourceId);
 assert.equal(L.sourceUrl(C,target),'https://www.vietanhnguyen.net/');
});

test('SEEM ordinary dates do not borrow HKPFS times or expose PhD routes for MPhil',()=>{
 const p=P.programmes[0],u=C.universities.find(x=>x.id==='cuhk');
 const phd=L.deadlinesFor(p,profile(''),u),mphil=L.deadlinesFor(p,profile('','MPhil'),u);
 assert.equal(phd.length,4);assert.equal(mphil.length,2);assert.ok(mphil.every(d=>d.at===null));
 assert.deepEqual(phd.filter(d=>d.route==='HKPFS').map(d=>d.at),['2026-12-01T12:00:00+08:00','2026-12-01T23:59:00+08:00']);
 assert.match(p.selection.text,/面试会早于申请截止/);assert.equal(p.contact.status,'unknown');assert.match(p.requirements[0].text,/研究型硕士.*优秀本科/);
 assert.ok(L.requirementsFor(p,profile('')).some(x=>x.text.includes('三份推荐')));
 assert.ok(!L.requirementsFor(p,profile('','MPhil')).some(x=>x.text.includes('三份推荐')));
 const stipend=p.finances.find(x=>x.kind==='studentship'),rates=L.financeRates(stipend,profile(''));
 assert.equal(rates.matched.length,0);assert.deepEqual(rates.reference.map(x=>x.cycle),['2026/27','2025/26']);
 assert.equal(p.finances.find(x=>x.kind==='tuition').rates[0].value,49500);
});

test('specific research queries lead to reviewed records and a portable follow-up',()=>{
 for(const [q,id] of [['共享单车','cuhk-seem-05'],['收益管理','cuhk-seem-26'],['多模态医疗','cuhk-seem-18'],['检索增强生成','cuhk-seem-19']]){
  assert.ok(L.facultyFor(C,profile(q)).some(x=>x.id===id),q);
  const state={profile:profile(q),shortlist:[id],tasks:[{id:'task-seem-follow-up',text:'核研究问题与项目，准备原材料',done:false,facultyId:id,programId:'cuhk-seem-rpg'}]};
  const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,[id]);assert.equal(restored.profile.researchQuery,q);assert.equal(restored.tasks[0].programId,'cuhk-seem-rpg');
 }
});

test('a published teacher notice is scoped to its stated PhD intake and keeps capacity unknown',()=>{
 const f=P.faculty.find(x=>x.id==='cuhk-seem-18'),n=f.applicationNotes[0];
 assert.deepEqual(n.degrees,['PhD']);assert.match(n.text,/2027秋季博士/);assert.match(n.text,/取决于研究契合、资助与院系录取流程/);assert.match(n.text,/不是实时剩余名额/);
 assert.equal(f.availability.state,'unknown');assert.ok(n.sourceIds.every(id=>C.sources.find(s=>s.id===id).evidenceLevel==='teacher_page_linked_from_official_profile'));
 const fee=P.programmes[0].finances.find(x=>x.kind==='application_fee').rates[0];assert.equal(fee.cycle,null);assert.equal(fee.basis,'page_reference');
});
