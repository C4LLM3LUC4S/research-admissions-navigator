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
  await assert.rejects(h.window.APP_LOAD_SCHOOLS(['hku']),/未能下载/);assert.equal(c.faculty.length,0);assert.equal(c.programs.length,85);
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
