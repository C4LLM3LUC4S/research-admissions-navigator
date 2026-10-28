'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('../dist/logic.js');
const C=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');

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
  const body=new Element('body');
  function query(selector){if(selector==='.view')return [...byId.values()].filter(x=>x.className.split(' ').includes('view'));if(selector==='[data-view]')return all.filter(x=>x.dataset.view);const name=/^\[name=([^\]]+)\](:checked)?$/.exec(selector);if(name)return all.filter(x=>x.name===name[1]&&(!name[2]||x.checked));throw Error('Unsupported test selector '+selector);}
  let networkCalls=0;
  class TestURL extends URL {static createObjectURL(blob){const key='blob:local-test-'+blobs.size;blobs.set(key,blob);return key;}static revokeObjectURL(){}}
  class TestFormData {get(name){return query('[name='+name+']:checked')[0]?.value||null;}}
  const context={window:{APP_LOGIC:L,APP_CATALOG:C},document:{getElementById:id=>{assert.ok(byId.has(id),id);return byId.get(id);},createElement:tag=>new Element(tag),querySelectorAll:query,body},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{if(options.storageWriteFails)throw Error('synthetic storage failure');saved.set(key,value);},removeItem:key=>saved.delete(key)},structuredClone,Intl,Date,Math,Blob,URL:TestURL,FormData:TestFormData,Option:function(label,value){const option=new Element('option');option.textContent=label;option.value=value;return option;},history:{replaceState(){}},location:{hash:''},setTimeout:()=>1,clearTimeout(){},console,fetch(){networkCalls++;throw Error('No outbound network allowed in this local task');}};
  // This is a hang guard, not a startup-speed requirement; locale cold starts vary on shared runners.
  vm.runInNewContext(script,context,{timeout:10000});
  const walk=(element)=>[element,...element.children.flatMap(walk)];
  const button=(parent,text)=>{const found=walk(byId.get(parent)).find(x=>x.tagName==='button'&&x.textContent.includes(text));assert.ok(found,text);return found;};
  function select(university,degree,interests){query('[name=degree]').forEach(x=>{x.checked=x.value===degree;});query('[name=university]').forEach(x=>{x.checked=x.value===university;});query('[name=interest]').forEach(x=>{x.checked=interests.includes(x.value);});}
  return {byId,saved,downloads,button,select,walk,networkCalls:()=>networkCalls};
}

test('access-check entries and source evidence never tell applicants institutional content was read',async()=>{
  const h=harness(),el=id=>h.byId.get(id);h.select('cityu','PhD',[]);await el('profile-form').emit('input');await el('show-directories').emit('click');
  assert.match(el('academic-coverage').textContent,/入口返回访问检查页，尚未读到院系正文/);
  const bios=h.walk(el('academic-coverage')).find(n=>n.tagName==='li'&&n.children.some(c=>c.textContent==='Department of Biostatistics ↗'));
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
  assert.match(el('academic-coverage').textContent,/不是.*学科教师库|不另外计成一个学科教师库/);
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
  assert.match(card.textContent,/国际申请者/);assert.match(card.textContent,/2027-06-15/);assert.match(card.textContent,/2027-07-15/);assert.match(card.textContent,/150/);
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
  assert.match(el('results').textContent,/不等于学校招生政策/);assert.match(el('results').textContent,/已读到正文/);
  await h.button('results','加入跟进待办').emit('click');await el('export-local').emit('click');
  const backup=L.parsePortable(await h.downloads[0].blob.text(),C);assert.ok(backup.tasks.some(x=>x.facultyId==='census-hkust-zxf'));
  await el('show-directories').emit('click');
  assert.match(el('results').textContent,/53 个不同主页：已读 38 个，15 个读取超时/);
  assert.match(el('results').textContent,/逐人进度与待核主页/);assert.match(el('results').textContent,/本轮读取超时，待核/);
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
  assert.match(el('results').textContent,/不是该院系教师总人数/);
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
 assert.match(card.textContent,/不代表你所选轮次已经开放/);assert.match(card.textContent,/当期申请时间待核/);
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
