'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/scope-clarifications-20261102.json'),old=read('data/snapshots/d11c2b26bf01e473ba6d9140b2dd0a99f93a7b419efc077817b639c777d0ae73.json');
const unit=(c,id)=>c.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('scope update preserves original entrance receipts, child identities, people, policies and all old evidence dates',()=>{
 for(const key of ['faculty','programs','directories'])assert.deepEqual(C[key],old[key]);for(const s of old.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);
 for(const p of P.units){const u=unit(C,p.unitId),prior=unit(old,p.unitId);for(const key of ['url','retrievedUrl','sourceIds','bodySha256','readMethod','entryBodyStatus','children','staffEntries'])assert.deepEqual(u[key],prior[key],p.unitId+' '+key);assert.deepEqual(u.priorOrganizationReview,prior.organizationReview);}
 for(const s of P.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);assert.ok(C.sources.length>=old.sources.length+P.sources.length);assert.equal(P.units.length,5);assert.equal(C.programs.length,40);assert.equal(C.academicCoverage.reduce((n,m)=>n+m.units.reduce((a,u)=>a+u.children.length,0),0),230);
});
test('research fields, undergraduate training, labs and institutes do not turn into departments or vacant places',()=>{
 const math=unit(C,'cuhk-zhizhen');assert.equal(math.children.length,0);assert.match(math.organizationReview.summary,/本科—博士贯通/);assert.equal(math.relatedNavigationGroups[0].entries.length,6);
 const design=unit(C,'polyu-8'),g=design.relatedNavigationGroups.find(g=>g.kind==='research_organizations');assert.equal(design.children.length,0);assert.equal(g.entries.length,11);assert.equal(g.entries.filter(e=>e.kind==='centre').length,3);assert.equal(g.entries.filter(e=>e.kind==='research_lab').length,7);assert.equal(g.entries.filter(e=>e.kind==='institute').length,1);
 for(const e of g.entries){assert.equal(e.entryBodyStatus,'not_read');assert.equal(e.availability,'unknown');assert.equal(e.supervisionEligibility,'unknown');}assert.equal(P.allSevenHierarchiesComplete,false);
});
test('reviewed next steps use exact read scope sources and leave the unread handbook PDF distinct',()=>{
 for(const p of P.units)for(const action of p.reviewedNavigation){assert.ok(unit(C,p.unitId).reviewedNavigation.some(a=>JSON.stringify(a)===JSON.stringify(action)));assert.ok(p.organizationReview.sourceIds.includes(action.sourceId));const s=C.sources.find(s=>s.id===action.sourceId);assert.equal(s.checkedAt,'2026-11-02');assert.match(s.bodySha256,/^[a-f0-9]{64}$/);}
 const law=C.sources.find(s=>s.id==='scope-cuhk-law-faculty-20261102');assert.equal(law.originalUrl,'http://www.law.cuhk.edu.hk/');assert.equal(law.url,'https://www.law.cuhk.edu.hk/app/');assert.match(unit(C,'cuhksz-7').reviewedNavigation.find(a=>a.kind==='document_entry').scope,/未下载或解析/);assert.match(unit(C,'cuhk-5').reviewedNavigation[0].scope,/清算轮仅在有余位/);
});
