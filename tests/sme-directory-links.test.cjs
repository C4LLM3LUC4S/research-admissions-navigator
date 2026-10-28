'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../dist/logic.js');
test('a personal site explicitly attached to this exact directory profile remains clickable',()=>{
 const profile='https://myweb.cuhk.edu.cn/a',url='https://example.org/research';
 const parent={id:'directory',url:'https://sme.cuhk.edu.cn/teacher-search',discoveredLinks:[url],teacherLinksByProfile:{[profile]:[url]}};
 const f={profileUrl:profile,sourceIds:['directory'],directorySourceIds:['directory'],extraLinks:[{url,parentSourceId:'directory',bodyStatus:'not_read'}]};
 assert.equal(L.facultyLinks({sources:[parent]},f)[0]?.url,url);
 const other={...f,profileUrl:'https://myweb.cuhk.edu.cn/b'};assert.deepEqual(L.facultyLinks({sources:[parent]},other),[]);
 parent.teacherLinksByProfile[profile]=['https://example.org/other'];assert.deepEqual(L.facultyLinks({sources:[parent]},f),[]);
});

test('nested supplied research links require every exact HTTPS edge back to an official page',()=>{
 const root={id:'root',url:'https://www.bme.cuhk.edu.hk/core',discoveredLinks:['https://lab.example/profile']};
 const profile={id:'profile',url:'https://lab.example/profile',parentSourceId:'root',evidenceLevel:'teacher_page_linked_from_official_profile',discoveredLinks:['https://lab.example/research']};
 const research={id:'research',url:'https://lab.example/research',parentSourceId:'profile',evidenceLevel:'teacher_page_linked_from_official_profile'};
 const catalog={sources:[root,profile,research]};assert.equal(L.sourceUrl(catalog,research),research.url);
 for(const mutate of [c=>c.sources[0].discoveredLinks=[],c=>c.sources[1].discoveredLinks=[],c=>c.sources[1].parentSourceId='research',c=>c.sources[1].evidenceLevel='official_profile_body_read',c=>c.sources[1].url='http://lab.example/profile',c=>c.sources[2].url='javascript:alert(1)']){
  const altered=structuredClone(catalog);mutate(altered);assert.equal(L.sourceUrl(altered,altered.sources[2]),null);
 }
});
