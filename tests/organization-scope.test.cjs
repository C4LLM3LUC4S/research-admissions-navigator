'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/organization-scope-20261029.json'),unit=id=>C.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('subjects and degree navigation do not invent CUHK-Shenzhen departments or policy cards',()=>{
 for(const id of ['cuhksz-2','cuhksz-4','cuhksz-8']){const u=unit(id);assert.equal(u.entryBodyStatus,'body_read');assert.equal(u.children.length,0);assert.equal(u.organizationReview.status,'not_listed_in_reviewed_pages');assert.equal(u.organizationReview.organizationComplete,false);}
 const sse=unit('cuhksz-2'),sds=unit('cuhksz-4');assert.equal(sse.relatedNavigationGroups.find(g=>g.kind==='research_fields').entries.length,6);assert.equal(sds.relatedNavigationGroups.find(g=>g.kind==='academic_subjects').entries.length,3);
 const links=sse.relatedNavigationGroups.find(g=>g.kind==='research_degree_navigation').entries;assert.equal(links.length,7);assert.equal(links.find(e=>e.name==='计算机与信息工程').url,'https://sse.cuhk.edu.cn/page/749');assert.ok(!links.some(e=>e.url.includes('ssemsc.')));assert.equal(C.programs.length,40);assert.ok(P.units.flatMap(u=>u.staffEntries||[]).every(s=>Array.isArray(s.profileLeads)&&s.profileLeads.length===0));for(const u of [sse,sds]){assert.equal(u.previousAccessNote.checkedAt,'2026-10-26');assert.match(u.previousAccessNote.text,/TLS/);assert.ok(!u.accessNote.includes('本轮未读到正文'));}
});
test('sixteen hub thrusts, education supports and college components keep separate scopes',()=>{
 for(const id of ['hkustgz-1','hkustgz-2','hkustgz-3','hkustgz-4']){const u=unit(id);assert.equal(u.children.length,4);assert.equal(u.organizationReview.status,'listed_children_matched');assert.ok(u.children.every(c=>c.url&&c.inventorySourceIds.length&&c.supervisionEligibility==='unknown'));}
 assert.equal(unit('hkustgz-3').children[0].name,'生命科学与生物医学工程');
 const ces=unit('hkustgz-5');assert.equal(ces.children.length,4);assert.equal(ces.organizationReview.status,'conflicting_scopes');assert.ok(ces.children.every(c=>c.kind==='education_pillar'));assert.ok(!ces.children.some(c=>/办公室|UG Teaching/.test(c.name)));assert.equal(ces.relatedNavigationGroups.length,2);
 const cft=unit('hkustgz-6');assert.equal(cft.children.length,0);assert.equal(cft.relatedNavigationGroups[0].entries.length,3);assert.equal(cft.relatedNavigationGroups[0].entries[0].url,null);assert.equal(C.sources.find(s=>s.id==='organization-cft-structure-failed-20261029').evidenceLevel,'official_entry_access_failed');
});
test('organization scope preserves all prior people, programmes, directories and evidence',()=>{
 const old=read('data/snapshots/c14b4c6262c0cc8343c9781b4be5302b44dce456512b7f094f6e3ad7c714eec3.json');for(const key of ['faculty','programs','directories'])assert.deepEqual(C[key],old[key]);for(const row of old.sources)assert.deepEqual(C.sources.find(s=>s.id===row.id),row);
 assert.equal(P.units.length,9);assert.equal(P.allSevenHierarchiesComplete,false);assert.ok(P.units.every(u=>!u.organizationReview.organizationComplete&&!u.organizationReview.facultyComplete));
});
