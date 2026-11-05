'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),old=read('data/snapshots/dd78279bdcbfe0e6dd084d2e933bc90ba70fb76da7afd7ccf5c9d5660121549a.json'),P=read('data/research/science-interdisciplinary-scopes-20261105.json');
const unit=(c,id)=>c.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('new dated scopes preserve all original records, source dates, unit identities and target receipts',()=>{
 for(const k of Object.keys(old).filter(k=>!['checkedDate','sources','academicCoverage','snapshotId'].includes(k)))assert.deepEqual(C[k],old[k]);
 assert.equal(C.checkedDate,'2026-11-05');assert.deepEqual(C.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(C.sources.slice(old.sources.length),P.sources);
 for(const row of C.academicCoverage){const before=old.academicCoverage.find(m=>m.universityId===row.universityId);for(const k of Object.keys(before).filter(k=>k!=='units'))assert.deepEqual(row[k],before[k]);for(const u of row.units){const prior=unit(old,u.id);if(!['hku-9','hkust-6'].includes(u.id)){assert.deepEqual(u,prior);continue;}
  for(const k of Object.keys(prior).filter(k=>!['children','relatedNavigationGroups'].includes(k)))assert.deepEqual(u[k],prior[k]);
  assert.equal(u.children.length,prior.children.length);for(let i=0;i<prior.children.length;i++){for(const k of Object.keys(prior.children[i]))assert.deepEqual(u.children[i][k],prior.children[i][k]);assert.deepEqual(u.children[i].inventorySourceIds,prior.children[i].sourceIds);}
 }}
});
test('brochure year and conflicting counts cannot replace current scope or create an extra direct department',()=>{
 const science=unit(C,'hku-9'),org=science.organizationReview;assert.equal(org.status,'conflicting_scopes');assert.equal(org.sourceAcademicYear,'2026/27');assert.match(org.summary,/不按标题补造第六个直属系/);assert.equal(science.children.length,8);assert.equal(science.children.filter(c=>c.relationship==='affiliated_school').length,3);
 const nested=science.relatedNavigationGroups.find(g=>g.kind==='academic_subunits');assert.equal(nested.parentUnitName,'School of Computing and Data Science');assert.equal(nested.entries.length,3);assert.ok(nested.entries.every(e=>e.url===null&&e.entryBodyStatus==='not_read'&&e.availability==='unknown'&&e.supervisionEligibility==='unknown'));
 const orgs=science.relatedNavigationGroups.find(g=>g.kind==='research_organizations');assert.equal(orgs.entries.length,3);assert.deepEqual(orgs.entries.map(e=>e.kind),['institute','research_lab','institute']);assert.ok(orgs.entries.every(e=>e.url===null));assert.equal(P.sources[0].academicYear,'2026/27');assert.deepEqual(P.sources[0].reviewedPages,[5]);assert.ok(!('declaredEffectiveFrom'in P.sources[0]));
 const ais=unit(C,'hkust-6');assert.equal(ais.children.length,5);assert.ok(ais.children.every(c=>c.kind==='division'));assert.equal(ais.relatedTeachingEntries.length,2);assert.equal(ais.organizationReview.facultyComplete,false);assert.equal(ais.organizationReview.organizationComplete,false);assert.equal(P.allSevenHierarchiesComplete,false);
});
