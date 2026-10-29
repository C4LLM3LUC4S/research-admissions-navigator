'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),C=read('data/catalog.json'),P=read('data/research/stem-college-structure-20261029.json'),old=read('data/snapshots/402a0e3bc9494ceb1641db134c9dc0bae7486130b9c43d576be4bbb307541436.json'),unit=(c,id)=>c.academicCoverage.flatMap(m=>m.units).find(u=>u.id===id);
test('engineering retains seven old nodes and adds only the sourced joint school and material entry',()=>{
 const u=unit(C,'hku-6'),prior=unit(old,'hku-6');assert.equal(prior.children.length,7);assert.equal(u.children.length,8);assert.equal(u.organizationReview.status,'conflicting_scopes');assert.match(u.organizationReview.summary,/七项|七个|七/);assert.match(u.organizationReview.summary,/八项|八/);
 const material=u.children.find(c=>c.name==='Department of Materials and Energy');assert.equal(material.url,'https://mse.hku.hk/');assert.equal(material.entryBodyStatus,'not_read');assert.equal(material.previousNavigation.url,null);
 const joint=u.children.find(c=>c.name==='School of Biomedical Engineering');assert.equal(joint.relationship,'affiliated_school');assert.equal(joint.crossFacultyRelation,'joint_school');assert.deepEqual(joint.jointFaculties,['Medicine','Engineering','Dentistry','Science']);assert.equal(C.academicCoverage.reduce((n,m)=>n+m.units.length,0),66);
 const ece=u.children.find(c=>c.name==='Department of Electrical and Computer Engineering');assert.equal(ece.entryBodyStatus,prior.children.find(c=>c.name===ece.name).entryBodyStatus);assert.equal(ece.url,'https://ece.hku.hk/');assert.equal(ece.providedEntries[0].url,'https://www.eee.hku.hk/');assert.equal(ece.providedEntries[0].bodyStatus,'not_read');
});
test('three college lists retain their school and division types and original read URL spelling',()=>{
 assert.equal(unit(C,'cuhk-7').children.length,6);assert.equal(unit(C,'polyu-4').children.length,5);const science=unit(C,'hkust-1');assert.equal(science.children.length,5);assert.equal(science.children.find(c=>c.name==='生命科学学部').kind,'division');assert.ok(science.children.filter(c=>c.kind==='department').length===4);
 const best=unit(C,'polyu-4').children.find(c=>c.name.includes('Sports Technology'));assert.equal(best.url,'https://www.polyu.edu.hk/best/');assert.equal(best.listedUrl,'https://www.polyu.edu.hk/best');assert.equal(best.entryBodyStatus,'body_read');assert.equal(best.bodySha256,unit(old,'polyu-4').children.find(c=>c.name===best.name).bodySha256);
});
test('STEM list review preserves every existing person policy directory source and other college',()=>{
 for(const k of ['faculty','programs','directories'])assert.deepEqual(C[k],old[k]);for(const s of old.sources)assert.deepEqual(C.sources.find(x=>x.id===s.id),s);const changed=new Set(P.units.map(u=>u.unitId));for(const m of old.academicCoverage)for(const u of m.units)if(!changed.has(u.id))assert.deepEqual(unit(C,u.id),u);
 assert.equal(P.units.length,4);assert.equal(P.sources.length,8);assert.equal(P.allSevenHierarchiesComplete,false);assert.ok(P.units.every(u=>u.organizationReview.organizationComplete===false&&u.organizationReview.facultyComplete===false));
});
