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
