'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('../dist/logic.js');
const C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');

test('PolyU September applicant sees degree-specific routes and restores a material task with its source', async () => {
 const h=harness(), el=id=>h.byId.get(id);
 const getCard=name=>el('results').children.find(card=>h.walk(card).some(n=>n.tagName==='h3'&&n.textContent===name));
 h.select('polyu','MPhil',[]);
 await el('profile-form').emit('input');
 assert.ok(getCard('时装及纺织研究学位'));
 assert.match(getCard('眼科视光学研究学位').textContent,/2027-04-30（具体时间请核对原页）/);
 assert.equal(getCard('设计学博士'),undefined);
 assert.equal(getCard('酒店及旅游业管理博士'),undefined);
 h.select('polyu','PhD',[]);
 await el('profile-form').emit('input');
 assert.match(getCard('设计学博士').textContent,/全日制或兼读/);
 const hotel=getCard('酒店及旅游业管理博士');
 assert.match(hotel.textContent,/2027-01-15（具体时间请核对原页）/);
 assert.match(hotel.textContent,/1,200–1,800 词/);
 assert.match(hotel.textContent,/2026 年 1 月 21 日/);
 assert.ok(h.walk(hotel).some(n=>n.tagName==='a'&&n.href==='https://www.polyu.edu.hk/study/pg/rpg/2027/shtm'));
 const materials=h.walk(hotel).find(n=>n.children.some(child=>child.tagName==='h4'&&child.textContent==='研究计划和个人陈述'));
 const start=materials.children.findIndex(n=>n.tagName==='h4'&&n.textContent==='研究计划和个人陈述');
 await materials.children.slice(start+1).find(n=>n.tagName==='button').emit('click');
 await el('export-local').emit('click');
 const raw=await h.downloads.at(-1).blob.text(), backup=JSON.parse(raw);
 assert.equal(backup.tasks[0].programId,'polyu-shtm-rpg-sept-2027');
 assert.ok(backup.sourceIds.includes('polyu-shtm-sept-2027-20261106'));
 const fresh=harness(), file=fresh.byId.get('import-local');
 file.files=[{size:Buffer.byteLength(raw),text:async()=>raw}];
 await file.emit('change');
 const reopened=harness(fresh.saved);
 assert.match(reopened.byId.get('tasks').textContent,/PhD.*分别核对两项材料的字数/);
 assert.equal(h.networkCalls()+fresh.networkCalls()+reopened.networkCalls(),0);
});

test('applicant-first cards keep unknown contact, exact process and dated decisions available without repeated audit copy',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-programs').emit('click');const p=C.programs.find(p=>p.id==='hku-cs-rpg'),card=el('results').children.find(n=>h.walk(n).some(x=>x.tagName==='h3'&&x.textContent===p.name));assert.ok(card);const process=h.walk(card).find(x=>x.className==='source-details application-process');assert.ok(process);assert.ok(!process.open);assert.ok(process.textContent.includes(p.contact.text));assert.ok(process.textContent.includes(p.selection.text));assert.match(h.walk(card).find(x=>x.className==='contact-next-step').textContent,/要求待确认/);assert.match(card.textContent,/2026\/12\/01/);assert.doesNotMatch(el('faculty-coverage').textContent,/导师总名单|本版已整理/);assert.ok(!html.includes('不预测录取概率'));assert.ok(!html.includes('这里没有真实投稿计数'));
 const original=new Set(p.contact.sourceIds.concat(p.selection.sourceIds).map(id=>C.sources.find(s=>s.id===id).url));for(const url of original)assert.ok(h.walk(card).some(n=>n.tagName==='a'&&n.href===url));await h.walk(card).find(n=>n.tagName==='button'&&n.textContent==='加入准备清单 ＋').emit('click');assert.ok(h.walk(el('tasks')).some(n=>n.textContent.includes(p.name)));assert.equal(h.networkCalls(),0);
});

test('PolyU science projects keep scholarship references scoped and the Physics and Materials statement separate', async () => {
 const h=harness(), el=id=>h.byId.get(id);
 const names=['化学研究学位','食品科学及营养学研究学位','生命科学研究学位','物理及材料科学研究学位'];
 for (const degree of ['MPhil','PhD']) {
   h.select('polyu',degree,[]);
   await el('profile-form').emit('input');
   for (const [index,name] of names.entries()) {
     const card=el('results').children.find(card=>h.walk(card).some(n=>n.tagName==='h3'&&n.textContent===name));
     assert.ok(card,name+' '+degree);
     assert.match(card.textContent,/2027-05-31（具体时间请核对原页）/);
     assert.match(card.textContent,/两份学术推荐报告列为奖学金申请要求/);
     assert.equal(card.textContent.includes('个人陈述'),index===3);
   }
 }
 assert.equal(h.networkCalls(),0);
});

test('teacher cards keep honorary, retired and cross-institution identities outside closed details',async()=>{
 const ids=['hku-mechanical-55','hku-mechanical-64','polyu-cee-005'],faculty=C.faculty.filter(f=>ids.includes(f.id)),h=harness(undefined,{catalog:{...C,faculty}}),el=id=>h.byId.get(id);
 const visibleText=n=>n.hidden?'':n.tagName==='details'&&!n.open?(n.children.find(c=>c.tagName==='summary')?.textContent||''):n._text+n.children.map(visibleText).join('');
 await el('show-faculty').emit('click');
 for(const f of faculty){const card=el('results').children.find(n=>h.walk(n).some(x=>x.tagName==='h3'&&x.textContent===f.name));assert.ok(card,f.id);const text=visibleText(card);assert.ok(text.includes(f.directoryRole),f.id+' role is visible');assert.ok(text.includes(f.identityNote),f.id+' identity is visible');const details=h.walk(card).find(n=>n.className==='source-details appointment-details');assert.ok(details&&!details.open);}
 assert.equal(h.networkCalls(),0);
});

test('deadline cards show each date once while retaining tentative batches, expired status and unknown times',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-programs').emit('click');const p=C.programs.find(p=>p.id==='cuhk-cse-rpg'),card=el('results').children.find(n=>h.walk(n).some(x=>x.tagName==='h3'&&x.textContent===p.name)),dates=h.walk(card).filter(n=>n.className.split(' ').includes('deadline'));assert.ok(dates.length>=5);
 for(const date of dates){assert.doesNotMatch(date.children[0].textContent,/\d{4}-\d\d-\d\d/);assert.equal(date.children.filter(n=>n.tagName==='strong').length,1);assert.match(date.children.find(n=>n.tagName==='strong').textContent,/具体时间请核对原页|UTC\+8/);assert.doesNotMatch(date.textContent,/官网只写了日期/);}
 assert.ok(dates.some(n=>n.textContent.includes('暂定')));assert.ok(dates.some(n=>n.className.includes('expired')&&n.textContent.includes('这个日期已过')));assert.equal(h.networkCalls(),0);
});

test('AIS reader sees scoped unit entrances, different AMC degree years and PPOL roles without marking the dynamic ENVR shell read',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const unit=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Academy of Interdisciplinary Studies')),reviews=h.walk(unit).filter(n=>n.className==='source-details unit-entry-followup');assert.equal(reviews.length,4);assert.match(unit.textContent,/MA、MFA.*2027\/28.*MPhil \/ PhD.*2026\/27/);assert.match(unit.textContent,/三个研究领域不是三个下属学系/);assert.match(unit.textContent,/关联身份不自动变成广州校区的指导资格/);assert.equal(h.networkCalls(),0);
});

test('applicants can follow the nursing, public health and separate environment unit pages',async()=>{
 const h=harness(),el=id=>h.byId.get(id);
 h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const nodes=h.walk(el('academic-coverage'));
 const nursing=nodes.find(n=>n.className==='source-details unit-entry-followup'&&n.textContent.includes('护理学院官网列出六类人员'));
 const publicHealth=nodes.find(n=>n.className==='source-details unit-entry-followup'&&n.textContent.includes('2027/28 公共卫生博士'));
 assert.ok(nursing&&publicHealth);
 assert.ok(h.walk(nursing).some(n=>n.href==='https://www.nur.cuhk.edu.hk/education/postgraduate-programmes/mphil-phd-in-nursing/'));
 assert.ok(!h.walk(publicHealth).some(n=>n.href==='https://sphpc.cuhk.edu.hk/our-centres/'));
 const centres=nodes.find(n=>n.className==='source-details unit-related-document'&&n.textContent.includes('公共卫生及基层医疗研究中心'));
 assert.ok(centres);
 assert.ok(h.walk(centres).some(n=>n.href==='https://sphpc.cuhk.edu.hk/our-centres/'));
 const rows=centres.children.find(n=>n.tagName==='ul').children;
 assert.equal(rows.length,10);
 assert.ok(rows.some(n=>n.textContent.includes('职业与环境健康研究中心')&&!h.walk(n).some(x=>x.href)));
 assert.ok(rows.some(n=>h.walk(n).some(x=>x.href==='https://www2.ccrb.cuhk.edu.hk/web/')));
 assert.ok(nodes.some(n=>n.className==='source-details unit-related-document'&&n.textContent.includes('1991 年设立')));
 h.select('hkust','PhD',[]);await el('profile-form').emit('input');
 const doc=h.walk(el('academic-coverage')).find(n=>n.className==='source-details unit-related-document');
 assert.ok(doc);
 assert.ok(h.walk(doc).some(n=>n.href==='https://envr.ust.hk/our-division/message-from-division-head.html'));
 assert.ok(h.walk(doc).some(n=>n.href==='https://envr.ust.hk/our-division/people/faculty-staff.html'));
 assert.ok(!h.walk(doc).some(n=>n.href?.startsWith('http://')));
 const themes=h.walk(el('academic-coverage')).find(n=>n.className==='source-details unit-related-document'&&n.textContent.includes('空气与健康'));
 assert.equal(themes.children.find(n=>n.tagName==='ul').children.length,3);
 assert.equal(h.networkCalls(),0);
});

test('HKU materials documents keep published research themes separate from an unfinished admissions page', async () => {
 const h=harness(), el=id=>h.byId.get(id);
 h.select('hku','PhD',[]);
 await el('profile-form').emit('input');
 await el('show-directories').emit('click');
 const children=h.walk(el('academic-coverage'));
 const materials=children.find(n=>n.tagName==='li'&&n.children[0]?.href==='https://mse.hku.hk/');
 assert.ok(materials);
 const panels=materials.children.filter(n=>n.className==='source-details unit-related-document');
 assert.equal(panels.length,3);
 assert.match(panels[0].textContent,/成立于 2026 年/);
 assert.deepEqual(panels[1].children.find(n=>n.tagName==='ul').children.map(n=>n.textContent),[
   '能源材料 · Energy Materials', '人工智能辅助材料研究 · AI for Materials',
   '先进制造 · Advanced Manufacturing', '半导体与电子材料 · Semiconductor & Electronic Materials'
 ]);
 assert.match(panels[2].textContent,/暂未公布申请要求或截止日期/);
 assert.ok(h.walk(panels[2]).some(n=>n.href==='https://mse.hku.hk/teaching-learning/rpg/'));
 const followup=materials.children.find(n=>n.className==='source-details unit-entry-followup');
 assert.match(followup.textContent,/首页核查（2026-11-04）/);
 assert.ok(h.walk(followup).some(n=>n.href==='https://mse.hku.hk/msepeople/academic-staff/'));
 assert.ok(!h.walk(followup).some(n=>n.href==='https://mse.hku.hk/research/research-areas/'));
 assert.equal(h.networkCalls(),0);
});

test('searchable subject browser opens the actual law college and saves a selected research term through empty restore',async()=>{
 const h=harness(),el=id=>h.byId.get(id);el('subject-search').value='法学';el('subject-kind').value='unit';await el('subject-search').emit('input');const law=h.walk(el('subject-options')).find(x=>x.tagName==='button'&&x.textContent==='港大 · 法律学院 · Faculty of Law');assert.ok(law);await law.emit('click');assert.equal(el('show-directories').attributes['aria-pressed'],'true');const opened=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.open);assert.match(opened.textContent,/Faculty of Law/);assert.ok(opened.focusRequested);
 el('subject-search').value='Department of Surgery';await el('subject-search').emit('input');const surgery=h.walk(el('subject-options')).find(x=>x.tagName==='button'&&x.textContent.endsWith('Department of Surgery'));assert.ok(surgery);await surgery.emit('click');const nested=h.walk(el('academic-coverage')).find(x=>x.className==='source-details organization-navigation'&&x.open);assert.ok(nested);assert.match(nested.textContent,/School of Clinical Medicine/);assert.ok(nested.focusRequested);
 el('subject-search').value='Matrix optimization';el('subject-kind').value='keyword';await el('subject-search').emit('input');const term=h.walk(el('subject-options')).find(x=>x.tagName==='button'&&x.textContent==='Matrix optimization');assert.ok(term);await term.emit('click');assert.equal(el('research-query').value,'Matrix optimization');assert.equal(el('show-faculty').attributes['aria-pressed'],'true');await el('profile-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads.at(-1).blob.text(),fresh=harness(),fe=id=>fresh.byId.get(id);fe('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await fe('import-local').emit('change');assert.equal(fe('research-query').value,'Matrix optimization');assert.equal(h.networkCalls()+fresh.networkCalls(),0);
 el('subject-search').value='unlisted-domain-example';await el('subject-search').emit('input');assert.equal(el('subject-options').children.length,0);assert.match(el('subject-count').textContent,/没有找到/);assert.equal(el('subject-more').hidden,true);
});

test('architecture reader follows supplied unit entries, keeps HTTP originals and restores a scoped admissions task',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const section=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Architecture')),routes=h.walk(section).filter(n=>n.className==='source-details provided-entry-routes');assert.equal(routes.length,3);assert.match(section.textContent,/学院另给入口正文已读/);assert.match(section.textContent,/官网原地址 http:\/\/www.arch.hku.hk\/people\/arch_staff\//);assert.match(section.textContent,/目标正文仍待核/);
 const links=h.walk(section).filter(n=>n.tagName==='a').map(n=>n.href);assert.ok(links.includes('https://www.arch.hku.hk/people/upad-staff/'));assert.ok(links.includes('https://www.arch.hku.hk/programmes/arch/mphil-and-phd/admissions/'));assert.ok(!links.includes('https://www.arch.hku.hk/people/arch_staff/'));
 const task='先核建筑学系研究学位当期要求，再检查人员类别；入口已读不代表有招生余位。';await el('profile-form').emit('submit');el('task-text').value=task;await el('task-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads.at(-1).blob.text(),fresh=harness(),fe=id=>fresh.byId.get(id);fe('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await fe('import-local').emit('change');const reopen=harness(fresh.saved);assert.match(reopen.byId.get('tasks').textContent,/入口已读不代表有招生余位/);assert.equal(h.networkCalls()+fresh.networkCalls()+reopen.networkCalls(),0);
});

test('shared school reader sees the old exact-page evidence and restores a followup without merging faculty or admission claims',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const science=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Science')),proof=h.walk(science).find(n=>n.className==='source-details shared-school-read');assert.ok(proof);assert.match(proof.textContent,/沿用2026-10-26的原网页记录/);assert.match(proof.textContent,/没有重新下载或改日期/);assert.match(proof.textContent,/完整师资、指导资格和当期余位仍需逐项核对/);assert.match(science.textContent,/关联学校：/);assert.doesNotMatch(proof.textContent,/核查 2026-11-05/);
 const task='继续核对CDS对应研究学位；官网入口已读不代表老师有余位。';await el('profile-form').emit('submit');el('task-text').value=task;await el('task-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads.at(-1).blob.text();const fresh=harness(),fe=id=>fresh.byId.get(id);fe('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await fe('import-local').emit('change');await fe('show-directories').emit('click');assert.match(fe('academic-coverage').textContent,/同一官网已读/);assert.match(fe('tasks').textContent,/不代表老师有余位/);assert.equal(h.networkCalls()+fresh.networkCalls(),0);
});

test('STEM unit reader separates Materials announcements from applications and reuses old staff reads at their actual dates',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const note=h.walk(el('academic-coverage')).find(n=>n.className==='source-details unit-scope-note');assert.ok(note);assert.match(note.textContent,/2027年开PhD和MSc、2028年开BEng/);assert.match(note.textContent,/不表示当前申请已开放/);assert.match(note.textContent,/三根研究支柱和两个技术平台/);assert.ok(h.walk(note).some(n=>n.href==='https://seng.hkust.edu.hk/node/10511'));
 h.select('polyu','PhD',[]);await el('profile-form').emit('input');const all=el('academic-coverage'),reviews=h.walk(all).filter(n=>n.className==='source-details unit-entry-followup'),ama=reviews.find(n=>n.textContent.includes('已沿原HTTP入口实际读到应用数学系主页'));assert.ok(ama);assert.match(ama.textContent,/已有2026-10-27的正文收据/);assert.match(ama.textContent,/没有重新下载/);assert.ok(h.walk(all).some(n=>n.tagName==='a'&&n.href==='https://www.polyu.edu.hk/pm/'));assert.match(all.textContent,/2026\/27，不能改成2027\/28/);assert.equal(h.networkCalls(),0);
});

test('science queue task: inspect a unit, keep a concrete followup, export and recover into an empty environment',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const scope=h.walk(el('academic-coverage')).find(n=>n.className==='source-details unit-entry-followup'&&n.textContent.includes('查看生物科学学院人员页面'));assert.ok(scope);assert.match(scope.textContent,/本页已核对 48 张人员卡/);assert.match(scope.textContent,/暂未归类不等于没有个人主页/);assert.ok(h.walk(scope).some(n=>n.href==='https://tropicalconslab.com/'));
 const task='先核港大生物科学学院当前PhD要求，再读Timothy C. Bonebrake所给网站；未确认指导资格和余位。';await el('profile-form').emit('submit');el('task-text').value=task;await el('task-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads.at(-1).blob.text(),backup=L.parsePortable(raw,C);assert.equal(backup.tasks.length,1);assert.equal(backup.tasks[0].text,task);assert.equal(backup.catalogSnapshotId,C.snapshotId);assert.equal(backup.profile.degree,'PhD');assert.deepEqual(backup.profile.universityIds,['hku']);
 const fresh=harness(),fe=id=>fresh.byId.get(id);assert.equal(fresh.saved.size,0);fe('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await fe('import-local').emit('change');assert.match(fe('notice').textContent,/已载入完整备份/);assert.match(fe('tasks').textContent,/Timothy C\. Bonebrake/);await fe('show-directories').emit('click');assert.match(fe('academic-coverage').textContent,/本页已核对 48 张人员卡/);
 const reopened=harness(fresh.saved);assert.match(reopened.byId.get('tasks').textContent,/未确认指导资格和余位/);assert.equal(h.networkCalls()+fresh.networkCalls()+reopened.networkCalls(),0);
});

test('CUHK science applicant sees actual new targets, unread degree entrances and a refusal without an invented HTTPS destination',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const reviews=h.walk(el('academic-coverage')).filter(n=>n.className==='source-details unit-entry-followup'),life=reviews.find(n=>n.textContent.includes('生命科学学院旧入口明确跳转')),physics=reviews.find(n=>n.textContent.includes('物理系原入口通过页面明确给出的目标')),math=reviews.find(n=>n.textContent.includes('原数学系入口返回403'));
 assert.ok(life&&physics&&math);assert.match(life.textContent,/六类研究主题与五个本科项目均不改称下属学系/);assert.ok(h.walk(el('academic-coverage')).some(n=>n.tagName==='a'&&n.href==='https://www.sls.cuhk.edu.hk/'));assert.ok(h.walk(physics).some(n=>n.tagName==='a'&&n.href==='https://app.phy.cuhk.edu.hk/teaching-staff/'));assert.match(physics.textContent,/目标正文待核/);assert.match(math.textContent,/未读到单位正文/);assert.match(math.textContent,/不改协议、换入口或浏览器重试/);assert.ok(!h.walk(math).some(n=>n.tagName==='a'));assert.equal(h.networkCalls(),0);
});

test('science-unit queue shows scoped names, supplied group sites and the unread embedded mathematics list separately',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const reviews=h.walk(el('academic-coverage')).filter(n=>n.className==='source-details unit-entry-followup');
 const bio=reviews.find(n=>n.textContent.includes('查看生物科学学院人员页面'));assert.ok(bio);assert.match(bio.textContent,/本页已核对 48 张人员卡/);assert.match(bio.textContent,/Timothy C\. Bonebrake/);assert.match(bio.textContent,/Professor, Director/);assert.match(bio.textContent,/网站正文待核/);assert.ok(h.walk(bio).some(n=>n.tagName==='a'&&n.href==='https://tropicalconslab.com/'));assert.match(bio.textContent,/原网址：http:\/\/www\.biosch\.hku\.hk\/staff\/ay\/index\.html/);
 assert.match(bio.textContent,/暂未归类不等于没有个人主页/);assert.doesNotMatch(bio.textContent,/原页未给这些人员的独立个人主页/);
 const chemistry=reviews.find(n=>n.textContent.includes('查看化学系人员页面'));assert.match(chemistry.textContent,/本页已核对 31 张人员卡/);assert.doesNotMatch(chemistry.textContent,/0 个主页/);
 const physics=reviews.find(n=>n.textContent.includes('查看物理系人员页面'));assert.match(physics.textContent,/63 个个人主页正文待核/);assert.match(physics.textContent,/同名卡片保留各自原主页/);
 const math=reviews.find(n=>n.textContent.includes('查看数学系人员页面'));assert.ok(math);assert.match(math.textContent,/嵌入页发生重定向循环，未读到姓名/);assert.ok(h.walk(el('academic-coverage')).some(n=>n.tagName==='a'&&n.href==='https://hkumath.hku.hk/web/index.php'));
 assert.match(bio.textContent,/目标正文待核/);assert.equal(h.networkCalls(),0);
});

// This runs actual event callbacks against deterministic DOM/storage/file stubs.
// It is not browser, keyboard, visual, native-picker or completed-download QA.
function harness(initialStorage,options={}) {
  const all=[],byId=new Map(),saved=new Map(initialStorage||[]),blobs=new Map(),downloads=[];
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this._text='';this.value='';this.checked=false;this.hidden=false;this.className='';this.files=[];all.push(this);this.classList={toggle:(name,on)=>{const values=new Set(this.className.split(' ').filter(Boolean));on?values.add(name):values.delete(name);this.className=[...values].join(' ');}};}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    get childElementCount(){return this.children.length;}
    append(...children){children.forEach(child=>{this.children.push(child);child.parent=this;});}
    replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
    setAttribute(name,value){this.attributes[name]=String(value);}
    removeAttribute(name){delete this.attributes[name];}
    addEventListener(name,callback){(this.events[name]||=[]).push(callback);}
    async emit(name,event={}){for(const callback of this.events[name]||[])await callback({target:this,preventDefault(){},...event});}
    click(){if(this.tagName==='a'&&this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});else return this.emit('click');}
    focus(){this.focusRequested=true;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  }
  for(const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
    const element=new Element(match[1]);element.id=match[2];element.className=/class="([^"]*)"/.exec(match[0])?.[1]||'';byId.set(element.id,element);
  }
  for(const value of ['MPhil','PhD']){const radio=new Element('input');radio.name='degree';radio.value=value;radio.checked=value==='MPhil';}
  for(const value of ['explore','shortlist','sources','community']){const button=new Element('button');button.dataset.view=value;}
  if(options.initialLoadingNote)byId.get('data-stamp').textContent=options.initialLoadingNote;
  const body=new Element('body');
  function query(selector){if(selector==='.view')return [...byId.values()].filter(x=>x.className.split(' ').includes('view'));if(selector==='[data-view]')return all.filter(x=>x.dataset.view);const name=/^\[name=([^\]]+)\](:checked)?$/.exec(selector);if(name)return all.filter(x=>x.name===name[1]&&(!name[2]||x.checked));throw Error('Unsupported test selector '+selector);}
  let networkCalls=0;
  class TestURL extends URL {static createObjectURL(blob){const key='blob:local-test-'+blobs.size;blobs.set(key,blob);return key;}static revokeObjectURL(){}}
  class TestFormData {get(name){return query('[name='+name+']:checked')[0]?.value||null;}}
  const context={window:{APP_LOGIC:L,APP_CATALOG:options.catalog||C},document:{getElementById:id=>{assert.ok(byId.has(id),id);return byId.get(id);},createElement:tag=>new Element(tag),querySelectorAll:query,body},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{if(options.storageWriteFails)throw Error('synthetic storage failure');saved.set(key,value);},removeItem:key=>saved.delete(key)},structuredClone,Intl,Date,Math,Blob,URL:TestURL,FormData:TestFormData,Option:function(label,value){const option=new Element('option');option.textContent=label;option.value=value;return option;},history:{replaceState(){}},location:{hash:''},setTimeout:()=>1,clearTimeout(){},console,fetch(){networkCalls++;throw Error('No outbound network allowed in this local task');}};
  // This is a hang guard, not a startup-speed requirement; locale cold starts vary on shared runners.
  vm.runInNewContext(script,context,{timeout:10000});
  const walk=(element)=>[element,...element.children.flatMap(walk)];
  const button=(parent,text)=>{const found=walk(byId.get(parent)).find(x=>x.tagName==='button'&&x.textContent.includes(text));assert.ok(found,text);return found;};
  function select(university,degree,interests){query('[name=degree]').forEach(x=>{x.checked=x.value===degree;});query('[name=university]').forEach(x=>{x.checked=x.value===university;});query('[name=interest]').forEach(x=>{x.checked=interests.includes(x.value);});}
  return {byId,saved,downloads,button,select,walk,networkCalls:()=>networkCalls};
}

test('a ready catalogue replaces the initial waiting guide rather than retaining a false loading state',()=>{
 const h=harness(undefined,{initialLoadingNote:'正在读取学校与研究资料；若学校一直没有出现，可下载完整离线包。'}),stamp=h.byId.get('data-stamp');
 assert.match(stamp.textContent,/资料更新/);assert.match(stamp.textContent,new RegExp(C.checkedDate));assert.doesNotMatch(stamp.textContent,/正在读取|一直没有出现/);
});

test('access-check entries and source evidence never tell applicants institutional content was read',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('cityu','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
  assert.match(el('academic-coverage').textContent,/入口返回访问检查页，尚未读到院系正文/);
  const bios=h.walk(el('academic-coverage')).find(n=>n.tagName==='li'&&n.children.some(c=>c.textContent==='生物统计学系 · Department of Biostatistics ↗'));
  assert.ok(bios);assert.doesNotMatch(bios.textContent,/已读学系\/学域入口/);assert.match(bios.textContent,/入口读取失败/);
  const cards=el('source-list').children.filter(c=>c.children.some(n=>n.textContent==='官方入口（未读到正文） · 核查 2026-10-26'));
  assert.equal(cards.length,5);assert.ok(cards.every(c=>!c.textContent.includes('已读取入口正文')));assert.equal(h.networkCalls(),0);
});

test('collapsed direction filters reveal active saved choices and remain clearable after backup restore',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  assert.equal(el('interest-summary').textContent,'按方向再筛选（选填）');
  h.select('hku','PhD',['机器学习','计算机视觉']);
  await el('profile-form').emit('input');
  assert.equal(el('interest-summary').textContent,'按方向再筛选 · 已选 2 项');
  await el('export-local').emit('click');
  const backup=JSON.parse(await h.downloads.at(-1).blob.text());
  await el('clear-filters').emit('click');
  assert.equal(el('interest-summary').textContent,'按方向再筛选（选填）');
  el('import-local').files=[{size:JSON.stringify(backup).length,text:async()=>JSON.stringify(backup)}];
  await el('import-local').emit('change');
  assert.equal(el('interest-summary').textContent,'按方向再筛选 · 已选 2 项');
  await el('export-local').emit('click');
  assert.deepEqual(JSON.parse(await h.downloads.at(-1).blob.text()).profile.interests,backup.profile.interests);
  assert.equal(h.networkCalls(),0);
});

test('a saved research query reopens teacher results and import does not mislabel projects as research matches',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('hku','MPhil',[]);el('research-query').value='医疗AI';
  await el('profile-form').emit('input',{target:el('research-query')});
  await el('profile-form').emit('submit');
  await el('export-local').emit('click');
  const backup=JSON.parse(await h.downloads.at(-1).blob.text()),restarted=harness(h.saved);
  assert.equal(restarted.byId.get('show-faculty').attributes['aria-pressed'],'true');
  assert.match(restarted.byId.get('result-count').textContent,/2 位老师/);
  assert.equal(restarted.byId.get('research-query').value,'医疗AI');
  const clean=harness(),target=clean.byId.get('import-local');
  target.files=[{size:JSON.stringify(backup).length,text:async()=>JSON.stringify(backup)}];
  await target.emit('change');
  assert.equal(clean.byId.get('show-faculty').attributes['aria-pressed'],'true');
  assert.match(clean.byId.get('result-count').textContent,/2 位老师/);
  assert.equal(clean.networkCalls(),0);
});

test('school structure is a separate scoped journey, without inventing faculty totals or changing directory counts',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  assert.equal(el('academic-coverage').hidden,true);
  await el('show-directories').emit('click');
  assert.equal(el('academic-coverage').hidden,false);
  const schools=h.walk(el('academic-coverage')).filter(x=>x.className==='school-coverage');
  assert.equal(schools.length,7);
  assert.equal(el('result-count').textContent,C.directories.length+' 个目录');
  assert.match(el('academic-coverage').textContent,/中央完整架构页(?:访问)?403/);
  assert.match(el('academic-coverage').textContent,/申请或教学服务入口/);assert.ok(h.walk(el('academic-coverage')).filter(n=>n.className==='source-details unit-information').every(n=>!n.open));
  h.select('cuhksz','PhD',[]);await el('profile-form').emit('input');
  const selected=h.walk(el('academic-coverage')).filter(x=>x.className==='school-coverage');
  assert.equal(selected.length,1);assert.match(selected[0].textContent,/港中文（深圳）/);
  assert.doesNotMatch(selected[0].textContent,/Faculty of Engineering/);
  await el('show-faculty').emit('click');assert.equal(el('academic-coverage').hidden,true);
  assert.equal(h.networkCalls(),0);
});

test('a non-computing applicant can find real research terms, inspect original roles and keep the same backup flow',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('polyu','PhD',['旅游与酒店管理']);el('research-query').value='旅游经济学';
  await el('profile-form').emit('input',{target:el('research-query')});
  assert.match(el('results').textContent,/Haiyan Song/);
  assert.match(el('results').textContent,/目录中的原职位/);
  assert.match(el('results').textContent,/指导资格/);
  await h.button('results','放入我的清单').emit('click');await el('profile-form').emit('submit');
  await el('export-local').emit('click');const backup=L.parsePortable(await h.downloads[0].blob.text(),C);
  assert.equal(backup.profile.interests[0],'旅游与酒店管理');assert.ok(backup.shortlist.length);
  const restored=harness([['yanxiang-local-v1',JSON.stringify(backup)]]);
  assert.match(restored.byId.get('saved-faculty').textContent,/Haiyan Song/);assert.equal(h.networkCalls(),0);
});

test('a Chinese multimodal search can save both Ming Li profiles and restore their separate identities',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('cuhksz','PhD',[]);el('research-query').value='多模态';
  await el('show-faculty').emit('click');await el('profile-form').emit('input',{target:el('research-query')});
  const cards=el('results').children.filter(card=>h.walk(card).some(x=>x.tagName==='h3'&&x.textContent==='LI, Ming'));
  assert.equal(cards.length,2);
  for(const card of cards)await h.walk(card).find(x=>x.tagName==='button'&&x.textContent.includes('放入我的清单')).emit('click');
  await el('profile-form').emit('submit');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);
  assert.equal(backup.shortlist.length,2);assert.equal(new Set(backup.shortlist).size,2);
  assert.equal(backup.profile.researchQuery,'多模态');
  assert.deepEqual(new Set(backup.shortlist.map(id=>C.faculty.find(f=>f.id===id).profileUrl)),new Set(['https://sai.cuhk.edu.cn/en/teacher/258','https://sai.cuhk.edu.cn/en/teacher/277']));
  const restored=harness([['yanxiang-local-v1',JSON.stringify(backup)]]);
  assert.equal(restored.walk(restored.byId.get('saved-faculty')).filter(x=>x.tagName==='h3'&&x.textContent==='LI, Ming').length,2);
  assert.equal(h.networkCalls(),0);
});

test('a microelectronics applicant can follow new research, keep the old faculty identity and reopen the full backup',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('hkustgz','PhD',['电子与集成电路']);el('research-query').value='电子设计自动化';
  await el('show-faculty').emit('click');await el('profile-form').emit('input',{target:el('research-query')});
  assert.match(el('results').textContent,/Yuzhe Ma|Yuzhe MA/);assert.match(el('results').textContent,/广州/);assert.match(el('results').textContent,/名额|接收/);
  const card=el('results').children.find(c=>h.walk(c).some(x=>x.tagName==='h3'&&/Yuzhe Ma|Yuzhe MA/.test(x.textContent)));
  assert.ok(card);await h.walk(card).find(x=>x.tagName==='button'&&x.textContent.includes('放入我的清单')).emit('click');
  await el('profile-form').emit('submit');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);assert.deepEqual(backup.shortlist,['wide-hkustgz-yuzhe-ma']);
  const restored=harness([['yanxiang-local-v1',JSON.stringify(backup)]]);
  assert.match(restored.byId.get('saved-faculty').textContent,/Yuzhe Ma|Yuzhe MA/);assert.equal(backup.profile.researchQuery,'电子设计自动化');assert.equal(h.networkCalls(),0);
});

test('an applicant sees a source identity conflict before saving a medical-image follow-up and reopening it',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('cuhk','PhD',[]);el('research-query').value='医学影像分析';await el('show-faculty').emit('click');await el('profile-form').emit('input',{target:el('research-query')});
  const colin=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Colin S. C. Tsang'));assert.ok(colin);
  assert.match(colin.textContent,/Michael Ping-Fu Fung/);assert.match(colin.textContent,/没有确认与Colin Tsang的关系/);
  await h.walk(colin).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
  await h.walk(colin).find(n=>n.tagName==='button'&&n.textContent==='加入跟进待办').emit('click');await el('profile-form').emit('submit');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);assert.equal(backup.shortlist.length,1);assert.equal(backup.tasks.length,1);assert.equal(backup.profile.researchQuery,'医学影像分析');
  const restored=harness([['yanxiang-local-v1',JSON.stringify(backup)]]);assert.match(restored.byId.get('saved-faculty').textContent,/Colin S. C. Tsang/);assert.match(restored.byId.get('saved-faculty').textContent,/没有确认与Colin Tsang的关系/);assert.equal(h.networkCalls(),0);
});

test('directory progress gives actual names and precise pending reasons without fake links or current-supervisor claims',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
  assert.match(el('results').textContent,/76 个主页：69 个已读，7 个待核/);assert.match(el('results').textContent,/Martin Ding Fat Wong/);assert.match(el('results').textContent,/In Memoriam/);assert.match(el('results').textContent,/证书校验失败/);assert.doesNotMatch(el('results').textContent,/7 个读取超时/);
  assert.ok(h.walk(el('results')).some(n=>n.tagName==='a'&&n.href==='https://cs.uwaterloo.ca/~lapchi/'));assert.ok(!h.walk(el('results')).some(n=>n.tagName==='a'&&n.href==='http://www.cse.cuhk.edu.hk/~adafu/'));
  assert.match(el('academic-coverage').textContent,/Leizhen Cai/);assert.match(el('academic-coverage').textContent,/Hongsheng Li/);assert.equal(h.networkCalls(),0);
});

test('a Function Hub applicant saves a scoped doctoral action and sees the separate Red Bird MPhil route',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('hkustgz','PhD',[]);await el('profile-form').emit('input');
  const card=el('results').children.find(c=>h.walk(c).some(x=>x.tagName==='h3'&&x.textContent.includes('微电子 PhD')));assert.ok(card);
  assert.match(card.textContent,/国际申请者/);assert.match(card.textContent,/2027\/06\/15 23:59（UTC\+8）/);assert.match(card.textContent,/2027\/07\/15 23:59（UTC\+8）/);assert.match(card.textContent,/150/);
  const nodes=h.walk(card),at=nodes.findIndex(n=>n.tagName==='h4'&&n.textContent==='英语分数和考试形式一起核对');assert.ok(at>=0);
  await nodes.slice(at+1).find(n=>n.tagName==='button').emit('click');await el('profile-form').emit('submit');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);assert.equal(backup.tasks.length,1);assert.match(backup.tasks[0].text,/微电子 PhD/);assert.ok(backup.sourceIds.includes('gz-central-requirements'));
  const restored=harness([['yanxiang-local-v1',JSON.stringify(backup)]]);assert.match(restored.byId.get('tasks').textContent,/微电子 PhD/);
  h.select('hkustgz','MPhil',[]);await el('profile-form').emit('input');assert.match(el('results').textContent,/红鸟/);assert.doesNotMatch(el('results').textContent,/微电子 PhD/);assert.equal(h.networkCalls(),0);
});

test('actual catalog callbacks: filter, inspect evidence, keep tasks/faculty, save, reject bad replacement, restore and export a private draft',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  assert.ok(el('results').childElementCount>0);
  assert.equal(el('source-list').childElementCount,C.sources.length);
  h.select('hkustgz','MPhil',['机器学习']);
  el('gpa-note').value='<script>这只是合成测试备注</script>';
  await el('profile-form').emit('input');
  assert.equal(el('results').childElementCount,1);
  assert.match(el('results').textContent,/红鸟/);
  assert.equal(el('funding-results').hidden,true);
  await h.button('results','加入准备清单').emit('click');
  assert.equal(JSON.parse(h.saved.get('yanxiang-local-v1')).profile.gpaNote,'');
  assert.equal(el('tasks').childElementCount,1);
  await el('show-faculty').emit('click');
  assert.match(el('results').textContent,/Lingjie Duan/);
  assert.match(el('results').textContent,/需进一步确认/);
  await h.button('results','放入我的清单').emit('click');
  await el('profile-form').emit('submit');
  await el('export-local').emit('click');
  assert.equal(h.downloads.length,1);
  const raw=await h.downloads[0].blob.text();
  const portable=L.parsePortable(raw,C);
  assert.equal(portable.profile.gpaNote,'<script>这只是合成测试备注</script>');
  assert.ok(portable.sourceIds.includes('gz-redbird'));
  assert.ok(portable.shortlist.includes('lingjie-duan'));
  const before=h.saved.get('yanxiang-local-v1');
  el('import-local').files=[{size:1,text:async()=>'{'}];
  await el('import-local').emit('change');
  assert.equal(h.saved.get('yanxiang-local-v1'),before);
  assert.match(el('notice').textContent,/没有替换当前清单/);
  await el('reset-local').emit('click');
  assert.equal(h.saved.has('yanxiang-local-v1'),false);
  el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];
  await el('import-local').emit('change');
  assert.match(el('notice').textContent,/已载入完整备份/);
  assert.ok(JSON.parse(h.saved.get('yanxiang-local-v1')).shortlist.includes('lingjie-duan'));
  assert.match(el('saved-faculty').textContent,/Lingjie Duan/);
  el('community-university').value='hkustgz';await el('community-university').emit('change');
  el('community-program').value='hkust-gz-rbm';el('community-cycle').value='2027/28';el('community-outcome').value='rejected';el('community-notes').value='开发者合成样例，不是真实申请反馈。';el('community-consent').checked=true;
  await el('community-form').emit('submit');
  const draft=JSON.parse(await h.downloads[1].blob.text());
  assert.equal(draft.publiclySubmitted,false);assert.equal(draft.outcome,'rejected');
  assert.equal(h.networkCalls(),0);
});

test('a malformed saved record is retained rather than overwritten on startup',()=>{
  const raw='{broken';const h=harness([['yanxiang-local-v1',raw]]);
  assert.equal(h.saved.get('yanxiang-local-v1'),raw);
  assert.match(h.byId.get('notice').textContent,/原记录没有被覆盖/);
  assert.ok(h.byId.get('results').childElementCount>0);
});

test('actual callbacks show observed linked-profile status and complete directory progress, then preserve follow-up in a backup',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);
  el('research-query').value='时空数据库, Spatiotemporal';await el('profile-form').emit('input');
  await el('show-faculty').emit('click');
  assert.match(el('results').textContent,/Xiaofang/);assert.match(el('results').textContent,/继续看个人主页/);
  const personal=h.walk(el('results')).find(x=>x.tagName==='a'&&x.href==='https://sites.google.com/view/xiaofang-zhou');assert.ok(personal);
  assert.match(el('results').textContent,/个人网站、课题组和研究档案/);assert.match(el('results').textContent,/已读到正文/);
  await h.button('results','加入跟进待办').emit('click');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);assert.ok(backup.tasks.some(x=>x.facultyId==='census-hkust-zxf'));
  await el('show-directories').emit('click');
  assert.match(el('results').textContent,/53 个不同主页：已读 38 个，15 个读取超时/);
  assert.match(el('results').textContent,/展开老师名单与资料详情/);assert.match(el('results').textContent,/本轮读取超时，待核/);
  const li=h.walk(el('results')).filter(x=>x.tagName==='li'&&/本轮已读正文|本轮读取超时/.test(x.textContent));assert.equal(li.length,53);
  assert.equal(h.networkCalls(),0);
});

test('a changed catalog is explained without erasing the saved application notes',()=>{
  const saved=L.portable(C,{profile:{...L.defaultProfile(),gpaNote:'保留这条旧笔记'},shortlist:['lingjie-duan'],tasks:[],sourceIds:['gz-lingjie-duan']});
  saved.catalogSnapshotId='sha256:'+'0'.repeat(64);
  const raw=JSON.stringify(saved),h=harness([['yanxiang-local-v1',raw]]);
  assert.match(h.byId.get('notice').textContent,/资料版本已变化/);
  assert.equal(h.byId.get('gpa-note').value,'保留这条旧笔记');
  assert.equal(h.saved.get('yanxiang-local-v1'),raw);
});

test('the real intake selector changes the date rows and survives portable save and restore',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('cuhksz','MPhil',[]);
  el('intake-cycle').value='2026/27 Spring';await el('profile-form').emit('input');
  assert.equal(el('results').childElementCount,2);
  assert.match(el('results').textContent,/2026-10-15/);assert.match(el('results').textContent,/2026-10-31/);
  assert.doesNotMatch(el('results').textContent,/2027-06-30/);
  await el('export-local').emit('click');const raw=await h.downloads[0].blob.text();assert.equal(L.parsePortable(raw,C).profile.cycle,'2026/27 Spring');
  await el('reset-local').emit('click');el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');
  assert.equal(el('intake-cycle').value,'2026/27 Spring');assert.equal(el('results').childElementCount,2);
});

test('source-backed material actions follow the selected degree, avoid duplicates and restore with intake context',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  function action(label){const nodes=h.walk(el('results')),at=nodes.findIndex(n=>n.tagName==='h4'&&n.textContent===label);assert.ok(at>=0,label);const b=nodes.slice(at+1).find(n=>n.tagName==='button');assert.ok(b);return b;}
  h.select('cuhk','MPhil',[]);el('education').value='undergraduate';el('english').value='scheduled';await el('profile-form').emit('input');
  assert.match(el('results').textContent,/硕士：先约好两位推荐人/);assert.doesNotMatch(el('results').textContent,/博士：先约好三位推荐人/);
  assert.match(el('preparation-note').textContent,/已预约不等于可以在截止后补交/);
  const link=h.walk(el('results')).find(n=>n.tagName==='a'&&n.href==='https://dept-eappsrv.cse.cuhk.edu.hk/pgas2027/');assert.ok(link);
  await action('别只完成一个申请系统').emit('click');await action('别只完成一个申请系统').emit('click');
  assert.equal(el('tasks').childElementCount,1);assert.match(el('notice').textContent,/已经在清单/);
  h.select('cuhk','PhD',[]);await el('profile-form').emit('input');
  assert.doesNotMatch(el('results').textContent,/硕士：先约好两位推荐人/);assert.match(el('results').textContent,/博士：先约好三位推荐人/);
  await action('博士：先约好三位推荐人').emit('click');await el('profile-form').emit('submit');await el('export-local').emit('click');
  const raw=await h.downloads[0].blob.text(),backup=L.parsePortable(raw,C);
  assert.equal(backup.tasks.length,2);assert.match(backup.tasks[0].text,/2027\/28学年 · MPhil/);assert.match(backup.tasks[1].text,/2027\/28学年 · PhD/);
  assert.ok(backup.sourceIds.includes('cuhk-gs-documents'));assert.ok(backup.sourceIds.includes('CUHK-CSE-PROGRAMME'));
  await el('reset-local').emit('click');el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');
  assert.match(el('tasks').textContent,/三位推荐人/);assert.match(el('tasks').textContent,/pgas2027/);assert.equal(h.networkCalls(),0);
});

test('actual finance and CIE callbacks keep scoped actions and distinguish matched amounts from references after restore',async()=>{
  const h=harness(),el=id=>h.byId.get(id),nodes=()=>h.walk(el('results'));
  function action(label){const all=nodes(),at=all.findIndex(n=>n.tagName==='h4'&&n.textContent===label);assert.ok(at>=0,label);return all.slice(at+1).find(n=>n.tagName==='button');}
  const matched=()=>nodes().filter(n=>n.className==='finance-rate matched').map(n=>n.textContent).join(' ');
  h.select('cuhk','MPhil',[]);await el('profile-form').emit('input');
  assert.match(matched(),/49,500/);assert.doesNotMatch(matched(),/229,200/);
  assert.ok(nodes().some(n=>n.className==='finance-rate unknown'&&n.textContent.includes('所选轮次')));
  await action('研究生助学金不是只有博士才有').emit('click');
  h.select('cuhksz','PhD',[]);await el('profile-form').emit('input');
  assert.match(el('results').textContent,/不能把意向导师列作这两位之一/);
  await action('硕博都先约两位推荐人').emit('click');
  h.select('hkustgz','PhD',[]);el('intake-cycle').value='2027/28';await el('profile-form').emit('input');
  assert.match(matched(),/CNY 60,000.*有PGS/);assert.doesNotMatch(matched(),/15,000|150,000/);
  el('intake-cycle').value='2026/27 Spring';await el('profile-form').emit('input');assert.equal(matched(),'');
  await action('有PGS与自费分开看').emit('click');await action('有PGS与自费分开看').emit('click');
  assert.equal(el('tasks').childElementCount,3);
  await el('profile-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads[0].blob.text();
  const backup=L.parsePortable(raw,C);assert.ok(backup.sourceIds.includes('cuhk-gs-studentships'));assert.ok(backup.sourceIds.includes('gz-scholarships-fees'));assert.ok(backup.sourceIds.includes('cuhksz-cie'));
  assert.match(backup.tasks[2].text,/2027年春季.*PhD/);
  await el('reset-local').emit('click');el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');
  assert.equal(el('tasks').childElementCount,3);assert.equal(matched(),'');assert.equal(h.networkCalls(),0);
});

test('importing, saving and exporting an old-catalogue backup retains its original source version across a restart',async()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/snapshots/f6acacfcbb436a3c52e45a92b093a614e3747c9554f94d036653464e6a9193fe.json'),'utf8'));
  const original={kind:'research-admissions-navigator-local',schemaVersion:1,catalogCheckedDate:old.checkedDate,catalogSnapshotId:old.snapshotId,
    profile:{...L.defaultProfile(old),universityIds:['cuhk'],gpaNote:'旧材料清单，尚未复核新版本'},shortlist:[],sourceIds:['CUHK-CSE-PROGRAMME'],
    tasks:[{id:'task-old-check',text:'保留原材料核查笔记',done:false,programId:'cuhk-cse-rpg',facultyId:null}]};
  const raw=JSON.stringify(original),h=harness();h.byId.get('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await h.byId.get('import-local').emit('change');
  const saved=JSON.parse(h.saved.get('yanxiang-local-v1'));
  const retains=value=>value.catalogSnapshotId===old.snapshotId||(value.catalogHistory||[]).some(x=>x.snapshotId===old.snapshotId&&x.checkedDate===old.checkedDate);
  assert.ok(retains(saved),'original catalogue identity must survive the actual import persistence callback');
  assert.equal(saved.tasks[0].text,original.tasks[0].text);assert.equal(saved.profile.gpaNote,original.profile.gpaNote);
  await h.byId.get('export-local').emit('click');const exported=JSON.parse(await h.downloads[0].blob.text());assert.ok(retains(exported));
  const restarted=harness([...h.saved]);await restarted.byId.get('export-local').emit('click');
  const after=JSON.parse(await restarted.downloads[0].blob.text());assert.ok(retains(after));
  assert.equal(restarted.byId.get('catalog-history-panel').hidden,false);assert.match(restarted.byId.get('catalog-history').textContent,/f6acacfc/);
  assert.equal(JSON.stringify(original),raw);assert.equal(restarted.networkCalls(),0);
});

test('provided multiple source versions survive while malformed or overflowing history leaves the current record intact',async()=>{
  const initial=L.portable(C,{profile:{...L.defaultProfile(C),gpaNote:'原清单'},tasks:[],shortlist:[],sourceIds:[]});
  const h=harness([['yanxiang-local-v1',JSON.stringify(initial)]]),el=id=>h.byId.get(id);
  const incoming=structuredClone(initial);incoming.catalogSnapshotId='sha256:'+'a'.repeat(64);incoming.catalogCheckedDate='2025-01-01';incoming.catalogHistory=[{snapshotId:'sha256:'+'b'.repeat(64),checkedDate:'2024-01-01'}];
  async function load(value){const raw=JSON.stringify(value);el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');}
  await load(incoming);const saved=JSON.parse(h.saved.get('yanxiang-local-v1'));assert.equal(saved.catalogHistory.length,2);
  assert.match(el('catalog-history').textContent,/2024-01-01/);assert.match(el('catalog-history').textContent,/2025-01-01/);
  const before=h.saved.get('yanxiang-local-v1');
  const bad=structuredClone(incoming);bad.catalogHistory=[{snapshotId:'wrong',checkedDate:'2023-01-01'}];await load(bad);assert.equal(h.saved.get('yanxiang-local-v1'),before);assert.match(el('notice').textContent,/没有替换当前清单/);
  const tooMany=structuredClone(incoming);tooMany.catalogHistory=Array.from({length:256},(_,i)=>({snapshotId:'sha256:'+i.toString(16).padStart(64,'0'),checkedDate:'2023-01-01'}));await load(tooMany);
  assert.equal(h.saved.get('yanxiang-local-v1'),before);assert.match(el('notice').textContent,/超过256项/);assert.equal(el('gpa-note').value,'原清单');
});

test('storage failure rejects an import before replacing visible notes and does not claim a new action was saved',async()=>{
  const initial=L.portable(C,{profile:{...L.defaultProfile(C),gpaNote:'保留原笔记'},tasks:[],shortlist:[],sourceIds:[]});
  const raw=JSON.stringify(initial),h=harness([['yanxiang-local-v1',raw]],{storageWriteFails:true}),el=id=>h.byId.get(id);
  const incoming=structuredClone(initial);incoming.profile.gpaNote='不应替换原笔记';const file=JSON.stringify(incoming);
  el('import-local').files=[{size:Buffer.byteLength(file),text:async()=>file}];await el('import-local').emit('change');
  assert.equal(h.saved.get('yanxiang-local-v1'),raw);assert.equal(el('gpa-note').value,'保留原笔记');assert.match(el('notice').textContent,/没有替换当前清单/);
  h.select('cuhk','MPhil',[]);await el('profile-form').emit('input');await h.button('results','加入准备清单').emit('click');
  assert.equal(h.saved.get('yanxiang-local-v1'),raw);assert.match(el('notice').textContent,/暂时没能写入本机记录/);assert.equal(el('tasks').childElementCount,1);
  await el('export-local').emit('click');const exported=JSON.parse(await h.downloads[0].blob.text());assert.equal(exported.tasks.length,1);assert.equal(exported.profile.gpaNote,'保留原笔记');assert.equal(h.networkCalls(),0);
});

test('concrete research discovery follows the teacher to evidence, follow-up, directories and portable recovery',async()=>{
  const h=harness(),el=id=>h.byId.get(id);
  h.select('hkust','PhD',[]);el('research-query').value='自然语言处理';
  await el('profile-form').emit('input',{target:el('research-query')});
  const card=h.walk(el('results')).find(n=>n.tagName==='article'&&n.textContent.includes('Junxian He'));
  assert.ok(card);assert.match(card.textContent,/对应的官网研究词：Natural language processing/);
  assert.doesNotMatch(el('results').textContent,/港科大（广州）/);
  const children=h.walk(card),pick=text=>children.find(n=>n.tagName==='button'&&n.textContent.includes(text));
  assert.ok(children.some(n=>n.tagName==='a'&&L.officialUrl(n.href)));
  await pick('放入我的清单').emit('click');await pick('加入跟进待办').emit('click');await pick('加入跟进待办').emit('click');
  assert.equal(el('tasks').childElementCount,1);assert.match(el('tasks').textContent,/PhD.*Junxian He/);
  await el('profile-form').emit('submit');await el('export-local').emit('click');
  const raw=await h.downloads[0].blob.text(),parsed=L.parsePortable(raw,C);
  assert.equal(parsed.profile.researchQuery,'自然语言处理');assert.equal(parsed.tasks[0].facultyId,'wide-hkust-junxian-he');
  await pick('查这所学校的院系目录').emit('click');
  assert.equal(el('results').childElementCount,L.directoriesFor(C,parsed.profile).length);
  assert.match(el('results').textContent,/从院系官网查看老师、研究方向和个人主页/);
  await el('reset-local').emit('click');el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');
  assert.equal(el('research-query').value,'自然语言处理');assert.match(el('saved-faculty').textContent,/Junxian He/);
  const restarted=harness([...h.saved]);assert.equal(restarted.byId.get('research-query').value,'自然语言处理');
  assert.match(restarted.byId.get('tasks').textContent,/Junxian He/);assert.equal(h.networkCalls(),0);
});

test('teacher PhD statements stay separate from the selected MPhil and remain scoped after portable recovery',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('hku','MPhil',[]);el('research-query').value='Medical Image Processing';
  await el('profile-form').emit('input',{target:el('research-query')});
  const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Liangqiong Qu'));assert.ok(card);
  assert.match(card.textContent,/2027春季和秋季/);assert.match(card.textContent,/没有覆盖当前选择的MPhil/);
  await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
  await h.walk(card).find(n=>n.tagName==='button'&&n.textContent==='加入跟进待办').emit('click');
  await el('profile-form').emit('submit');await el('export-local').emit('click');const raw=await h.downloads[0].blob.text();
  const restored=harness([['yanxiang-local-v1',raw]]);assert.match(restored.byId.get('saved-faculty').textContent,/没有覆盖当前选择的MPhil/);assert.match(restored.byId.get('tasks').textContent,/MPhil.*Liangqiong Qu/);assert.equal(h.networkCalls(),0);
});

test('no fully funded position is not rendered as no admissions and does not inject personal GPA preferences',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);el('research-query').value='Dependence Modeling';await el('profile-form').emit('input',{target:el('research-query')});
  assert.match(el('results').textContent,/Marius Hofert/);assert.match(el('results').textContent,/近期没有全额资助职位/);assert.match(el('results').textContent,/不等于整个项目不招生/);assert.doesNotMatch(el('results').textContent,/3\.8|top 100/i);
});

test('a malformed official homepage target is explained without guessing a corrected clickable website',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);el('research-query').value='hallucinations';await el('profile-form').emit('input',{target:el('research-query')});
  const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Zheng Zhang'));assert.ok(card);
  assert.match(card.textContent,/原链接有误，待核/);assert.match(card.textContent,/没有自行修正网址/);
  assert.ok(!h.walk(card).filter(n=>n.tagName==='a').some(n=>(n.href||'').includes('hackmd')));
});

test('broad discovery renders bounded batches and clearing filters preserves the saved plan',async()=>{
  const h=harness(),el=id=>h.byId.get(id);await el('show-faculty').emit('click');
  assert.equal(el('results').childElementCount,24);assert.equal(el('show-more-faculty').hidden,false);
  await el('show-more-faculty').emit('click');assert.equal(el('results').childElementCount,48);
  assert.equal(el('results').children[24].focusRequested,true);
  h.select('hkust','PhD',[]);el('research-query').value='完全未收录的研究问题';
  await el('profile-form').emit('input',{target:el('research-query')});assert.match(el('results').textContent,/未收录不等于/);
  await el('clear-filters').emit('click');assert.equal(el('research-query').value,'');assert.equal(el('results').childElementCount,24);
  assert.equal(el('intake-cycle').value,'2027/28');assert.match(el('notice').textContent,/学位.*清单保留/);
  await el('export-local').emit('click');assert.equal(L.parsePortable(await h.downloads[0].blob.text(),C).profile.degree,'PhD');
});

test('SME actual callbacks connect a research query, directory-only personal link and a saved doctoral task',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('cuhksz','PhD',[]);el('research-query').value='数据驱动优化';
  await el('profile-form').emit('input',{target:el('research-query')});
  const teacher=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='邓淇元'));assert.ok(teacher);
  assert.ok(h.walk(teacher).some(n=>n.tagName==='a'&&n.href==='https://qiyuan-deng.github.io/'));
  await h.walk(teacher).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
  await el('show-programs').emit('click');
  const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='金融学博士（港中文深圳经管）'));assert.ok(p);
  assert.match(p.textContent,/博士/);assert.match(p.textContent,/自动纳入考虑|奖学金考虑/);assert.match(p.textContent,/2027-04-15/);
  await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='加入准备清单 ＋').emit('click');
  await el('export-local').emit('click');const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);
  assert.match(restored.byId.get('saved-faculty').textContent,/邓淇元/);assert.match(restored.byId.get('tasks').textContent,/金融学博士/);
  assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('an undated research-degree route remains findable without pretending the selected intake is verified',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-programs').emit('click');
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='数据与系统工程研究学位'));assert.ok(card);
 const top=h.walk(card).find(n=>n.className==='card-topline');assert.match(top.textContent,/入学轮次待核/);assert.doesNotMatch(top.textContent,/2027/);
 assert.match(card.textContent,/入学年份未注明，请先查看项目当前招生安排/);assert.match(card.textContent,/当期申请时间待核/);
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');
 assert.match(el('tasks').textContent,/计划2027\/28学年（项目轮次待核）/);
 await el('export-local').emit('click');const restored=harness([['yanxiang-local-v1',await h.downloads[0].blob.text()]]);
 assert.match(restored.byId.get('tasks').textContent,/项目轮次待核/);
 assert.equal(h.networkCalls(),0);
});

test('SEEM callbacks expose a verified personal redirect, keep ordinary dates separate and restore a doctoral task',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);el('research-query').value='金融工程';await el('profile-form').emit('input',{target:el('research-query')});
 const teacher=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='CHEN, Nan / 陳南'));assert.ok(teacher);
 assert.ok(h.walk(teacher).some(n=>n.tagName==='a'&&n.href==='https://www1.se.cuhk.edu.hk/~nchenweb/'));
 await h.walk(teacher).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='系统工程与工程管理 MPhil/PhD'));assert.ok(p);
 assert.match(p.textContent,/面试会早于申请截止/);assert.match(p.textContent,/三份推荐报告/);assert.match(p.textContent,/2026-12-01/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');
 await el('export-local').emit('click');const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);
 assert.match(restored.byId.get('saved-faculty').textContent,/陳南/);assert.match(restored.byId.get('tasks').textContent,/2027\/28.*PhD/);assert.equal(restored.networkCalls(),0);
});

test('physics callbacks preserve research, an undated programme action and the scoped directory across backup restore',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);el('research-query').value='量子控制';await el('profile-form').emit('input',{target:el('research-query')});
 const teacher=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Shilin HUANG'));assert.ok(teacher);
 assert.ok(h.walk(teacher).some(n=>n.tagName==='a'&&n.href==='https://huang-shilin.github.io/'));assert.match(teacher.textContent,/未注明入学年度/);assert.match(teacher.textContent,/指导资格/);
 await h.walk(teacher).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='物理 MPhil/PhD'));assert.ok(p);
 assert.match(p.textContent,/入学轮次待核/);assert.match(p.textContent,/不能当成递交申请前/);assert.match(p.textContent,/当期申请时间待核/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');
 await el('export-local').emit('click');const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);
 assert.match(restored.byId.get('saved-faculty').textContent,/Shilin HUANG/);assert.match(restored.byId.get('tasks').textContent,/PhD.*项目轮次待核|项目轮次待核.*PhD/);
 await el('show-directories').emit('click');assert.ok(h.walk(el('academic-coverage')).some(n=>n.tagName==='a'&&n.href==='https://science.hkust.edu.hk/about/our_people?academic-unit=2942&show=faculty-members&page=0'));
 assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('math applicant reads actual research and current programme, then reopens the teacher and doctoral action',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);el('research-query').value='随机控制';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(x=>x.tagName==='h3'&&x.textContent==='Shuoqing DENG'));assert.ok(card);assert.match(card.textContent,/随机控制/);assert.match(card.textContent,/指导资格/);
 assert.ok(h.walk(card).some(x=>x.tagName==='a'&&x.href==='https://sites.google.com/view/shuoqingdeng/'));
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(x=>x.tagName==='h3'&&x.textContent==='数学（含概率统计、金融数学等方向）'));assert.ok(p);assert.match(p.textContent,/2027-06-01/);assert.match(p.textContent,/每项5.5/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');
 const raw=await h.downloads[0].blob.text(),saved=L.parsePortable(raw,C);assert.deepEqual(saved.shortlist,['hkust-math-07']);const restored=harness([['yanxiang-local-v1',raw]]);
 assert.match(restored.byId.get('saved-faculty').textContent,/Shuoqing DENG/);assert.match(restored.byId.get('tasks').textContent,/PhD/);assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('BME applicant opens the directory-supplied lab, sees earlier submission and restores a MPhil action',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','MPhil',[]);el('research-query').value='定量相位成像';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='ZHOU, Renjie'));assert.ok(card);
 assert.ok(h.walk(card).some(n=>n.tagName==='a'&&n.href==='https://www.lambcuhk.org/'),'An observed directory HTTPS link should be usable on the teacher card');
 assert.ok(h.walk(card).some(n=>n.tagName==='a'&&n.href==='https://www.lambcuhk.org/people/openings'),'The exact research/opening Links from that supplied profile should remain usable');
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='生物医学工程 MPhil/PhD'));assert.ok(p);
 assert.match(p.textContent,/2026-11-15/);assert.match(p.textContent,/纸质/);assert.match(p.textContent,/三封推荐/);assert.doesNotMatch(p.textContent,/博士英文研究兴趣和院系信息表/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');
 const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);
 assert.match(restored.byId.get('saved-faculty').textContent,/ZHOU, Renjie/);assert.match(restored.byId.get('tasks').textContent,/MPhil/);assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('chemistry applicant follows the supplied lab, reads the correct round and restores the degree-scoped action',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','MPhil',[]);el('research-query').value='生物催化';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Hui CAO'));assert.ok(card);
 assert.ok(h.walk(card).some(n=>n.tagName==='a'&&n.href==='https://hcaogroup.com/'));assert.match(card.textContent,/HKPFS本身只适用于PhD/);
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='化学 MPhil/PhD'));assert.ok(p);
 assert.match(p.textContent,/2027-07-15/);assert.match(p.textContent,/2027-06-01/);assert.match(p.textContent,/完整上传材料/);assert.doesNotMatch(p.textContent,/博士不只有硕士毕业一条路/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');
 const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);assert.match(restored.byId.get('saved-faculty').textContent,/Hui CAO/);assert.match(restored.byId.get('tasks').textContent,/MPhil/);
 assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('research cards keep concise distinct keywords and preserve a description-only search through restore',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','MPhil',[]);el('research-query').value='生物催化';await el('profile-form').emit('input',{target:el('research-query')});
 let card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Hui CAO'));assert.ok(card);
 const chips=card.children.find(n=>n.className==='research-terms').children.map(n=>n.textContent);assert.ok(chips.length<=6);assert.ok(chips.includes('生物催化'));assert.ok(!chips.some(t=>t.includes('天然酶反应范围之外')));assert.equal(new Set(chips.map(t=>t.toLowerCase())).size,chips.length);
 const more=card.children.find(n=>n.tagName==='details'&&n.textContent.includes('还有 1 个研究词'));assert.ok(more);assert.match(more.textContent,/Enantioselective reactions/);
 const summary=C.faculty.find(f=>f.id==='hkust-chemistry-01').summary;assert.match(card.textContent,/与你所填词语对应的官网研究词：生物催化/);assert.match(summary,/天然酶反应范围之外/);
 el('research-query').value='天然酶反应范围之外';await el('profile-form').emit('input',{target:el('research-query')});card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Hui CAO'));assert.ok(card);assert.match(card.textContent,/研究描述与所填词语有交集/);
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');await el('export-local').emit('click');const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);
 assert.match(restored.byId.get('saved-faculty').textContent,/Hui CAO/);assert.equal(restored.byId.get('research-query').value,'天然酶反应范围之外');assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});


test('compact labels preserve case-sensitive scientific symbols and exponent notation',async()=>{
 const catalog={...C,faculty:C.faculty.map(f=>f.id==='hkust-chemistry-01'?{...f,researchKeywords:['Co','CO','mRNA','mrna','x²','x2','Protein engineering','protein engineering']}:f)};
 const h=harness(undefined,{catalog}),el=id=>h.byId.get(id);h.select('hkust','MPhil',[]);el('research-query').value='protein';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Hui CAO'));assert.ok(card);
 const labels=h.walk(card).filter(n=>n.className==='research-term').map(n=>n.textContent);
 for(const term of ['Co','CO','mRNA','mrna','x²','x2'])assert.ok(labels.includes(term),term);
 assert.equal(labels.filter(x=>x.toLowerCase()==='protein engineering').length,1);
 assert.deepEqual(catalog.faculty.find(f=>f.id==='hkust-chemistry-01').researchKeywords,['Co','CO','mRNA','mrna','x²','x2','Protein engineering','protein engineering']);
});

test('mechanical applicant finds graph control and restores a school-and-degree-specific preparation task',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','MPhil',[]);el('research-query').value='图学习';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Gao, Zhan'));assert.ok(card);assert.match(card.textContent,/指导资格.*实时余位/);
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='机械工程研究学位'));assert.ok(p);
 assert.match(p.textContent,/2023–24/);assert.match(p.textContent,/2026\/12\/01/);assert.doesNotMatch(p.textContent,/先分研究硕士与不同博士学制/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');
 const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);assert.match(restored.byId.get('saved-faculty').textContent,/Gao, Zhan/);assert.match(restored.byId.get('tasks').textContent,/MPhil/);assert.match(restored.byId.get('tasks').textContent,/机械工程/);assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});


test('directory-only research uses its real evidence and restores a teacher and unknown-year MPhil action',async()=>{
 const h=harness(),el=id=>h.byId.get(id);assert.match(el('saved-faculty').textContent,/读过研究说明和来源后再收藏/);h.select('cityu','MPhil',[]);el('research-query').value='光子集成';await el('profile-form').emit('input',{target:el('research-query')});
 const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Prof. FENG , Hanke'));assert.ok(card);assert.match(card.textContent,/从院系名录了解研究内容/);
 assert.ok(h.walk(card).some(n=>n.tagName==='a'&&n.textContent==='看院系中的研究原文 ↗'&&n.href==='https://www.ee.cityu.edu.hk/people/academic_staff/faculty'));assert.ok(!h.walk(card).some(n=>n.tagName==='a'&&n.textContent==='看院系提供的老师主页 ↗'));
 await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='电机工程研究型硕士（招生年度待核）'));assert.ok(p);assert.match(p.textContent,/当期申请时间待核/);assert.match(p.textContent,/不是强制/);assert.match(p.textContent,/2023/);
 await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');
 const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);assert.match(restored.byId.get('saved-faculty').textContent,/FENG/);assert.match(restored.byId.get('saved-faculty').textContent,/院系名录/);assert.match(restored.byId.get('tasks').textContent,/MPhil/);assert.match(restored.byId.get('tasks').textContent,/电机工程/);assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});


test('CEE MPhil reader saves a teacher and current-year fee action without doctoral deadlines',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('polyu','MPhil',[]);el('research-query').value='PFAS';await el('profile-form').emit('input',{target:el('research-query')});const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Prof. Jinxia LIU'));assert.ok(card);await h.walk(card).find(n=>n.tagName==='button'&&n.textContent.includes('放入我的清单')).emit('click');
 await el('show-programs').emit('click');assert.doesNotMatch(el('results').textContent,/土木与环境工程：2027\/28 HKPFS博士申请/);const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='土木与环境工程研究学位'));assert.ok(p);assert.match(p.textContent,/当期申请时间待核/);assert.doesNotMatch(p.textContent,/HKPFS RGC初申请截止/);assert.match(p.textContent,/600/);await h.walk(p).find(n=>n.tagName==='button'&&n.textContent==='把这一步加入待办 ＋').emit('click');await el('export-local').emit('click');const raw=await h.downloads[0].blob.text(),restored=harness([['yanxiang-local-v1',raw]]);assert.match(restored.byId.get('saved-faculty').textContent,/Jinxia LIU/);assert.match(restored.byId.get('tasks').textContent,/MPhil/);assert.match(restored.byId.get('tasks').textContent,/项目轮次待核/);assert.equal(h.networkCalls(),0);assert.equal(restored.networkCalls(),0);
});

test('CEE doctoral reader sees a scoped 2027 advertisement and both separate HKPFS steps',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('polyu','PhD',[]);el('research-query').value='超材料';await el('profile-form').emit('input',{target:el('research-query')});const card=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='Prof. Kai ZHOU'));assert.ok(card);assert.match(card.textContent,/2027年秋季PhD招募/);assert.match(card.textContent,/不是MPhil/);
 await el('show-programs').emit('click');const p=el('results').children.find(c=>h.walk(c).some(n=>n.tagName==='h3'&&n.textContent==='土木与环境工程：2027/28 HKPFS博士申请'));assert.ok(p);assert.match(p.textContent,/12:00/);assert.match(p.textContent,/23:59/);assert.match(p.textContent,/不是两个不同学位或两次大学缴费/);assert.equal(h.networkCalls(),0);
});

test('college-first view separates matched list from unfinished departments and faculty',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cityu','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const text=el('academic-coverage').textContent;
 assert.match(text,/按学院和院系找老师/);assert.match(text,/研究学位名单共11个学术单位；研究生院另列/);assert.match(text,/包含创新学院/);assert.match(text,/学院名单：已逐项核对研究学位页/);assert.match(text,/下属院系：尚未核齐；教师：按院逐步核对/);assert.match(text,/打开学院官网，查看下属单位和师资/);assert.doesNotMatch(text,/全校教师已收齐/);assert.equal(h.networkCalls(),0);
});

test('child-unit reader sees affiliated schools and separate teaching entries while an exact old homepage read remains scoped',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const science=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Science'));assert.ok(science);
 assert.match(science.textContent,/五个直属学术单位和三个关联学校/);assert.match(science.textContent,/关联学校：/);assert.match(science.textContent,/同一官网已读，沿用原记录/);assert.match(science.textContent,/School of Biological Sciences/);assert.match(science.textContent,/Department of Earth and Planetary Sciences/);
 const targets=h.walk(science).filter(n=>n.tagName==='a').map(n=>n.href);assert.ok(targets.includes('https://www.cds.hku.hk/'));assert.ok(targets.includes('https://i-school.hku.hk/'));assert.ok(!targets.includes('https://www.scifac.hku.hk/prospective/tpg/about'));
 h.select('hkust','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');assert.match(el('academic-coverage').textContent,/其他教学项目与单位（不计作学部）/);assert.equal(h.networkCalls(),0);
});

test('scoped organization reader finds research degree links without invented departments',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhksz','MPhil',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.startsWith('理工学院'));assert.ok(u);assert.match(u.textContent,/已读学院入口/);assert.doesNotMatch(u.textContent,/本轮未读到正文/);assert.match(u.textContent,/2026-10-26/);assert.match(u.textContent,/2026-10-29已读到本次入口正文/);assert.match(u.textContent,/尚未核到下设学系的完整清单/);assert.match(u.textContent,/科研领域（不是学系列表）/);assert.match(u.textContent,/研究型硕博项目导航（不计作学系）/);
 const urls=h.walk(u).filter(n=>n.tagName==='a').map(n=>n.href);assert.ok(urls.includes('https://sse.cuhk.edu.cn/page/749'));assert.ok(!urls.some(u=>u.includes('ssemsc.')));assert.equal(h.networkCalls(),0);
});
test('scoped organization reader separates education pillars and conflicting support counts',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkustgz','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.startsWith('教育科学学院'));assert.ok(u);assert.match(u.textContent,/共五个部门/);assert.match(u.textContent,/共六个/);assert.match(u.textContent,/教学支持/);assert.match(u.textContent,/校级介绍另列的行政部门/);assert.match(u.textContent,/Pillar of Cognitive Sciences/);assert.match(u.textContent,/所读页未给独立网址/);assert.equal(h.networkCalls(),0);
});

test('STEM college applicant finds material entry and supplied alternatives without erasing old failures',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Engineering'));assert.ok(u);assert.match(u.textContent,/七项|七个|七/);assert.match(u.textContent,/四学院|四学院共同|四/);assert.match(u.textContent,/关联学校：/);assert.match(u.textContent,/原入口的读取状态另保留/);const links=h.walk(u).filter(n=>n.tagName==='a');assert.ok(links.some(a=>a.href==='https://mse.hku.hk/'));assert.ok(links.some(a=>a.href==='https://www.eee.hku.hk/'&&a.textContent.includes('正文待核')));assert.equal(h.networkCalls(),0);
});

test('college hierarchy callback keeps clinical departments beneath their school and recovered old read states separate',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const med=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Li Ka Shing Faculty'));
 assert.ok(med);const group=h.walk(med).find(n=>n.tagName==='details'&&n.children[0]?.textContent==='临床医学院下的学系和单位');assert.ok(group);assert.match(group.textContent,/所属上级：临床医学学院 · School of Clinical Medicine/);assert.match(group.textContent,/不与学院的一级单位混算/);assert.match(group.textContent,/单位正文、完整师资及招生信息仍待核/);assert.ok(h.walk(group).some(n=>n.tagName==='a'&&n.href==='https://www.psychiatry.hku.hk/'));assert.match(group.textContent,/Department of Surgery/);assert.match(group.textContent,/http:\/\/www.surgery.hku.hk\//);assert.ok(!h.walk(group).some(n=>n.tagName==='a'&&n.href?.includes('surgery.hku.hk')));
 const direct=med.children.find(n=>n.tagName==='ul');assert.equal(direct.children.length,7);assert.equal(group.children.find(n=>n.tagName==='ul').children.length,17);assert.equal(h.networkCalls(),0);
});

test('scope next-step callback warns about bachelor-to-PhD routes and opens only the scoped read page',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const math=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Zhizhen'));assert.ok(math);assert.match(math.textContent,/本科—博士贯通/);assert.match(math.textContent,/不能直接当作已有本科或硕士/);assert.match(math.textContent,/接下来可以这样查/);const action=h.walk(math).find(n=>n.tagName==='a'&&n.textContent.startsWith('先看课程面向哪些学生'));assert.equal(action.href,'https://www.zsims.cuhk.edu.hk/en/?Home___Academics');assert.equal(h.networkCalls(),0);
});

test('scope next-step callback retains a restored profile and separates research organisations from direct units',async()=>{
 const first=harness(),el=id=>first.byId.get(id);first.select('polyu','PhD',[]);await el('profile-form').emit('input');await el('export-local').emit('click');const backup=await first.downloads.at(-1).blob.text();
 const h=harness([['yanxiang-local-v1',backup]]),e=id=>h.byId.get(id);await e('show-directories').emit('click');const design=h.walk(e('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('School of Design'));assert.ok(design);assert.match(design.textContent,/研究中心、实验室与研究院（不是学系）/);assert.match(design.textContent,/RIDE|Research Institute of Design-driven Entrepreneurship/);assert.match(design.textContent,/2025年在读博士人数不当招生余位/);const links=h.walk(design).filter(n=>n.tagName==='a');assert.ok(links.some(n=>n.href==='https://www.polyu.edu.hk/sd/research/research-centres-and-labs/'));assert.equal(h.networkCalls(),0);
});

test('reviewed landscape entrance shows read scope without inventing a department parent',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Architecture'));assert.ok(u);
 const group=h.walk(u).find(n=>n.tagName==='details'&&n.children[0]?.textContent.startsWith('园境建筑学部：'));assert.ok(group);assert.match(group.textContent,/已读到该单位入口/);assert.doesNotMatch(group.textContent,/单位正文、完整师资及招生信息仍待核/);assert.doesNotMatch(group.textContent,/所属上级：Department of Architecture/);
 assert.ok(h.walk(group).some(n=>n.tagName==='a'&&n.href==='https://www.arch.hku.hk/departments-and-divisions/division-of-landscape-architecture/'));assert.match(group.textContent,/指导资格/);assert.equal(h.networkCalls(),0);
});

test('restored fashion applicant finds dated evidence and separate research organisations',async()=>{
 const first=harness(),f=id=>first.byId.get(id);first.select('polyu','MPhil',[]);await f('profile-form').emit('input');await f('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text();
 const h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('School of Fashion and Textiles'));assert.ok(u);assert.match(u.textContent,/三个研究范围（不是三个学系）/);assert.match(u.textContent,/2025年9月/);assert.match(u.textContent,/不是导师名额/);assert.match(u.textContent,/Research Hub/);assert.ok(h.walk(u).some(n=>n.tagName==='a'&&n.href==='https://www.polyu.edu.hk/sft/about-sft/facts-and-figures/'));assert.equal(h.networkCalls(),0);
});

test('architecture reader can follow all three supplied department entrances without false read status',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','MPhil',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Architecture'));assert.ok(u);
 for(const slug of ['department-of-architecture','department-of-real-estate-and-construction','department-of-urban-planning-and-design']){
  const a=h.walk(u).find(n=>n.tagName==='a'&&n.href==='https://www.arch.hku.hk/departments-and-divisions/'+slug+'/');assert.ok(a);assert.match(a.textContent,/已读单位正文/);
 }
 assert.match(u.textContent,/原入口和原读取记录另行保留/);assert.equal(h.networkCalls(),0);
});

test('law applicant sees the official unitary model without a fabricated department or admission promise',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cuhk','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const u=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Law'));assert.ok(u);assert.match(u.textContent,/同时承担学院和教学部门/);assert.match(u.textContent,/下一步沿全院人员名录/);assert.match(u.textContent,/不能用来判断研究生录取/);assert.ok(h.walk(u).some(n=>n.tagName==='a'&&n.href==='https://www.law.cuhk.edu.hk/app/governance-structure/'));assert.equal(h.networkCalls(),0);
});

test('university cross-check keeps the mixed index outside college departments and labels supplied links',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hkust','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const r=h.walk(el('academic-coverage')).find(n=>n.className==='source-details institutional-reference');assert.ok(r);assert.match(r.textContent,/16个Department和8个Division/);assert.match(r.textContent,/Materials/);assert.match(r.textContent,/不是|不把24条当作全校/);const items=r.children.find(n=>n.tagName==='ul');assert.equal(items.children.length,24);
 assert.ok(h.walk(r).some(n=>n.tagName==='a'&&n.href==='https://cbe.hkust.edu.hk/'));assert.ok(!h.walk(r).some(n=>n.tagName==='a'&&n.href?.startsWith('http://')));assert.match(r.textContent,/此前的独立读取记录仍在对应学院中保留/);assert.equal(h.networkCalls(),0);
});

test('restored Guangzhou applicant sees seven unread manual chapters without merging campus admissions',async()=>{
 const first=harness(),e=id=>first.byId.get(id);first.select('hkustgz','MPhil',[]);await e('profile-form').emit('input');await e('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text();
 const h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');const r=h.walk(el('academic-coverage')).find(n=>n.className==='source-details institutional-reference');assert.ok(r);assert.match(r.textContent,/七个章节正文尚未读取/);assert.match(r.textContent,/不能据此合并香港与广州的申请要求/);assert.equal(r.children.find(n=>n.tagName==='ul').children.length,7);assert.equal(h.networkCalls(),0);
});

test('new unit follow-up explains undergraduate scope and exposes actual pending people routes',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
 const engineering=h.walk(el('academic-coverage')).find(n=>n.tagName==='details'&&n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Engineering'));assert.ok(engineering);
 const sbme=h.walk(engineering).find(n=>n.className==='source-details unit-entry-followup'&&n.textContent.includes('BEng及本科招生'));assert.ok(sbme);assert.match(sbme.textContent,/不能据此生成MPhil\/PhD/);assert.ok(h.walk(sbme).some(n=>n.tagName==='a'&&n.href==='https://sbme.hku.hk/people'));assert.match(sbme.textContent,/目标正文待核/);assert.match(sbme.textContent,/原入口和原读取记录保留/);const supplied=h.walk(engineering).find(n=>n.className==='provided-college-entry'&&h.walk(n).some(a=>a.href==='https://i-school.hku.hk/'));assert.ok(supplied);assert.match(supplied.children[0].textContent,/已读单位正文/);assert.match(supplied.textContent,/查看此前的入口发现记录/);assert.equal(h.networkCalls(),0);
});

test('certificate failure stays explicit after restoring a Hong Kong applicant without losing earlier directory',async()=>{
 const first=harness(),e=id=>first.byId.get(id);first.select('hkust','PhD',[]);await e('profile-form').emit('input');await e('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text();
 const h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');const fail=h.walk(el('academic-coverage')).find(n=>n.className==='source-details unit-entry-followup'&&n.textContent.includes('证书链验证'));assert.ok(fail);assert.match(fail.textContent,/尚未读到网页正文/);assert.match(fail.textContent,/不关闭验证或改用其他通道/);assert.ok(h.walk(el('academic-coverage')).some(n=>n.tagName==='a'&&n.href==='https://isom.hkust.edu.hk/'));assert.equal(h.networkCalls(),0);
});

test('law reader restores a dated administrative declaration without turning it into an admission rule',async()=>{
 const first=harness(),f=id=>first.byId.get(id);first.select('hku','PhD',[]);await f('profile-form').emit('input');await f('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text();const h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');
 const law=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Law'));assert.ok(law);assert.match(law.textContent,/2024年9月1日/);assert.match(law.textContent,/教学安排保持不变/);assert.match(law.textContent,/不说明研究生录取由谁决定/);assert.ok(h.walk(law).some(n=>n.tagName==='a'&&n.href==='https://www.law.hku.hk/news/hku-law-as-a-unitary-faculty/'));assert.equal(h.networkCalls(),0);
});

test('business reader gets five actually supplied HTTPS department entrances and keeps failed original URLs',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('cityu','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const cb=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('College of Business'));assert.ok(cb);assert.match(cb.textContent,/六个学术系/);assert.match(cb.textContent,/原HTTP入口和读取记录保留/);
 for(const slug of ['ac','ef','is','mgt','mkt']){const a=h.walk(cb).find(n=>n.tagName==='a'&&n.href==='https://www.cb.cityu.edu.hk/'+slug+'/');assert.ok(a);assert.match(a.textContent,/正文待核/);}
 assert.ok(!h.walk(cb).some(n=>n.tagName==='a'&&n.href==='https://www.cityu.edu.hk/ac/'));assert.ok(h.walk(cb).some(n=>n.tagName==='a'&&n.href==='https://www.cb.cityu.edu.hk/en/people/faculty-directory'));assert.equal(h.networkCalls(),0);
});

test('science applicant can read conflicting dated evidence then restore the same saved preparation without invented links',async()=>{
 const first=harness(),e=id=>first.byId.get(id);first.select('hku','PhD',[]);await e('profile-form').emit('input');await e('show-directories').emit('click');
 const science=first.walk(e('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Science'));assert.ok(science);assert.match(science.textContent,/2026\/27/);assert.match(science.textContent,/不按标题补造第六个直属系/);assert.match(science.textContent,/所属上级：计算与数据科学学院 · School of Computing and Data Science/);
 const nested=first.walk(science).find(n=>n.className==='source-details organization-navigation'&&n.textContent.includes('所属上级：')&&n.children[0]?.textContent.includes('2026/27'));assert.ok(nested);const items=nested.children.find(n=>n.tagName==='ul');assert.equal(items.children.length,3);assert.ok(!first.walk(items).some(n=>n.tagName==='a'));assert.match(nested.textContent,/不猜网址/);
 assert.ok(first.walk(science).some(n=>n.tagName==='a'&&n.href==='https://www.scifac.hku.hk/f/page/7141/23978/Science_Leaflet_RPG%202026-27.pdf'));
 await e('show-faculty').emit('click');await first.button('results','放入我的清单').emit('click');await first.button('results','加入跟进待办').emit('click');await e('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text(),h=harness(),el=id=>h.byId.get(id);el('import-local').files=[{size:Buffer.byteLength(raw),text:async()=>raw}];await el('import-local').emit('change');await el('show-directories').emit('click');assert.match(el('academic-coverage').textContent,/不按标题补造第六个直属系/);await el('export-local').emit('click');const restored=JSON.parse(await h.downloads.at(-1).blob.text()),original=JSON.parse(raw);assert.equal(original.shortlist.length,1);assert.equal(original.tasks.length,1);assert.deepEqual(restored.profile,original.profile);assert.deepEqual(restored.tasks,original.tasks);assert.deepEqual(restored.shortlist,original.shortlist);assert.equal(h.networkCalls()+first.networkCalls(),0);
});

test('interdisciplinary reader keeps five divisions separate from teaching programmes after reopening',async()=>{
 const first=harness(),e=id=>first.byId.get(id);first.select('hkust','PhD',[]);await e('profile-form').emit('input');await e('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text(),h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');const ais=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Academy of Interdisciplinary Studies'));assert.ok(ais);assert.match(ais.textContent,/明确列出五个学部/);assert.match(ais.textContent,/学生人数不当作教师人数或招生余位/);assert.ok(h.walk(ais).some(n=>n.tagName==='a'&&n.href==='https://ais.hkust.edu.hk/about-ais/deans-message'));assert.equal(h.networkCalls(),0);
});

test('applicant can continue through three named current department links while the old unlinked brochure stays separate',async()=>{
 const h=harness(),el=id=>h.byId.get(id);h.select('hku','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');const u=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Faculty of Science'));assert.ok(u);assert.match(u.textContent,/从下方师资入口继续查看老师和研究方向/);assert.doesNotMatch(u.textContent,/逐人主页仍待整理/);
 const current=h.walk(u).find(n=>n.className==='source-details organization-navigation'&&n.children[0]?.textContent.includes('学院网页实给'));assert.ok(current);const items=current.children.find(n=>n.tagName==='ul');assert.equal(items.children.length,3);for(const url of ['https://ai.hku.hk/','https://www.cs.hku.hk/','https://saasweb.hku.hk/'])assert.ok(h.walk(items).some(n=>n.tagName==='a'&&n.href===url));assert.match(current.textContent,/单位正文、完整师资及招生信息仍待核/);const historical=h.walk(u).find(n=>n.className==='source-details organization-navigation'&&n.children[0]?.textContent.includes('三个系（2026/27'));assert.ok(historical);assert.ok(!h.walk(historical.children.find(n=>n.tagName==='ul')).some(n=>n.tagName==='a'));assert.equal(h.networkCalls(),0);
});

test('undated AIS degree navigation and reused Shenzhen teaching units remain correctly scoped after restoring a saved choice',async()=>{
 const first=harness(),f=id=>first.byId.get(id);first.select('hkust','PhD',[]);await f('profile-form').emit('input');await f('show-directories').emit('click');const ais=first.walk(f('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.includes('Academy of Interdisciplinary Studies'));assert.ok(ais);const group=first.walk(ais).find(n=>n.className==='source-details organization-navigation'&&n.children[0]?.textContent.includes('研究学位路线'));assert.ok(group);assert.match(group.textContent,/年度待核/);assert.match(group.textContent,/TIE只列MPhil/);const items=group.children.find(n=>n.tagName==='ul');assert.equal(items.children.length,7);assert.match(items.children.at(-1).textContent,/科技创新与创业研究型硕士 · MPhil · Technology/);assert.doesNotMatch(items.children.at(-1).textContent,/PhD/);
 first.select('cuhksz','PhD',[]);await f('profile-form').emit('input');await f('export-local').emit('click');const raw=await first.downloads.at(-1).blob.text(),h=harness([['yanxiang-local-v1',raw]]),el=id=>h.byId.get(id);await el('show-directories').emit('click');const hss=h.walk(el('academic-coverage')).find(n=>n.className==='academic-unit'&&n.children[0]?.textContent.startsWith('人文社科学院'));assert.ok(hss);assert.match(hss.textContent,/2026年10月28日/);assert.match(hss.textContent,/国情、语言、体育等教学部门/);assert.match(hss.textContent,/不把十项都推成独立招收MPhil\/PhD/);assert.equal(first.networkCalls()+h.networkCalls(),0);
});
