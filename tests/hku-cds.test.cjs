'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),L=require('../dist/logic.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
const C=read('catalog.json'),P=read('research/hku-cds-census-20261027.json');

test('HKU keeps the92 observed original links, failures, alternate DU link and13 saved identities distinct',()=>{
  const d=C.directories.find(d=>d.id==='wide-dir-hku-cds');
  assert.equal(d.census.observedTotal,92);assert.equal(d.census.profilesRead,87);assert.equal(d.census.profilesFailed,5);
  assert.equal(P.faculty.length,73);assert.equal(P.facultyUpdates.length,13);
  for(const id of Object.values(P.identityReview.preservedIds))assert.equal(C.faculty.filter(f=>f.id===id).length,1);
  const du=d.census.entries.find(e=>e.name==='Jin-Hong Du');assert.equal(du.profileRead,false);assert.match(du.reviewNote,/404.*RPG/);
  const teacher=C.faculty.find(f=>f.id==='hku-cds-census-019');assert.equal(teacher.profileUrl,'https://saasweb.hku.hk/staff/jinhongd');
  const retired=d.census.entries.find(e=>e.name==='Wenping Wang');assert.match(retired.reviewNote,/不再在HKU招收研究生/);
  assert.ok(!C.faculty.some(f=>f.id==='hku-cds-census-065'));
  assert.ok(!C.faculty.some(f=>f.id==='hku-cds-census-025'));
});

test('the18 RPG names are positive directory evidence, never a real-time place or automatic exclusion rule',()=>{
  const rows=C.faculty.filter(f=>(f.applicationNotes||[]).some(n=>n.kind==='official_supervisor_list'));
  assert.equal(rows.length,18);
  for(const f of rows){assert.equal(f.availability.state,'unknown');assert.match(f.applicationNotes[0].text,/不是当期余位清单/);}
  const lecturer=C.faculty.find(f=>f.id==='hku-cds-census-013');assert.match(lecturer.directoryRole,/Lecturer/);assert.equal(lecturer.availability.state,'unknown');
  assert.ok(!(lecturer.applicationNotes||[]).some(n=>n.kind==='official_supervisor_list'));
  const src=C.sources.find(s=>s.id==='hku-cds-directory-observed-20261026');assert.equal(src.checkedAt,'2026-10-26');
  assert.equal(C.sources.find(s=>s.id==='hku-saas-rpg-supervisors-20261027').checkedAt,'2026-10-27');
});

test('personal-only research never acquires an official-profile evidence label or navigation words',()=>{
  for(const id of ['056','069','074','078']){
    const f=C.faculty.find(f=>f.id==='hku-cds-census-'+id);assert.ok(f);
    for(const sid of f.keywordSourceIds)assert.equal(C.sources.find(s=>s.id===sid).evidenceLevel,'teacher_page_linked_from_official_profile');
  }
  for(const f of [...P.faculty,...P.facultyUpdates])assert.ok(!f.researchKeywords.some(k=>/^(Research Highlights|Study Programmes|Computing Facilities|Office Intranet|Current Students)$/.test(k)));
  assert.equal(P.staffEntries[0].profileLeads[69].bodyFormat,'web_reader_rendered_response_or_saved_excerpt_not_HTTP');
});

test('a reviewed official profile can supply its own exact observed site, without broadening host trust',()=>{
  const f=C.faculty.find(f=>f.id==='wide-hku-yuan-cao');
  assert.notEqual(f.profileUrl,f.reviewedProfileUrl);
  assert.ok(L.facultyLinks(C,f).some(x=>x.url==='https://yuancaohku.github.io/'));
  const bad=structuredClone(f);bad.reviewedProfileUrl='https://outside.invalid/somebody';assert.equal(L.facultyLinks(C,bad).length,0);
  const unseen=structuredClone(f);unseen.extraLinks=[{...f.extraLinks[0],url:'https://unobserved.invalid/'}];assert.equal(L.facultyLinks(C,unseen).length,0);
});

test('statistics programme keeps current deadlines, optional central contact and old fees in their actual scopes',()=>{
  const p=C.programs.find(p=>p.id==='hku-saas-rpg');assert.deepEqual(p.degrees,['MPhil','PhD']);
  assert.equal(p.contact.status,'unknown');assert.match(p.contact.text,/可选.*额外|可选.*核对/);
  assert.equal(p.deadlines[0].at,'2026-12-01T23:59:00+08:00');
  assert.ok(p.finances[0].rates.every(r=>r.cycle==='2026/27'));
  assert.equal(L.financeRates(p.finances[0],{cycle:'2027/28',degree:'MPhil'}).matched.length,0);
  assert.equal(C.programs.find(p=>p.id==='hku-cs-rpg').contact.status,'unknown');
});

test('research aliases are bounded to research terms and do not search teacher advice as a qualification',()=>{
  assert.ok(C.faculty.some(f=>f.universityId==='hku'&&L.matchedResearchTerms(f,'精算').length));
  assert.ok(L.matchedResearchTerms(C.faculty.find(f=>f.id==='hku-cds-census-087'),'量子计算').length);
  assert.deepEqual(L.matchedResearchTerms(C.faculty.find(f=>f.id==='expand-hku-marius-hofert'),'全额资助职位'),[]);
  const qu=C.faculty.find(f=>f.id==='hku-cds-census-060'),notice=qu.applicationNotes[0];
  assert.deepEqual(notice.degrees,['PhD']);assert.deepEqual(notice.mentionedIntakes.map(i=>i.cycle),['2026/27 Spring','2027/28']);
  assert.equal(qu.availability.state,'unknown');
});
