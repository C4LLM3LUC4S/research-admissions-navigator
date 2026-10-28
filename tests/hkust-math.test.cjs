'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hkust-math-census-20261028.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/452a9f812d522b475238c505c0d03dbdbbad39d44c002e29600a21e6dd073016.json');
const profile=q=>({...L.defaultProfile(C),universityIds:['hkust'],degree:'PhD',researchQuery:q});

test('math preserves1056 prior identities, all programme conditions and original source objects',()=>{
 for(const k of ['faculty','programs','sources'])for(const row of old[k])assert.deepEqual(C[k].find(x=>x.id===row.id),row);
 assert.equal(P.faculty.length,52);assert.equal(P.existingIdentityEvidence.length,4);assert.ok(C.faculty.length>=1191);
 assert.deepEqual(P.existingIdentityEvidence.map(x=>x.id).sort(),['expand-hkust-ke-wang','review-hkust-1a4d5126dd3fea','review-hkust-8e8e02159255ad','review-hkust-b23367cbd3623b'].sort());
 for(const row of P.existingIdentityEvidence)assert.ok(!P.faculty.some(f=>f.name===row.name));
});

test('school and departmental ranges keep missing research and teaching roles without fake supervisor totals',()=>{
 const leads=P.staffEntries.flatMap(x=>x.profileLeads);assert.equal(leads.length,58);assert.equal(leads.filter(x=>x.facultyId).length,56);
 assert.deepEqual(leads.filter(x=>!x.facultyId).map(x=>x.name),['Yin Bon KU','Xueyang QUAN / 權雪阳']);
 assert.ok(P.staffEntries.every(x=>x.enumerationComplete===false&&x.teacherProfilesTotal===null));
 assert.ok(P.directories.every(x=>x.coverageComplete===false));assert.match(P.directories[0].coverageNotes,/不能加总成导师数/);
 const status=read('STATUS.json'),leadsAll=C.academicCoverage.flatMap(m=>m.units.flatMap(u=>(u.staffEntries||[]).flatMap(e=>e.profileLeads||[])));
 assert.equal(status.counts.observed_profile_links,leadsAll.length);assert.equal(status.counts.profile_bodies_read,leadsAll.filter(x=>x.profileBodyStatus==='body_read').length);assert.equal(status.counts.pending_research_review,leadsAll.filter(x=>!x.facultyId).length);
 for(const f of P.faculty){assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);assert.match(f.identityNote,/不自动证明/);}
});

test('math personal links retain exact original to returned binding and the stale student identity conflict',()=>{
 for(const f of P.faculty)for(const link of f.extraLinks.filter(x=>x.bodyStatus==='body_read')){
  const s=C.sources.find(x=>x.id===link.sourceId);assert.equal(s.originalUrl,link.url);assert.equal(s.parentSourceId,link.parentSourceId);assert.equal(s.retrievedUrl,s.url);
 }
 const cai=P.faculty.find(x=>x.id==='hkust-math-01');assert.ok(L.facultyLinks(C,cai).some(x=>x.url==='https://www.math.hkust.edu.hk/people/faculty/profile/jfcai/'));
 const hu=P.faculty.find(x=>x.id==='hkust-math-16');assert.match(hu.directoryRole,/Research Assistant Professor/);assert.match(hu.applicationNotes[0].text,/Georgia Tech博士生/);assert.equal(hu.availability.state,'unknown');
 assert.ok(hu.keywordSourceIds.every(s=>!s.includes('personal')),'A stale personal role is not used to infer new current research or eligibility');
 const ho=P.faculty.find(x=>x.id==='hkust-math-15');assert.equal(ho.extraLinks[0].bodyStatus,'not_read');assert.deepEqual(L.facultyLinks(C,ho),[]);
});

test('specific STEM queries preserve a next action and an existing saved identity through portable restore',()=>{
 for(const [q,id] of [['科学机器学习','hkust-math-03'],['随机控制','hkust-math-07'],['混合整数规划','hkust-math-46']]){
  assert.ok(L.facultyFor(C,profile(q)).some(x=>x.id===id));
  const state={profile:profile(q),shortlist:[id,'expand-hkust-ke-wang'],tasks:[{id:'task-math-next',text:'核项目、研究问题与指导资格',done:false,facultyId:id,programId:'hkust-math-rpg'}]};
  const saved=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(saved.shortlist,state.shortlist);assert.equal(saved.tasks[0].programId,'hkust-math-rpg');assert.equal(saved.profile.researchQuery,q);
 }
});

test('new research inventory does not convert old departmental English or funding wording into new admissions promises',()=>{
 assert.deepEqual(C.programs.find(x=>x.id==='hkust-math-rpg'),old.programs.find(x=>x.id==='hkust-math-rpg'));
 assert.deepEqual(P.programmeUpdates,[]);assert.ok(!P.faculty.some(x=>x.availability.state!=='unknown'));
 assert.ok(P.faculty.every(x=>!x.researchKeywords.some(k=>k.includes('document.title'))));
});
