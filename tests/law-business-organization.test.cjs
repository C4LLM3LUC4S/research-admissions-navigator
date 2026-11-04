'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),old=read('data/snapshots/ff5bacb8ebe0797ff06ed33e5b219381639cdd314acd20a934091fd2468815da.json'),P=read('data/research/law-business-organization-20261105.json');
const unit=(c,id)=>c.academicCoverage.flatMap(r=>r.units).find(u=>u.id===id);
test('two scoped organization updates preserve every original input, source date and unrelated unit',()=>{
 for(const k of ['faculty','programs','directories','funding','academicEntryProgress','academicEntryFollowups'])assert.deepEqual(C[k],old[k]);assert.deepEqual(C.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(C.sources.slice(old.sources.length),P.sources);
 for(const row of C.academicCoverage){const prior=old.academicCoverage.find(r=>r.universityId===row.universityId);for(const k of Object.keys(prior).filter(k=>k!=='units'))assert.deepEqual(row[k],prior[k]);for(const u of row.units){const before=unit(old,u.id);if(!['hku-7','cityu-2'].includes(u.id)){assert.deepEqual(u,before);continue;}
  const allowed=u.id==='hku-7'?['organizationReview','organizationReviewHistory','reviewedNavigation']:['organizationReview','relatedNavigationGroups','reviewedNavigation','children','staffEntries'];for(const k of Object.keys(before).filter(k=>!allowed.includes(k)))assert.deepEqual(u[k],before[k]);
  if(u.id==='hku-7'){assert.deepEqual(u.organizationReviewHistory,[before.organizationReview]);assert.deepEqual(u.reviewedNavigation.slice(0,-1),before.reviewedNavigation);}
  else{assert.deepEqual(u.staffEntries.slice(0,before.staffEntries.length),before.staffEntries);for(const child of before.children){const now=u.children.find(x=>x.name===child.name);for(const k of Object.keys(child))assert.deepEqual(now[k],child[k]);}}
 }}
});
test('dated administration, six observed departments, supplied HTTPS and unread targets remain distinct',()=>{
 const law=unit(C,'hku-7');assert.equal(law.organizationReview.status,'unitary_faculty');assert.equal(law.organizationReview.effectiveFrom,'2024-09-01');assert.equal(law.children.length,0);assert.match(law.organizationReview.summary,/教学安排保持不变/);assert.match(law.organizationReview.summary,/不说明研究生录取/);
 const cb=unit(C,'cityu-2');assert.equal(cb.children.length,6);assert.equal(P.entries.length,5);assert.equal(P.sources[1].observedDepartmentCards.length,6);assert.equal(cb.organizationReview.facultyComplete,false);assert.equal(cb.organizationReview.organizationComplete,false);
 for(const child of cb.children){assert.equal(child.inventoryListing.sourceIds[0],P.sources[1].id);assert.equal(child.supervisionEligibility,'unknown');assert.equal(child.availability,'unknown');for(const e of child.providedEntries||[]){assert.equal(e.bodyStatus,'not_read');assert.equal(e.supervisionEligibility,'unknown');}}
 assert.equal(cb.children.find(c=>c.name==='Department of Accountancy').url,'http://www.cityu.edu.hk/ac/');assert.equal(P.sources[0].publishedAt,'2024-09-01');assert.equal(P.sources[0].checkedAt,'2026-11-04');assert.equal(P.allSevenHierarchiesComplete,false);
});
