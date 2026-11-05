'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),L=require('../dist/logic.js');const C=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/catalog.json'),'utf8'));
test('subject browsing includes every listed academic parent and child and every original searchable research term without changing records',()=>{
 const before=JSON.stringify(C),options=L.researchOptions(C),units=options.filter(x=>x.kind==='unit');
 const expected=C.academicCoverage.flatMap(r=>r.units.filter(u=>!['graduate_school','undergraduate_college'].includes(u.kind)).flatMap(u=>[u,...u.children]));assert.equal(units.length,expected.length);assert.equal(new Set(units.map(x=>x.universityId)).size,7);
 const original=new Set(C.faculty.flatMap(f=>f.researchKeywords?.length?f.researchKeywords:f.topics||[]).map(x=>x.trim()).filter(Boolean));assert.deepEqual(new Set(options.filter(x=>x.kind==='keyword').map(x=>x.value)),original);assert.equal(JSON.stringify(C),before);assert.equal(options.filter(x=>x.kind==='category').length,L.INTERESTS.length);
});
test('subject search supports Chinese subject names and official English names without creating unlisted departments',()=>{
 const options=L.researchOptions(C);const law=L.searchResearchOptions(options,'法学','unit');assert.ok(law.length);assert.ok(law.every(x=>/law/i.test(x.label)));assert.equal(L.searchResearchOptions(options,'unlisted-domain-example','unit').length,0);assert.ok(L.searchResearchOptions(options,'Faculty of Science','unit').length);
});
test('research-choice labels preserve scientific case, complete long originals and no-match results',()=>{
 const c={faculty:[{researchKeywords:['pH','PH','δ² '+ 'x'.repeat(200)]}],universities:[],academicCoverage:[]};const choices=L.researchOptions(c).filter(x=>x.kind==='keyword');assert.equal(choices.length,3);assert.ok(choices.some(x=>x.value==='pH'));assert.ok(choices.some(x=>x.value==='PH'));assert.equal(choices.find(x=>x.value.startsWith('δ²')).value.length,203);assert.deepEqual(L.searchResearchOptions(choices,'not-present',''),[]);
});
