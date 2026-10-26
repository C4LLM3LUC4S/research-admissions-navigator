'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../dist/logic.js'),C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));

test('wide coverage is an evidence-linked faculty inventory, never a count of available places',()=>{
  assert.ok(C.faculty.length>=94);assert.equal(new Set(C.faculty.map(f=>f.id)).size,C.faculty.length);
  assert.equal(new Set(C.faculty.map(f=>f.universityId+'|'+f.profileUrl.replace(/\/$/,''))).size,C.faculty.length);
  for(const u of C.universities){assert.ok(C.faculty.filter(f=>f.universityId===u.id).length>=10,u.id);assert.ok(C.directories.filter(d=>d.universityId===u.id).length>=2,u.id);}
  const sources=new Set(C.sources.map(s=>s.id));
  for(const f of C.faculty){assert.ok(f.researchKeywords.length);assert.ok(f.keywordSourceIds.every(id=>sources.has(id)));assert.ok(L.officialUrl(f.profileUrl));assert.notEqual(f.availability.state,'confirmed');}
  for(const d of C.directories){assert.equal(d.coverageComplete,false);assert.ok(L.officialUrl(d.url));assert.ok(d.sourceIds.every(id=>sources.has(id)));}
});

test('the academic map exposes pending profile links without inflating researched-faculty counts',()=>{
  assert.equal(C.academicCoverage.length,7);
  const leads=C.academicCoverage.flatMap(r=>r.units.flatMap(u=>u.staffEntries.flatMap(s=>s.profileLeads)));
  assert.equal(leads.length,271);assert.equal(C.faculty.length,304);
  assert.equal(leads.filter(p=>p.facultyId).length,170);
  for(const lead of leads){assert.equal(lead.profileBodyStatus,'body_read');assert.equal(lead.supervisionEligibility,'unknown');assert.equal(lead.availability,'unknown');assert.ok(L.officialUrl(lead.url));}
  const polyu=C.academicCoverage.find(r=>r.universityId==='polyu');
  assert.ok(polyu.units.find(u=>u.id==='polyu-8').staffEntries.some(s=>s.profileLeads.length>20));
  assert.equal(C.directories.length,34);
});

test('research records keep directory identities, existing aliases and unknown supervision rather than inflating available places',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/reviewed-directory-profiles-20261026.json'),'utf8'));
  assert.equal(pack.faculty.length,165);assert.equal(pack.facultyUpdates.length,5);
  for(const raw of pack.faculty){const f=C.faculty.find(f=>f.id===raw.id);assert.ok(f.directoryRole);assert.match(f.identityNote,/资格/);assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);}
  const fung=C.faculty.find(f=>f.id==='wide-hkust-yi-r-fung');assert.equal(fung.reviewedProfileUrl,'https://researchportal.hkust.edu.hk/en/persons/may-fung/');
  assert.equal(C.faculty.filter(f=>f.reviewedProfileUrl===fung.reviewedProfileUrl).length,1);
  const existingLink=L.facultyLinks(C,fung).find(link=>link.url===fung.reviewedProfileUrl);
  assert.equal(existingLink.bodyStatus,'body_read');
  const alias={...L.defaultProfile(C),universityIds:['polyu'],researchQuery:'旅游经济学'};
  assert.ok(L.facultyFor(C,alias).some(f=>f.name==='Haiyan Song'));
  assert.ok(L.facultyFor(C,{...alias,researchQuery:'',interests:['旅游与酒店管理']}).length>40);
  assert.deepEqual(L.matchedTopics({topics:['人文与社会科学']},['人工智能','网络与系统']),[]);
});

test('the full regular-directory census keeps every observed entry and separates failed profile reads',()=>{
  const d=C.directories.find(d=>d.id==='census-hkust-cse-regular'),c=d.census;
  assert.equal(c.observedTotal,53);assert.equal(c.entries.length,53);
  assert.equal(new Set(c.entries.map(e=>e.profileUrl)).size,53);
  assert.equal(c.entries.filter(e=>e.profileRead).length,38);assert.equal(c.profilesFailed,15);
  assert.equal(c.enumerationComplete,true);assert.equal(d.coverageComplete,false);
  for(const entry of c.entries.filter(e=>e.profileRead)){
    const f=C.faculty.find(f=>f.profileUrl===entry.profileUrl);assert.ok(f,entry.name);
    assert.ok(f.directorySourceIds.includes(d.id));assert.equal(f.availability.state,'unknown');
  }
  assert.equal(C.faculty.filter(f=>f.id==='james-kwok').length,1);
  assert.ok(!C.faculty.some(f=>f.id==='census-hkust-jamesk'));
});

test('an external personal website needs its exact observed official-parent link, never a domain-wide exception',()=>{
  const f=C.faculty.find(f=>f.id==='census-hkust-zxf'),links=L.facultyLinks(C,f);
  assert.ok(links.some(x=>x.url==='https://sites.google.com/view/xiaofang-zhou'&&x.bodyStatus==='body_read'));
  assert.equal(L.officialUrl('https://sites.google.com/view/xiaofang-zhou'),null);
  const s=C.sources.find(s=>s.id==='census-hkust-zxf-personal');assert.equal(L.sourceUrl(C,s),s.url);
  for(const bad of ['https://sites.google.com/view/someone-else','javascript:alert(1)','https://user:secret@sites.google.com/view/xiaofang-zhou','http://sites.google.com/view/xiaofang-zhou']){
    assert.equal(L.sourceUrl(C,{...s,url:bad}),null);
    assert.deepEqual(L.facultyLinks(C,{...f,extraLinks:[{...f.extraLinks[0],url:bad}]}),[]);
  }
  assert.equal(L.sourceUrl(C,{...s,parentSourceId:'missing'}),null);
  assert.deepEqual(L.facultyLinks(C,{...f,profileUrl:'https://cse.hkust.edu.hk/unrelated'}),[]);
});

test('new subject categories do not silently cross-match other canonical categories',()=>{
  assert.deepEqual(L.matchedTopics({topics:['网络安全','数据库与数据系统']},['网络与系统','网络安全','数据库与数据系统']),['网络安全','数据库与数据系统']);
  for(const query of ['编程语言','人机交互','密码学','计算机音乐'])assert.ok(L.facultyFor(C,{...L.defaultProfile(C),universityIds:['hkust'],researchQuery:query}).length,query);
  const old=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/snapshots/62f69402a15a65a232876e747aea5c41c982fd9a4763e4ff44450741ce31e625.json'),'utf8'));
  assert.ok(old.faculty.every(f=>C.faculty.some(current=>current.id===f.id)));
});
test('research queries use grounded keywords and bounded translations, not claims or arbitrary substrings',()=>{
  const f={researchKeywords:['Networked control','Robotics','Fair learning','Reinforcement learning'],summary:'这里没有核实MFAＣ、机器翻译和大语言模型。',topics:['机器人与控制']};
  assert.deepEqual(L.matchedResearchTerms(f,'网络化控制, 机器人'),['Networked control','Robotics']);
  assert.deepEqual(L.matchedResearchTerms(f,'AI'),[]);assert.deepEqual(L.matchedResearchTerms(f,'MFAC,机器翻译,大语言模型'),[]);
  assert.deepEqual(L.matchedResearchTerms(f,'REINFORCEMENT LEARNING'),['Reinforcement learning']);
  assert.deepEqual(L.matchedResearchTerms(f,'[control]'),[]);
});
test('school and broad direction filters combine with concrete terms without inheriting campus or capacity',()=>{
  const profile={...L.defaultProfile(C),universityIds:['hkust'],researchQuery:'自然语言处理'};
  const matches=L.facultyFor(C,profile);assert.ok(matches.some(f=>f.id==='wide-hkust-junxian-he'));
  assert.ok(matches.every(f=>f.universityId==='hkust'&&L.matchedResearchTerms(f,profile.researchQuery).length));
  assert.ok(!matches.some(f=>f.universityId==='hkustgz'));
  const dirs=L.directoriesFor(C,{...profile,researchQuery:'a phrase not in this inventory',interests:['机器人与控制']});
  assert.ok(dirs.length);assert.ok(dirs.every(d=>d.universityId==='hkust'));
  assert.ok(dirs.some(d=>L.reviewedForDirectory(C,d)>0));
});
test('a concrete research preference is portable, old formats get an empty preference and incomplete new files are rejected',()=>{
  const value=L.portable(C,{profile:{...L.defaultProfile(C),researchQuery:'网络化控制,强化学习'},shortlist:[],tasks:[],sourceIds:[]});
  assert.equal(value.schemaVersion,3);assert.equal(L.parsePortable(JSON.stringify(value),C).profile.researchQuery,'网络化控制,强化学习');
  for(const version of [1,2]){const older=structuredClone(value);older.schemaVersion=version;delete older.profile.researchQuery;assert.equal(L.validatePortable(older,C).profile.researchQuery,'');}
  const incomplete=structuredClone(value);delete incomplete.profile.researchQuery;assert.throws(()=>L.validatePortable(incomplete,C),/研究关键词字段/);
  const huge=structuredClone(value);huge.profile.researchQuery='x'.repeat(161);assert.throws(()=>L.validatePortable(huge,C),/研究关键词/);
});

test('new subject paths expose actual statistics, finance and health research across campuses',()=>{
  for(const id of C.universities.map(u=>u.id))assert.ok(L.facultyFor(C,{...L.defaultProfile(C),universityIds:[id],interests:['数学与统计']}).length,id);
  const stats=L.facultyFor(C,{...L.defaultProfile(C),researchQuery:'贝叶斯'});assert.ok(stats.some(f=>f.id==='expand-hku-edwin-fong'));
  const finance=L.facultyFor(C,{...L.defaultProfile(C),universityIds:['hkustgz'],interests:['金融与精算'],researchQuery:'金融工程'});
  assert.ok(finance.some(f=>f.id==='expand-hkustgz-ning-cai'));assert.ok(finance.every(f=>f.universityId==='hkustgz'));
  const health=L.facultyFor(C,{...L.defaultProfile(C),interests:['生物医学与健康'],researchQuery:'精准医疗'});
  assert.ok(health.some(f=>f.id==='expand-cityu-xinyue-li'));
  const value=L.portable(C,{profile:{...L.defaultProfile(C),interests:['数学与统计'],researchQuery:'贝叶斯'},shortlist:[],tasks:[],sourceIds:[]});
  assert.equal(L.parsePortable(JSON.stringify(value),C).profile.interests[0],'数学与统计');
});

test('undated doctoral notices and a funding limitation never become confirmed places or a school-wide closure',()=>{
  for(const id of ['expand-cityu-xinyue-li','expand-cityu-qi-wu']){
    const f=C.faculty.find(x=>x.id===id);assert.equal(f.availability.state,'advertised');assert.equal(f.availability.cycle,null);
    assert.deepEqual(f.availability.degrees,['PhD']);assert.match(f.availability.text,/年度|轮次/);assert.match(f.availability.text,/MPhil/);
    assert.match(L.availabilityText(f),/需进一步确认/);
  }
  const f=C.faculty.find(x=>x.id==='expand-hku-marius-hofert');assert.equal(f.availability.state,'unknown');
  assert.match(f.availability.text,/没有全额资助岗位/);assert.match(f.availability.text,/不能解释为学校/);
});
