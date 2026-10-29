'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/cityu-ee-census-20261029.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/8d8d7b88cf894f78a0fa78ce33f183cd1e5a5369e9f214e6b1796c1a4a3217b2.json');
const person=id=>P.faculty.find(f=>f.id==='cityu-ee-'+id);
test('EE preserves every old record, existing identity and all four role categories',()=>{
 for(const k of ['faculty','programs','sources'])for(const row of old[k])assert.deepEqual(C[k].find(f=>f.id===row.id),row);
 assert.equal(P.faculty.length,65);assert.equal(P.faculty.filter(f=>f.recordKind==='directory_research').length,18);
 assert.deepEqual(P.directories.map(d=>d.census.entries.length+d.census.unlinkedEntries.length),[47,14,4,2]);
 assert.equal(P.directories.reduce((n,d)=>n+d.census.entries.length,0),49);assert.equal(P.existingIdentityEvidence[0].id,'wide-cityu-hing-cheung-so');assert.equal(P.pendingIdentity.length,1);
 assert.equal(read('STATUS.json').counts.faculty,C.faculty.length);assert.equal(read('data/coverage.json').counts.sources,C.sources.length);
 assert.ok(P.faculty.every(f=>f.availability.state==='unknown'&&f.availability.cycle===null));
});
test('directory-only research needs the actual named official card rather than a fabricated personal URL',()=>{
 const f=person('39'),s=L.directoryResearchSource(C,f);assert.ok(s);assert.equal(f.profileUrl,null);assert.ok(L.officialUrl(s.url));
 for(const change of [{name:'Other person'},{id:'another-person'},{universityId:'hku'},{directoryEvidenceSourceId:'cityu-ee-rpg-admissions-20261029'},{profileUrl:s.url},{sourceIds:[]},{directorySourceIds:[]}])assert.equal(L.directoryResearchSource(C,{...f,...change}),null);
 const clone=structuredClone(C);clone.sources.find(x=>x.id===s.id).url='https://unrelated.example/';assert.equal(L.directoryResearchSource(clone,f),null);
 for(const [q,id] of [['光子集成','39'],['电力市场','43']])assert.ok(L.facultyFor(C,{...L.defaultProfile(C),universityIds:['cityu'],researchQuery:q,degree:'MPhil'}).some(x=>x.id===person(id).id));
 assert.equal(L.directoryResearchSource(C,C.faculty.find(f=>f.id==='wide-cityu-hing-cheung-so')),null);
});
test('access-checks and invalid decoding remain separate from read bodies and all-year recruitment',()=>{
 assert.equal(P.counts.accessChecksOrDenials,26);assert.equal(P.counts.transportOrHTTPFailures,4);assert.equal(P.counts.strictDecodePending,1);assert.equal(P.counts.actualPrimaryBodiesScoped,12);
 assert.match(person('37').applicationNotes[0].text,/未说明学位或适用入学年/);assert.equal(person('37').availability.state,'unknown');
 assert.match(person('50').applicationNotes[0].text,/Adjunct.*Chair Professor/);assert.match(person('01').applicationNotes[0].text,/未明确招募学位/);
 const p=P.programmes[0];assert.deepEqual(p.degrees,['MPhil']);assert.equal(p.cycle,null);assert.equal(p.cycleVerified,false);assert.deepEqual(p.deadlines,[]);assert.equal(p.contact.status,'recommended');assert.match(p.contact.text,/不是强制/);
 assert.match(p.requirements.map(r=>r.text).join(' '),/2023.*2026.*没有据此补成2027\/28/);assert.match(p.requirements.at(-1).text,/MPhil完整材料/);
});
test('new directory evidence keeps the saved profile and old known identities portable',()=>{
 const state={profile:{...L.defaultProfile(C),universityIds:['cityu'],degree:'MPhil',researchQuery:'光子集成'},shortlist:['cityu-ee-39','wide-cityu-hing-cheung-so','wide-hku-peng-lu'],tasks:[],sourceIds:[person('39').directoryEvidenceSourceId],experiences:[]};
 const saved=L.portable(C,state),restored=L.parsePortable(JSON.stringify(saved),C);assert.deepEqual(restored.shortlist,state.shortlist);assert.equal(restored.profile.researchQuery,'光子集成');assert.ok(restored.sourceIds.includes(person('39').directoryEvidenceSourceId));
});
