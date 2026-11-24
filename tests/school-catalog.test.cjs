'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist');
const script=name=>fs.readFileSync(path.join(root,name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness({saved=null,fail=false,mutate}={}){
  const requests=[],indexRequests=[];let failing=fail;
  const context={window:{},URL,setTimeout,clearTimeout,localStorage:{getItem:()=>saved},document:{currentScript:{src:'https://example.org/app/catalog-loader.js'},
    createElement(){return {remove(){}};},head:{append(element){const isIndex=element.src.includes("/faculty-index.js?");(isIndex?indexRequests:requests).push(element.src);setTimeout(()=>{
      if(failing){element.onerror();return;}
      vm.runInContext(script(new URL(element.src).pathname.split('/').pop()),context);
      if(mutate&&!isIndex)mutate(context.window.APP_CATALOG_PARTS.at(-1));
      element.onload();
    },Math.random()*5);}}}};
  vm.createContext(context);vm.runInContext(script('catalog-loader.js'),context);
  return {window:context.window,requests,indexRequests,recover:()=>{failing=false;}};
}
const original={window:{}};vm.runInNewContext(script('catalog.js'),original);
const expected=plain(original.window.APP_CATALOG);
function checkSources(catalog){
  const ids=new Set(expected.sources.map(s=>s.id)),available=new Set(catalog.sources.map(s=>s.id));
  function visit(value){if(typeof value==='string'&&ids.has(value))assert.ok(available.has(value),'Missing source '+value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);}
  visit(catalog);
}
test('new visitors get complete programme requirements without requesting any school',async()=>{
  const h=harness(),c=await h.window.APP_CATALOG_READY;
  assert.equal(h.requests.length,0);assert.equal(h.indexRequests.length,0);assert.equal(c.faculty.length,0);
  assert.deepEqual(plain(c.programs),expected.programs);assert.deepEqual(plain(c.funding),expected.funding);checkSources(c);
});
test('one school is independently usable with complete source closure and stable IDs',async()=>{
  for(const university of expected.universities){const h=harness();await h.window.APP_CATALOG_READY;
    const c=await h.window.APP_LOAD_SCHOOLS([university.id]);assert.equal(h.requests.length,1);
    for(const field of ['faculty','directories','academicCoverage'])assert.deepEqual(plain(c[field]),expected[field].filter(row=>row.universityId===university.id));
    checkSources(c);
  }
});
test('overlapping concurrent requests download each school only once',async()=>{
  const h=harness();await h.window.APP_CATALOG_READY;await Promise.all([h.window.APP_LOAD_SCHOOLS(['hku']),h.window.APP_LOAD_SCHOOLS(['hku','cuhk'])]);
  assert.equal(h.requests.length,2);await h.window.APP_LOAD_SCHOOLS(['hku']);assert.equal(h.requests.length,2);
});
test('loading all schools in arbitrary order reconstructs the exact original catalogue',async()=>{
  const h=harness();await h.window.APP_CATALOG_READY;
  assert.deepEqual(plain(await h.window.APP_LOAD_ALL()),expected);assert.equal(h.window.APP_ALL_SCHOOLS_READY,true);
});
test('existing local backups wait for the full ID set before validation',async()=>{
  const h=harness({saved:JSON.stringify({shortlist:['unknown-old-id'],tasks:[],sourceIds:[]})});const c=await h.window.APP_CATALOG_READY;
  assert.equal(h.requests.length,8);assert.deepEqual(plain(c),expected);
});
test('a failed school keeps programmes usable and supports a bounded user retry',async()=>{
  const h=harness({fail:true});const c=await h.window.APP_CATALOG_READY;
  await assert.rejects(h.window.APP_LOAD_SCHOOLS(['hku']),/未能下载/);assert.equal(c.faculty.length,0);assert.equal(c.programs.length,expected.programs.length);
  h.recover();await h.window.APP_LOAD_SCHOOLS(['hku']);assert.equal(c.faculty.length,expected.faculty.filter(f=>f.universityId==='hku').length);
});
test('mixed catalogue versions do not publish partial school records',async()=>{
  const h=harness({mutate:part=>{part.snapshotId='wrong-version';}}),c=await h.window.APP_CATALOG_READY;
  await assert.rejects(h.window.APP_LOAD_SCHOOLS(['hku']),/版本不一致/);assert.equal(c.faculty.length,0);assert.equal(h.window.APP_LOADED_SCHOOLS.size,0);
});

const L=require('../dist/logic.js');
function backupFor(facultyIds){return L.portable(expected,{profile:L.defaultProfile(expected),shortlist:facultyIds,tasks:[],sourceIds:facultyIds.flatMap(id=>expected.faculty.find(f=>f.id===id).sourceIds)});}
test('a saved two-school shortlist loads just those schools before validating its complete portable record',async()=>{
 const ids=['hku','hkustgz'].map(uid=>expected.faculty.find(f=>f.universityId===uid).id),backup=backupFor(ids),h=harness({saved:JSON.stringify(backup)});
 const c=await h.window.APP_CATALOG_READY;assert.equal(h.requests.length,2);
 assert.deepEqual(L.parsePortable(JSON.stringify(backup),plain(c)).shortlist,ids);
 assert.deepEqual(L.parsePortable(JSON.stringify(backup),plain(c)).sourceIds,backup.sourceIds);checkSources(c);
});
test('a merged teacher archive restores old favourites and follow-ups with the original profile',async()=>{
 const [oldId,id]=Object.entries(expected.facultyAliases)[0];
 const backup=backupFor([id]);
 backup.shortlist=[oldId,id];
 backup.tasks=[{id:'task-legacy-jiang',text:'继续核对研究方向',done:false,programId:null,facultyId:oldId}];
 const h=harness({saved:JSON.stringify(backup)});
 const c=await h.window.APP_CATALOG_READY;
 const restored=L.parsePortable(JSON.stringify(backup),plain(c));
 assert.equal(h.requests.length,1);
 assert.deepEqual(restored.shortlist,[id]);
 assert.equal(restored.tasks[0].facultyId,id);
 assert.deepEqual(restored.sourceIds,backup.sourceIds);
});
test('historical source references beyond saved faculty trigger full fallback without dropping any source ID',async()=>{
 const id=expected.faculty.find(f=>f.universityId==='hkustgz').id,backup=backupFor([id]);
 const partial=harness({saved:JSON.stringify(backup)}),c=await partial.window.APP_CATALOG_READY;
 const missing=expected.sources.find(s=>!c.sources.some(p=>p.id===s.id));backup.sourceIds.push(missing.id);
 const h=harness({saved:JSON.stringify(backup)}),full=await h.window.APP_CATALOG_READY;
 assert.equal(h.requests.length,8);assert.deepEqual(L.parsePortable(JSON.stringify(backup),plain(full)).sourceIds,backup.sourceIds);
});
test('a faculty follow-up without a bookmark still loads the referenced school for saved-state validation',async()=>{
 const f=expected.faculty.find(f=>f.universityId==='cuhksz'),backup=backupFor([]);
 backup.tasks=[{id:'task-saved-one',text:'Read official research',done:false,programId:null,facultyId:f.id}];backup.sourceIds=f.sourceIds;
 const h=harness({saved:JSON.stringify(backup)}),c=await h.window.APP_CATALOG_READY;
 assert.equal(h.requests.length,1);assert.equal(L.parsePortable(JSON.stringify(backup),plain(c)).tasks[0].facultyId,f.id);
});
test('an empty valid local backup and a malformed JSON record do not request unrelated faculty data',async()=>{
 for(const saved of [JSON.stringify(backupFor([])),'{broken']){const h=harness({saved});await h.window.APP_CATALOG_READY;assert.equal(h.requests.length,0);}
});
test('the first cross-school search shares one optional index request and a failed request can retry',async()=>{
  const h=harness({fail:true});await h.window.APP_CATALOG_READY;
  assert.equal(h.indexRequests.length,0);
  const first=h.window.APP_LOAD_FACULTY_INDEX();
  assert.equal(h.window.APP_LOAD_FACULTY_INDEX(),first);
  await assert.rejects(first,/暂未载入/);
  h.recover();
  const index=await h.window.APP_LOAD_FACULTY_INDEX();
  assert.equal(index.snapshotId,expected.snapshotId);
  assert.equal(index.faculty.length,expected.faculty.length);
  assert.equal(h.indexRequests.length,2);
  assert.equal(h.requests.length,0);
});

test('four PolyU engineering cards preserve distinct materials and degree scope',()=>{
 const byId=id=>expected.programs.find(p=>p.id==='polyu-'+id+'-rpg-sept-2027');
 for(const id of ['cmi','lsgs','aae','ise']){
  const p=byId(id);
  assert.deepEqual(L.applicationDegrees(expected,p),['MPhil','PhD']);
  assert.deepEqual(p.deadlines.map(d=>[d.date,d.at]),[['2027-05-31',null]]);
  assert.deepEqual(p.finances.flatMap(f=>f.rates.map(r=>r.value)),[600,99000,49500,49500]);
  for(const degree of ['MPhil','PhD']){
   assert.deepEqual(L.requirementsFor(p,{degree}).map(r=>r.label),[degree+' 学历','英语证明','申请材料']);
  }
 }
 assert.match(byId('cmi').requirements.at(-1).text,/奖学金或奖助计划时提交两份学术推荐/);
 assert.doesNotMatch(byId('lsgs').requirements.at(-1).text,/个人陈述/);
 assert.match(byId('aae').requirements.at(-1).text,/截止日前完成两份学术推荐/);
 assert.match(byId('ise').requirements.at(-1).text,/HKPFS/);
});

test('PolyU CEE May keeps its year, date and departmental condition separate from September and HKPFS',()=>{
 const may=expected.programs.find(p=>p.id==='polyu-cee-rpg-may-2027');
 assert.deepEqual(may.deadlines.map(d=>[d.date,d.at,d.cycle]),[['2027-01-31',null,'2026/27']]);
 assert.equal(may.contact.status,'required');
 assert.match(may.requirements.find(r=>r.label==='先确认系级递交时间').text,/十二月底.*2027 年 1 月 31 日/);
 for(const degree of ['MPhil','PhD']){
  const profile={...L.defaultProfile(expected),degree,universityIds:['polyu'],cycle:'2026/27'};
  assert.ok(L.programsFor(expected,profile).includes(may));
  assert.ok(!L.programsFor(expected,{...profile,cycle:'2027/28'}).includes(may));
  assert.deepEqual(may.finances.flatMap(f=>L.financeRates(f,profile).matched.map(r=>r.value)),[500,94000,47000]);
 }
});

test('a saved local school hint reopens a two-school shortlist without the search index',async()=>{
 const people=['hku','hkustgz'].map(id=>expected.faculty.find(f=>f.universityId===id));
 const ids=people.map(person=>person.id),backup=backupFor(ids);
 const hints=people.map(person=>[person.id,person.universityId]);
 const h=harness({saved:JSON.stringify({...backup,facultySchools:hints})});
 const c=await h.window.APP_CATALOG_READY;
 assert.equal(h.indexRequests.length,0);
 assert.equal(h.requests.length,2);
 assert.deepEqual(L.parsePortable(JSON.stringify(backup),plain(c)).shortlist,ids);
 checkSources(c);
});

test('a stale local school hint is verified and repaired by normal index routing',async()=>{
 const person=expected.faculty.find(f=>f.universityId==='hkustgz');
 const backup=backupFor([person.id]);
 const h=harness({saved:JSON.stringify({...backup,facultySchools:[[person.id,'hku']]})});
 const c=await h.window.APP_CATALOG_READY;
 assert.equal(h.indexRequests.length,1);
 assert.equal(h.requests.length,2);
 assert.deepEqual(L.parsePortable(JSON.stringify(backup),plain(c)).shortlist,[person.id]);
 checkSources(c);
});

test('HKUST Guangzhou CMA uses the PhD application route and Red Bird for research MPhil',()=>{
 const phd=expected.programs.find(p=>p.id==='hkustgz-cma-phd-2027');
 const redbird=expected.programs.find(p=>p.id==='hkust-gz-rbm');
 const profile={...L.defaultProfile(expected),universityIds:['hkustgz']};
 assert.ok(!L.programsFor(expected,profile).includes(phd));
 assert.ok(L.programsFor(expected,{...profile,degree:'PhD'}).includes(phd));
 assert.deepEqual(phd.deadlines.map(d=>d.at),['2027-06-15T23:59:00+08:00','2027-07-15T23:59:00+08:00']);
 assert.match(redbird.requirements.find(r=>r.label==='对计算媒体与艺术感兴趣').text,/MPhil \(General\).*统一录取/);
 assert.match(phd.selection.text,/作品集.*授课型 MFA/);
});

test('CUHK mathematics and materials science retain distinct requirements and PhD-only fellowship clocks',()=>{
 const math=expected.programs.find(p=>p.id==='cuhk-math-rpg-2027');
 const mse=expected.programs.find(p=>p.id==='cuhk-mse-rpg-2027');
 const school=expected.universities.find(u=>u.id==='cuhk');
 const mphil={...L.defaultProfile(expected),universityIds:['cuhk']};
 for(const p of [math,mse]){
  assert.deepEqual(L.deadlinesFor(p,mphil,school).map(d=>[d.date,d.at]),[['2026-12-01',null],['2027-03-31',null]]);
  assert.equal(L.deadlinesFor(p,{...mphil,degree:'PhD'},school).filter(d=>/HKPFS/.test(d.label)).length,2);
 }
 assert.match(L.requirementsFor(math,mphil).map(r=>r.text).join(' '),/部分申请者可能.*GRE/);
 assert.doesNotMatch(L.requirementsFor(mse,mphil).map(r=>r.text).join(' '),/36 个月|GRE/);
 assert.match(L.requirementsFor(mse,{...mphil,degree:'PhD'}).map(r=>r.text).join(' '),/36 个月/);
});

test('HKUST Guangzhou AI and IoT separate direct PhD from the shared Red Bird application',()=>{
 const profile={...L.defaultProfile(expected),universityIds:['hkustgz']};
 const redbird=expected.programs.find(p=>p.id==='hkust-gz-rbm');
 for(const [key,field] of [['ai','人工智能'],['iot','物联网']]){
  const phd=expected.programs.find(p=>p.id==='hkustgz-'+key+'-phd-2027');
  assert.ok(!L.programsFor(expected,profile).includes(phd));
  assert.ok(L.programsFor(expected,{...profile,degree:'PhD'}).includes(phd));
  assert.deepEqual(phd.deadlines.map(d=>d.at),['2027-06-15T23:59:00+08:00','2027-07-15T23:59:00+08:00']);
  assert.ok(redbird.requirements.some(r=>r.label==='对'+field+'感兴趣'&&r.text.includes('MPhil (General)')));
  assert.ok(!phd.selection.text.includes('MFA'));
 }
});
