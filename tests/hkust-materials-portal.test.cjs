'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hkust-materials-portal-20261107.json');
const old=read('data/snapshots/3a26cceee49c082552fdd9c653bf329836ac28591cc3a1b1e6901af1b93d3a8e.json');
test('materials portal reuses three identities, adds only one researcher and leaves the unprovided department homepage unknown',()=>{
 assert.equal(C.faculty.length,old.faculty.length+1);
 for(const key of ['faculty','programs','sources','directories'])for(const row of old[key])assert.deepEqual(C[key].find(x=>x.id===row.id),row);
 const school=C.academicCoverage.find(m=>m.universityId==='hkust'),engineering=school.units.find(u=>u.id==='hkust-2');
 const original=old.academicCoverage.find(m=>m.universityId==='hkust').units.find(u=>u.id==='hkust-2');
 assert.deepEqual(engineering.children,original.children);
 assert.equal(engineering.children.find(c=>c.name==='Department of Materials').url,null);
 const ids=P.staffEntries[0].profileLeads.map(l=>l.facultyId);
 assert.deepEqual(ids,['hkust-materials-antonio-facchetti','hkust-math-44','review-hkust-6bc3e91fa5943e','hkust-cbe-47336498acd858']);
 assert.equal(P.directories[0].census.entries.length,4);
 assert.equal(P.directories[0].coverageComplete,false);
 for(const row of P.directories[0].census.entries)assert.equal(row.profileRead,true);
 assert.match(P.directories[0].coverageNotes,/研究门户.*完整师资/);
 const f=P.faculty[0];assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);
 assert.match(f.summary,/柔性.*光伏.*储能/);
 assert.ok(engineering.reviewedNavigation.some(n=>n.sourceId==='hkust-materials-portal-20261107'));
 assert.equal(P.sources.length,5);for(const s of P.sources){assert.equal(s.checkedAt,'2026-11-07');assert.ok(s.readReceiptSha256);assert.equal(s.bodySha256,undefined);}
});
