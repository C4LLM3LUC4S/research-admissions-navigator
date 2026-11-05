'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),old=read('data/snapshots/c0a3dd526c423dcddc3a1cca0ebbbc57ddfd15a7b8d6444fc40a13f2c3a63ac7.json'),P=read('data/research/stem-unit-queue-20261105.json');
test('STEM continuation keeps every prior source and record and reuses five dated bodies without rewriting them',()=>{
 for(const k of Object.keys(old).filter(k=>!['sources','academicEntryFollowups','snapshotId'].includes(k)))assert.deepEqual(C[k],old[k]);assert.deepEqual(C.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(C.sources.slice(old.sources.length,old.sources.length+P.sources.length),P.sources);assert.deepEqual(C.academicEntryFollowups.slice(0,old.academicEntryFollowups.length),old.academicEntryFollowups);assert.deepEqual(C.academicEntryFollowups.slice(old.academicEntryFollowups.length,old.academicEntryFollowups.length+P.entries.length),P.entries);assert.deepEqual(C.academicUnitNotes,P.academicUnitNotes);
 assert.equal(P.sources.length,6);assert.equal(P.entries.length,4);assert.equal(P.reusedSourceIds.length,5);for(const id of P.reusedSourceIds){const s=C.sources.find(s=>s.id===id);assert.equal(s.checkedAt,old.sources.find(x=>x.id===id).checkedAt);assert.ok(s.checkedAt<'2026-11-05');}assert.equal(C.faculty.length,1378);assert.equal(C.programs.length,40);
});

test('Architecture entrance batch preserves the full prior catalogue and adds only its declared sources and followups',()=>{
 const prior=read('data/snapshots/b65961778358e71b96b5343faba9466b26533700c7bd4bcebad9e90459e877f6.json'),p=read('data/research/hku-architecture-unit-entrances-20261105.json');
 for(const k of Object.keys(prior).filter(k=>!['sources','academicEntryFollowups','snapshotId'].includes(k)))assert.deepEqual(C[k],prior[k]);
 assert.deepEqual(C.sources,prior.sources.concat(p.sources));assert.deepEqual(C.academicEntryFollowups,prior.academicEntryFollowups.concat(p.entries));assert.equal(p.sources.length,3);assert.equal(p.entries.length,3);assert.equal(p.newFaculty,0);
});
test('actual old AP to PM navigation, dated announcements and unread recruitment do not become departments or positions',()=>{
 const pm=P.entries.find(e=>e.url==='http://www.polyu.edu.hk/ap');assert.equal(pm.retrievedUrl,'https://www.polyu.edu.hk/pm/');assert.match(pm.summary,/2027-2028 MPhil\/PhD/);const hti=P.entries.find(e=>e.url.includes('/hti/'));assert.match(hti.summary,/2026\/27.*不能改成2027\/28/);assert.match(hti.summary,/不当作四个下属学系/);
 const recruitment=P.entries.flatMap(e=>e.nextEntries).find(e=>e.url.includes('projects-recruiting'));assert.equal(recruitment.bodyStatus,'not_read');assert.equal(recruitment.availability,'unknown');
 const n=C.academicUnitNotes[0];assert.equal(n.parentUnitId,'hkust-2');assert.equal(n.childName,'Department of Materials');assert.equal(n.establishedEffectiveAt,'2026-07-01');assert.equal(n.publishedAt,'2026-10-26');assert.deepEqual(n.announcedProgrammes,[{degree:'PhD',year:2027},{degree:'MSc',year:2027},{degree:'BEng',year:2028}]);assert.equal(n.availability,'unknown');assert.equal(C.academicCoverage.flatMap(m=>m.units).find(u=>u.id==='hkust-2').children.find(ch=>ch.name===n.childName).url,null);
});
