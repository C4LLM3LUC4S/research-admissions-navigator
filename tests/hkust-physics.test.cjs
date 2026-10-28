'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hkust-physics-census-20261028.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/8a208df3c6212dd35904f5d31ebd65e6b16bf35cabe91c8838e59e1ce96592f3.json');
const profile=q=>({...L.defaultProfile(C),universityIds:['hkust'],degree:'PhD',researchQuery:q});

test('physics adds research leads without rewriting1013 prior people, sources or programme conditions',()=>{
 for(const f of old.faculty)assert.deepEqual(C.faculty.find(n=>n.id===f.id),f);
 for(const p of old.programs)assert.deepEqual(C.programs.find(n=>n.id===p.id),p);
 for(const s of old.sources)assert.deepEqual(C.sources.find(n=>n.id===s.id),s);
 assert.equal(P.faculty.length,43);assert.equal(P.staffEntries[0].profileLeads.length,44);
 assert.equal(P.staffEntries[0].profileLeads.find(f=>f.name==='Kirill PROKOFIEV').facultyId,null);
 assert.ok(P.directories.every(d=>d.coverageComplete===false));
 assert.equal(C.academicCoverage.flatMap(m=>m.units).find(u=>u.id==='hkust-1').children.length,5);
 for(const f of P.faculty){assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);}
});

test('actual provided personal pages recover missing research and keep failed links unpromoted',()=>{
 const che=P.faculty.find(f=>f.id==='hkust-physics-01');assert.equal(che.extraLinks[0].url,'https://www.phys.ust.hk/ctchan/index.html');assert.equal(che.extraLinks[0].bodyStatus,'not_read');assert.equal(L.facultyLinks(C,che)[0].bodyStatus,'not_read');assert.equal(che.extraLinks[0].sourceId,undefined);
 const chen=P.faculty.find(f=>f.id==='hkust-physics-02');
 assert.match(chen.summary,/量子力学基础/);assert.ok(chen.keywordSourceIds.some(s=>s.includes('personal')));
 assert.match(chen.directoryRole,/Education|Lecturer/);assert.match(chen.identityNote,/不自动证明/);
 assert.ok(L.facultyLinks(C,chen).some(x=>x.url==='https://physics.hkust.edu.hk/node/2444'));
 const failed=P.faculty.find(f=>f.id==='hkust-physics-38');assert.equal(failed.extraLinks[0].bodyStatus,'not_read');assert.deepEqual(L.facultyLinks(C,failed),[]);
 for(const f of P.faculty)for(const link of f.extraLinks.filter(x=>x.bodyStatus==='body_read')){
  const s=C.sources.find(x=>x.id===link.sourceId);assert.equal(s.originalUrl,link.url);assert.equal(s.retrievedUrl,s.url);assert.equal(s.parentSourceId,link.parentSourceId);
 }
});

test('life-science navigation uses the actually read scoped pagination and retains the unfiltered original',()=>{
 const child=P.unitChildren.find(x=>x.name==='生命科学学部'),route=child.staffRoutes[0];
 assert.equal(route.url,'https://science.hkust.edu.hk/about/our_people?academic-unit=2942&show=faculty-members&page=0');
 assert.equal(route.originalUrl,'https://science.hkust.edu.hk/about/our_people?academic-unit=2942&show=faculty-members');
 assert.equal(route.bodyStatus,'body_read');assert.equal(route.completeFacultyEnumeration,false);
 const source=C.sources.find(x=>x.id===route.sourceIds[0]);assert.equal(source.url,route.url);assert.match(source.knownIssues[0],/All Academic Units/);
 assert.match(source.bodySha256,/^[a-f0-9]{64}$/);assert.ok(C.sources.find(x=>x.id===source.parentSourceId).discoveredLinks.includes(route.url));
});

test('cross-field applicants find specific evidence and retain the teacher and next action after save restore',()=>{
 for(const [q,id] of [['量子控制','hkust-physics-08'],['物理智能体','hkust-physics-37'],['软体机器人','hkust-physics-41']]){
  assert.ok(L.facultyFor(C,profile(q)).some(f=>f.id===id),q);
  const state={profile:profile(q),shortlist:[id],tasks:[{id:'task-physics-follow-up',text:'核指导资格、入学轮次和资助；准备研究问题',done:false,facultyId:id,programId:'hkust-physics-rpg'}]};
  const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,[id]);assert.equal(restored.tasks[0].programId,'hkust-physics-rpg');
 }
 const wang=P.faculty.find(f=>f.id==='hkust-physics-36'),note=wang.applicationNotes[0];
 assert.deepEqual(note.degrees,['PhD']);assert.match(note.text,/暂无PhD位置/);assert.match(note.text,/未注明公告日期/);assert.equal(wang.availability.state,'unknown');
});

test('undated physics and nano routes do not inherit deadlines, scores, rates or pre-entry qualifying exams',()=>{
 for(const p of P.programmes){
  assert.equal(p.cycle,null);assert.equal(p.cycleVerified,false);assert.deepEqual(p.deadlines,[]);
  assert.deepEqual(p.degrees,['MPhil','PhD']);assert.equal(p.contact.status,'unknown');assert.deepEqual(p.finances[0].rates,[]);
  assert.match(p.requirements[2].text,/不能当成递交申请前/);assert.ok(!p.requirements.some(r=>/6\.5|79|3\.7/.test(r.text)));
  assert.ok(L.programsFor(C,profile('')).some(x=>x.id===p.id));
 }
 assert.ok(!L.cyclesFor(C).includes(null));
});
