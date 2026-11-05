'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),L=require('../dist/logic.js');
const C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
function target(c){return c.academicCoverage.find(m=>m.universityId==='hku').units.find(u=>u.id==='hku-9').children.find(ch=>ch.name==='School of Computing and Data Science');}
function donor(c){return c.academicCoverage.find(m=>m.universityId==='hku').units.find(u=>u.id==='hku-6').children.find(ch=>ch.url==='https://www.cds.hku.hk/');}
test('same-school affiliation reuses the exact original name, URL, body and date without changing either hierarchy record',()=>{
 const before=JSON.stringify(C),read=L.sharedSchoolRead(C,'hku',target(C));assert.deepEqual(read.sourceIds,['entry-read-academic-child-ba62ca945ed385ea']);assert.deepEqual(read.checkedDates,['2026-10-26']);assert.equal(read.bodySha256,donor(C).bodySha256);assert.equal(JSON.stringify(C),before);assert.equal(target(C).entryBodyStatus,'not_read');assert.equal(target(C).relationship,'affiliated_school');
});
test('shared list pages, another institution or a guessed HTTP alias cannot create a school-body read',()=>{
 const business=C.academicCoverage.find(m=>m.universityId==='hku').units.find(u=>u.id==='hku-3');for(const ch of business.children)assert.equal(L.sharedSchoolRead(C,'hku',ch),null);assert.equal(L.sharedSchoolRead(C,'cuhk',target(C)),null);
 const c=structuredClone(C);target(c).url='http://www.cds.hku.hk/';assert.equal(L.sharedSchoolRead(c,'hku',target(c)),null);
});
test('a similar name, different body or rejected source does not lend its read status',()=>{
 for(const change of [c=>donor(c).observedName='Another School',c=>donor(c).bodySha256='0'.repeat(64),c=>c.sources.find(s=>s.id===donor(c).sourceIds[0]).evidenceLevel='official_entry_access_failed']){const c=structuredClone(C);change(c);assert.equal(L.sharedSchoolRead(c,'hku',target(c)),null);}
});
