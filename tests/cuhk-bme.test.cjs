'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const C=read('data/catalog.json'),P=read('data/research/cuhk-bme-census-20261028.json'),L=require('../dist/logic.js');
const previous=read('data/snapshots/ba51270ff69c5e1dcf299e45a3829f06845e6503a895d1ba1ec6a4f582b4878b.json');
test('BME preserves previous research, programme, source and saved identities',()=>{
 for(const key of ['faculty','programs','sources'])for(const row of previous[key])assert.deepEqual(C[key].find(x=>x.id===row.id),row);
 assert.equal(P.faculty.length,39);assert.equal(P.existingIdentityEvidence.length,3);
 assert.deepEqual(P.existingIdentityEvidence.map(x=>x.id).sort(),['wide-cuhk-samuel-au','wide-cuhk-darwin-lau','cuhk-cse-census-016'].sort());
});
test('all three observed lists retain unavailable profiles, one unlinked card and distinct employment scope',()=>{
 assert.deepEqual(P.staffEntries.map(x=>x.profileLeads.length),[22,31,9]);
 const leads=P.staffEntries.flatMap(x=>x.profileLeads);assert.equal(leads.filter(x=>x.facultyId).length,42);
 assert.equal(P.directories.flatMap(x=>x.census.unlinkedEntries).length,1);
 for(const bad of ['BLOCKI','Michael Kenneth','C.K. Vincent','KO, Ho Owen','Wei Hsin','ZHAO, Ni'])assert.ok(leads.some(x=>x.name.includes(bad)&&!x.facultyId));
 assert.ok(P.directories.every(x=>x.coverageComplete===false));assert.ok(P.faculty.every(x=>x.availability.state==='unknown'));
 const external=P.faculty.find(x=>x.id==='cuhk-bme-60');assert.match(external.applicationNotes[0].text,/Western University/);assert.match(external.directoryRole,/Adjunct/);
});
test('research questions and actual supplied HTTPS sites retain provenance without enabling legacy HTTP',()=>{
 const p={...L.defaultProfile(C),universityIds:['cuhk'],degree:'PhD',researchQuery:'定量相位成像'};
 assert.ok(L.facultyFor(C,p).some(x=>x.id==='cuhk-bme-21'));
 const zhou=P.faculty.find(x=>x.id==='cuhk-bme-21');assert.equal(L.observedProfileUrl(C,zhou.profileUrl,zhou.directorySourceIds),'https://www.lambcuhk.org/');
 const blu=P.faculty.find(x=>x.id==='cuhk-bme-24');assert.match(blu.profileUrl,/^http:/);assert.equal(L.observedProfileUrl(C,blu.profileUrl,blu.directorySourceIds),null);
 const source=C.sources.find(s=>s.id==='bme-profile-24-20261028');assert.equal(source.url,source.originalUrl);assert.equal(L.sourceUrl(C,source),null);
 const cheung=P.faculty.find(x=>x.id==='cuhk-bme-31');assert.match(cheung.profileUrl,/^https:/);assert.match(cheung.originalProfileUrl,/^http:/);
});
test('department early submission, documents and central conflicts remain actionable for each degree',()=>{
 const p=P.programmes[0];assert.equal(p.cycle,'2027/28');assert.equal(p.contact.status,'recommended');
 assert.equal(p.deadlines[0].date,'2026-11-15');assert.equal(p.deadlines[0].at,null);
 const rgc=p.deadlines.find(d=>d.route==='HKPFS');assert.equal(rgc.degree,'PhD');assert.equal(rgc.at,'2026-12-01T12:00:00+08:00');
 for(const degree of ['PhD','MPhil'])assert.ok(L.deadlinesFor(p,{degree,cycle:'2027/28'},C.universities.find(x=>x.id==='cuhk')).some(d=>d.date==='2026-11-15'));
 const both=p.requirements.filter(r=>!r.degrees||r.degrees.includes('MPhil'));assert.ok(both.some(x=>/三封/.test(x.label)&&/MPhil/.test(x.text)));
 assert.ok(p.requirements.find(r=>/博士英文/.test(r.label)).degrees.every(x=>x==='PhD'));
 assert.ok(p.requirements.some(r=>/纸质/.test(r.label)));assert.deepEqual(p.finances[0].rates,[]);
});
test('dated teacher statement and old notice never become live places or an MPhil promise',()=>{
 const shao=P.faculty.find(x=>x.id==='cuhk-bme-15');assert.equal(shao.availability.state,'unknown');assert.deepEqual(shao.applicationNotes[0].degrees,['PhD']);assert.match(shao.applicationNotes[0].text,/不表示.*仍剩两个/);
 const dinh=P.faculty.find(x=>x.id==='cuhk-bme-56');assert.match(dinh.applicationNotes[0].text,/2022/);assert.equal(dinh.availability.cycle,null);
 const profile={...L.defaultProfile(C),universityIds:['cuhk'],degree:'MPhil',researchQuery:'器官芯片'};
 const value=L.parsePortable(JSON.stringify(L.portable(C,{profile,shortlist:['cuhk-bme-10','wide-cuhk-samuel-au'],tasks:[{id:'task-bme-action',text:'核推荐数量并准备纸质材料',done:false,programId:'cuhk-bme-rpg',facultyId:'cuhk-bme-10'}]})),C);
 assert.equal(value.profile.degree,'MPhil');assert.deepEqual(value.shortlist,['cuhk-bme-10','wide-cuhk-samuel-au']);assert.equal(value.tasks[0].programId,'cuhk-bme-rpg');
});
