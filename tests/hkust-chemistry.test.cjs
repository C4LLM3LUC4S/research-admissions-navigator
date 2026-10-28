'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/hkust-chemistry-census-20261028.json'),L=require('../dist/logic.js');
const old=read('data/snapshots/46b23bcfbea4a9f89283670036da4d4268a15871e319e67d98b6ee1e26e1f682.json');
const profile=(q='',degree='MPhil',cycle='2027/28')=>({...L.defaultProfile(C),universityIds:['hkust'],researchQuery:q,degree,cycle});
const source=id=>C.sources.find(s=>s.id===id);

test('chemistry extends research without changing prior people, programmes, sources or eight shared identities',()=>{
 for(const key of ['faculty','programs','sources'])for(const row of old[key])assert.deepEqual(C[key].find(x=>x.id===row.id),row);
 assert.equal(P.faculty.length,44);assert.equal(P.existingIdentityEvidence.length,8);
 assert.equal(C.faculty.length,1191);assert.equal(C.programs.length,36);
 for(const identity of P.existingIdentityEvidence){assert.ok(old.faculty.some(f=>f.id===identity.id));assert.ok(!P.faculty.some(f=>f.id===identity.id));}
});

test('school pages and four department categories preserve roles and historic duplicate cards',()=>{
 assert.equal(P.directories[0].census.pageUrls.length,4);
 assert.deepEqual(P.staffEntries.map(e=>e.profileLeads.length),[42,41,10,5,8]);
 const leads=P.staffEntries.flatMap(e=>e.profileLeads);
 for(const node of P.excludedHistorical){const rows=leads.filter(l=>l.url.endsWith(node.nodeId==='112'?'/professor-nai-teng-yu':node.nodeId==='675'?'/professor-nai-teng-yu-0':node.nodeId==='676'?'/professor-hiroyuki-hiraoka':'/professor-chris-chi-kwong-chang'));assert.equal(rows.length,1);assert.equal(rows[0].facultyId,null);assert.match(rows[0].reviewNote,/历史|历任/);}
 const zhang=leads.find(l=>l.name.includes('Li-Sheng'));assert.equal(zhang.facultyId,'hkust-chemistry-40');
 const formerJia=leads.find(l=>l.name.includes('Guochen'));assert.equal(formerJia.facultyId,'hkust-chemistry-12');
 assert.ok(P.directories.every(d=>d.coverageComplete===false));assert.ok(P.faculty.every(f=>f.availability.state==='unknown'));
 assert.ok(P.faculty.find(f=>f.id==='hkust-chemistry-21').directoryRole.includes('Lecturer'));
 assert.ok(P.faculty.find(f=>f.id==='hkust-chemistry-department-107').directoryRole.includes('Emeritus'));
});

test('provided redirects are source-bound while HTTP evidence and failed sites remain unusable as HTTPS links',()=>{
 const quan=P.faculty.find(f=>f.id==='hkust-chemistry-23'),link=quan.extraLinks[0],s=source(link.sourceId);
 assert.equal(link.url,'http://www.boroncatal.com/people');assert.equal(s.url,'http://www.boroncatal.com/people/');
 assert.equal(s.originalUrl,link.url);assert.equal(s.transportScope,'read_only_http_source_not_clickable');
 assert.equal(L.sourceUrl(C,s),null);assert.deepEqual(L.facultyLinks(C,quan),[]);
 const cao=P.faculty.find(f=>f.id==='hkust-chemistry-01');assert.ok(L.facultyLinks(C,cao).some(l=>l.url==='https://hcaogroup.com/'));
 const chen=P.faculty.find(f=>f.id==='hkust-chemistry-04');assert.equal(chen.extraLinks[0].bodyStatus,'not_read');assert.match(chen.extraLinks[0].readNote,/404/);
 assert.ok(!P.sources.some(s=>s.url.includes('qing-chen.org')));
 assert.ok(!P.sources.some(s=>s.url.includes('/captcha')));
 for(const f of P.faculty)for(const l of f.extraLinks.filter(l=>l.bodyStatus==='body_read')){const s=source(l.sourceId);assert.equal(s.parentSourceId,l.parentSourceId);assert.equal(s.originalUrl,l.url);assert.ok(source(l.parentSourceId).discoveredLinks.includes(l.url));}
});

test('research queries reach concrete chemical topics without converting roles or notices into live places',()=>{
 for(const [q,id] of [['生物催化','hkust-chemistry-01'],['RNA加工','hkust-chemistry-03'],['极化激元化学','hkust-chemistry-05'],['光开关材料','hkust-chemistry-35'],['法医毒理学','hkust-chemistry-department-737'],['碳点','hkust-chemistry-department-911']])assert.ok(L.facultyFor(C,profile(q)).some(f=>f.id===id),q);
 const cao=P.faculty.find(f=>f.id==='hkust-chemistry-01');assert.match(cao.applicationNotes[0].text,/HKPFS本身只适用于PhD/);assert.equal(cao.availability.cycle,null);
 const chang=P.faculty.find(f=>f.id==='hkust-chemistry-03');assert.match(chang.applicationNotes[0].text,/专指博士后/);
 assert.ok(!P.faculty.some(f=>/Nai.Teng|Hiroyuki|Chris Chi Kwong/.test(f.name)));
});

test('chemistry keeps the actual local July15 deadline, both spring dates and doctoral-only fellowship',()=>{
 const p=P.programmes[0];assert.equal(p.contact.status,'unknown');assert.match(p.selection.text,/不能推成申请前/);
 assert.deepEqual(L.deadlinesFor(p,profile()).map(d=>[d.date,d.at]),[['2027-06-01',null],['2027-07-15',null]]);
 assert.deepEqual(L.deadlinesFor(p,profile('','MPhil','2026/27 Spring')).map(d=>d.date),['2026-11-01','2026-12-15']);
 assert.ok(!L.deadlinesFor(p,profile()).some(d=>d.route.includes('HKPFS')));
 assert.equal(L.deadlinesFor(p,profile('','PhD'),C.universities.find(u=>u.id==='hkust')).find(d=>d.route.includes('HKPFS')).at,'2026-12-01T23:59:00+08:00');
 assert.match(p.requirements.find(r=>r.label.includes('新旧')).text,/六年.*八年/);
 assert.match(p.requirements.find(r=>r.label.startsWith('完整上传')).text,/未逐项/);
 assert.equal(p.finances[0].rates[0].value,180);assert.equal(p.finances[0].rates[0].unit,'application');
 assert.ok(!p.finances.some(f=>f.kind==='studentship'||f.kind==='tuition'));
});

test('old identity, new teacher and degree-scoped chemistry action survive portable restore',()=>{
 const state={profile:profile('生物催化'),shortlist:['hkust-cbe-580a70f80c1fd1','hkust-chemistry-01'],tasks:[{id:'task-chemistry',text:'核2027/28材料与研究方向后联系',done:false,facultyId:'hkust-chemistry-01',programId:'hkust-chemistry-rpg'}]};
 const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,state.shortlist);assert.equal(restored.tasks[0].programId,'hkust-chemistry-rpg');assert.equal(restored.profile.degree,'MPhil');assert.equal(restored.profile.researchQuery,'生物催化');
});
