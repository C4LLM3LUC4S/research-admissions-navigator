'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../data/catalog.json'),P=require('../data/research/cuhksz-sme-census-20261028.json'),L=require('../dist/logic.js');
const profile=(q='',degree='PhD')=>({...L.defaultProfile(C),universityIds:['cuhksz'],degree,researchQuery:q});
const old=require('../data/snapshots/c5f4056ab88012139553dc04599f91a23b2e7a62c7185dada2245a9b572490a4.json');
test('the entire returned130-card range stays visible without calling twelve unresolved records supervisors',()=>{
 const leads=P.staffEntries[0].profileLeads;assert.equal(leads.length,130);assert.equal(new Set(leads.map(l=>l.url)).size,130);
 assert.equal(leads.filter(l=>l.profileBodyStatus==='body_read').length,127);assert.equal(leads.filter(l=>l.facultyId).length,118);assert.equal(leads.filter(l=>!l.facultyId).length,12);
 for(const l of leads){assert.equal(l.supervisionEligibility,'unknown');assert.equal(l.availability,'unknown');}
 assert.equal(P.directories[0].coverageComplete,false);assert.equal(P.staffEntries[0].enumerationComplete,false);
});
test('old faculty, programme, source dates and identities remain exact objects',()=>{
 for(const key of ['faculty','programs','sources'])for(const r of old[key])assert.deepEqual(C[key].find(n=>n.id===r.id),r,r.id);
 assert.equal(C.faculty.length,1013);assert.equal(C.programs.length,32);assert.equal(C.faculty.filter(f=>f.universityId==='cuhksz').length,178);
});
test('Chinese words find the actual original research while appointments and past institutions stay separate',()=>{
 for(const [q,name] of [['大语言模型','申睿'],['图神经网络','陈琛'],['气候金融','胡中琛']]){
  assert.ok(L.facultyFor(C,profile(q)).some(f=>f.name===name),q);
 }
 const hu=P.faculty.find(f=>f.name==='胡中琛');assert.ok(hu.keywordSourceIds[0].endsWith('-personal'));
 const xiong=P.faculty.find(f=>f.name==='熊伟');assert.match(xiong.identityNote,/其他高校/);
 const yoon=P.faculty.find(f=>f.name==='晋润晧');assert.match(yoon.identityNote,/晋润皓/);
 for(const f of P.faculty){assert.equal(f.availability.state,'unknown');assert.equal(f.availability.cycle,null);}
});
test('directory-only personal sites have per-person provenance, rather than a link from somebody else',()=>{
 const f=P.faculty.find(f=>f.name==='邓淇元'),items=L.facultyLinks(C,f);
 assert.ok(items.some(x=>x.url==='https://qiyuan-deng.github.io/'&&x.parentSourceId==='cuhksz-sme-directory-20261028'));
 const d=P.sources.find(s=>s.id==='cuhksz-sme-directory-20261028');assert.ok(d.teacherLinksByProfile[f.profileUrl].includes('https://qiyuan-deng.github.io/'));
 const other={...f,profileUrl:'https://myweb.cuhk.edu.cn/other',reviewedProfileUrl:null};
 assert.ok(!L.facultyLinks(C,other).some(x=>x.url==='https://qiyuan-deng.github.io/'));
});
test('five specific2027PhD cards never become MPhil applications or rules for the unread sixth programme',()=>{
 assert.equal(P.programmes.length,5);
 for(const p of P.programmes){assert.deepEqual(p.degrees,['PhD']);assert.equal(p.cycle,'2027/28');assert.equal(p.contact.status,'unknown');assert.equal(p.deadlines[0].at,null);assert.equal(p.deadlines[0].date,'2027-04-15');assert.match(p.requirements[0].text,/不能单独证明/);}
 assert.ok(!L.programsFor(C,profile('','MPhil')).some(p=>p.id.startsWith('cuhksz-sme-')));
 assert.ok(!P.programmes.some(p=>p.id.includes('information')));
});
test('fees, contingent waivers and capped work payments never imply a guaranteed income',()=>{
 for(const p of P.programmes){
  const fees=L.financesFor(p,profile());assert.equal(fees.find(f=>f.kind==='tuition').rates[0].value,162000);
  assert.equal(fees.find(f=>f.kind==='application_fee').rates[0].value,600);
  assert.match(fees.find(f=>f.kind==='studentship').text,/税前最高/);
  assert.match(p.requirements.find(x=>x.label==='奖学金考虑不等于已获资助').text,/不等于|具体是否授予/);
 }
});
test('the material list and lecturer personal admission advice keep their scopes',()=>{
 for(const p of P.programmes){const text=p.requirements.find(r=>r.label==='GRE/GMAT与完整材料').text;assert.match(text,/至少两位学术推荐人/);assert.match(text,/英文论文可选/);}
 const huang=P.faculty.find(f=>f.name==='黄宗博');assert.equal(huang.applicationNotes[0].kind,'teacher_statement');assert.deepEqual(huang.applicationNotes[0].degrees,['PhD']);assert.match(huang.applicationNotes[0].text,/未注明申请年度/);
});
test('a student can preserve old and new teacher IDs with a programme-specific follow-up',()=>{
 const f=P.faculty.find(f=>f.name==='胡中琛'),p=P.programmes[0];
 const state={profile:profile('气候金融'),shortlist:['cityu-jun-wang',f.id],tasks:[{id:'task-sme',text:'核对英语路径和当期资助条件',done:false,programId:p.id,facultyId:f.id}]};
 const restored=L.parsePortable(JSON.stringify(L.portable(C,state)),C);assert.deepEqual(restored.shortlist,state.shortlist);assert.equal(restored.tasks[0].programId,p.id);assert.equal(restored.profile.researchQuery,'气候金融');
});
