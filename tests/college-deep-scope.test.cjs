'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/college-deep-scope-20261102.json'),old=read('data/snapshots/4b781419cd35517d1c1a73bab12eb7530b09a4308711759819ec776df331ba67.json');
const unit=(c,id)=>c.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('deep college review keeps original inputs, policies, people and entrance receipts',()=>{
 for(const key of ['faculty','programs','directories','funding'])assert.deepEqual(C[key].slice(0,old[key].length),old[key]);
 for(const s of old.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);
 for(const p of P.units){const a=unit(C,p.unitId),b=unit(old,p.unitId);for(const key of ['url','sourceIds','bodySha256','retrievedUrl','entryBodyStatus','staffEntries'])assert.deepEqual(a[key],b[key],p.unitId+' '+key);if(p.unitId==='hku-1')assert.deepEqual(a.children.map(({providedEntries,...original})=>original),b.children);else assert.deepEqual(a.children,b.children);assert.deepEqual(a.priorOrganizationReview,b.organizationReview);}
 for(const s of P.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);
 assert.equal(P.sources.length,8);assert.equal(P.units.length,5);assert.equal(P.allSevenHierarchiesComplete,false);
});
test('landscape division retains conflicting scopes and uses its own actual read target',()=>{
 const u=unit(C,'hku-1');assert.equal(u.children.length,3);assert.equal(u.organizationReview.status,'conflicting_scopes');
 const g=u.relatedNavigationGroups[0],e=g.entries[0];assert.equal(g.kind,'related_academic_units');assert.equal(g.parentUnitName,undefined);assert.equal(e.kind,'division');assert.equal(e.entryBodyStatus,'body_read');
 assert.equal(e.url,'https://www.arch.hku.hk/departments-and-divisions/division-of-landscape-architecture/');assert.equal(e.availability,e.supervisionEligibility);assert.equal(e.availability,'unknown');
 const s=C.sources.find(s=>s.id==='deep-hku-landscape-20261102');assert.equal(e.bodySha256,s.bodySha256);assert.equal(e.retrievedUrl,s.url);assert.match(e.note,/旧校级介绍/);
});
test('fashion research topics, organisations, hubs and dated staff counts stay distinct',()=>{
 const sft=unit(C,'polyu-9');assert.equal(sft.children.length,0);
 assert.equal(sft.relatedNavigationGroups.find(g=>g.kind==='research_fields').entries.length,3);
 const org=sft.relatedNavigationGroups.find(g=>g.kind==='research_organizations');assert.equal(org.entries.filter(e=>e.kind==='centre').length,2);assert.equal(org.entries.filter(e=>e.kind==='institute').length,2);assert.equal(org.entries.filter(e=>e.kind==='research_lab').length,1);
 assert.equal(sft.relatedNavigationGroups.find(g=>g.kind==='college_components').entries.length,4);assert.match(sft.organizationReview.summary,/2025年9月/);assert.match(sft.organizationReview.summary,/不是导师名额/);
 const hotel=unit(C,'polyu-10');assert.equal(hotel.children.length,0);assert.equal(hotel.relatedNavigationGroups[0].entries.length,2);assert.ok(hotel.relatedNavigationGroups[0].entries.every(e=>e.kind==='centre'));
});
test('actual medical list and future technology scope preserve unknowns and earlier failed entry',()=>{
 const med=unit(C,'hku-8'),oldMed=unit(old,'hku-8');assert.deepEqual(med.relatedNavigationGroups,oldMed.relatedNavigationGroups);assert.equal(med.relatedNavigationGroups.find(g=>g.parentUnitName==='School of Clinical Medicine').entries.length,17);
 const cft=unit(C,'hkustgz-6');assert.equal(cft.organizationReview.organizationComplete,false);assert.deepEqual(cft.relatedNavigationGroups,unit(old,'hkustgz-6').relatedNavigationGroups);assert.match(cft.organizationReview.summary,/行政架构页未读到/);assert.equal(cft.priorOrganizationReview.unreadEntryUrl,'https://cft.hkust-gz.edu.cn/about/administration-structure/');
});
