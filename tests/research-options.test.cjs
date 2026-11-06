'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),L=require('../dist/logic.js');const C=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/catalog.json'),'utf8'));
test('subject browsing includes every listed academic parent and child and every original searchable research term without changing records',()=>{
 const before=JSON.stringify(C),options=L.researchOptions(C),units=options.filter(x=>x.kind==='unit');
 const expected=C.academicCoverage.flatMap(r=>r.units.filter(u=>!['graduate_school','undergraduate_college'].includes(u.kind)).flatMap(u=>[u,...u.children,...(u.relatedNavigationGroups||[]).filter(g=>!['teaching_support','administrative_support','college_components'].includes(g.kind)).flatMap(g=>g.entries.filter(e=>!['teaching_support','administrative_support'].includes(e.kind)))]));assert.equal(units.length,expected.length);assert.equal(new Set(units.map(x=>x.universityId)).size,7);
 const original=new Set(C.faculty.flatMap(f=>f.researchKeywords?.length?f.researchKeywords:f.topics||[]).map(x=>x.trim()).filter(Boolean));assert.deepEqual(new Set(options.filter(x=>x.kind==='keyword').map(x=>x.value)),original);assert.equal(JSON.stringify(C),before);assert.equal(options.filter(x=>x.kind==='category').length,L.INTERESTS.length);
});
test('subject search supports Chinese subject names and official English names without creating unlisted departments',()=>{
 const options=L.researchOptions(C);const law=L.searchResearchOptions(options,'法学','unit');assert.ok(law.length);assert.ok(law.every(x=>/law/i.test(x.label)));assert.equal(L.searchResearchOptions(options,'unlisted-domain-example','unit').length,0);assert.ok(L.searchResearchOptions(options,'Faculty of Science','unit').length);
});
test('every listed academic choice is readable in Chinese and a translated unit keeps its original search route',()=>{
 const options=L.researchOptions(C);
 const units=options.filter(x=>x.kind==='unit');
 assert.ok(units.every(x=>/ · [^·]*[\u3400-\u9fff]/.test(x.label)));
 const lookup=query=>L.searchResearchOptions(options,query,'unit').find(x=>x.universityId==='hku'&&x.label.endsWith('建筑学院 · Faculty of Architecture'));
 assert.ok(lookup('建筑学院'));
 assert.deepEqual(lookup('建筑学院'),lookup('Faculty of Architecture'));
 const parent=C.academicCoverage.find(row=>row.universityId==='hku').units.find(u=>u.name==='Faculty of Architecture');
 assert.equal(lookup('建筑学院').unitId,parent.id);
});
test('research-choice labels preserve scientific case, complete long originals and no-match results',()=>{
 const c={faculty:[{researchKeywords:['pH','PH','δ² '+ 'x'.repeat(200)]}],universities:[],academicCoverage:[]};const choices=L.researchOptions(c).filter(x=>x.kind==='keyword');assert.equal(choices.length,3);assert.ok(choices.some(x=>x.value==='pH'));assert.ok(choices.some(x=>x.value==='PH'));assert.equal(choices.find(x=>x.value.startsWith('δ²')).value.length,203);assert.deepEqual(L.searchResearchOptions(choices,'not-present',''),[]);
});
test('nested academic units, supplied fields and research organisations stay searchable with their original category',()=>{
 const options=L.researchOptions(C);assert.ok(options.some(x=>x.label.endsWith('Department of Surgery')&&x.groupTitle&&x.scopeLabel==='下层或关联学术单位'));assert.ok(options.some(x=>x.label.includes('Institute of Mathematical Research')&&x.scopeLabel==='研究机构（非学系）'));assert.ok(options.some(x=>x.label.endsWith('材料科学与工程')&&x.scopeLabel==='研究学位入口（非学系名单）'));assert.ok(!options.some(x=>x.label.endsWith('教育科学学院办公室')));
});
