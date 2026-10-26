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
