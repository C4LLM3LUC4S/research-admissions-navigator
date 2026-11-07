'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hku-physics-census-20261107.json');
const old=read('data/snapshots/1037686cfff1654911b9e27e6122c1ec0e4528aac8ea6e0a237d78a358e1d0ca.json');
const D=C.directories.find(d=>d.id===P.directoryUpdate.id);

test('physics retains the entire original named list and prior census rather than overwriting historical progress',()=>{
 const C=require('./fixtures/before-robotics.cjs');
 const before=old.directories.find(d=>d.id===D.id),history=D.censusHistory.find(h=>h.batch==='hku-physics-census-20261107');
 assert.deepEqual(history.census,before.census);assert.equal(history.coverageNotes,before.coverageNotes);
 for(const key of Object.keys(before).filter(k=>!['census','coverageNotes'].includes(k)))assert.deepEqual(D[key],before[key]);
 assert.equal(D.census.entries.length,63);assert.equal(D.census.profilesRead,63);assert.equal(D.census.profilesFailed,0);
 const projection=e=>[e.name,e.directoryPosition,e.profileUrl,e.providedLinks];
 assert.deepEqual(D.census.entries.map(projection),before.census.entries.map(projection));
 assert.equal(D.coverageComplete,false);
 for(const k of ['faculty','sources','programs'])for(const row of old[k])assert.deepEqual(C[k].find(x=>x.id===row.id),row);
 for(const d of old.directories.filter(d=>d.id!==D.id))assert.deepEqual(C.directories.find(x=>x.id===d.id),d);
 for(const m of old.academicCoverage)for(const u of m.units)assert.deepEqual(C.academicCoverage.find(x=>x.universityId===m.universityId).units.find(x=>x.id===u.id).children,u.children);
});

test('research, teaching, courtesy and non-teaching roles remain separate from supervision and capacity',()=>{
 assert.equal(P.faculty.length,58);assert.equal(P.staffEntry.profileLeads.length,63);
 const leads=P.staffEntry.profileLeads;assert.equal(leads.filter(l=>l.facultyId).length,59);
 assert.equal(leads[26].facultyId,'hku-mechanical-24');assert.ok(!P.faculty.some(f=>f.id==='hku-physics-26'));
 assert.deepEqual([1,42].map(i=>leads[i].researchReviewStatus),['research_pending','research_pending']);
 for(const i of [54,55]){assert.equal(leads[i].facultyId,null);assert.equal(leads[i].researchReviewStatus,'research_role_not_teacher_card');}
 for(const i of [3,10,17])assert.match(P.faculty.find(f=>f.id==='hku-physics-'+String(i).padStart(2,'0')).identityNote,/教学岗位/);
 assert.match(P.faculty.find(f=>f.id==='hku-physics-35').identityNote,/荣休.*同名/);
 assert.match(P.faculty.find(f=>f.id==='hku-physics-43').identityNote,/名誉.*同名/);
 for(const f of P.faculty){assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);assert.ok(f.keywordSourceIds.length);}
 assert.ok(leads.every(l=>l.availability==='unknown'&&l.supervisionEligibility==='unknown'));
});

test('each profile has its own read receipt and unsuccessful or non-personal supplied links never become verified personal research',()=>{
 assert.equal(P.sources.length,79);
 const directory=C.sources.find(s=>s.id==='hku-science-physics-staff-20261105');
 assert.equal(directory.checkedAt,'2026-11-05');assert.equal(directory.bodySha256,'e622a4d0a369b9c7c3524e93529a2c931fff43cf783edd8765477e3a49c1c60a');
 for(const l of P.staffEntry.profileLeads){const s=P.sources.find(s=>s.originalUrl===l.url);assert.equal(l.bodySha256,s.bodySha256);assert.equal(s.checkedAt,'2026-11-07');}
 for(const f of P.faculty)for(const l of f.extraLinks){
  const parent=P.sources.find(s=>s.id===l.parentSourceId);assert.ok(parent.discoveredLinks.includes(l.url));
  if(l.bodyStatus==='body_read'){const s=P.sources.find(s=>s.id===l.sourceId);assert.equal(s.originalUrl,l.url);assert.equal(s.parentSourceId,l.parentSourceId);}
  else assert.equal(l.sourceId,undefined);
 }
 const blog=P.faculty.find(f=>f.id==='hku-physics-15').extraLinks.find(l=>l.url==='https://quantummc.xyz/');
 assert.equal(blog.bodyStatus,'not_read');assert.match(blog.readNote,/博客首页/);
});

test('the departmental 2026/27 programme remains dated navigation and does not fabricate a current admission route',()=>{
 const source=P.sources.find(s=>s.id==='hku-physics-rpg-scope-20261107');
 assert.match(source.scope,/2026\/27/);assert.match(P.reviewedNavigation[0].label,/2026\/27/);
 assert.deepEqual(C.programs,old.programs);
 assert.equal(P.counts.allSevenComplete,false);
 const science=C.academicCoverage.find(m=>m.universityId==='hku').units.find(u=>u.id==='hku-9');
 assert.ok(science.reviewedNavigation.some(n=>n.sourceId===source.id));
});
