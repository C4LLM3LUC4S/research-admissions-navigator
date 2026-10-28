'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../dist/logic.js');
const C={schemaVersion:1,checkedDate:'2026-10-26',cycle:'2027/28 Fall',universities:[
  {id:'hkust',name:'香港科技大学',short:'HKUST',region:'香港'},
  {id:'hkust-gz',name:'香港科技大学（广州）',short:'HKUST(GZ)',region:'广州'},
  {id:'cuhk-sz',name:'香港中文大学（深圳）',short:'CUHK(SZ)',region:'深圳'}],
programs:[{id:'both',universityId:'hkust',degrees:['MPhil','PhD']},{id:'mphil',universityId:'hkust-gz',degrees:['MPhil']},{id:'phd',universityId:'cuhk-sz',degrees:['PhD']}],
faculty:[{id:'f1',universityId:'hkust',topics:['Machine learning','Data mining'],availability:{state:'unknown'}},{id:'f2',universityId:'hkust-gz',topics:['Networked control'],availability:{state:'advertised'}}],
sources:[{id:'s1'}],funding:[{id:'hkpfs',degree:'PhD',universities:['hkust','hkust-gz','cuhk-sz']}]};
test('program filtering uses the actual offered degree and exact campus ids',()=>{assert.deepEqual(L.programsFor(C,L.defaultProfile()).map(p=>p.id),['both','mphil']);assert.deepEqual(L.programsFor(C,{...L.defaultProfile(),degree:'PhD',universityIds:['hkust-gz']}),[]);assert.deepEqual(L.programsFor(C,{...L.defaultProfile(),degree:'PhD',universityIds:['cuhk-sz']}).map(p=>p.id),['phd']);});
test('unknown availability is neither a closed position nor a confirmed opening',()=>{assert.match(L.availabilityText(C.faculty[0]),/未知，不等于不招生/);assert.equal(L.facultyFor(C,L.defaultProfile()).length,2);assert.deepEqual(L.matchedTopics(C.faculty[1],['机器人与控制','自然语言处理']),['机器人与控制']);});
test('date categories distinguish past, other cycle, unknown and a known future date',()=>{const now='2026-10-26T10:00:00+08:00';assert.equal(L.deadlineState({at:'2026-10-26T09:59:00+08:00',cycle:C.cycle},C.cycle,now).code,'expired');assert.equal(L.deadlineState({at:'2027-01-01T12:00:00+08:00',cycle:'2026/27 Spring'},C.cycle,now).code,'out_of_scope');assert.equal(L.deadlineState({at:null},C.cycle,now).code,'unknown');assert.equal(L.deadlineState({at:'2026-10-26'},C.cycle,now).code,'date_only');});
test('date-only evidence never invents a closing time and uses the Hong Kong calendar day',()=>{const now='2026-10-26T00:30:00+08:00';assert.equal(L.deadlineState({date:'2026-10-25',at:null},null,now).code,'expired');assert.equal(L.deadlineState({date:'2026-10-26',at:null},null,now).code,'date_only');assert.equal(L.deadlineState({date:'2026-10-27',at:null},null,now).code,'date_only');assert.equal(L.deadlineState({date:'2026-02-30',at:null},null,now).code,'unknown');});
test('a narrative disclaimer cannot create a research match absent from source-backed tags',()=>{const faculty={topics:['机器人与控制'],summary:'这里没有核实计算机视觉方向，也不能凭系统二字推荐网络。'};assert.deepEqual(L.matchedTopics(faculty,['计算机视觉','网络与系统']),[]);});
test('HKPFS never applies to MPhil or either mainland campus even if input membership is wrong',()=>{assert.deepEqual(L.fundingFor(C,L.defaultProfile()),[]);for(const id of ['hkust-gz','cuhk-sz'])assert.deepEqual(L.fundingFor(C,{...L.defaultProfile(),degree:'PhD',universityIds:[id]}),[]);assert.equal(L.fundingFor(C,{...L.defaultProfile(),degree:'PhD',universityIds:['hkust']}).length,1);});
test('official HTTPS links reject lookalikes, credentials and executable URLs',()=>{assert.ok(L.officialUrl('https://cse.hkust.edu.hk/faculty/'));assert.ok(L.officialUrl('https://cerg1.ugc.edu.hk/hkpfs/institutions.html'));for(const url of ['javascript:alert(1)','https://hkust.edu.hk.evil.test','http://hku.hk','https://evil.test@hku.hk','https://hku.hk:8000','https://ugc.edu.hk.evil.test'])assert.equal(L.officialUrl(url),null);});
test('actual sources retain the official or explicitly linked teacher-page policy and dated evidence',()=>{const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));for(const source of actual.sources){assert.ok(L.sourceUrl(actual,source),source.url);if(source.evidenceLevel!=='teacher_page_linked_from_official_profile')assert.ok(L.officialUrl(source.url),source.url);}assert.equal(actual.programs.find(p=>p.id==='cuhk-cse-rpg').contact.status,'recommended');const early=actual.programs.find(p=>p.id==='hku-cds-early-2027');assert.equal(L.deadlineState(early.deadlines[0],actual.cycle,'2026-10-26T12:00:00+08:00').code,'expired');const dates=actual.programs.flatMap(p=>p.deadlines).filter(d=>d.at===null);assert.ok(dates.length);for(const d of dates)assert.match(d.date,/^\d{4}-\d\d-\d\d$/);});
test('the actual Shenzhen AI and CIE spring deadlines remain distinct from their autumn dates',()=>{const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));const profile={...L.defaultProfile(actual),universityIds:['cuhksz'],cycle:'2026/27 Spring'};const entries=L.programsFor(actual,profile);assert.equal(entries.length,2);const ai=entries.find(p=>p.id==='cuhksz-ai-rpg'),cie=entries.find(p=>p.id==='cuhksz-sse-cie');assert.deepEqual(L.deadlinesFor(ai,profile).map(d=>d.date),['2026-10-31']);assert.deepEqual(L.deadlinesFor(cie,profile).map(d=>d.date),['2026-10-15']);assert.equal(L.deadlineState(L.deadlinesFor(cie,profile)[0],profile.cycle,'2026-10-26T09:00:00+08:00').code,'expired');});
test('Hong Kong spring routes do not inherit a later academic-year fellowship call',()=>{const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));const profile={...L.defaultProfile(actual),degree:'PhD',universityIds:['hkust'],cycle:'2026/27 Spring'};assert.deepEqual(L.programsFor(actual,profile).filter(p=>p.cycle!==null).map(p=>p.id).sort(),['hkust-hk-cse-rpg','hkust-hk-ece-rpg','hkust-math-rpg','hkust-cbme-rpg','hkust-bien-rpg'].sort());assert.equal(L.fundingFor(actual,profile).length,0);for(const p of L.programsFor(actual,profile)){const expected=p.cycle===null?[]:['hkust-math-rpg','hkust-cbme-rpg','hkust-bien-rpg'].includes(p.id)?['2026-11-01','2026-12-15']:['2026-11-01'];assert.deepEqual(L.deadlinesFor(p,profile,actual.universities.find(u=>u.id==='hkust')).map(d=>d.date),expected);}});
function backup(){return L.portable(C,{profile:{...L.defaultProfile(),gpaNote:'<img src=x onerror=alert(1)> 中文'},shortlist:['f1'],sourceIds:['s1'],tasks:[{id:'task-a',text:'<script>bad()</script>',done:false,programId:'both',facultyId:null}]});}
test('portable JSON roundtrip preserves notes as text and validates all referenced ids',()=>{const value=backup();assert.deepEqual(L.parsePortable(JSON.stringify(value),C),value);for(const change of [v=>v.shortlist=['missing'],v=>v.profile.universityIds=['hkust-other'],v=>v.sourceIds=['wrong'],v=>v.tasks[0].programId='wrong',v=>v.tasks[0].facultyId='wrong',v=>v.schemaVersion=4]){const altered=structuredClone(value);change(altered);assert.throws(()=>L.validatePortable(altered,C));}});
test('restore enforces byte size, proper JSON, unique task ids and enum contracts',()=>{assert.throws(()=>L.parsePortable('你'.repeat(400000),C),/1 MiB/);assert.throws(()=>L.parsePortable('{',C),/JSON/);const value=backup();value.tasks.push({...value.tasks[0]});assert.throws(()=>L.validatePortable(value,C));const other=backup();other.profile.degree='MSc';assert.throws(()=>L.validatePortable(other,C));});
test('old notes without an intake stay unspecified while unsupported intake ids are rejected',()=>{const old=backup();delete old.profile.cycle;assert.equal(L.validatePortable(old,C).profile.cycle,'');const unknown=backup();unknown.profile.cycle='2099/00';assert.throws(()=>L.validatePortable(unknown,C),/入学轮次/);});
test('application renders imported notes through textContent and has no HTML string injection',()=>{const script=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');assert.match(script,/textContent/);assert.doesNotMatch(script,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);assert.match(script,/file\.size>1024\*1024/);assert.match(script,/没有替换当前清单/);});

test('actual material rules preserve degree, university, exam-date and programme differences',()=>{
  const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
  const p=id=>actual.programs.find(p=>p.id===id),text=(id,degree)=>L.requirementsFor(p(id),{degree}).map(item=>item.text).join(' ');
  assert.match(text('cuhk-cse-rpg','PhD'),/三份/);assert.doesNotMatch(text('cuhk-cse-rpg','PhD'),/两份/);
  assert.match(text('cuhk-cse-rpg','MPhil'),/两份/);assert.doesNotMatch(text('cuhk-cse-rpg','MPhil'),/三份/);
  const dual=L.requirementsFor(p('cuhk-cse-rpg'),{degree:'MPhil'}).find(item=>item.url);
  assert.equal(dual.url,'https://dept-eappsrv.cse.cuhk.edu.hk/pgas2027/');assert.ok(L.officialUrl(dual.url));
  for(const id of ['hkust-hk-cse-rpg','hkust-hk-ece-rpg']){
    assert.match(text(id,'MPhil'),/各单项5.5/);assert.match(text(id,'MPhil'),/2026年1月21日/);assert.match(text(id,'MPhil'),/不接受在家考试/);
    assert.doesNotMatch(text(id,'MPhil'),/至少一年全日制/);assert.match(text(id,'PhD'),/至少一年全日制/);
    const sid=id.includes('cse')?'hk-cse-2027':'hk-ece-2027';assert.ok(L.requirementsFor(p(id),{degree:'PhD'}).every(item=>item.sourceIds.includes(sid)));
  }
  assert.match(text('polyu-computing-rpg','PhD'),/未明确2027\/28新制TOEFL尺度/);
  assert.match(text('hkust-gz-rbm','MPhil'),/不等于免学费/);
  assert.ok(L.requirementsFor(p('hkust-gz-rbm'),{degree:'MPhil'}).some(item=>item.sourceIds.includes('gz-central-requirements')));
  assert.ok(L.requirementsFor(p('hkust-gz-rbm'),{degree:'MPhil'}).every(item=>!item.sourceIds.some(id=>id.startsWith('hk-cse')||id.startsWith('hk-ece'))));
  assert.match(text('hku-cs-rpg','MPhil'),/各项至少6/);assert.match(text('hku-cs-rpg','MPhil'),/六级\/专八不能替代/);
});
test('Guangzhou spring doctoral deadlines are visible without inheriting RedBird or Hong Kong dates',()=>{
  const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
  const profile={...L.defaultProfile(actual),degree:'PhD',universityIds:['hkustgz'],cycle:'2026/27 Spring'};
  const entries=L.programsFor(actual,profile);assert.equal(entries.length,1);assert.equal(entries[0].id,'hkust-gz-phd-entry');
  const dates=L.deadlinesFor(entries[0],profile,actual.universities.find(u=>u.id==='hkustgz'));
  assert.deepEqual(dates.map(d=>d.at),['2026-12-25T23:59:00+08:00','2026-12-04T23:59:00+08:00']);
  assert.equal(L.fundingFor(actual,profile).length,0);
});
test('profile preparation prompts are concrete but never infer eligibility from missing scores',()=>{
  const note=L.preparationNote({...L.defaultProfile(),degree:'PhD',education:'undergraduate',english:'scheduled'});
  assert.match(note,/在读证明/);assert.match(note,/是否有相应学历路径/);assert.match(note,/已预约不等于可以在截止后补交/);
  assert.match(L.preparationNote({...L.defaultProfile(),english:'available'}),/没有判定成绩是否达标/);
  assert.equal(L.preparationNote(L.defaultProfile()),'');
});
test('an earlier catalogue backup keeps its original source identity and personal notes under the new catalogue',()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/snapshots/f6acacfcbb436a3c52e45a92b093a614e3747c9554f94d036653464e6a9193fe.json'),'utf8'));
  const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
  const before=L.portable(old,{profile:{...L.defaultProfile(old),universityIds:['cuhk'],gpaNote:'只是一条合成旧备注'},shortlist:['CUHK-Sinno-Jialin-Pan'],tasks:[],sourceIds:['CUHK-CSE-PROGRAMME']});
  const loaded=L.parsePortable(JSON.stringify(before),actual);assert.deepEqual(loaded,before);assert.notEqual(loaded.catalogSnapshotId,actual.snapshotId);
});

test('catalogue history preserves only provided version chains and validates shape, duplicates and bounds',()=>{
  const state=backup();
  state.catalogSnapshotId='sha256:'+'a'.repeat(64);state.catalogCheckedDate='2025-01-01';
  state.catalogHistory=[{snapshotId:'sha256:'+'b'.repeat(64),checkedDate:'2024-01-01'}];
  const current={...C,snapshotId:'sha256:'+'c'.repeat(64)};
  const migrated=L.portable(current,state);
  assert.equal(migrated.catalogHistory.length,2);assert.equal(migrated.catalogHistory[0].snapshotId,state.catalogHistory[0].snapshotId);
  assert.equal(migrated.catalogHistory[1].snapshotId,state.catalogSnapshotId);
  assert.deepEqual(L.portable(current,migrated),migrated);
  for(const bad of [null,{},[{snapshotId:'not-a-hash',checkedDate:''}],[{snapshotId:null,checkedDate:2}],[state.catalogHistory[0],state.catalogHistory[0]],Array.from({length:257},(_,i)=>({snapshotId:'sha256:'+i.toString(16).padStart(64,'0'),checkedDate:''}))]){
    const value=backup();value.catalogHistory=bad;assert.throws(()=>L.validatePortable(value,C),/历史/);
  }
  const unknown=backup();unknown.schemaVersion=1;delete unknown.catalogSnapshotId;delete unknown.catalogHistory;
  const restored=L.validatePortable(unknown,C),preserved=L.portable(current,restored);
  assert.ok(preserved.catalogHistory.some(h=>h.snapshotId===null));
});

test('the new backup format requires its history field while preserving old v1 readability',()=>{
  const old=backup();old.schemaVersion=1;delete old.catalogHistory;
  assert.equal(L.parsePortable(JSON.stringify(old),C).schemaVersion,1);
  const current=L.portable(C,L.parsePortable(JSON.stringify(old),C));assert.equal(current.schemaVersion,3);assert.ok(Array.isArray(current.catalogHistory));
  const broken=structuredClone(current);delete broken.catalogHistory;assert.throws(()=>L.validatePortable(broken,C),/缺少资料版本历史/);
});
