'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hku-dase-census-20261028.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/94495ca73081619fb2db1979a60c6c141147da353b0d3afd5d0d423494101e86.json');
const profile=q=>({...L.defaultProfile(C),degree:'PhD',universityIds:['hku'],researchQuery:q});

test('DASE preserves the prior959 records, one existing ID and the limits of both staff lists',()=>{
 for(const f of old.faculty)assert.deepEqual(C.faculty.find(x=>x.id===f.id),f);
 for(const p of old.programs)assert.deepEqual(C.programs.find(x=>x.id===p.id),p);
 assert.equal(P.faculty.length,21);assert.equal(P.staffEntries[0].profileLeads.length,22);
 assert.equal(P.staffEntries[0].profileLeads.find(x=>x.name==='N. Xi').facultyId,'wide-hku-ning-xi');
 assert.equal(C.faculty.filter(x=>x.profileUrl==='https://www.dase.hku.hk/people/n-xi').length,1);
 assert.equal(P.unlinkedAcademic[0].name,'Bill K.P. Chan');assert.equal(P.unlinkedAcademic[0].profileUrl,null);
 assert.equal(P.counts.honoraryCards,29);assert.equal(P.staffEntries[1].profileLeads.length,0);
 for(const d of P.directories)assert.equal(d.coverageComplete,false);
});

test('specific Chinese research queries lead to reviewed people and preserve complete follow-up state',()=>{
 for(const [q,slug] of [['脑电','j-c-chen'],['低空物流','f-n-zhang'],['混合现实','x-li'],['韧性优化','y-cheng']]){
  const f=P.faculty.find(x=>x.id==='hku-dase-'+slug);assert.ok(L.facultyFor(C,profile(q)).some(x=>x.id===f.id),q);
  const state={profile:profile(q),shortlist:[f.id],tasks:[{id:'task-dase-followup',text:'核具体项目后准备研究说明',done:false,facultyId:f.id,programId:'hku-dase-rpg'}]};
  const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,[f.id]);assert.equal(restored.tasks[0].programId,'hku-dase-rpg');assert.equal(restored.profile.researchQuery,q);
 }
});

test('the November1 lab contact date does not become a university deadline or current vacancy',()=>{
 const f=P.faculty.find(x=>x.id==='hku-dase-x-li');const n=f.applicationNotes.find(x=>x.kind==='teacher_statement');
 assert.deepEqual(n.degrees,['PhD']);assert.match(n.text,/2026年11月1日之前/);assert.match(n.text,/不是官方HKPFS截止/);assert.match(n.text,/未说明具体几点/);
 const s=C.sources.find(x=>x.id===n.sourceIds[0]);assert.equal(L.sourceUrl(C,s),'https://www.situated-reality.org/join-us');
 assert.ok(L.facultyLinks(C,f).some(x=>x.url==='https://www.situated-reality.org/join-us'));
 assert.ok(!C.programs.flatMap(p=>p.deadlines).some(d=>d.date==='2026-11-01'&&d.sourceIds.includes(s.id)));
 for(const x of P.faculty){assert.equal(x.availability.state,'unknown');assert.equal(x.availability.cycle,null);}
});

test('DASE research degrees do not inherit another programme requirements or postgraduate training as pre-admission work',()=>{
 const p=P.programmes[0];assert.deepEqual(p.degrees,['MPhil','PhD']);assert.equal(p.contact.status,'recommended');assert.deepEqual(p.deadlines,[]);assert.deepEqual(p.finances,[]);
 assert.equal(p.cycle,null);assert.equal(p.cycleVerified,false);
 assert.ok(L.programsFor(C,profile('')).some(x=>x.id===p.id));
 assert.ok(!L.cyclesFor(C).includes(null));
 assert.match(p.scope,/未标具体招生年度/);assert.match(p.requirements[1].text,/确认候选资格/);assert.match(p.requirements[2].text,/在读研究生/);
 assert.ok(!p.requirements.some(x=>/3\.7|985|TOEFL|IELTS/.test(x.text)));
 const cheng=P.faculty.find(x=>x.id==='hku-dase-y-cheng');assert.match(cheng.identityNote,/2026.07/);
});
