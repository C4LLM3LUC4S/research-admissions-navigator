'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),old=read('data/snapshots/bffaadbbeb3998adbe2105d743059a872811bc33c3599a008c81d4bdbd8f6add.json'),P=read('data/research/cuhk-science-unit-entrances-20261105.json');
test('CUHK Science entrances preserve all old sources, faculty, policies, structures, directories and first followups',()=>{
 for(const k of Object.keys(old).filter(k=>!['sources','academicEntryFollowups','snapshotId'].includes(k)))assert.deepEqual(C[k],old[k]);
 assert.deepEqual(C.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(C.sources.slice(old.sources.length),P.sources);assert.deepEqual(C.academicEntryFollowups.slice(0,old.academicEntryFollowups.length),old.academicEntryFollowups);assert.deepEqual(C.academicEntryFollowups.slice(old.academicEntryFollowups.length),P.entries);
 assert.equal(P.sources.length,6);assert.equal(P.entries.length,5);assert.equal(P.newFaculty,0);assert.equal(P.allSevenHierarchiesComplete,false);
 const science=C.academicCoverage.find(m=>m.universityId==='cuhk').units.find(u=>u.id==='cuhk-7');assert.equal(science.children.length,6);assert.ok(P.entries.every(e=>science.children.some(child=>child.url===e.url)));
 const reused=C.sources.find(s=>s.id===P.reusedExistingScope.sourceId);assert.equal(reused.checkedAt,'2026-10-26');assert.ok(!P.sources.some(s=>s.url===reused.url));
});
test('literal redirects and refusal stay separate from actual academic content and admissions requirements',()=>{
 const life=P.entries.find(e=>e.url==='http://www.cuhk.edu.hk/lifesciences'),physics=P.entries.find(e=>e.url==='http://www.phy.cuhk.edu.hk/');assert.equal(life.unitNavigationChain[0].declaredTarget,'http://www.sls.cuhk.edu.hk');assert.equal(life.retrievedUrl,'https://www.sls.cuhk.edu.hk/');assert.equal(physics.retrievedUrl,'https://app.phy.cuhk.edu.hk/');assert.match(life.summary,/研究主题.*本科项目.*不改称下属学系/);
 const refusal=P.entries.find(e=>e.bodyStatus==='read_failed');assert.equal(refusal.failureKind,'http_403');assert.equal(refusal.retrievedUrl,null);assert.equal(refusal.bodySha256,undefined);assert.deepEqual(refusal.sourceIds,[]);assert.match(refusal.summary,/未读到单位正文/);
 for(const e of P.entries){assert.equal(e.organizationComplete,false);assert.equal(e.facultyComplete,false);for(const n of e.nextEntries){assert.equal(n.bodyStatus,'not_read');assert.equal(n.availability,'unknown');assert.equal(n.supervisionEligibility,'unknown');}}
 assert.equal(physics.nextEntries.filter(e=>e.label.includes('MPhil/PhD')).length,2);assert.ok(physics.nextEntries.every(e=>!e.url.includes('/msc-')));
});
