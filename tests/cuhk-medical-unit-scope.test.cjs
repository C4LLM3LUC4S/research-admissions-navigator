'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/cuhk-medical-unit-scope-20261107.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/ceb830bc4b8e276a72992c908df13181edd47e87a0491e75db30bfbe4b18fb17.json');

test('the faculty unit supplements the original 19 children without changing source, teacher or programme histories',()=>{
 for(const k of ['faculty','programs','directories'])assert.deepEqual(C[k],old[k]);
 assert.deepEqual(C.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(C.sources.slice(old.sources.length),P.sources);
 const unit=C.academicCoverage.find(m=>m.universityId==='cuhk').units.find(u=>u.id==='cuhk-6');
 const before=old.academicCoverage.find(m=>m.universityId==='cuhk').units.find(u=>u.id==='cuhk-6');
 assert.deepEqual(unit.children,before.children);assert.equal(unit.children.length,19);
 assert.deepEqual(unit.relatedNavigationGroups.at(-1),P.navigationGroup);
 const entry=P.navigationGroup.entries[0];assert.equal(entry.kind,'teaching_unit');
 assert.equal(entry.availability,'unknown');assert.equal(entry.supervisionEligibility,'unknown');
 assert.equal(L.academicLabel(entry.name),'急症医学教研单位 · Accident and Emergency Medicine Academic Unit');
 assert.ok(P.sources[0].discoveredLinks.includes(entry.url));
 assert.match(entry.note,/授课课程/);assert.equal(P.newProgrammes,0);
 assert.equal(P.sources[1].readReceiptSha256,entry.readReceiptSha256);
 assert.ok(!P.sources[1].bodySha256);
});
