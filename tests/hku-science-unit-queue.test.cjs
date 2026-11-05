'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),old=read('data/snapshots/db656f4dbae0e45a8e47f1c1f1b664754dbdc7ac4085f3acc89516f3e0b96af8.json'),P=read('data/research/hku-science-unit-queue-20261105.json');
test('five existing science-unit followups append exact evidence without rewriting old schools, people, policies or sources',()=>{
 for(const key of Object.keys(old).filter(k=>!['sources','directories','academicEntryFollowups','snapshotId'].includes(k)))assert.deepEqual(C[key],old[key]);
 for(const key of ['sources','directories','academicEntryFollowups']){assert.deepEqual(C[key].slice(0,old[key].length),old[key]);assert.deepEqual(C[key].slice(old[key].length),P[key==='academicEntryFollowups'?'entries':key]);}
 assert.equal(P.sources.length,12);assert.equal(P.entries.length,5);assert.equal(C.faculty.length,1378);assert.equal(P.newFaculty,0);assert.equal(P.allSevenHierarchiesComplete,false);
 const parent=C.academicCoverage.find(m=>m.universityId==='hku').units.find(u=>u.id==='hku-9');for(const e of P.entries){assert.ok(parent.children.some(c=>c.url===e.url));assert.equal(e.organizationComplete,false);assert.equal(e.facultyComplete,false);assert.equal(e.nextEntries.at(-1).bodyStatus,'not_read');}
});
test('scoped name cards exclude filters and courses, preserve same names by supplied URL and keep unlinked people unlinked',()=>{
 assert.deepEqual(P.directories.map(d=>d.observedNamedCards),[48,31,63,8]);assert.equal(P.counts.namedCards,150);assert.equal(P.counts.providedIndividualProfileUrls,71);assert.equal(P.counts.cardsWithoutSeparateProfileClassification,79);
 for(const d of P.directories){assert.equal(d.coverageComplete,false);assert.equal(d.enumerationScope,'saved_body_cards_only');assert.equal(d.census.profilesRead,0);assert.equal(d.census.pendingReasonCounts.not_read,d.census.observedTotal);for(const r of d.census.entries)assert.equal(r.reviewStatus,'not_read');for(const r of d.census.unlinkedEntries){assert.equal(r.profileUrl,null);assert.doesNotMatch(r.name,/^CHEM\d+|Show All/);for(const l of r.providedLinks)assert.equal(l.bodyStatus,'not_read');}}
 const physics=P.directories[2],same=physics.census.entries.filter(e=>e.name==='Prof. Jian Wang');assert.equal(same.length,2);assert.equal(new Set(same.map(e=>e.profileUrl)).size,2);assert.deepEqual(physics.identityNotes,['Prof. Jian Wang']);
 const chem=P.directories[1];assert.match(chem.census.unlinkedEntries[0].name,/Xiaoyu/);assert.ok(chem.census.unlinkedEntries.some(e=>e.providedLinks.length));assert.match(chem.census.unlinkedEntries.find(e=>e.name.includes('(R.I.P.)')).reason,/纪念记录/);assert.ok(P.directories[0].census.unlinkedEntries.every(e=>e.name!=='Honorary Appointees'));
});
test('mathematics retains both literal meta refreshes and treats its failed embedded names as unknown',()=>{
 const m=P.entries.find(e=>e.url==='http://www.math.hku.hk/');assert.equal(m.retrievedUrl,'https://hkumath.hku.hk/web/index.php');assert.deepEqual(m.unitNavigationChain.map(h=>h.suppliedHref),['http://hkumath.hku.hk/web/','./index.php']);
 const staff=m.nextEntries[0];assert.equal(staff.bodyStatus,'body_read');assert.equal(staff.contentScope,'embedded_directory_shell');assert.equal(staff.directoryId,undefined);assert.equal(staff.embeddedRead.namesRead,0);assert.equal(staff.embeddedRead.failureKind,'redirect_limit_exceeded');assert.match(staff.readNote,/未读到姓名/);
 assert.equal(P.sources.find(s=>s.id==='hku-science-mathematics-navigation-20261105').bodySha256,'e22d626d94399b124e767ac3529034040b5ba5c1c30024bee95b1c1781c7f778');
});
