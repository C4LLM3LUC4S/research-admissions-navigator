'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
test('later unit reads retain all original structure, policies, people, and source receipts',()=>{
 const c=read('data/catalog.json'),old=read('data/snapshots/a56e59194019b4005c46cc64d18f9e14aac964ab30cb76015da612eceb525785.json'),p=read('data/research/unit-entry-followups-20261104.json');
 for(const k of ['academicCoverage','academicEntryProgress','faculty','programs','directories','funding'])assert.deepEqual(c[k],old[k]);
 assert.deepEqual(c.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(c.sources.slice(old.sources.length,old.sources.length+7),p.sources);assert.deepEqual(c.academicEntryFollowups,p.entries);
 assert.equal(p.sources.length,7);assert.equal(p.entries.length,8);const fail=p.entries.find(e=>e.bodyStatus==='read_failed');assert.equal(fail.url,'https://isom.hkust.edu.hk/');assert.equal(fail.bodySha256,undefined);assert.deepEqual(fail.sourceIds,[]);
 for(const r of p.entries){assert.equal(r.organizationComplete,false);assert.equal(r.facultyComplete,false);for(const e of r.nextEntries||[])assert.equal(e.bodyStatus,'not_read');}
 const sbme=p.entries.find(e=>e.url==='https://sbme.hku.hk/');assert.match(sbme.summary,/BEng及本科招生/);assert.match(sbme.summary,/不能据此生成MPhil\/PhD/);
});
