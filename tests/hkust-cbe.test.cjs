'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../data/catalog.json'),P=require('../data/research/hkust-cbe-census-20261027.json'),L=require('../dist/logic.js');
const source=id=>C.sources.find(s=>s.id===id),profile=(q='',degree='MPhil',cycle='2027/28')=>({...L.defaultProfile(C),universityIds:['hkust'],researchQuery:q,degree,cycle});
const leads=P.staffEntries.flatMap(s=>s.profileLeads),byName=s=>C.faculty.find(f=>f.name.includes(s));
test('seven current category counts include all68 original links but only67 researched records',()=>{
 assert.deepEqual(P.staffEntries.map(s=>s.profileLeads.length),[29,4,5,17,0,6,7]);assert.equal(leads.length,68);assert.equal(new Set(leads.map(l=>l.url)).size,68);
 assert.equal(leads.filter(l=>l.facultyId).length,67);assert.equal(P.faculty.length,63);assert.equal(P.facultyUpdates.length,4);assert.equal(C.faculty.length,1108);
 assert.equal(leads.filter(l=>!l.facultyId)[0].name,'Teng ZHAO');assert.equal(P.directories[0].coverageComplete,false);
 for(const l of leads){assert.equal(l.profileBodyStatus,'body_read');assert.equal(l.availability,'unknown');assert.equal(l.supervisionEligibility,'unknown');assert.match(l.bodySha256,/^[a-f0-9]{64}$/);}
});
test('old faculty identity and original source dates survive new departmental appointments',()=>{
 const prior=require('../data/snapshots/12e6d8a0d2911cacf7b111f610b884cc6f24eeda0dca98127a7cd12de81a4c0d.json');assert.equal(prior.faculty.length,745);
 for(const f of prior.faculty)assert.ok(C.faculty.some(n=>n.id===f.id),f.id);
 for(const f of P.facultyUpdates){const old=prior.faculty.find(n=>n.id===f.id);assert.equal(f.profileUrl,old.profileUrl);assert.ok(old.sourceIds.every(id=>f.sourceIds.includes(id)));assert.match(f.identityNote,/不是仅按同名/);assert.equal(source(old.sourceIds[0]).checkedAt,'2026-10-26');}
 assert.match(C.faculty.find(f=>f.id==='ling-shi').department,/Electronic and Computer Engineering/);
 assert.match(C.faculty.find(f=>f.id==='wide-hkust-hao-chen').department,/Computer Science and Engineering/);
});
test('an announcedJuly2027 appointment is visible and remains different from a current place',()=>{
 const f=byName('Muyang LIN');assert.match(f.name,/林沐陽/);assert.match(f.identityNote,/2027年7月/);assert.match(f.identityNote,/不当作当前已在任/);assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);
 const out=L.facultyFor(C,profile('可穿戴电子'));assert.ok(out.some(n=>n.id===f.id));assert.ok(!out.some(n=>n.availability.state==='confirmed'));
});
test('personal and institutional links retain exact source authority without promoting shells or other affiliations',()=>{
 const linked=P.sources.filter(s=>s.evidenceLevel==='teacher_page_linked_from_official_profile');assert.equal(linked.length,16);
 for(const s of linked){assert.ok(source(s.parentSourceId).discoveredLinks.includes(s.url));assert.ok(L.sourceUrl(C,s));}
 const shellURLs=['https://www.kinglunyeung.net/','https://yaonimblaboratory.github.io/Yaolab/','https://ieda.ust.hk/dfaculty/so/'];
 for(const url of shellURLs){assert.ok(!linked.some(s=>s.url===url));assert.ok(P.faculty.concat(P.facultyUpdates).flatMap(f=>f.extraLinks).some(x=>x.url===url&&x.bodyStatus==='not_read'));}
 assert.match(byName('Dan LI').applicationNotes[0].text,/墨尔本大学的荣誉任职/);
 assert.equal(P.sources.filter(s=>s.id.startsWith('hkust-cbe-legacy-')).length,3);
 for(const f of [...P.faculty,...P.facultyUpdates])for(const link of L.facultyLinks(C,f))assert.ok(source(link.parentSourceId).discoveredLinks.includes((f.extraLinks.find(x=>L.facultyLinks(C,{...f,extraLinks:[x]}).some(l=>l.url===link.url))||{}).url));
});
test('new Chinese directions and research words locate bounded original research without inventing capacities',()=>{
 for(const [q,name] of [['合成生物学','Becki Yi KUANG'],['生物信息学','Henry Hei Ning LAM'],['过程控制','Richard LAKERVELD'],['电催化','Minhua SHAO']])assert.ok(L.facultyFor(C,profile(q)).some(f=>f.name.includes(name)),q);
 assert.equal(L.INTERESTS.length,29);assert.ok(L.facultyFor(C,{...profile(),interests:['生命科学与生物工程']}).some(f=>f.id==='review-hkust-a9e7c044251e12'));
 assert.ok(!L.matchedTopics(byName('Minhua SHAO'),['生命科学与生物工程']).length);assert.ok(L.facultyFor(C,{...profile(),interests:['化学工程']}).some(f=>f.name.includes('Richard LAKERVELD')));
});
test('CBME and BIEN stay separate fromMSc, programme coordinators and unknown complete material lists',()=>{
 for(const code of ['cbme','bien']){const p=C.programs.find(p=>p.id==='hkust-'+code+'-rpg');assert.deepEqual(p.degrees,['MPhil','PhD']);assert.equal(source(p.sourceIds[0]).url,'https://prog-crs.hkust.edu.hk/pgprog/2027-28/mphil-phd-'+code);assert.equal(p.contact.status,'unknown');assert.match(p.selection.text,/未核到/);assert.match(p.requirements.find(r=>r.label==='完整上传材料还需核对').text,/未取得正文/);
 const fee=L.financesFor(p,profile())[0];assert.equal(fee.kind,'application_fee');assert.equal(fee.rates[0].value,180);assert.equal(fee.rates[0].basis,'page_reference');assert.ok(!p.finances.some(f=>f.kind==='tuition'||f.kind==='studentship'));
 assert.match(p.requirements.find(r=>r.label==='英语：托福新旧分制分开').text,/2026年1月21日/);assert.match(p.requirements.find(r=>r.label==='英语：托福新旧分制分开').text,/4.5/);}
 const bien=C.programs.find(p=>p.id==='hkust-bien-rpg');assert.match(bien.requirements.find(r=>r.label.startsWith('非生物背景')).text,/可能/);assert.match(bien.requirements.find(r=>r.label.startsWith('非生物背景')).text,/不能改写成必须生物本科/);
});
test('locality, spring and fall dates never inherit a made-up clock or PhD fellowship forMPhil',()=>{
 for(const p of C.programs.filter(p=>['hkust-cbme-rpg','hkust-bien-rpg'].includes(p.id))){
 assert.deepEqual(L.deadlinesFor(p,profile()).map(d=>[d.date,d.at]),[['2027-06-01',null],['2027-07-01',null]]);
 assert.deepEqual(L.deadlinesFor(p,profile('','PhD','2026/27 Spring')).map(d=>[d.date,d.at]),[['2026-11-01',null],['2026-12-15',null]]);
 assert.equal(L.deadlinesFor(p,profile('','PhD'),C.universities.find(u=>u.id==='hkust')).find(d=>d.route.includes('HKPFS')).at,'2026-12-01T23:59:00+08:00');
 assert.match(p.requirements.find(r=>r.label==='兼读制还要核签证').text,/不能读香港兼读制/);}
});
test('new subject selections and old-ID favourites round-trip together without modifying the recorded snapshot',()=>{
 const f=byName('Muyang LIN'),state={profile:{...profile('合成生物学'),interests:['生命科学与生物工程','化学工程']},shortlist:['ling-shi',f.id],tasks:[{id:'task-cbe',text:'先核任职时间与对应项目',done:false,programId:'hkust-bien-rpg',facultyId:f.id}],sourceIds:[f.sourceIds[0]]};
 const file=L.portable(C,state),restored=L.parsePortable(JSON.stringify(file),C);assert.deepEqual(restored.shortlist,state.shortlist);assert.deepEqual(restored.profile.interests,state.profile.interests);assert.equal(restored.catalogSnapshotId,C.snapshotId);assert.equal(restored.tasks[0].facultyId,f.id);
});
