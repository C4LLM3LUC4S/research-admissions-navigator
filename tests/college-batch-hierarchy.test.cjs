'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/college-batch-hierarchy-20261029.json'),old=read('data/snapshots/7d1cecaafe9213e2fa9198fb9c7828c5c750be84d53da359c04b63b086f1a0e4.json');
const unit=(c,id)=>c.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('college batch adds only sourced missing direct nodes and retains old identities and all read receipts',()=>{
 assert.equal(unit(C,'cuhk-2').children.length,6);assert.equal(unit(C,'cuhk-6').children.length,19);assert.equal(unit(C,'cuhksz-6').children.length,5);
 for(const u of P.units)for(const prior of unit(old,u.unitId).children){const child=unit(C,u.unitId).children.find(c=>c.name===prior.name);assert.ok(child);for(const key of ['bodySha256','retrievedUrl','failure','sourceIds','staffRoutes','entryBodyStatus'])if(prior[key]!==undefined)assert.deepEqual(child[key],prior[key],u.unitId+' '+prior.name+' '+key);if(prior.url!==null)assert.equal(child.url,prior.url);}
 const maths=unit(C,'polyu-2').children[0];assert.equal(maths.url,'http://www.polyu.edu.hk/ama/');assert.equal(maths.entryBodyStatus,'body_read');
 const science=unit(C,'polyu-7');assert.equal(science.children.length,4);assert.ok(science.children.every(c=>c.inventoryListing.name.includes('(')));assert.equal(science.children[0].inventoryListing.url,'https://www.polyu.edu.hk/chem/');
});
test('nested schools retain explicit parents and never enter direct-child or teacher totals',()=>{
 const C=require('./fixtures/before-robotics.cjs');
 const med=unit(C,'hku-8'),clinical=med.relatedNavigationGroups.find(g=>g.parentUnitName==='School of Clinical Medicine');assert.equal(med.children.length,7);assert.equal(clinical.entries.length,17);assert.equal(clinical.entries.filter(e=>e.kind==='department').length,14);assert.equal(clinical.entries.filter(e=>e.kind==='unit').length,2);
 const humanities=unit(C,'hku-2').relatedNavigationGroups.find(g=>g.parentUnitName==='School of Humanities');assert.equal(humanities.entries.length,7);assert.equal(humanities.entries.find(e=>e.name==='Gender Studies').kind,'department_or_programme');
 const fields=unit(C,'cuhksz-1');assert.equal(fields.children.length,0);assert.ok(fields.relatedNavigationGroups[0].entries.every(e=>e.kind==='research_field'&&e.url===null));
 assert.equal(C.academicCoverage.reduce((n,m)=>n+m.units.reduce((a,u)=>a+u.children.length,0),0),230);assert.equal(old.faculty.length,1378);assert.deepEqual(C.faculty.slice(0,old.faculty.length),old.faculty);
});
test('academic centres, support units and degree titles are never relabelled as departments or availability',()=>{
 const art=unit(C,'cuhk-1');assert.equal(art.children.length,11);assert.equal(art.relatedNavigationGroups[0].entries.length,3);
 const eng=unit(C,'hkust-2');assert.equal(eng.children.length,7);assert.equal(eng.relatedNavigationGroups[0].entries.length,6);
 for(const u of P.units){assert.equal(u.organizationReview.organizationComplete,false);assert.equal(u.organizationReview.facultyComplete,false);for(const g of u.navigationGroups)for(const e of g.entries){assert.equal(e.entryBodyStatus,'not_read');assert.equal(e.supervisionEligibility,'unknown');assert.equal(e.availability,'unknown');}}
 assert.match(unit(C,'hkust-5').organizationReview.summary,/MBBS/);assert.equal(unit(C,'hkust-5').children.length,0);
});
test('new college scope preserves all previous people policies evidence and unmodified colleges',()=>{
 // Freeze this historical patch proof; the new batch separately compares every current old object.
 const C=read('data/snapshots/dd78279bdcbfe0e6dd084d2e933bc90ba70fb76da7afd7ccf5c9d5660121549a.json');
 for(const key of ['faculty','programs','directories'])assert.deepEqual(C[key],old[key]);for(const s of old.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);
 const changed=new Set([...P.units,...read('data/research/college-deep-scope-20261102.json').units,...read('data/research/law-business-organization-20261105.json').units].map(u=>u.unitId));for(const m of old.academicCoverage)for(const u of m.units)if(!changed.has(u.id))assert.deepEqual(unit(C,u.id),u);
 assert.equal(P.units.length,31);assert.equal(P.sources.length,43);assert.equal(P.allSevenHierarchiesComplete,false);
});
