'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
test('university references keep all earlier institutions, units, inputs and read receipts intact',()=>{
 const latest=read('data/catalog.json'),c=read('data/snapshots/a56e59194019b4005c46cc64d18f9e14aac964ab30cb76015da612eceb525785.json'),old=read('data/snapshots/7e45fcf7131521d5c8228c25abcbe3c61c683b8cbbd64dc3f0cccc02f2fc7e45.json');
 for (const row of c.academicCoverage.filter(row=>row.institutionalReferences)) {
   const current=latest.academicCoverage.find(r=>r.universityId===row.universityId).institutionalReferences;
   assert.deepEqual(current.slice(0,row.institutionalReferences.length),row.institutionalReferences);
 }
 for(const key of ['faculty','programs','directories','funding'])assert.deepEqual(c[key],old[key]);
 const pack=read('data/research/institution-references-20261104.json');assert.deepEqual(c.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(c.sources.slice(old.sources.length,old.sources.length+2),pack.sources);
 for(const row of c.academicCoverage){const {institutionalReferences,...prior}=row;assert.deepEqual(prior,old.academicCoverage.find(r=>r.universityId===row.universityId));if(!['hkust','hkustgz'].includes(row.universityId))assert.equal(institutionalReferences,undefined);}
 const hk=c.academicCoverage.find(r=>r.universityId==='hkust').institutionalReferences[0],gz=c.academicCoverage.find(r=>r.universityId==='hkustgz').institutionalReferences[0];
 assert.equal(hk.entries.filter(e=>e.kind==='department').length,16);assert.equal(hk.entries.filter(e=>e.kind==='division').length,8);assert.match(hk.caution,/Materials/);assert.equal(gz.entries.length,7);
 for(const r of [hk,gz]){assert.equal(r.organizationComplete,false);assert.equal(r.facultyComplete,false);assert.ok(r.entries.every(e=>e.bodyStatus==='not_read'&&e.availability==='unknown'&&e.supervisionEligibility==='unknown'));}
});
