'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/polyu-cee-census-20261029.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/2a90437bb7228d0cca797d1084714aac1dbd159039f113c9d01cfc4972e8be00.json');
const f=i=>P.faculty.find(x=>x.id==='polyu-cee-'+String(i).padStart(3,'0'));
test('CEE preserves old records and exposes every actual role card without inventing missing research',()=>{
 for(const key of ['faculty','programs','sources'])for(const row of old[key])assert.deepEqual(C[key].find(x=>x.id===row.id),row);
 assert.equal(P.faculty.length,67);assert.equal(P.pendingResearch.length,30);assert.equal(P.directories.reduce((n,d)=>n+d.census.entries.length+d.census.unlinkedEntries.length,0),106);
 assert.equal(P.directories[0].census.entries.length,97);assert.equal(P.directories.reduce((n,d)=>n+d.census.unlinkedEntries.length,0),9);
 assert.ok(!f(45));assert.ok(P.pendingResearch.some(x=>x.index===45));assert.match(P.directories[0].census.entries[45].name,/Kwan/i);
 assert.equal(read('STATUS.json').counts.faculty,C.faculty.length);assert.equal(read('data/coverage.json').counts.sources,C.sources.length);
});
test('new searches cover actual environmental, transport, control and material problems',()=>{
 for(const [query,i] of [['PFAS',30],['智能交通',32],['PINN',29],['厌氧生物技术',96],['环境流行病学',66],['月壤',34],['水力瞬变',15]])assert.ok(L.facultyFor(C,{...L.defaultProfile(C),universityIds:['polyu'],researchQuery:query}).some(x=>x.id===f(i).id),query);
 assert.match(f(29).summary,/轨道减振.*深度学习.*能量采集/);assert.ok(!f(66).topics.includes('数学与统计'));assert.ok(!f(9).topics.includes('机器人与控制'));assert.ok(!f(43).researchKeywords.includes('智能体'));
});
test('declared HTML navigation retains both bodies and the original teacher binding',()=>{
 const source=P.sources.find(s=>s.navigationEvidence);const original=P.sources.find(s=>s.id===source.navigationEvidence.sourceId);assert.ok(source);assert.equal(original.originalUrl,source.originalUrl);assert.equal(original.url,source.navigationEvidence.documentUrl);assert.equal(source.navigationEvidence.bodySha256,original.bodySha256);assert.equal(source.navigationEvidence.declaredTarget,source.url);assert.ok(original.discoveredLinks.includes(source.url));
 assert.equal(L.sourceUrl(C,source),source.url);assert.ok(L.facultyLinks(C,f(15)).some(x=>x.url==='https://hkpolyucee.wixsite.com/hfduan'));
 const changed=structuredClone(C);changed.sources.find(s=>s.id===source.parentSourceId).discoveredLinks=[];assert.equal(L.sourceUrl(changed,source),null);
 assert.equal(P.counts.accessDenials,3);assert.equal(P.counts.deferredAfterHostRefusal,40);assert.equal(P.counts.decodePending,3);assert.equal(P.counts.transportFailures,2);
});
test('MPhil never inherits HKPFS deadlines or old tuition as a new-year price',()=>{
 const p=P.programmes.find(p=>p.id==='polyu-cee-rpg-route'),h=P.programmes.find(p=>p.id==='polyu-cee-hkpfs-2027'),profile={...L.defaultProfile(C),cycle:'2027/28',degree:'MPhil'};
 assert.equal(p.cycle,null);assert.equal(p.cycleVerified,false);assert.deepEqual(p.deadlines,[]);assert.equal(h.cycle,'2027/28');assert.deepEqual(h.degrees,['PhD']);
 assert.deepEqual(L.deadlinesFor(h,profile,C.universities.find(u=>u.id==='polyu')),[]);assert.equal(L.deadlinesFor(h,{...profile,degree:'PhD'},C.universities.find(u=>u.id==='polyu')).length,2);
 assert.equal(L.financeRates(p.finances[0],profile).matched[0].value,600);assert.equal(L.financeRates(p.finances[1],profile).matched.length,0);assert.ok(L.financeRates(p.finances[1],profile).reference.every(r=>r.cycle==='2026/27'));
 assert.ok(L.requirementsFor(p,profile).every(r=>!r.degrees||r.degrees.includes('MPhil')));
});
test('dated PhD advertising and researcher jobs stay separate from live places and MPhil',()=>{
 assert.equal(f(43).availability.state,'advertised');assert.equal(f(43).availability.cycle,'2027/28');assert.deepEqual(f(43).availability.degrees,['PhD']);assert.match(f(43).availability.text,/不是MPhil/);assert.ok(P.faculty.filter(x=>x.id!==f(43).id).every(x=>x.availability.state==='unknown'));
 assert.match(f(5).identityNote,/荣休/);assert.match(f(95).identityNote,/Research Fellow/);assert.match(f(40).applicationNotes[0].text,/研究助理.*博士后.*不当作/);assert.match(f(11).applicationNotes[0].text,/2026年6月.*港城大/);
});
