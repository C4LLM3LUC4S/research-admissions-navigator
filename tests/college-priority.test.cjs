'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/college-priority-20261029.json');
test('college review accounts for every academic and support node without changing teachers or policies',()=>{
 const old=read('data/snapshots/b03d222d05f9da8470eb26bcf4835c71cfe74a86b9c38c7530ae6b84a187c931.json');
 for(const key of ['faculty','programs'])assert.deepEqual(C[key],old[key]);
 for(const row of old.sources)assert.deepEqual(C.sources.find(s=>s.id===row.id),row);
 assert.equal(P.reviews.length,7);assert.equal(P.reviews.reduce((n,r)=>n+r.academicUnitsListed,0),60);assert.equal(P.reviews.reduce((n,r)=>n+r.supportUnitIds.length,0),6);
 for(const r of P.reviews){assert.equal(r.wholeUniversityHierarchyComplete,false);assert.equal(r.departmentInventoryStatus,'pending');assert.equal(r.facultyInventoryStatus,'pending');}
});
test('CityU research inventory includes the named academy and keeps its scope separate from the whole university',()=>{
 const m=C.academicCoverage.find(m=>m.universityId==='cityu'),r=m.listReview;
 assert.equal(r.status,'research_degree_list_matched');assert.equal(r.academicUnitsListed,11);assert.ok(r.academicUnitIds.includes('cityu-innovation'));assert.ok(r.supportUnitIds.includes('cityu-gs'));assert.equal(m.coverageComplete,false);
 assert.match(m.note,/包含创新学院/);assert.match(m.note,/校级完整架构仍未核实/);
 assert.equal(C.sources.find(s=>s.id==='college-priority-cuhksz-20261029').bodySha256,undefined);
});
