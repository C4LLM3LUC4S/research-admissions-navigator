'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/polyu-me-census-20261107.json');
const prior=read('data/snapshots/ae65c6f49a14ca671378412ac8aa71f88f791787afda0570309f5747bec1da8e.json');

test('ME additions preserve every prior source, teacher, programme, directory and formal child relation',()=>{
 for(const key of ['sources','faculty','programs','directories']){
  const now=new Map(C[key].map(row=>[row.id,row]));
  for(const row of prior[key]){
   let current=now.get(row.id);
   if(key==='directories'&&row.id==='hku-science-physics-observed-staff'){
    const history=current.censusHistory.find(h=>h.batch==='hku-physics-census-20261107');
    current={...current,census:history.census,coverageNotes:history.coverageNotes};delete current.censusHistory;
   }
   assert.deepEqual(current,row,`${key}: ${row.id}`);
  }
 }
 for(const school of prior.academicCoverage){
  const now=C.academicCoverage.find(row=>row.universityId===school.universityId);
  for(const unit of school.units){
   const current=now.units.find(row=>row.id===unit.id);
   assert.deepEqual(current.children,unit.children);
   for(const [key,value] of Object.entries(unit.organizationReview||{})){
    assert.deepEqual(key==='sourceIds'?current.organizationReview[key].slice(0,value.length):current.organizationReview[key],value);
   }
   assert.deepEqual(current.staffEntries.slice(0,unit.staffEntries.length),unit.staffEntries);
  }
 }
});

test('the saved 40-profile academic list and 13 honorary/visitor roles retain separate evidence dates and missing links',()=>{
 const academic=P.directories.find(d=>d.id==='polyu-me-academic-census');
 assert.equal(academic.census.entries.length,40);
 assert.equal(academic.census.profilesRead,40);
 const directory=C.sources.find(s=>s.id===academic.sourceIds[0]);
 assert.equal(directory.checkedAt,'2026-10-26');
 assert.equal(directory.bodySha256,'584c30dc706e7c5a73de84cbde095e6200a1944533f6dc92ece4634cf8e4dd4d');
 const honorary=P.directories.find(d=>d.id==='polyu-me-honorary-census');
 assert.equal(honorary.census.entries.length,5);
 assert.equal(honorary.census.unlinkedEntries.length,8);
 for(const row of honorary.census.unlinkedEntries){
  const teacher=C.faculty.find(f=>f.id===row.facultyId);
  assert.equal(teacher.profileUrl,null);
  assert.equal(teacher.recordKind,'directory_research');
  assert.match(teacher.directoryRole,/近年访问/);
  assert.equal(teacher.availability.state,'unknown');
 }
 assert.equal(P.faculty.filter(f=>f.identityNote?.includes('教学岗位')).length,5);
 assert.equal(C.faculty.find(f=>f.id==='hku-mechanical-63').universityId,'hku');
 assert.equal(C.faculty.find(f=>f.id==='polyu-me-mai-yiu-wing').universityId,'polyu');
});

test('dated programme route, undated personal adverts and conflicting appointment wording stay separate',()=>{
 const p=P.programmes[0];
 assert.deepEqual(p.degrees,['MPhil','PhD']);
 assert.equal(p.cycle,'2027/28');
 assert.equal(p.deadlines[0].date,'2027-05-31');
 assert.equal(p.deadlines[0].at,null);
 assert.match(p.evidenceNote,/全年.*具体截止日/);
 assert.match(p.requirements.find(r=>r.label==='标准格式研究计划').text,/标准表格/);
 const adverts=P.faculty.filter(f=>f.availability.state==='advertised');
 assert.equal(adverts.length,3);
 for(const f of adverts){assert.equal(f.availability.cycle,null);assert.deepEqual(f.availability.degrees,['PhD']);}
 const li=P.faculty.find(f=>f.id==='polyu-me-li-tianyi-prof');
 assert.match(li.directoryRole,/Assistant Professor/);
 assert.match(li.applicationNotes[0].text,/个人网站仍写 2026 年将加入/);
 assert.equal(li.applicationNotes[0].sourceIds.length,2);
 const xu=P.faculty.find(f=>f.id==='polyu-me-xu-shengduo-prof');
 const blocked=xu.extraLinks.find(l=>l.label==='Personal Website');
 assert.equal(blocked.bodyStatus,'not_read');assert.match(blocked.readNote,/403/);
});
