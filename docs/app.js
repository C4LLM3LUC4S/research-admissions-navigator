(function () {
  'use strict';
  const L=window.APP_LOGIC, C=window.APP_CATALOG, KEY='yanxiang-local-v1';
  const $=id=>document.getElementById(id);
  function node(tag, text, className) { const n=document.createElement(tag);if(text!==undefined && text!==null)n.textContent=String(text);if(className)n.className=className;return n; }
  function append(parent,...children) { children.filter(Boolean).forEach(child=>parent.append(child));return parent; }
  function clear(parent) { parent.replaceChildren(); }
  let noticeTimer;
  function notify(message,error) { const box=$('notice');box.textContent=message;box.classList.toggle('error',!!error);box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{box.hidden=true;},9500); }
  if (!L || !C || C.schemaVersion!==1 || !['universities','programs','faculty','sources'].every(k=>Array.isArray(C[k]))) {
    document.querySelectorAll('.view').forEach(v=>{v.hidden=true;});$('startup-error').hidden=false;$('startup-error').textContent='资料文件还没有完整载入。请保留整个文件夹，确认 catalog.js、logic.js 和 app.js 与本页放在一起，再重新打开。';return;
  }
  let state={profile:L.defaultProfile(C),shortlist:[],tasks:[],sourceIds:[]},savedProfile=L.defaultProfile(C),mode='programs',facultyLimit=24,resultCards=[];
  try { const raw=localStorage.getItem(KEY);if(raw){const previous=L.parsePortable(raw,C),prepared=L.portable(C,previous);state=prepared;savedProfile=structuredClone(state.profile);if(!previous.catalogSnapshotId||previous.catalogSnapshotId!==C.snapshotId)notify('已恢复本机清单；招生资料版本已变化或未注明，申请前请重新核对政策。旧版本信息已保留在“我的清单”。');} } catch (_) { notify('本机旧记录没有载入。原记录没有被覆盖；可以在“我的清单”载入完整备份。',true); }
  function university(id) { return C.universities.find(u=>u.id===id); }
  function button(text, action, cls) { const b=node('button',text,cls||'button secondary');b.type='button';b.addEventListener('click',action);return b; }
  function link(label,url) { const safe=L.officialUrl(url);if(!safe)return node('span','官方链接待核实','field-help');const a=node('a',label);a.href=safe;a.target='_blank';a.rel='noopener noreferrer';return a; }
  function sourceIdsForState() { return [...new Set([...state.sourceIds,...state.shortlist.flatMap(id=>(C.faculty.find(f=>f.id===id)||{}).sourceIds||[]),...state.tasks.flatMap(t=>(C.programs.find(p=>p.id===t.programId)||{}).sourceIds||[])])].filter(id=>C.sources.some(s=>s.id===id)); }
  function persist(saveProfile) { try { const value=L.portable(C,{...state,profile:saveProfile?state.profile:savedProfile,sourceIds:sourceIdsForState()});localStorage.setItem(KEY,JSON.stringify(value));state.catalogHistory=value.catalogHistory;state.catalogSnapshotId=value.catalogSnapshotId;state.catalogCheckedDate=value.catalogCheckedDate;if(saveProfile)savedProfile=structuredClone(state.profile);return true; } catch(e){notify('暂时没能写入本机记录：'+e.message+' 可以先下载完整备份。',true);return false;} }
  function download(name,value) { const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function empty(parent,title,description) { const box=node('div',null,'empty-state');append(box,node('strong',title),node('span',description));parent.append(box); }
  function evidence(ids,note) {
    const details=node('details',null,'source-details'),summary=node('summary','看依据与适用范围'),body=node('div',null,'source-details-body');append(details,summary,body);
    if(note)body.append(node('p',note,'evidence-note'));
    const list=node('ul');[...new Set(ids||[])].forEach(id=>{const s=C.sources.find(x=>x.id===id);if(!s)return;const li=node('li');append(li,link(s.title,s.url),node('div','适用范围：'+(s.scope||'待核实')),node('div','核查日期：'+(s.checkedAt||'未知')));(s.knownIssues||[]).forEach(x=>li.append(node('div','待留意：'+x)));list.append(li);});body.append(list);if(!list.childElementCount)body.append(node('p','这条信息暂缺可核对来源，请先查看项目官方入口。'));return details;
  }
  function deadlineCard(d, cycle) {
    const status=L.deadlineState(d,cycle),box=node('div',null,'deadline'+(status.code==='expired'?' expired':'')+(status.code==='out_of_scope'?' out-of-scope':''));
    append(box,node('span',d.label||'申请日期'),node('strong',(d.at||d.date)?formatDate(d.at||d.date):'尚未核实'),node('span',status.text,'deadline-state'));
    if(d.cycle && d.cycle!==cycle)box.append(node('span',d.cycle));return box;
  }
  function formatDate(value) { if(/^\d{4}-\d\d-\d\d$/.test(value))return value+'（具体时间请核对原页）';const stamp=Date.parse(value);if(!Number.isFinite(stamp))return '日期待核实';return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(stamp)+'（UTC+8）'; }
  function topLine(u,cycle) { const row=node('div',null,'card-topline'),kicker=node('div',null,'university-kicker');append(kicker,node('strong',u?u.short||u.name:'学校待核实'),node('span',u?u.region:'','region-pill'));append(row,kicker,cycle?node('span',cycle,'cycle-pill'):null);return row; }
  function taskForProgram(p) { if(state.tasks.length>=200){notify('待办已到 200 条，请先整理或备份现有清单。',true);return;}const text='核对 '+p.name+' 的联系要求、申请轮次和材料清单';state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:p.id,facultyId:null});state.sourceIds=[...new Set([...state.sourceIds,...(p.sourceIds||[])])];const saved=persist(false);renderShortlist();if(saved)notify('已加入准备清单。先核对要求，再决定是否联系。'); }
  function taskForRequirement(p,item) {
    const text=L.cycleLabel(state.profile.cycle||p.cycle)+' · '+state.profile.degree+' · '+p.name+'：'+item.action;
    if(state.tasks.some(t=>t.programId===p.id&&t.text===text)){notify('这件事已经在清单里，可以接着完成。');return;}
    if(state.tasks.length>=200){notify('待办已到 200 条，请先整理或备份现有清单。',true);return;}
    state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:p.id,facultyId:null});
    state.sourceIds=[...new Set([...state.sourceIds,...item.sourceIds])];const saved=persist(false);renderShortlist();if(saved)notify('已加入准备清单，学位和入学轮次也一起保留了。');
  }
  function financeSection(p) {
    const items=L.financesFor(p,state.profile);
    if(!items.length)return node('p','这条路线的费用与资助还没整理好，不代表免费或没有资助。请在官方原页继续核对。','evidence-note');
    const section=node('details',null,'source-details');section.append(node('summary','学费、申请费和资助分开看'));
    const body=node('div',null,'source-details-body');body.append(node('p','下面是已核到的部分信息。助学金要看正式结果，不能直接从学费里扣掉；还不含完整生活、住宿等费用。','evidence-note'));
    items.forEach(item=>{
      const box=node('section',null,'finance-item');append(box,node('h4',item.label),node('p',item.text));
      const rates=L.financeRates(item,state.profile);
      rates.matched.forEach(rate=>box.append(node('p',L.financeRateText(rate),'finance-rate matched')));
      if(!rates.matched.length)box.append(node('p',state.profile.cycle?'所选轮次的金额尚未核实。':'先选入学轮次，再核对对应金额。','finance-rate unknown'));
      if(rates.reference.length){const ref=node('details',null,'source-details');ref.append(node('summary','看其他年度或未注明轮次的参考金额'));ref.append(node('p','这些参考不能直接当作所选轮次的个人费用或收入。','evidence-note'));rates.reference.forEach(rate=>ref.append(node('p',L.financeRateText(rate),'finance-rate reference')));box.append(ref);}
      append(box,evidence(item.sourceIds),button('把这一步加入待办 ＋',()=>taskForRequirement(p,item),'subtle-button'));body.append(box);
    });section.append(body);return section;
  }
  function programCard(p) {
    const u=university(p.universityId),card=node('article',null,'result-card');append(card,topLine(u,L.cycleLabel(state.profile.cycle||p.cycle)),node('h3',p.name));const tags=node('div',null,'degree-line');(p.degrees||[]).forEach(d=>tags.append(node('span',d==='MPhil'?'MPhil · 研究型硕士':'PhD · 博士','small-tag')));card.append(tags);card.append(node('p',p.scope||'具体适用范围待核实','scope-text'));if(state.profile.cycle&&state.profile.cycle!==p.cycle)card.append(node('p','下面只显示官网列出的这轮日期；导师联系、资格和材料是否有变化，还需按这轮原页核对。','evidence-note'));
    const questions=node('div',null,'question-grid');[['申请前要不要先联系导师',p.contact&&p.contact.text],['谁参与审核',p.selection&&p.selection.text]].forEach(([heading,text])=>{const part=node('div');append(part,node('h4',heading),node('p',text||'当前资料不足，先查项目要求；不要把未知当成无需联系。'));questions.append(part);});card.append(questions);
    const items=L.requirementsFor(p,state.profile);
    if(items.length){const requirements=node('details',null,'source-details');requirements.append(node('summary','已核到的要求与下一步'));const body=node('div',null,'source-details-body');body.append(node('p','这里只整理了已核到的部分要求。没有列出的材料仍需看官网完整清单，不代表无需提交。','evidence-note'));items.forEach(item=>{append(body,node('h4',item.label),node('p',item.text));if(item.url)body.append(link('打开这一步的官方入口 ↗',item.url));body.append(evidence(item.sourceIds));if(item.action)body.append(button('把这一步加入待办 ＋',()=>taskForRequirement(p,item),'subtle-button'));});requirements.append(body);card.append(requirements);}
    else card.append(node('p','这条路线的学历、英语和完整材料还没补齐。请打开官方原页逐项核对，不能按资料缺失理解为没有要求。','evidence-note'));
    card.append(financeSection(p));
    const dates=node('div',null,'deadlines'),visible=L.deadlinesFor(p,state.profile,u);visible.forEach(d=>dates.append(deadlineCard({...d,cycle:d.cycle||p.cycle},state.profile.cycle)));if(!visible.length)dates.append(deadlineCard({label:'本轮申请时间',at:null,cycle:state.profile.cycle||p.cycle},state.profile.cycle));card.append(dates);
    const primary=(p.sourceIds||[]).map(id=>C.sources.find(s=>s.id===id)).find(s=>s&&L.officialUrl(s.url));
    const bottom=node('div',null,'card-bottom');append(bottom,link('打开官方原页 ↗',p.entryUrl||(primary&&primary.url)||(u&&u.entryUrl)),button('加入准备清单 ＋',()=>taskForProgram(p),'subtle-button'));card.append(bottom);card.append(evidence([...(p.sourceIds||[]),...((p.contact||{}).sourceIds||[]),...((p.selection||{}).sourceIds||[]),...visible.flatMap(d=>d.sourceIds||[])],p.evidenceNote));return card;
  }
  function toggleFaculty(f) { if(state.shortlist.includes(f.id))state.shortlist=state.shortlist.filter(id=>id!==f.id);else state.shortlist.push(f.id);persist(false);renderResults();renderShortlist(); }
  function taskForFaculty(f) {
    const text=L.cycleLabel(state.profile.cycle||C.cycle)+' · '+state.profile.degree+'：读 '+f.name+' 的主页与近期工作，核对研究问题、对应项目及本轮接收要求';
    if(state.tasks.some(t=>t.facultyId===f.id&&t.text===text)){notify('这位老师的跟进事项已经在清单里。');return;}
    if(state.tasks.length>=200){notify('待办已到200条，请先备份或整理。',true);return;}
    state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:null,facultyId:f.id});state.sourceIds=[...new Set([...state.sourceIds,...f.sourceIds])];const saved=persist(false);renderShortlist();if(saved)notify('已加入跟进待办。先核研究方向和申请入口，再决定是否联系。');
  }
  function facultyCard(f) {
    const u=university(f.universityId),card=node('article',null,'result-card');append(card,topLine(u,(f.availability||{}).cycle),node('h3',f.name),node('p',f.department||'院系待核实','scope-text'));const matches=L.matchedTopics(f,state.profile.interests);card.append(node('p',matches.length?'方向有交集 · '+matches.join('、'):'先看研究问题，再判断是否适合自己','matched-line'));const tags=node('div',null,'degree-line');(f.topics||[]).slice(0,8).forEach(t=>tags.append(node('span',t,'small-tag neutral')));card.append(tags);append(card,node('p',f.summary||'研究简介待核实','faculty-summary'),node('p',L.availabilityText(f)+' '+((f.availability||{}).text||''),'availability-note'));
    card.tabIndex=-1;
    if(f.role)card.append(node('p','官网所列身份：'+f.role,'scope-text'));
    const specific=node('div',null,'research-terms');(f.researchKeywords||[]).forEach(term=>specific.append(node('span',term,'research-term')));card.append(specific);
    const termMatches=L.matchedResearchTerms(f,state.profile.researchQuery);if(termMatches.length)card.append(node('p','与你所填词语对应的官网研究词：'+termMatches.join('、'),'research-match'));
    const bottom=node('div',null,'card-bottom');append(bottom,link('看老师的官方主页 ↗',f.profileUrl),button(state.shortlist.includes(f.id)?'已在清单中 · 移除':'放入我的清单 ＋',()=>toggleFaculty(f),'subtle-button'));card.append(bottom);
    const actions=node('div',null,'faculty-actions');append(actions,button('加入跟进待办',()=>taskForFaculty(f),'button secondary'),button('查这所学校的院系目录',()=>{state.profile.universityIds=[f.universityId];populateProfile();chooseMode('directories');showView('explore');},'button text-button'));card.append(actions);card.append(node('p','本目录的项目路线尚未覆盖所有院系。请继续核对这位老师对应的申请项目、所选学位和入学轮次。','field-help'));
    card.append(evidence([...(f.sourceIds||[]),...(f.keywordSourceIds||[]),...((f.availability||{}).sourceIds||[])],'研究主题相近只是继续了解的理由，不代表录取机会、导师承诺或名额。'));return card;
  }
  function directoryCard(d) {
    const card=node('article',null,'result-card'),u=university(d.universityId),count=L.reviewedForDirectory(C,d);append(card,topLine(u),node('h3',d.unit),node('p',count?'已整理其中 '+count+' 位老师的研究方向，仍有其他老师尚未收录。':'这个院系的个人页还没整理好，可以先从官网继续找。','coverage-status'),node('p','这不是该院系教师总人数，也不能据此判断谁正在招生。','field-help'),link('继续查看官方师资目录 ↗',d.url));const progress=node('details',null,'source-details');append(progress,node('summary','本轮整理到了哪里'),node('p',d.coverageNotes,'evidence-note'));append(card,progress,evidence(d.sourceIds));return card;
  }
  function renderFunding() { const items=L.fundingFor(C,state.profile);$('funding-results').hidden=!items.length;clear($('funding-cards'));items.forEach(f=>{const box=node('article',null,'funding-card');append(box,node('h3',f.title),node('p',f.note||'资格和资助结果以官方审核为准，不是自动获奖。'));box.append(deadlineCard({label:'相关申请日期',at:f.deadline,cycle:f.cycle},state.profile.cycle));box.append(evidence(f.sourceIds));$('funding-cards').append(box);}); }
  function renderResults() {
    const target=$('results');clear(target);resultCards=[];const items=mode==='programs'?L.programsFor(C,state.profile):mode==='directories'?L.directoriesFor(C,state.profile):L.facultyFor(C,state.profile);
    $('result-count').textContent=mode==='faculty'?'找到 '+items.length+' 位老师（已整理研究方向）':items.length+(mode==='directories'?' 个目录':' 条项目路线');$('results-jump').textContent='查看筛选结果（'+items.length+'）';
    $('filter-note').textContent=mode==='programs'?'项目按学位、学校和入学轮次筛选。研究关键词用于找老师，不会替你判断申请资格。':mode==='directories'?'目录只按学校筛选。直接打开相关院系官网继续查；已收录人数不是可申请导师总数。':'只在已核到的研究关键词中查找，命中任一所填词语即可列出；顺序不代表推荐等级，方向相关也不等于有名额。';
    const preparation=L.preparationNote(state.profile);$('preparation-note').textContent=preparation;$('preparation-note').hidden=!preparation||mode!=='programs';
    const shown=mode==='faculty'?items.slice(0,facultyLimit):items;shown.forEach(item=>{const card=mode==='programs'?programCard(item):mode==='directories'?directoryCard(item):facultyCard(item);resultCards.push(card);target.append(card);});
    $('show-more-faculty').hidden=mode!=='faculty'||shown.length>=items.length;$('show-more-faculty').textContent='再看一些老师（已显示 '+shown.length+' / '+items.length+'）';
    if(!items.length)empty(target,'这组条件下暂时没有已核到的资料。','可以清除部分筛选，或查看院系目录。未收录不等于没有项目、没有导师或不招生。');renderFunding();
  }
  function chooseMode(value) { mode=value;facultyLimit=24;[['show-programs','programs'],['show-faculty','faculty'],['show-directories','directories']].forEach(([id,target])=>$(id).setAttribute('aria-pressed',String(mode===target)));renderResults(); }
  function readProfile() { state.profile={degree:new FormData($('profile-form')).get('degree'),cycle:$('intake-cycle').value,universityIds:[...document.querySelectorAll('[name=university]:checked')].map(x=>x.value),interests:[...document.querySelectorAll('[name=interest]:checked')].map(x=>x.value),researchQuery:$('research-query').value,education:$('education').value,english:$('english').value,gpaNote:$('gpa-note').value}; }
  function populateProfile() { document.querySelectorAll('[name=degree]').forEach(x=>{x.checked=x.value===state.profile.degree;});document.querySelectorAll('[name=university]').forEach(x=>{x.checked=state.profile.universityIds.includes(x.value);});document.querySelectorAll('[name=interest]').forEach(x=>{x.checked=state.profile.interests.includes(x.value);});$('intake-cycle').value=state.profile.cycle||'';$('research-query').value=state.profile.researchQuery||'';$('education').value=state.profile.education;$('english').value=state.profile.english;$('gpa-note').value=state.profile.gpaNote; }
  function buildFilters() { $('intake-cycle').append(new Option(L.cycleLabel(''),''));L.cyclesFor(C).forEach(cycle=>$('intake-cycle').append(new Option(L.cycleLabel(cycle),cycle)));C.universities.forEach(u=>{const label=node('label',null,'check-label'),input=node('input');input.type='checkbox';input.name='university';input.value=u.id;append(label,input,node('span',u.short||u.name),node('span',u.region,'campus-label'));$('university-filters').append(label);});L.INTERESTS.forEach(tag=>{const label=node('label',null,'interest-label'),input=node('input');input.type='checkbox';input.name='interest';input.value=tag;append(label,input,node('span',tag));$('interest-filters').append(label);});populateProfile(); }
  function renderShortlist() {
    const saved=$('saved-faculty');clear(saved);state.shortlist.forEach(id=>{const f=C.faculty.find(x=>x.id===id);if(f)saved.append(facultyCard(f));});if(!state.shortlist.length)empty(saved,'先留下一两位想了解的老师。','去“找研究交集”看官方研究方向，再放进清单。这里不会替你发邮件。');
    const tasks=$('tasks');clear(tasks);state.tasks.forEach(t=>{const li=node('li'),label=node('label'),input=node('input');input.type='checkbox';input.checked=t.done;const span=node('span',t.text,t.done?'done':'');input.addEventListener('change',()=>{t.done=input.checked;persist(false);renderShortlist();});append(label,input,span);append(li,label,button('移除',()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);persist(false);renderShortlist();},'remove-button'));tasks.append(li);});if(!state.tasks.length)tasks.append(node('li','还没有待办。可以从项目卡片加入，或写一件自己的小事。','field-help'));
    const history=$('catalog-history');clear(history);const versions=state.catalogHistory||[];$('catalog-history-panel').hidden=!versions.length;versions.forEach(entry=>history.append(node('li','核查日期：'+(entry.checkedDate||'未知')+' · '+(entry.snapshotId?entry.snapshotId:'当时未注明资料摘要'))));
  }
  function renderSources() { const list=$('source-list');C.sources.forEach(s=>{const card=node('article',null,'source-card');append(card,node('p','官方资料 · 核查 '+(s.checkedAt||'日期未知'),'source-meta'),node('h2',s.title),node('p','适用范围：'+(s.scope||'待核实')));const claims=node('ul');(s.claims||[]).forEach(text=>claims.append(node('li',text)));card.append(claims);(s.knownIssues||[]).forEach(text=>card.append(node('p','待留意：'+text,'evidence-note')));card.append(link('打开原始来源 ↗',s.url));list.append(card);}); }
  function showView(name) { if(!['explore','shortlist','sources','community'].includes(name))name='explore';document.querySelectorAll('.view').forEach(view=>{view.hidden=view.id!=='view-'+name;});document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(name==='shortlist')renderShortlist();history.replaceState(null,'','#'+name); }
  function renderCommunityPrograms() { const universityId=$('community-university').value;clear($('community-program'));$('community-program').append(new Option('请选择项目',''));C.programs.filter(p=>p.universityId===universityId).forEach(p=>$('community-program').append(new Option(p.name+' · '+p.degrees.join('/'),p.id))); }
  buildFilters();renderResults();renderShortlist();renderSources();
  $('data-stamp').append(node('strong','本版资料 · '+(C.checkedDate||'日期待核实')),node('span',C.sources.length+' 项官方来源 · 每条核查日分别保留'));
  $('faculty-coverage').textContent='本版已核 '+C.faculty.length+' 位教师的研究线索、'+(C.directories||[]).length+' 个官方院系目录。它们不是导师总名单，更不是可申请人数上限；还有未收录、未核完的部分，可以从院系目录继续找。';
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('profile-form').addEventListener('input',event=>{readProfile();facultyLimit=24;if(event.target.id==='research-query')chooseMode('faculty');else renderResults();});$('profile-form').addEventListener('submit',event=>{event.preventDefault();readProfile();if(persist(true))notify('已保存在这个浏览器中。备份到文件后，才能换设备恢复。');});
  [['show-programs','programs'],['show-faculty','faculty'],['show-directories','directories']].forEach(([id,value])=>$(id).addEventListener('click',()=>chooseMode(value)));
  $('show-more-faculty').addEventListener('click',()=>{const previous=facultyLimit;facultyLimit+=24;renderResults();if(resultCards[previous])resultCards[previous].focus();});
  $('clear-filters').addEventListener('click',()=>{state.profile.universityIds=[];state.profile.interests=[];state.profile.researchQuery='';facultyLimit=24;populateProfile();renderResults();notify('已清除学校和方向筛选，学位、入学轮次及保存的清单保留。');});
  $('task-form').addEventListener('submit',event=>{event.preventDefault();const text=$('task-text').value.trim();if(!text)return;if(state.tasks.length>=200){notify('待办已到 200 条，请先整理现有清单。',true);return;}state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:null,facultyId:null});persist(false);$('task-text').value='';renderShortlist();});
  $('export-local').addEventListener('click',()=>{try{download('研向-完整备份.json',L.portable(C,{...state,sourceIds:sourceIdsForState()}));notify('已请求浏览器保存备份，请核对文件是否实际保存。');}catch(e){notify(e.message,true);}});
  let importSequence=0;
  $('import-local').addEventListener('change',async event=>{const sequence=++importSequence,file=event.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('备份超过 1 MiB，请保留原文件。');const next=L.parsePortable(await file.text(),C),prepared=L.portable(C,next);if(sequence!==importSequence)return;localStorage.setItem(KEY,JSON.stringify(prepared));state=prepared;savedProfile=structuredClone(prepared.profile);populateProfile();renderResults();renderShortlist();notify(next.catalogSnapshotId&&next.catalogSnapshotId===C.snapshotId?'已载入完整备份。原文件没有修改，来源编号也已核对。':'已载入你的清单，并保留旧资料版本信息。页面显示当前资料，请重新核对政策。');}catch(e){if(sequence===importSequence)notify('没有替换当前清单：'+e.message,true);}finally{if(sequence===importSequence)event.target.value='';}});
  $('reset-local').addEventListener('click',()=>{try{localStorage.removeItem(KEY);state={profile:L.defaultProfile(C),shortlist:[],tasks:[],sourceIds:[]};savedProfile=L.defaultProfile(C);populateProfile();renderResults();renderShortlist();notify('已清空这个浏览器的记录。你下载的文件不会被删除。');}catch(e){notify('本机记录暂时无法清空：'+e.message,true);}});
  $('community-university').append(new Option('请选择学校 / 校区',''));C.universities.forEach(u=>$('community-university').append(new Option(u.name+' · '+u.region,u.id)));$('community-university').addEventListener('change',renderCommunityPrograms);renderCommunityPrograms();$('community-cycle').value=C.cycle||'';
  $('community-form').addEventListener('submit',event=>{event.preventDefault();if(!$('community-consent').checked)return;const uid=$('community-university').value,pid=$('community-program').value;if(!C.programs.some(p=>p.id===pid&&p.universityId===uid)){notify('请先选对应学校的项目。',true);return;}const draft={kind:'anonymous-community-draft',schemaVersion:1,publiclySubmitted:false,consentToLocalExport:true,universityId:uid,programId:pid,cycle:$('community-cycle').value.trim(),outcome:$('community-outcome').value,notes:$('community-notes').value.trim(),scope:'个人匿名经历草稿，非官方要求，不用于计算录取率。'};download('研向-匿名经历草稿.json',draft);notify('已请求保存匿名草稿。没有公开提交，请先检查内容和实际保存的文件。');});
  showView(location.hash.slice(1));
}());
