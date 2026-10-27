'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../dist/logic.js'),C=require('../data/catalog.json'),P=require('../data/research/polyu-fcms-census-20261027.json');
const profile=(degree='PhD',researchQuery='')=>({...L.defaultProfile(C),degree,universityIds:['polyu'],researchQuery});
const source=id=>C.sources.find(s=>s.id===id);
const leads=C.academicCoverage.flatMap(a=>a.units).find(u=>u.id==='polyu-2').staffEntries.flatMap(e=>e.profileLeads);

test('all168 observed profile entries remain visible, without turning four missing research pages into invented teachers',()=>{
  assert.equal(leads.length,168);assert.equal(leads.filter(p=>p.profileBodyStatus==='body_read').length,168);
  assert.equal(leads.filter(p=>p.facultyId).length,164);assert.equal(leads.filter(p=>!p.facultyId).length,4);
  assert.equal(P.faculty.length,151);assert.equal(P.facultyUpdates.length,10);
  assert.equal(C.faculty.length,745);assert.equal(C.faculty.filter(f=>f.universityId==='polyu').length,234);
  for(const p of leads){assert.equal(p.supervisionEligibility,'unknown');assert.equal(p.availability,'unknown');assert.match(p.bodySha256,/^[a-f0-9]{64}$/);}
  assert.deepEqual(leads.filter(p=>!p.facultyId).map(p=>p.name),['Zachary Leung Ngai-hang','Leung Ping-kei','FUNG Sui Leung Walter','LUI Wing Cheung Richard']);
});

test('cross-department appointments share one reviewed identity and every older saved faculty ID survives',()=>{
  for(const pair of [[2,144],[15,149],[74,150]]){
    const a=P.staffEntries.flatMap(e=>e.profileLeads).find(p=>p.url===P.sources.find(s=>s.id==='polyu-fcms-profile-'+String(pair[0]).padStart(3,'0')+'-20261027').url);
    const b=leads.find(p=>p.url===P.sources.find(s=>s.id==='polyu-fcms-profile-'+String(pair[1]).padStart(3,'0')+'-20261027').url);
    assert.equal(a.facultyId,b.facultyId);assert.equal(C.faculty.filter(f=>f.id===a.facultyId).length,1);
    assert.match(C.faculty.find(f=>f.id===a.facultyId).identityNote,/不是仅按同名/);
  }
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/snapshots/d31e2a1e5e350cf56e632f5140895925bd616229c990bb26d516f5e590c17294.json'),'utf8'));
  assert.equal(old.faculty.length,594);for(const f of old.faculty)assert.ok(C.faculty.some(n=>n.id===f.id));
  const cao=C.faculty.find(f=>f.id==='polyu-cao');assert.match(cao.profileUrl,/\/risa\//);assert.match(cao.reviewedProfileUrl,/prof-cao-jiannong/);
  const qing=C.faculty.find(f=>f.id==='wide-polyu-qing-li');assert.ok(qing.keywordSourceIds.includes('wide-polyu-qing-li-home'));assert.equal(source('wide-polyu-qing-li-home').checkedAt,'2026-10-26');
});

test('only actual research descriptions create new search terms, never portal fingerprints, navigation or teacher preferences',()=>{
  for(const f of [...P.faculty,...P.facultyUpdates]){
    for(const id of f.keywordSourceIds)assert.ok(!source(id).url.includes('research.polyu.edu.hk'));
    assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);
    assert.ok(!f.researchKeywords.some(t=>/experimental result|privacy policy|professors of practice|perfect GPA/i.test(t)));
  }
  for(const s of P.sources.filter(s=>s.evidenceLevel==='teacher_page_linked_from_official_profile')){
    assert.ok(source(s.parentSourceId).discoveredLinks.includes(s.url));assert.ok(L.sourceUrl(C,s),s.url);
  }
  const jessie=P.faculty.find(f=>f.reviewedProfileUrl.endsWith('prof-li-jessie-zhenhui/'));
  assert.deepEqual(jessie.researchKeywords,['City Intelligence','AI for Science']);
  assert.equal(source(jessie.keywordSourceIds[0]).readMethod,'actual_Edge_DOM');
  assert.match(jessie.applicationNotes[0].text,/研究助理/);assert.match(jessie.applicationNotes[0].text,/不是博士或MPhil正式接收/);
  assert.equal(L.facultyFor(C,profile('PhD','perfect GPA')).length,0);
  const songlin=P.faculty.find(f=>f.name==='XU Songlin');
  assert.ok(L.facultyLinks(C,songlin).some(l=>l.url==='https://songlinxu.com/'));
});

test('common Chinese technical queries follow exact reviewed research, including control and cybersecurity',()=>{
  for(const [query,name] of [['量子控制','Zhang Guofeng'],['随机控制','Li Xun'],['联邦学习','LIU Yang Veronica'],['后量子密码','LU Xingye'],['图检索增强生成','HUANG Xiao'],['数学金融','Xu Zuoquan']]){
    const found=L.facultyFor(C,profile('PhD',query));assert.ok(found.some(f=>f.name===name),query+' / '+name);
  }
});

test('current September routes open actual2027 pages and preserve the closed January flyer-target conflict',()=>{
  for(const [id,dept] of [['polyu-ama-rpg','ama'],['polyu-computing-rpg','comp'],['polyu-dsai-rpg','dsai']]){
    const p=C.programs.find(p=>p.id===id);assert.equal(source(p.sourceIds[0]).url,'https://www.polyu.edu.hk/study/pg/rpg/2027/'+dept);
    const normal=L.deadlinesFor(p,profile(),C.universities.find(u=>u.id==='polyu')).find(d=>d.route==='院系常规申请');
    assert.equal(normal.date,'2027-05-31');assert.equal(normal.at,null);assert.match(normal.label,/官网未说明具体时间/);
    assert.ok(p.requirements.some(r=>r.label==='研究计划、CV与学历材料'));
    assert.equal(p.requirements.some(r=>r.label==='个人陈述'),dept!=='comp');
  }
  assert.match(source('polyu-comp-flyer-old-target-20261027').claims.join(' '),/2026-09-30/);
  assert.match(source('polyu-comp-phd-flyer-2027-20261027').knownIssues.join(' '),/旧|Jan 2027/);
});

test('PhD fees and conditional scholarship caps never become MPhil costs, zeroes or an awarded total',()=>{
  const p=C.programs.find(p=>p.id==='polyu-computing-rpg');assert.equal(L.financesFor(p,profile('MPhil')).length,0);
  const tuition=p.finances.find(x=>x.kind==='tuition'),rates=L.financeRates(tuition,profile()).matched;
  assert.equal(rates.length,1);assert.equal(rates[0].value,49500);assert.equal(rates[0].cycle,'2027/28');
  const award=p.finances.find(x=>x.kind==='studentship');assert.match(award.text,/不能相加/);assert.match(award.text,/已获待遇/);
  assert.deepEqual(L.financeRates(award,profile()).matched.map(r=>r.value),[344400,340800,230640,235920]);
  for(const id of ['polyu-ama-rpg','polyu-dsai-rpg']){const f=C.programs.find(p=>p.id===id).finances[0];assert.deepEqual(f.rates,[]);assert.match(f.text,/不是人人自动获得/);}
});
