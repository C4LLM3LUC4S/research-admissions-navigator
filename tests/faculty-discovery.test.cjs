'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../dist/logic.js'),C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));

test('wide coverage is an evidence-linked faculty inventory, never a count of available places',()=>{
  assert.ok(C.faculty.length>=94);assert.equal(new Set(C.faculty.map(f=>f.id)).size,C.faculty.length);
  assert.equal(new Set(C.faculty.map(f=>f.universityId+'|'+(f.recordKind==='directory_research'?f.directoryEvidenceSourceId+'|'+f.name:f.profileUrl.replace(/\/$/,'')))).size,C.faculty.length);
  for(const u of C.universities){assert.ok(C.faculty.filter(f=>f.universityId===u.id).length>=10,u.id);assert.ok(C.directories.filter(d=>d.universityId===u.id).length>=2,u.id);}
  const sources=new Set(C.sources.map(s=>s.id));
  for(const f of C.faculty){assert.ok(f.researchKeywords.length);assert.ok(f.keywordSourceIds.every(id=>sources.has(id)));if(f.recordKind==='directory_research'){assert.equal(f.profileUrl,null);assert.ok(L.directoryResearchSource(C,f));}else if(f.profileUrl.startsWith('http://')){assert.equal(L.observedProfileUrl(C,f.profileUrl,f.directorySourceIds),null);if(f.researchBasis==='official_directory'){assert.ok(f.keywordSourceIds.every(id=>f.directorySourceIds.includes(id)));assert.ok(C.directories.some(d=>d.universityId===f.universityId&&d.census?.entries.some(e=>e.profileUrl===f.profileUrl&&e.name===f.name)));}else assert.ok(f.sourceIds.some(id=>C.sources.some(s=>s.id===id&&s.transportScope==='read_only_http_source_not_clickable')));}else assert.ok(L.observedProfileUrl(C,f.profileUrl,f.directorySourceIds));assert.notEqual(f.availability.state,'confirmed');}
  for(const d of C.directories){assert.equal(d.coverageComplete,false);assert.ok(L.officialUrl(d.url));assert.ok(d.sourceIds.every(id=>sources.has(id)));}
});

test('the academic map exposes pending profile links without inflating researched-faculty counts',()=>{
  assert.equal(C.academicCoverage.length,7);
  const leads=C.academicCoverage.flatMap(r=>r.units.flatMap(u=>u.staffEntries.flatMap(s=>s.profileLeads)));
  assert.ok(leads.length>=1338);assert.ok(C.faculty.length>=1191);
  assert.ok(leads.filter(p=>p.facultyId).length>=1149);
  for(const lead of leads){assert.ok(['body_read','not_read','access_failed'].includes(lead.profileBodyStatus));assert.equal(lead.supervisionEligibility,'unknown');assert.equal(lead.availability,'unknown');if(lead.url.startsWith('http://')){if(lead.profileBodyStatus==='body_read')assert.match(lead.bodySha256||lead.readReceiptSha256,/^[a-f0-9]{64}$/);assert.equal(L.observedProfileUrl(C,lead.url,lead.directorySourceIds),null);}else assert.ok(L.observedProfileUrl(C,lead.url,lead.directorySourceIds));}
  const polyu=C.academicCoverage.find(r=>r.universityId==='polyu');
  assert.ok(polyu.units.find(u=>u.id==='polyu-8').staffEntries.some(s=>s.profileLeads.length>20));
  assert.ok(C.directories.length>=54);
});

test('SAI keeps all six pages, original identities and two different Ming Li profiles',()=>{
  const d=C.directories.find(d=>d.id==='wide-directory-cuhksz-sai');
  assert.equal(d.census.pageUrls.length,6);assert.equal(d.census.observedTotal,53);
  assert.equal(d.census.profilesRead,53);assert.equal(d.census.profilesFailed,0);
  const same=C.faculty.filter(f=>f.universityId==='cuhksz'&&f.name==='LI, Ming');
  assert.equal(same.length,2);assert.notEqual(same[0].id,same[1].id);
  assert.deepEqual(new Set(same.map(f=>f.profileUrl)),new Set(['https://sai.cuhk.edu.cn/en/teacher/258','https://sai.cuhk.edu.cn/en/teacher/277']));
  assert.equal(C.faculty.filter(f=>f.profileUrl==='https://sai.cuhk.edu.cn/en/teacher/175')[0].id,'cuhksz-xiaoqiang-ji');
  assert.ok(C.faculty.find(f=>f.profileUrl==='https://sai.cuhk.edu.cn/en/teacher/328').directoryRole.includes('Adjunct'));
});

test('Function Hub retains returned range, missing research, public-interface provenance and conflicting pagination',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/hkustgz-function-census-20261027.json'),'utf8'));
  assert.equal(pack.faculty.length,94);assert.equal(pack.facultyUpdates.length,2);assert.equal(pack.pendingResearch.length,7);
  const d=C.directories.find(d=>d.id==='hkustgz-function-census');
  assert.equal(d.census.observedTotal,103);assert.equal(d.census.profilesRead,103);assert.equal(d.census.enumerationComplete,false);
  const source=C.sources.find(s=>s.id===d.sourceIds[0]);
  assert.equal(source.paginationObservation.total,103);assert.equal(source.paginationObservation.pages,1);assert.equal(source.paginationObservation.hasNextPage,true);
  assert.match(source.readMethod,/public_directory_interface/);assert.match(source.knownIssues.join(' '),/矛盾/);
  const ids=new Set(pack.faculty.map(f=>f.id));
  for(const missing of pack.pendingResearch)assert.ok(!C.faculty.some(f=>f.profileUrl===missing.profileUrl));
  for(const f of C.faculty.filter(f=>ids.has(f.id))){assert.equal(f.universityId,'hkustgz');assert.equal(f.availability.state,'unknown');assert.match(f.identityNote,/香港.*广州|广州.*香港/);}
  assert.equal(C.sources.filter(s=>s.id.startsWith('gz-function-linked-')).length,28);
});

test('new circuit searches preserve old saved identities without attributing an empty research field to AI',()=>{
  for(const [id,oldUrl] of [['wide-hkustgz-jiang-xu','https://personal.hkust-gz.edu.cn/jiangxu/'],['wide-hkustgz-yuzhe-ma','https://personal.hkust-gz.edu.cn/yuzhema/']]){
    const f=C.faculty.find(f=>f.id===id);assert.equal(f.profileUrl,oldUrl);assert.ok(f.reviewedProfileUrl.includes('faculty-personal-page?id='));
    assert.equal(C.faculty.filter(x=>x.reviewedProfileUrl===f.reviewedProfileUrl).length,1);
  }
  const profile={...L.defaultProfile(C),universityIds:['hkustgz'],interests:['电子与集成电路'],researchQuery:'电子设计自动化'};
  const matches=L.facultyFor(C,profile);assert.ok(matches.some(f=>f.id==='wide-hkustgz-yuzhe-ma'));assert.ok(matches.every(f=>f.universityId==='hkustgz'));
  const peng=C.faculty.find(f=>f.id==='hkustgz-function-707');assert.ok(!peng.topics.includes('人工智能'));assert.deepEqual(L.matchedResearchTerms(peng,'AI'),[]);
  const backup=L.portable(C,{profile,shortlist:['wide-hkustgz-yuzhe-ma'],tasks:[],sourceIds:[]});
  assert.deepEqual(L.parsePortable(JSON.stringify(backup),C).profile.interests,['电子与集成电路']);
});

test('public Function Hub pack excludes contact and internal personnel fields',()=>{
  const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/hkustgz-function-census-20261027.json'),'utf8'));
  const forbidden=new Set(['email','telephone','phone','mobile','personCode','createUser','personId','studentList','avatar']);
  const check=value=>{if(Array.isArray(value))value.forEach(check);else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){assert.ok(!forbidden.has(key),key);check(v);}};
  check(p);
});

test('CUHK CSE keeps memorial, unlinked, non-HTTPS and certificate cases out of invented current-faculty counts',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/cuhk-cse-census-20261027.json'),'utf8'));
  assert.equal(pack.faculty.length,55);assert.equal(pack.facultyUpdates.length,7);
  const census=pack.directoryUpdate.census;assert.equal(census.observedTotal,76);assert.equal(census.profilesRead,69);assert.equal(census.profilesFailed,7);
  assert.deepEqual(census.pendingReasonCounts,{originalHTTP:6,certificateFailure:1});assert.equal(census.unlinkedEntries[0].name,'Martin Ding Fat Wong');assert.ok(!census.unlinkedEntries[0].profileUrl);
  const historic=census.entries.filter(e=>e.historicalMemorialEntry);assert.equal(historic.length,2);
  for(const entry of historic)assert.ok(!C.faculty.some(f=>f.profileUrl===entry.profileUrl));
  assert.ok(!pack.faculty.some(f=>f.profileUrl.startsWith('http:')));
  assert.equal(C.faculty.find(f=>f.profileUrl?.endsWith('/qi-dou/')).id,'wide-cuhk-qi-dou');
  assert.equal(C.faculty.find(f=>f.profileUrl?.endsWith('/sinno-jialin-pan/')).id,'CUHK-Sinno-Jialin-Pan');
});

test('an observed external directory profile grants only its exact safe link, not an outside-domain exception',()=>{
  const ids=['cuhk-cse-directory-20261027'];
  assert.equal(L.observedProfileUrl(C,'https://cs.uwaterloo.ca/~lapchi/',ids),'https://cs.uwaterloo.ca/~lapchi/');
  for(const u of ['https://cs.uwaterloo.ca/unobserved','http://www.cse.cuhk.edu.hk/~adafu/','javascript:alert(1)','https://user:password@cs.uwaterloo.ca/~lapchi/'])assert.equal(L.observedProfileUrl(C,u,ids),null);
  assert.equal(L.observedProfileUrl(C,'https://cs.uwaterloo.ca/~lapchi/',['gz-function-directory-20261027']),null);
});

test('a shared personal URL with another person title remains an explicit unresolved conflict',()=>{
  const colin=C.faculty.find(f=>f.name==='Colin S. C. Tsang');assert.ok(colin);
  const link=L.facultyLinks(C,colin).find(l=>l.url==='https://www.cse.cuhk.edu.hk/~pffung');
  assert.equal(link.bodyStatus,'not_read');assert.equal(link.identityStatus,'conflicting_person_title');assert.match(link.readNote,/Michael Ping-Fu Fung/);assert.match(link.readNote,/没有确认/);
  assert.ok(!colin.keywordSourceIds.some(id=>id.includes('linked')));
  const source=C.sources.find(s=>s.id===link.parentSourceId);assert.ok(source.discoveredLinks.includes(link.url));
});

test('concrete Chinese research queries use source terms while emeritus roles stay explicit',()=>{
  const profile={...L.defaultProfile(C),universityIds:['cuhk'],researchQuery:'医学影像分析'};
  const matches=L.facultyFor(C,profile);assert.ok(matches.some(f=>f.id==='wide-cuhk-qi-dou'));assert.ok(matches.some(f=>f.name==='Colin S. C. Tsang'));
  const graph=L.facultyFor(C,{...profile,researchQuery:'图算法'}).find(f=>f.name==='Leizhen Cai');assert.ok(graph);assert.match(graph.identityNote,/荣休/);assert.equal(graph.availability.state,'unknown');
  const rl=L.facultyFor(C,{...profile,researchQuery:'强化学习'});assert.ok(rl.some(f=>f.name==='James Cheng'));
  assert.deepEqual(L.matchedResearchTerms({researchKeywords:['parallel algorithms']},'强化学习'),[]);
});

test('current Function Hub award names do not turn four MPhil awards into four direct applications',()=>{
  const p=C.programs.filter(p=>p.id.startsWith('hkustgz-function-'));
  assert.equal(p.length,4);
  for(const route of p){assert.deepEqual(route.degrees,['PhD']);assert.equal(route.cycle,'2027/28');assert.equal(route.contact.status,'unknown');assert.match(route.evidenceNote,/红鸟/);
    assert.deepEqual(route.deadlines.map(d=>[d.route,d.at]),[['国际申请者','2027-06-15T23:59:00+08:00'],['中国申请者','2027-07-15T23:59:00+08:00']]);}
  const mphil=L.programsFor(C,{...L.defaultProfile(C),universityIds:['hkustgz'],degree:'MPhil'});
  assert.equal(mphil.filter(p=>p.id.startsWith('hkustgz-function-')).length,0);assert.ok(mphil.some(p=>p.id==='hkust-gz-rbm'));
  assert.equal(C.programs.find(p=>p.id==='hkust-gz-rbm').deadlines[0].date,'2027-03-01');
});

test('current programme evidence excludes hidden taught entries and keeps application fees distinct from tuition',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/hkustgz-function-programmes-20261027.json'),'utf8'));
  for(const source of pack.sources){assert.equal(source.yearOfEntry,'2027/28');assert.ok(source.recordId.endsWith('-27'));assert.match(source.readMethod,/public_programme_interface/);assert.ok(!source.url.endsWith('-5'));}
  assert.ok(!pack.programs.some(p=>/new.energy|MSc/.test(p.id+p.name)));
  for(const p of pack.programs){const item=p.finances[0];assert.equal(item.kind,'application_fee');assert.deepEqual(item.rates.map(r=>[r.value,r.currency,r.unit,r.cycle]),[[150,'CNY','application','2027/28']]);assert.match(p.requirements[1].text,/单项5.5/);assert.match(p.requirements[1].text,/不接受在家/);}
});

test('SAI exact official-parent Links retain unread shells and old affiliation conflicts',()=>{
  const faculty=C.faculty.filter(f=>f.sourceIds.some(id=>id.startsWith('cuhksz-sai-profile-')));
  const links=faculty.flatMap(f=>f.extraLinks||[]).filter(l=>l.parentSourceId.startsWith('cuhksz-sai-profile-'));
  assert.equal(links.length,42);assert.equal(links.filter(l=>l.bodyStatus==='body_read').length,33);
  const orcid=links.find(l=>l.url.startsWith('https://orcid.org/'));assert.equal(orcid.bodyStatus,'not_read');
  const david=faculty.find(f=>f.profileUrl?.endsWith('/107'));assert.equal(L.facultyLinks(C,david).length,0);
  const actual=C.sources.find(s=>s.title.startsWith('ZHAO, Zhanzhan')&&s.evidenceLevel==='teacher_page_linked_from_official_profile');
  assert.ok(actual.knownIssues.some(x=>x.includes('博士后')&&x.includes('不同')));
});

test('a teacher Fall notice is scoped evidence and generic Master never becomes MPhil',()=>{
  const wu=C.faculty.find(f=>f.name==='WU, Baoyuan');assert.equal(wu.availability.state,'advertised');
  assert.equal(wu.availability.cycle,'2027/28');assert.equal(wu.availability.intake,'2027 Fall');
  assert.deepEqual(wu.availability.degrees,['PhD']);assert.match(wu.availability.text,/未说明是否为MPhil/);
  const yang=C.faculty.find(f=>f.name==='LI, Yang');assert.deepEqual(yang.availability.degrees,['PhD','MPhil']);
  assert.equal(yang.availability.state,'advertised');assert.match(L.availabilityText(yang),/需进一步确认/);
  assert.equal(C.faculty.find(f=>f.name==='LI, Ming'&&f.profileUrl?.endsWith('/258')).availability.state,'unknown');
});

test('Chinese multimodal queries find the corresponding original English research terms',()=>{
  const base={...L.defaultProfile(C),universityIds:['cuhksz']};
  const multi=L.facultyFor(C,{...base,researchQuery:'多模态'});
  assert.ok(multi.some(f=>f.profileUrl?.endsWith('/258')));assert.ok(multi.some(f=>f.profileUrl?.endsWith('/277')));
  assert.ok(L.facultyFor(C,{...base,researchQuery:'多模态大模型'}).some(f=>f.profileUrl?.endsWith('/277')));
  assert.deepEqual(L.matchedResearchTerms({researchKeywords:['Speech Processing'],summary:'No multimodal work confirmed'},'多模态'),[]);
  assert.ok(multi.every(f=>L.matchedResearchTerms(f,'多模态').length));
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

test('CityU expansion keeps unverified HTTP and institution-home redirects pending, and reuses existing people',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/cityu-ds-reviewed-20261026.json'),'utf8'));
  assert.equal(pack.faculty.length,23);assert.equal(pack.facultyUpdates.length,5);assert.equal(pack.deferred.length,4);
  for(const f of pack.faculty){assert.ok(L.officialUrl(f.profileUrl));assert.equal(f.availability.state,'unknown');}
  assert.ok(pack.deferred.some(f=>f.name==='Way KUO'&&f.retrievedUrl==='https://www.hkias.cityu.edu.hk/'));
  const cityu=C.academicCoverage.find(r=>r.universityId==='cityu');
  assert.equal(cityu.units.reduce((n,u)=>n+u.children.length,0),28);
  const yin=L.facultyFor(C,{...L.defaultProfile(C),universityIds:['cityu'],researchQuery:'具身智能'});
  assert.ok(yin.some(f=>f.name==='Peng YIN'));
  assert.equal(C.faculty.filter(f=>f.id==='expand-cityu-qi-wu').length,1);
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
