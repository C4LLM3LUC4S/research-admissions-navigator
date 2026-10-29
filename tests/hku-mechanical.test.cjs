'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hku-mechanical-census-20261029.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/56ff5b59801b54901679a5d5fb09086f57e6daf7597da7e431878e7aa18976a7.json');
const profile=(q='',degree='MPhil')=>({...L.defaultProfile(C),universityIds:['hku'],researchQuery:q,degree,cycle:'2027/28'});
const person=i=>P.faculty.find(f=>f.id==='hku-mechanical-'+String(i).padStart(2,'0'));

test('mechanical extends exact old records and binds current counts to the actual catalogue',()=>{
 for(const key of ['faculty','programs','sources'])for(const row of old[key])assert.deepEqual(C[key].find(x=>x.id===row.id),row);
 assert.equal(P.faculty.length,55);assert.equal(P.sources.length,95);assert.equal(P.existingIdentityEvidence[0].id,'wide-hku-peng-lu');
 assert.ok(!P.faculty.some(f=>f.id==='wide-hku-peng-lu'));assert.ok(C.faculty.length>=old.faculty.length+55);
 const status=read('STATUS.json'),quality=read('data/coverage.json').counts;
 assert.equal(status.counts.faculty,C.faculty.length);assert.equal(status.counts.programme_or_route_cards,C.programs.length);assert.equal(status.counts.official_directory_entries,C.directories.length);assert.equal(quality.sources,C.sources.length);
});

test('all seven mechanical role categories retain actual provided links and unlinked cards separately',()=>{
 assert.equal(P.directories.length,7);assert.deepEqual(P.directories.map(d=>d.census.entries.length+d.census.unlinkedEntries.length),[28,5,7,4,15,21,26]);
 const leads=P.staffEntries.flatMap(e=>e.profileLeads),unlinked=P.directories.flatMap(d=>d.census.unlinkedEntries);
 assert.equal(leads.length,66);assert.equal(new Set(leads.map(l=>l.url)).size,66);assert.equal(unlinked.length,40);assert.ok(unlinked.every(l=>!l.profileUrl));
 assert.equal(leads.filter(l=>l.facultyId).length,56);assert.ok(P.directories.every(d=>!d.coverageComplete));
 for(const d of P.directories)assert.equal(Object.values(d.census.pendingReasonCounts).reduce((a,b)=>a+b,0),d.census.profilesFailed);
 for(const l of leads)assert.equal(l.supervisionEligibility,'unknown');
});

test('mechanical concrete searches find graph control, medical robotics, flow computing and materials',()=>{
 for(const [q,i] of [['图学习',5],['医疗机器人',8],['计算流体力学',3],['二维半导体',44],['模型预测控制',54],['组织工程',55]])assert.ok(L.facultyFor(C,profile(q)).some(f=>f.id===person(i).id),q);
 assert.match(person(36).directoryRole,/Teaching/);assert.match(person(55).identityNote,/港中文/);assert.match(person(64).identityNote,/2025.*退休/);
 assert.ok(!person(28).topics.includes('土木与机械工程'));assert.ok(person(7).topics.includes('材料与能源'));assert.ok(person(5).topics.includes('机器学习'));
 assert.ok(P.faculty.every(f=>f.availability.state==='unknown'&&f.availability.cycle===null));
});

test('unexpected redirects, empty bodies and denied profiles never become verified personal research',()=>{
 for(const s of P.sources)if(s.url.startsWith('https:'))assert.ok(L.sourceUrl(C,s),s.url);
 for(const i of [30,32]){const source=C.sources.find(s=>s.id===person(i).sourceIds[0]);assert.equal(source.evidenceLevel,'teacher_page_linked_from_official_profile');assert.ok(person(i).directorySourceIds.includes(source.parentSourceId));}
 const li=person(12),link=li.extraLinks.find(l=>l.url==='http://www.yugo.hk/');assert.equal(link.bodyStatus,'not_read');assert.match(link.readNote,/第三方/);assert.ok(!P.sources.some(s=>s.url.includes('znaki.fm')));
 assert.ok(P.pendingProfiles.some(r=>r.index===57&&r.reason.includes('404')));assert.ok(P.pendingProfiles.some(r=>r.index===65&&r.reason.includes('403')));
 assert.ok(P.pendingProfiles.some(r=>r.index===31&&r.reason.includes('Xiaoxiao Wu')));
 assert.ok(!P.faculty.some(f=>/hku-mechanical-(31|58|59|61|65)$/.test(f.id)));
 const lin=person(13);assert.ok(lin.extraLinks.some(l=>l.bodyStatus==='body_read'&&l.url.startsWith('http:')));assert.ok(!L.facultyLinks(C,lin).some(l=>l.url.startsWith('http:')));
 assert.ok(L.facultyLinks(C,person(25)).some(l=>l.url==='https://mars.hku.hk/'));
});

test('old intake advertisements and distinct researcher jobs never become current places or MPhil offers',()=>{
 assert.match(person(4).applicationNotes.find(n=>n.kind==='teacher_statement').text,/2026\/27.*2027\/28/);
 assert.match(person(7).applicationNotes.find(n=>n.kind==='teacher_statement').text,/fall\/2026/);
 const song=person(19).applicationNotes.find(n=>n.kind==='teacher_statement');assert.deepEqual(song.degrees,['PhD']);assert.match(song.text,/RA明确Closed/);
 const zhou=person(27).applicationNotes.find(n=>n.kind==='teacher_statement');assert.deepEqual(zhou.degrees,['PhD']);assert.match(zhou.text,/不将它改写为对外MPhil/);
 assert.match(person(30).applicationNotes.find(n=>n.kind==='teacher_statement').text,/不能当港大统一制度/);
});

test('mechanical uses current central dates without making the old brochure or mentorship an admission rule',()=>{
 const p=P.programmes[0];assert.equal(p.contact.status,'unknown');assert.match(p.contact.text,/可选.*额外/);assert.match(p.selection.text,/不能.*录取模式/);
 assert.deepEqual(L.deadlinesFor(p,profile()).map(d=>d.at),['2026-12-01T23:59:00+08:00','2027-04-30T23:59:00+08:00','2027-08-31T23:59:00+08:00']);
 assert.match(p.requirements.find(r=>r.label.startsWith('旧招生册')).text,/2023–24.*只取.*通用/);
 assert.match(p.requirements.find(r=>r.label.startsWith('两名')).text,/不是已有两名导师/);
 assert.match(p.requirements.find(r=>r.label.startsWith('完整材料')).text,/不等于.*自动获资助/);
 assert.ok(!p.finances);assert.ok(p.deadlines.every(d=>d.cycle==='2027/28'));
});

test('old identity and a new mechanical teacher restore together with degree and programme action',()=>{
 const state={profile:profile('图学习'),shortlist:['wide-hku-peng-lu',person(5).id],tasks:[{id:'task-mech',text:'核机械系完整材料再联系',done:false,facultyId:person(5).id,programId:'hku-mechanical-rpg'}]};
 const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,state.shortlist);assert.equal(restored.tasks[0].programId,'hku-mechanical-rpg');assert.equal(restored.profile.degree,'MPhil');assert.equal(restored.profile.researchQuery,'图学习');
});
