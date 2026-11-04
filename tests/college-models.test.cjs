'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
test('unitary faculty model preserves all earlier facts and does not create missing departments or admissions rules',()=>{
 const c=read('data/catalog.json'),old=read('data/snapshots/0b9ba31f3c159c77d59259f605f6553203b8678ab1782c0fa47fb32b4b3a4d1a.json');
 for(const k of ['faculty','programs','directories','funding'])assert.deepEqual(c[k],old[k]);for(const s of old.sources)assert.deepEqual(c.sources.find(x=>x.id===s.id),s);
 for(const m of c.academicCoverage)for(const u of m.units){const prior=old.academicCoverage.flatMap(m=>m.units).find(p=>p.id===u.id);if(u.id!=='cuhk-5'){assert.deepEqual(u,prior);continue;}
  for(const k of ['children','url','sourceIds','bodySha256','entryBodyStatus','staffEntries','priorOrganizationReview','relatedNavigationGroups'])assert.deepEqual(u[k],prior[k]);assert.deepEqual(u.organizationReviewHistory,[prior.organizationReview]);assert.deepEqual(u.reviewedNavigation.slice(0,-1),prior.reviewedNavigation);
  assert.equal(u.children.length,0);assert.equal(u.organizationReview.status,'unitary_faculty_department');assert.equal(u.organizationReview.organizationComplete,false);assert.equal(u.organizationReview.facultyComplete,false);assert.match(u.organizationReview.summary,/治理委员会/);
 }
 const law=read('data/research/college-models-20261104.json');assert.equal(law.sources.length,1);assert.deepEqual(c.sources[old.sources.length],law.sources[0]);assert.equal(law.sources[0].checkedAt,'2026-11-04');
});
