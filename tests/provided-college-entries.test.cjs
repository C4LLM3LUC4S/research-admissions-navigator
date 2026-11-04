'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
test('provided department entrances preserve original unknown URLs and all other catalogue records',()=>{
 const c=read('data/catalog.json'),old=read('data/snapshots/f68fbd04012bed9ac1a509132052f923b8aa5661deb52093484cfbaca482c896.json');
 for(const key of ['faculty','programs','directories','funding'])assert.deepEqual(c[key],old[key]);
 for(const s of old.sources)assert.deepEqual(c.sources.find(x=>x.id===s.id),s);
 const current=c.academicCoverage.flatMap(m=>m.units),previous=old.academicCoverage.flatMap(m=>m.units);
 for(const u of current){const prior=previous.find(p=>p.id===u.id);if(u.id==='cuhk-5'){for(const k of ['url','sourceIds','bodySha256','retrievedUrl','entryBodyStatus','children','staffEntries'])assert.deepEqual(u[k],prior[k]);continue;}if(u.id!=='hku-1'){assert.deepEqual(u,prior);continue;}
  assert.equal(u.children.length,3);
  for(const child of u.children){const {providedEntries,...original}=child;assert.deepEqual(original,prior.children.find(p=>p.name===child.name));assert.equal(original.url,null);assert.equal(providedEntries.length,1);const e=providedEntries[0];assert.equal(e.bodyStatus,'not_read');assert.equal(e.availability,'unknown');assert.equal(e.supervisionEligibility,'unknown');assert.ok(c.sources.find(s=>s.id===e.sourceIds[0]).discoveredLinks.includes(e.url));}
 }
});
