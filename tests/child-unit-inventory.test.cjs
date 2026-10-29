'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/child-unit-inventory-20261029.json');
const unit=id=>C.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);

test('science navigation uses the eight supplied entries and separates the three affiliated schools',()=>{
 const u=unit('hku-9');assert.equal(u.children.length,8);assert.equal(u.children.filter(c=>c.relationship==='affiliated_school').length,3);
 assert.equal(u.children.find(c=>c.name==='School of Computing and Data Science').url,'https://www.cds.hku.hk/');assert.equal(u.children.find(c=>c.name==='School of Innovation').url,'https://i-school.hku.hk/');
 for(const child of u.children){assert.equal(child.entryBodyStatus,'not_read');assert.equal(child.staffRoutes,undefined);assert.ok(!child.url.includes('/prospective/tpg/'));assert.equal(child.supervisionEligibility,'unknown');}
});
test('divisions, teaching departments and academic areas retain their real categories and dates',()=>{
 assert.equal(unit('hkust-3').children.length,6);assert.equal(unit('hkust-6').children.length,5);assert.equal(unit('hkust-6').relatedTeachingEntries.length,2);assert.ok(unit('hkust-6').children.every(c=>c.kind==='division'));
 assert.equal(unit('hku-3').children.length,6);assert.ok(unit('hku-3').children.every(c=>c.kind==='academic_area'));
 const hss=unit('cuhksz-3');assert.equal(hss.children.length,10);assert.equal(hss.childInventoryReview.checkedAt,'2026-10-28');for(const child of hss.children){assert.equal(C.sources.find(s=>s.id===child.sourceIds[0]).checkedAt,'2026-10-28');assert.equal(child.availability,'unknown');}
 assert.equal(P.allSevenHierarchiesComplete,false);
});
test('child navigation changes preserve every original teacher, programme, source and college identity',()=>{
 const old=read('data/snapshots/0baa903e0ba3b9d12cdf0debd9331e409945152404b70615470cdf9073044e04.json');for(const key of ['faculty','programs','directories'])assert.deepEqual(C[key],old[key]);for(const s of old.sources)assert.deepEqual(C.sources.find(r=>r.id===s.id),s);
 assert.deepEqual(C.academicCoverage.map(m=>m.units.map(u=>u.id)),old.academicCoverage.map(m=>m.units.map(u=>u.id)));for(const m of C.academicCoverage)assert.equal(m.listReview.wholeUniversityHierarchyComplete,false);
});
