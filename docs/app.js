(function () {
  'use strict';
  const L=window.APP_LOGIC, C=window.APP_CATALOG, KEY='yanxiang-local-v1';
  const $=id=>document.getElementById(id);
  function node(tag, text, className) { const n=document.createElement(tag);if(text!==undefined && text!==null)n.textContent=String(text);if(className)n.className=className;return n; }
  function academicTitle(tag, name, className) {
    const chinese = L.academicChineseName(name);
    const title = node(tag, chinese, className);
    if (chinese !== name) {
      const original = node('span', ' · ' + name, 'academic-name-original');
      original.setAttribute('lang', 'en');
      title.append(original);
    }
    return title;
  }
  function append(parent,...children) { children.filter(Boolean).forEach(child=>parent.append(child));return parent; }
  function clear(parent) { parent.replaceChildren(); }
  let noticeTimer;
  function notify(message,error) { const box=$('notice');box.textContent=message;box.classList.toggle('error',!!error);box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{box.hidden=true;},9500); }
  if (!L || !C || C.schemaVersion!==1 || !['universities','programs','faculty','sources'].every(k=>Array.isArray(C[k]))) {
    $('startup-error').hidden=false;$('startup-error').textContent='完整资料暂时没能载入。可以先按学校打开项目官网，或重新载入完整页面。';return;
  }
  let state={profile:L.defaultProfile(C),shortlist:[],tasks:[],sourceIds:[]},savedProfile=L.defaultProfile(C),mode='programs',facultyLimit=24,resultCards=[];
  const resultBookmarkButtons=new Map();
  try { const raw=localStorage.getItem(KEY);if(raw){const previous=L.parsePortable(raw,C),prepared=L.portable(C,previous);state=prepared;savedProfile=structuredClone(state.profile);if(!previous.catalogSnapshotId||previous.catalogSnapshotId!==C.snapshotId)notify('已恢复本机清单；招生资料版本已变化或未注明，申请前请重新核对政策。旧版本信息已保留在“我的清单”。');} } catch (_) { notify('本机旧记录没有载入。原记录没有被覆盖；可以在“我的清单”载入完整备份。',true); }
  function university(id) { return C.universities.find(u=>u.id===id); }
  function button(text, action, cls) { const b=node('button',text,cls||'button secondary');b.type='button';b.addEventListener('click',action);return b; }
  function link(label,url) { const safe=L.officialUrl(url);if(!safe)return node('span','官方链接待核实','field-help');const a=node('a',label);a.href=safe;a.target='_blank';a.rel='noopener noreferrer';return a; }
  function verifiedLink(label,safe) {if(!safe)return node('span','链接来源待核实','field-help');const a=node('a',label);a.href=safe;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function observedProfileLink(label,url,sourceIds) {const safe=L.observedProfileUrl(C,url,sourceIds);return safe?verifiedLink(label,safe):node('span',label+'（原链接待核）','field-help');}
  function sourceIdsForState() { return [...new Set([...state.sourceIds,...state.shortlist.flatMap(id=>(C.faculty.find(f=>f.id===id)||{}).sourceIds||[]),...state.tasks.flatMap(t=>(C.programs.find(p=>p.id===t.programId)||{}).sourceIds||[])])].filter(id=>C.sources.some(s=>s.id===id)); }
  function persist(saveProfile) { try { const value=L.portable(C,{...state,profile:saveProfile?state.profile:savedProfile,sourceIds:sourceIdsForState()});localStorage.setItem(KEY,JSON.stringify(value));state.catalogHistory=value.catalogHistory;state.catalogSnapshotId=value.catalogSnapshotId;state.catalogCheckedDate=value.catalogCheckedDate;if(saveProfile)savedProfile=structuredClone(state.profile);return true; } catch(e){notify('暂时没能写入本机记录：'+e.message+' 可以先下载完整备份。',true);return false;} }
  function download(name,value) { const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function empty(parent,title,description) { const box=node('div',null,'empty-state');append(box,node('strong',title),node('span',description));parent.append(box); }
  function evidence(ids,note) {
    const details=node('details',null,'source-details'),summary=node('summary','看依据与适用范围'),body=node('div',null,'source-details-body');append(details,summary,body);
    if(note)body.append(node('p',note,'evidence-note'));
    const list=node('ul');[...new Set(ids||[])].forEach(id=>{const s=C.sources.find(x=>x.id===id);if(!s)return;const li=node('li');append(li,verifiedLink(s.title,L.sourceUrl(C,s)),node('div','适用范围：'+(s.scope||'待核实')),node('div','核查日期：'+(s.checkedAt||'未知')));(s.knownIssues||[]).forEach(x=>li.append(node('div','待留意：'+x)));list.append(li);});body.append(list);if(!list.childElementCount)body.append(node('p','这条信息暂缺可核对来源，请先查看项目官方入口。'));return details;
  }
  function deadlineCard(d, cycle) {
    const status=L.deadlineState(d,cycle),box=node('div',null,'deadline'+(status.code==='expired'?' expired':'')+(status.code==='out_of_scope'?' out-of-scope':''));
    const label=(d.label||'申请日期').replace(/[:：]\s*\d{4}-\d\d-\d\d(?:\s+\d\d:\d\d)?(?:（UTC\+8）|（官网未说明具体时间）)?\s*$/,'').replace(/（官网未说明具体时间）$/,'');
    append(box,node('span',label),node('strong',(d.at||d.date)?formatDate(d.at||d.date):'请查看当期招生页'));
    if(!['dated','date_only'].includes(status.code))box.append(node('span',status.code==='unknown'?'请确认申请年份和截止时间。':status.text,'deadline-state'));
    if(d.cycle && d.cycle!==cycle)box.append(node('span',d.cycle));return box;
  }
  function formatDate(value) { if(/^\d{4}-\d\d-\d\d$/.test(value))return value+'（具体时间请核对原页）';const stamp=Date.parse(value);if(!Number.isFinite(stamp))return '日期待核实';return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(stamp)+'（UTC+8）'; }
  function topLine(u,cycle) { const row=node('div',null,'card-topline'),kicker=node('div',null,'university-kicker');append(kicker,node('strong',u?u.short||u.name:'学校待核实'),node('span',u?u.region:'','region-pill'));append(row,kicker,cycle?node('span',cycle,'cycle-pill'):null);return row; }
  function taskForProgram(p) { if(state.tasks.length>=200){notify('待办已到 200 条，请先整理或备份现有清单。',true);return;}const text='核对 '+p.name+' 的联系要求、申请轮次和材料清单';state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:p.id,facultyId:null});state.sourceIds=[...new Set([...state.sourceIds,...(p.sourceIds||[])])];const saved=persist(false);renderShortlist();if(saved)notify('已加入准备清单。先核对要求，再决定是否联系。'); }
  function taskForRequirement(p,item) {
    const cycleText=p.cycleVerified===false?'计划'+L.cycleLabel(state.profile.cycle)+'（项目轮次待核）':L.cycleLabel(state.profile.cycle||p.cycle);
    const text=cycleText+' · '+state.profile.degree+' · '+p.name+'：'+item.action;
    if(state.tasks.some(t=>t.programId===p.id&&t.text===text)){notify('这件事已经在清单里，可以接着完成。');return;}
    if(state.tasks.length>=200){notify('待办已到 200 条，请先整理或备份现有清单。',true);return;}
    state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:p.id,facultyId:null});
    state.sourceIds=[...new Set([...state.sourceIds,...item.sourceIds])];const saved=persist(false);renderShortlist();if(saved)notify('已加入准备清单，学位和入学轮次也一起保留了。');
  }
  function financeSection(p) {
    const items=L.financesFor(p,state.profile);
    if(!items.length)return node('p','学费与资助：请查看项目官网。','evidence-note');
    const section=node('details',null,'source-details');section.append(node('summary','学费、申请费和资助分开看'));
    const body=node('div',null,'source-details-body');body.append(node('p','先核对适用年份，再分别查看学费、申请费、助学金和生活预算。','evidence-note'));
    items.forEach(item=>{
      const box=node('section',null,'finance-item');append(box,node('h4',item.label),node('p',item.text));
      const rates=L.financeRates(item,state.profile);
      rates.matched.forEach(rate=>box.append(node('p',L.financeRateText(rate),'finance-rate matched')));
      if(!rates.matched.length)box.append(node('p',state.profile.cycle?'所选轮次的金额尚未核实。':'先选入学轮次，再核对对应金额。','finance-rate unknown'));
      if(rates.reference.length){const ref=node('details',null,'source-details');ref.append(node('summary','看其他年度或未注明轮次的参考金额'));ref.append(node('p','申请其他年份时，请回项目官网查看当年金额。','evidence-note'));rates.reference.forEach(rate=>ref.append(node('p',L.financeRateText(rate),'finance-rate reference')));box.append(ref);}
      append(box,evidence(item.sourceIds),button('把这一步加入待办 ＋',()=>taskForRequirement(p,item),'subtle-button'));body.append(box);
    });section.append(body);return section;
  }
  function programCard(p) {
    const u=university(p.universityId),card=node('article',null,'result-card');append(card,topLine(u,p.cycleVerified===false?'入学轮次待核':L.cycleLabel(state.profile.cycle||p.cycle)),node('h3',p.name));const tags=node('div',null,'degree-line');L.applicationDegrees(C,p).forEach(d=>tags.append(node('span',d==='MPhil'?'MPhil · 研究型硕士':'PhD · 博士','small-tag')));card.append(tags);card.append(node('p',p.scope||'具体适用范围待核实','scope-text'));if(p.cycleVerified===false)card.append(node('p','入学年份未注明，请先查看项目当前招生安排。','evidence-note'));else if(state.profile.cycle&&state.profile.cycle!==p.cycle)card.append(node('p','你选择了另一入学轮次，请核对这一轮的申请流程。','evidence-note'));
    const contactStatus=(p.contact||{}).status,contactLabel=contactStatus==='required'?'提交申请前须联系意向导师。':contactStatus==='recommended'?'建议联系意向导师，接收安排见申请流程。':contactStatus==='not_required'?'无须提前联系导师，按项目流程准备申请。':'导师联系要求待确认，请先查看项目招生页。';card.append(node('p',contactLabel,'contact-next-step'));const process=node('details',null,'source-details application-process');process.append(node('summary','联系导师与申请流程'));const questions=node('div',null,'question-grid');[['申请前要不要先联系导师',p.contact&&p.contact.text],['谁参与审核',p.selection&&p.selection.text]].forEach(([heading,text])=>{const part=node('div');append(part,node('h4',heading),node('p',text||'请向项目办公室确认具体流程。'));questions.append(part);});process.append(questions);card.append(process);
    const items=L.requirementsFor(p,state.profile);
    if(items.length){const requirements=node('details',null,'source-details');requirements.append(node('summary','申请材料与准备事项'));const body=node('div',null,'source-details-body');body.append(node('p','按下面各项准备，完整材料清单可从项目官网查看。','evidence-note'));items.forEach(item=>{append(body,node('h4',item.label),node('p',item.text));if(item.url)body.append(link('打开这一步的官方入口 ↗',item.url));body.append(evidence(item.sourceIds));if(item.action)body.append(button('把这一步加入待办 ＋',()=>taskForRequirement(p,item),'subtle-button'));});requirements.append(body);card.append(requirements);}
    else card.append(node('p','请在项目官网查看学历、语言和材料要求。','evidence-note'));
    card.append(financeSection(p));
    const dates=node('div',null,'deadlines'),visible=L.deadlinesFor(p,state.profile,u);visible.forEach(d=>dates.append(deadlineCard({...d,cycle:d.cycle||p.cycle},state.profile.cycle)));if(!visible.length)dates.append(deadlineCard({label:p.cycleVerified===false?'当期申请时间待核':'本轮申请时间',at:null,cycle:p.cycleVerified===false?null:state.profile.cycle||p.cycle},state.profile.cycle));card.append(dates);
    const primary=(p.sourceIds||[]).map(id=>C.sources.find(s=>s.id===id)).find(s=>s&&L.officialUrl(s.url));
    const bottom=node('div',null,'card-bottom');append(bottom,link('打开官方原页 ↗',p.entryUrl||(primary&&primary.url)||(u&&u.entryUrl)),button('加入准备清单 ＋',()=>taskForProgram(p),'subtle-button'));card.append(bottom);card.append(evidence([...(p.sourceIds||[]),...((p.contact||{}).sourceIds||[]),...((p.selection||{}).sourceIds||[]),...visible.flatMap(d=>d.sourceIds||[])],p.evidenceNote));return card;
  }
  function bookmarkLabel(saved) { return saved?'已在清单中 · 移除':'放入我的清单 ＋'; }
  function toggleFaculty(f) {
    const saved=!state.shortlist.includes(f.id);
    if(saved)state.shortlist.push(f.id);else state.shortlist=state.shortlist.filter(id=>id!==f.id);
    const persisted=persist(false), control=resultBookmarkButtons.get(f.id);
    if(control)control.textContent=bookmarkLabel(saved);
    renderShortlist();
    if(persisted)notify(saved?'已放入“我的清单”。':'已从“我的清单”移除。');
  }
  function taskForFaculty(f) {
    const text=L.cycleLabel(state.profile.cycle||C.cycle)+' · '+state.profile.degree+'：'+(f.recordKind==='directory_research'?'读 '+f.name+' 在院系名录中的研究说明，确认个人主页、指导资格和对应申请项目':'读 '+f.name+' 的主页与近期工作，核对研究问题、对应项目及本轮接收要求');
    if(state.tasks.some(t=>t.facultyId===f.id&&t.text===text)){notify('这位老师的跟进事项已经在清单里。');return;}
    if(state.tasks.length>=200){notify('待办已到200条，请先备份或整理。',true);return;}
    state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:null,facultyId:f.id});state.sourceIds=[...new Set([...state.sourceIds,...f.sourceIds])];const saved=persist(false);renderShortlist();if(saved)notify('已加入跟进待办。先核研究方向和申请入口，再决定是否联系。');
  }
  function facultyCard(f, inResults=false) {
    const u=university(f.universityId),card=node('article',null,'result-card');append(card,topLine(u,(f.availability||{}).cycle),node('h3',f.name),academicTitle('p',f.department||'院系待核实','scope-text'));const matches=L.matchedTopics(f,state.profile.interests);card.append(node('p',matches.length?'方向有交集 · '+matches.join('、'):'先看研究问题，再判断是否适合自己','matched-line'));const tags=node('div',null,'degree-line');(f.topics||[]).slice(0,8).forEach(t=>tags.append(node('span',t,'small-tag neutral')));card.append(tags);append(card,node('p',f.summary||'研究简介待核实','faculty-summary'),node('p',(f.availability||{}).state==='unknown'?'招生安排待确认，可先查看老师主页和对应项目。':L.availabilityText(f)+' '+((f.availability||{}).text||''),'availability-note'));
    card.tabIndex=-1;
    if(f.role||f.directoryRole)card.append(node('p','官网所列身份：'+(f.role||f.directoryRole),'scope-text'));
    const generalIdentityNotes=new Set(['本条保留官网目录中的原职位；教学、实践、荣休、兼任或联合任职不等于已确认研究生指导资格。','这是名录所列的任职信息；是否可以指导你所选的学位，需要再核对对应项目。','这是官网名录身份；教学或应用职称与其他职称都不等于已确认研究生指导资格。','这是名录所列身份；是否能指导你所选的研究学位、目前是否接收，仍要分别核对。','这是官网列出的任职分类，不等于已确认所选学位的指导资格或当前正在接收。']);
    if(f.identityNote&&!generalIdentityNotes.has(f.identityNote))card.append(node('p',f.identityNote,'appointment-note'));
    const key=word=>{const value=word.trim().replace(/\s+/g,' ');return /^[A-Z]?[a-z]{2,}(?: [A-Z]?[a-z]{2,})+$/.test(value)?value.toLowerCase():value;};
    const summaryKey=key((f.summary||'').replace(/^研究/,'').replace(/[。.]$/,''));
    const concise=terms=>{const seen=new Set();return terms.filter(term=>{const value=key(term);if(seen.has(value)||(term.length>28&&summaryKey.includes(value)))return false;seen.add(value);return true;});};
    const words=concise(f.researchKeywords||[]),specific=node('div',null,'research-terms');words.slice(0,6).forEach(term=>specific.append(node('span',term,'research-term')));card.append(specific);
    if(words.length>6){const more=node('details',null,'source-details'),terms=node('div',null,'research-terms');more.append(node('summary','还有 '+(words.length-6)+' 个研究词'));words.slice(6).forEach(term=>terms.append(node('span',term,'research-term')));more.append(terms);card.append(more);}
      const termMatches=L.matchedResearchTerms(f,state.profile.researchQuery);const matchedWords=concise(termMatches);if(termMatches.length)card.append(node('p',matchedWords.length?'与你所填词语对应的官网研究词：'+matchedWords.join('、'):'研究描述与所填词语有交集，具体范围请看上文和原页。','research-match'));
      const directoryEvidence=L.directoryResearchSource(C,f);
      if(f.recordKind==='directory_research')card.append(node('p','可先从院系名录了解研究内容，再查老师的个人主页。','field-help'));
      const bookmark=button(bookmarkLabel(state.shortlist.includes(f.id)),()=>toggleFaculty(f),'subtle-button');
      if(inResults)resultBookmarkButtons.set(f.id,bookmark);
      const bottom=node('div',null,'card-bottom');append(bottom,f.recordKind==='directory_research'?(directoryEvidence?link('看院系中的研究原文 ↗',directoryEvidence.url):node('span','研究原页仍待核实','field-help')):observedProfileLink('看院系提供的老师主页 ↗',f.profileUrl,f.directorySourceIds),bookmark);card.append(bottom);
    if(f.directoryRole||f.identityNote||(f.availability||{}).text){const identity=node('details',null,'source-details appointment-details');identity.append(node('summary','任职与招生说明'));if(f.role&&f.directoryRole&&f.directoryRole!==f.role)identity.append(node('p','官网职位：'+f.directoryRole,'scope-text'));if(f.identityNote&&generalIdentityNotes.has(f.identityNote))identity.append(node('p',f.identityNote,'field-help'));if((f.availability||{}).text)identity.append(node('p',f.availability.text,'field-help'));if(f.reviewedProfileUrl&&f.reviewedProfileUrl!==f.profileUrl)identity.append(link('查看官方研究档案 ↗',f.reviewedProfileUrl));card.append(identity);}
    const related=L.facultyLinks(C,f);
    if(related.length){
      const more=node('details',null,'source-details');
      const sections=L.facultyLinkSections(related);
      more.append(node('summary',sections.primary.length?'个人网站与课题组':'原网页中的其他链接'));
      const appendLinks=(parent,items)=>{
        const list=node('ul',null,'faculty-link-list');
        items.forEach(item=>{
          const row=node('li');
          row.append(item.linkIssue?node('span',item.label+'（原链接有误，待核）'):verifiedLink(item.label+' ↗',item.url));
          if(item.readNote)row.append(node('p',item.readNote,'field-help'));
          list.append(row);
        });
        parent.append(list);
      };
      if(sections.primary.length)appendLinks(more,sections.primary);
      if(sections.more.length){
        const references=node('details',null,'source-details faculty-more-links');
        references.append(node('summary','更多原页链接（'+sections.more.length+'）'));
        appendLinks(references,sections.more);more.append(references);
      }
      card.append(more);
    }
    if((f.applicationNotes||[]).length){
      const notes=node('details',null,'source-details');
      const directionsOnly=f.applicationNotes.every(item=>item.kind==='official_supervisor_list');
      notes.append(node('summary',directionsOnly?'研究学位指导方向':'导师与申请说明'));
      f.applicationNotes.forEach(item=>{
        append(notes,node('h4',item.label),node('p',item.text));
        if(item.degrees&&!item.degrees.includes(state.profile.degree))notes.append(node('p','本条适用于 '+item.degrees.join('、')+'。','field-help'));
        notes.append(evidence(item.sourceIds));
      });
      card.append(notes);
    }
    const actions=node('div',null,'faculty-actions');append(actions,button('加入跟进待办',()=>taskForFaculty(f),'button secondary'),button('查这所学校的院系目录',()=>{state.profile.universityIds=[f.universityId];populateProfile();chooseMode('directories');showView('explore');},'button text-button'));card.append(actions);card.append(node('p','联系前，先确认这位老师对应的项目与入学轮次。','field-help'));
    card.append(evidence([...(f.sourceIds||[]),...(f.keywordSourceIds||[]),...((f.availability||{}).sourceIds||[])],'研究方向、任职和招生说明的原网页见下方。'));return card;
  }
  function directoryCard(d) {
    const card=node('article',null,'result-card'),u=university(d.universityId),count=L.reviewedForDirectory(C,d),census=d.census;
    const status=d.observedNamedCards!==undefined?'本页已核对 '+d.observedNamedCards+' 张人员卡。'+(census.observedTotal?'其中 '+census.observedTotal+' 个个人主页正文待核。':'所给网站与逐人核查进度见下方；暂未归类不等于没有个人主页。'):census?(census.pendingReasonCounts?'这组名录保留 '+census.observedTotal+' 个主页：'+census.profilesRead+' 个已读，'+census.profilesFailed+' 个待核。'+((census.unlinkedEntries||[]).length?'另有 '+census.unlinkedEntries.length+' 张卡未提供主页。':''):'这组目录列出 '+census.observedTotal+' 个不同主页：已读 '+census.profilesRead+' 个，'+census.profilesFailed+' 个读取超时。'):count?'已整理其中 '+count+' 位老师的研究方向，仍有其他老师尚未收录。':'这个院系的个人页还没整理好，可以先从官网继续找。';
    append(card,topLine(u),academicTitle('h3',d.unit),node('p','从院系官网查看老师、研究方向和个人主页。','coverage-status'),link('查看官方师资目录 ↗',d.url));
    if(d.applicationGuideSourceId){
      const guide=C.sources.find(s=>s.id===d.applicationGuideSourceId);
      if(guide&&d.sourceIds.includes(guide.id))card.append(append(node('p'),link('查看研究学位申请指南 ↗',guide.url)));
    }
    const progress=node('details',null,'source-details');append(progress,node('summary',census?'展开老师名单与资料详情':'查看目录与资料详情'),node('p',status,'field-help'),node('p',d.coverageNotes,'evidence-note'));
    if(census){const list=node('ul');census.entries.forEach(entry=>{const li=node('li');append(li,observedProfileLink(entry.name+' ↗',entry.profileUrl,d.sourceIds),node('div',(entry.directoryPosition||'原站未列职位')+' · '+(entry.reviewNote||(entry.profileRead?'已核对个人页':entry.reviewStatus==='network_timeout'?'读取超时，待核':entry.reviewStatus==='access_failed'?'未能读取，待核':'个人页待核')),'field-help'));if(entry.profileUrl.startsWith('http://'))li.append(node('div','原网址：'+entry.profileUrl,'field-help'));list.append(li);});(census.unlinkedEntries||[]).forEach(entry=>{const li=node('li');append(li,node('span',entry.name),node('div',(entry.directoryPosition?entry.directoryPosition+' · ':'')+entry.reason,'field-help'));(entry.providedLinks||[]).forEach(extra=>{append(li,observedProfileLink(extra.label+' ↗',extra.url,d.sourceIds),node('span',' · '+(entry.groupLinkReview||'网站正文待核'),'field-help'));if(extra.url.startsWith('http://'))li.append(node('div','原网址：'+extra.url,'field-help'));});list.append(li);});progress.append(list);if((d.identityNotes||[]).length)progress.append(node('p','同名卡片保留各自原主页，尚未按姓名合并或认定为不同自然人：'+d.identityNotes.join('、'),'field-help'));}
    append(card,progress,evidence([...d.sourceIds,...(d.reviewSourceIds||[])]));return card;
  }
  function renderAcademicCoverage() {
    const target=$('academic-coverage');clear(target);target.hidden=mode!=='directories';
    if(target.hidden)return;
    append(target,node('h2','按学院和院系找老师'),node('p','选学院，再打开下属院系、师资名录或研究学位入口。','evidence-note'));
    const selected=state.profile.universityIds||[];
    (C.academicCoverage||[]).filter(row=>!selected.length||selected.includes(row.universityId)).forEach(row=>{
      const school=node('details',null,'school-coverage'),u=university(row.universityId);
      const review=row.listReview;
      const schoolInfo=node('details',null,'source-details school-information');append(school,node('summary',(u.short||u.name)+' · 学院与院系'));append(schoolInfo,node('summary','院系名单与更新说明'),node('p',review?review.summary:row.reportedCounts.map(c=>c.value+' '+c.label).join('；'),'field-help'),node('p',row.note,'evidence-note'));school.append(schoolInfo);
      if(review)append(schoolInfo,node('p','学院名单：'+(review.status==='research_degree_list_matched'?'已逐项核对研究学位页的名单；校级完整架构仍待核。':'已逐项核对所引校级名单。')+' 核查：'+review.checkedAt,'field-help'),node('p','下属院系：尚未核齐；教师：按院逐步核对。','field-help'),node('p',review.next,'field-help'),evidence(review.sourceIds));
      (row.institutionalReferences||[]).forEach(reference=>{
        const panel=node('details',null,'source-details institutional-reference'),source=C.sources.find(s=>s.id===reference.sourceId);
        const receipt = reference.entries.length ? '介绍或名录正文核查：'+reference.checkedAt+'；下列入口正文待核。' : '资料核查：'+reference.checkedAt+'。';
        append(panel,node('summary',reference.title),node('p',reference.summary,'evidence-note'),node('p',reference.caution,'evidence-note'),link('查看这份校级资料 ↗',source.url),node('p',receipt,'field-help'),node('p',reference.entryNote,'field-help'));
        if (reference.entries.length) {
          const entries=node('ul');reference.entries.forEach(entry=>{const item=node('li');append(item,entry.url.startsWith('https://')?link(L.academicLabel(entry.name)+' ↗',entry.url):academicTitle('span',entry.name),node('span',' · 正文待核','field-help'));if(entry.url.startsWith('http://'))item.append(node('p','官网原链接为 HTTP，保留原地址供核对，不猜改为 HTTPS：'+entry.url,'field-help'));entries.append(item);});panel.append(entries);
        }
        panel.append(evidence([reference.sourceId]));school.append(panel);
      });
      if(row.units.some(unit=>unit.id===coverageTarget))school.open=true;const list=node('div',null,'academic-unit-list');
      row.units.forEach(unit=>{
        const section=node('details',null,'academic-unit');if(unit.id===coverageTarget){section.open=true;section.setAttribute('tabindex','-1');coverageTargetElement=section;}
        const status=unit.entryBodyStatus==='body_read'?'已读学院入口':unit.entryBodyStatus==='access_failed'?'入口读取失败，待核':'入口待核';
        const supportUnit=['graduate_school','undergraduate_college'].includes(unit.kind);
        const unitInfo=node('details',null,'source-details unit-information');append(section,academicTitle('summary',unit.name));append(unitInfo,node('summary','学院信息与来源'),node('p',status,'field-help'),node('p',supportUnit?'申请或教学服务入口。':'可从下方师资入口继续查看老师和研究方向。','field-help'));section.append(unitInfo);
        if(unit.url)section.append(link('打开这个单位的官方入口 ↗',unit.url));
        if(unit.researchPlatforms){
          const platforms=unit.researchPlatforms,panel=node('details',null,'source-details research-platforms'),items=node('ul');
          panel.append(node('summary',platforms.title+'（'+platforms.items.length+'）'));
          platforms.items.forEach(platform=>{const item=node('li');append(item,node('strong',platform.name),node('span',' · '+platform.teacher,'field-help'));items.append(item);});
          append(panel,items,link('查看'+platforms.pageLabel+' ↗',platforms.pageUrl),evidence([platforms.sourceId]));section.append(panel);
        }
        if(unit.accessNote)unitInfo.append(node('p',unit.accessNote,'field-help'));
        if(unit.childInventoryReview)append(unitInfo,node('p',unit.childInventoryReview.summary+' 名单依据核查：'+unit.childInventoryReview.checkedAt,'evidence-note'),evidence(unit.childInventoryReview.sourceIds));
        if(unit.organizationReview)append(unitInfo,node('p',unit.organizationReview.summary+' 核查：'+unit.organizationReview.checkedAt,'evidence-note'),evidence(unit.organizationReview.sourceIds));
        if((unit.reviewedNavigation||[]).length){const actions=node('div',null,'college-next-actions');actions.append(node('h4','接下来可以这样查'));unit.reviewedNavigation.forEach(action=>{const source=C.sources.find(s=>s.id===action.sourceId),card=node('div',null,'college-next-action');card.append(link(action.label+' ↗',source.url));unitInfo.append(node('p',action.scope,'field-help'));actions.append(card);});section.append(actions);}
        if(!supportUnit&&!unit.children.length&&!unit.organizationReview)section.append(node('p','可先打开学院官网，查看下属单位和师资。','field-help'));
        if(unit.children.length){section.append(node('h4','继续查看这些学术单位'));const children=node('ul');
          unit.children.forEach(child=>{const followup=(C.academicEntryFollowups||[]).find(r=>r.url===child.url),sharedRead=!followup?L.sharedSchoolRead(C,row.universityId,child):null,providedRead=(child.providedEntries||[]).some(e=>(C.academicEntryFollowups||[]).some(r=>r.url===e.url&&r.bodyStatus==='body_read')),childTarget=(followup&&followup.retrievedUrl)||child.retrievedUrl||child.url,item=node('li'),stateText=followup?(followup.bodyStatus==='body_read'?'已读单位正文':'本次入口读取失败，待核'):providedRead?'学院另给入口正文已读':sharedRead?'同一官网已读，沿用原记录':child.entryBodyStatus==='body_read'?'已读单位正文':child.entryBodyStatus==='access_failed'?'入口读取失败，待核':child.parentEvidenceStatus==='body_read'?(child.url?'已核名单与所给链接；单位正文待核':'已核名单；所读页未给独立网址；单位正文待核'):'入口待核';append(item,childTarget&&childTarget.startsWith('https://')?link(L.academicLabel(child.name)+' ↗',childTarget):academicTitle('span',child.name),node('details',null,'source-details child-entry-state'));const entryState=item.children[item.children.length-1];append(entryState,node('summary','资料更新'),node('p',stateText,'field-help'));if(child.relationship==='affiliated_school')append(item,node('span','关联学术单位','small-tag neutral'),node('details',null,'affiliation-details'));if(child.relationship==='affiliated_school')item.children[item.children.length-1].append(node('summary','查看关联关系'),node('p','关联学校：保留与本学院的关系，不算作它的直属学系。','field-help'));if(child.responseKind==='access_challenge')item.append(node('p','入口返回访问检查页，尚未读到院系正文；保留原链接，待正常访问后再核。','field-help'));if(child.url&&child.url.startsWith('http://'))item.append(node('div','官网原链接为 HTTP，原地址保留供核对：'+child.url,'field-help'));
            const documentedUrls = new Set();
            for (const document of C.academicChildDocuments || []) {
              if (document.parentUnitId !== unit.id || document.childUrl !== child.url) continue;
              const source = C.sources.find(s => s.id === document.sourceId);
              documentedUrls.add(source.url);
              const panel = node('details', null, 'source-details unit-related-document');
              append(panel, node('summary', document.title), node('p', document.summary, 'evidence-note'),
                link((document.linkLabel || '查看学部主任介绍') + ' ↗', source.url));
              if (document.items?.length) {
                const items = node('ul');
                for (const entry of document.items) {
                  const row = node('li');
                  const label = entry.label + ' · ' + entry.observedLabel;
                  if (entry.url?.startsWith('https://')) row.append(verifiedLink(label + ' ↗', entry.url));
                  else row.append(node('span', label + (entry.url ? '（官网地址 ' + entry.url + '）' : '')));
                  items.append(row);
                }
                panel.append(items);
              }
              const links = node('ul');
              for (const entry of document.nextEntries) {
                const route = node('li');
                route.append(entry.url.startsWith('https://') ? link(entry.label + ' ↗', entry.url)
                  : node('span', entry.label + '（官网地址 ' + entry.url + '）', 'field-help'));
                links.append(route);
              }
              if (links.childElementCount) panel.append(links);
              panel.append(evidence([source.id]));
              item.append(panel);
            }
            if(sharedRead){const proof=node('details',null,'source-details shared-school-read');append(proof,node('summary','查看原网页的核查记录'),node('p','沿用'+sharedRead.checkedDates.join('、')+'的原网页记录，本次没有重新下载或改日期。这只说明读过该入口页，完整师资、指导资格和当期余位仍需逐项核对。原有关联学校关系及其记录保持分开。','field-help'),evidence(sharedRead.sourceIds));item.append(proof);}
            (C.academicUnitNotes||[]).filter(note=>note.parentUnitId===unit.id&&note.childName===child.name).forEach(note=>{const box=node('details',null,'source-details unit-scope-note');append(box,node('summary',note.title),node('p',note.summary,'evidence-note'),node('p','当期申请要求、完整师资、指导资格和实时余位仍待核对。','field-help'));note.sourceIds.forEach(id=>{const source=C.sources.find(s=>s.id===id);if(source)box.append(link(source.title+' ↗',source.url));});box.append(evidence(note.sourceIds));item.append(box);});
            if (followup) {
              const review = node('details', null, 'source-details unit-entry-followup');
              const summary = documentedUrls.size ? '首页核查（' + followup.checkedAt + '）：' + followup.summary : followup.summary;
              append(review, node('summary', '师资与研究学位入口'), node('p', summary, 'evidence-note'));
              if (!documentedUrls.size) review.append(node('p', '原入口和原读取记录保留；这次核查不代表院系或完整师资已收齐。', 'field-help'));
              for (const entry of followup.nextEntries || []) {
                if (entry.bodyStatus === 'not_read' && documentedUrls.has(entry.url)) continue;
                append(review, link(entry.label + ' ↗', entry.url),
                  node('p', entry.bodyStatus === 'body_read' ? (entry.readNote || '已读这一个入口页面；完整名单仍待核。')
                    : '官网提供的入口，目标正文待核；指导资格和实时余位未知。', 'field-help'));
                if (entry.directoryId) {
                  const directory = C.directories.find(d => d.id === entry.directoryId);
                  if (directory) review.append(directoryCard(directory));
                }
              }
              if (followup.sourceIds.length) review.append(evidence(followup.sourceIds));
              item.append(review);
            }
            (child.providedEntries||[]).forEach(entry=>{const later=(C.academicEntryFollowups||[]).find(r=>r.url===entry.url&&r.bodyStatus==='body_read'),status=later?'已读单位正文':'正文待核',extra=node('div',null,'provided-college-entry'),entryLink=link('打开学院另给的官网（'+status+'） ↗',entry.url);entryLink.setAttribute('aria-label',child.name+'：'+entry.label+'（'+status+'）');extra.append(entryLink);if(later){append(extra,node('p',later.summary+' 核查：'+later.checkedAt,'evidence-note'),evidence(later.sourceIds));if((later.nextEntries||[]).length){const routes=node('details',null,'source-details provided-entry-routes');routes.append(node('summary','继续看人员和研究学位入口'));later.nextEntries.forEach(route=>{append(routes,route.url.startsWith('https://')?link(route.label+' ↗',route.url):node('p',route.label+'：官网原地址 '+route.url,'field-help'),node('p',route.bodyStatus==='body_read'?(route.readNote||'已读这一个入口；完整名单和当期要求另核。'):'这是官网提供的下一入口，目标正文仍待核；指导资格和实时余位未知。','field-help'));});extra.append(routes);}const history=node('details',null,'source-details');append(history,node('summary','查看此前的入口发现记录'),node('p',entry.note,'field-help'),evidence(entry.sourceIds));extra.append(history);}else append(extra,node('p',entry.note,'field-help'),evidence(entry.sourceIds));item.append(extra);});
            if((child.staffRoutes||[]).length){const routes=node('details',null,'source-details');routes.append(node('summary','继续看这个单位的人员导航'));child.staffRoutes.forEach(route=>{append(routes,link(route.label+' ↗',route.retrievedUrl||route.url),node('p',route.bodyStatus==='body_read'?'已读人员导航正文，完整名单和分页仍需逐项核对。':route.bodyStatus==='access_failed'?'本轮未读到正文，保留待核。':'导航入口待核。','field-help'));});item.append(routes);}if((child.sourceIds||[]).length)item.append(evidence(child.sourceIds));children.append(item);});section.append(children);}
        if((unit.relatedTeachingEntries||[]).length){const related=node('details',null,'source-details'),entries=node('ul');related.append(node('summary','其他教学项目与单位（不计作学部）'));unit.relatedTeachingEntries.forEach(entry=>{const item=node('li');item.append(link(L.academicLabel(entry.name)+' ↗',entry.url));entries.append(item);});related.append(entries);section.append(related);}
        (unit.relatedNavigationGroups||[]).forEach(group=>{const related=node('details',null,'source-details organization-navigation'),entries=node('ul');if(unit.id===coverageTarget&&group.title===coverageGroupTarget){related.open=true;related.setAttribute('tabindex','-1');coverageTargetElement=related;}append(related,node('summary',group.title));if(group.parentUnitName)related.append(node('p','所属上级：'+L.academicLabel(group.parentUnitName)+'。以下单位保留在这个上级之下，不与学院的一级单位混算。','evidence-note'));related.append(node('p',group.note,'field-help'));group.entries.forEach(entry=>{const item=node('li');item.append(entry.url&&entry.url.startsWith('https://')?link(L.academicLabel(entry.name)+' ↗',entry.url):academicTitle('span',entry.name));if(entry.url&&entry.url.startsWith('http://'))item.append(node('p','官网原链接为 HTTP，保留地址供核对，不猜改为 HTTPS：'+entry.url,'field-help'));if(['academic_subunits','related_academic_units','research_organizations'].includes(group.kind))item.append(node('p',entry.entryBodyStatus==='body_read'?'已读到该单位入口；完整师资、指导资格与招生信息仍待核。':'已核到名称'+(entry.url?'和所给链接':'')+'；单位正文、完整师资及招生信息仍待核。','field-help'));if(entry.note)item.append(node('p',entry.note,'field-help'));entries.append(item);});append(related,entries,evidence(group.sourceIds));section.append(related);});
        if(unit.staffEntries.length){section.append(node('h4','人员目录'));unit.staffEntries.forEach(entry=>{append(section,link(entry.label+' ↗',entry.url),node('p',entry.scopeNote||(entry.entryBodyStatus==='body_read'?'已读目录，完整名单还需核对。':entry.entryBodyStatus==='access_failed'?'暂时读不到目录，可试着打开官网。':'可先打开官网查看。'),'field-help'));
          if((entry.profileLeads||[]).length){
            const pending=node('details',null,'source-details'),read=entry.profileLeads.filter(p=>p.profileBodyStatus==='body_read').length,reviewed=entry.profileLeads.filter(p=>p.facultyId).length;
            if(!entry.pageSourceIds){
              append(pending,node('summary','展开 '+entry.profileLeads.length+' 个目录主页 · 已读 '+read+'，研究信息已整理 '+reviewed),node('p','保留目录中的实践、教学、兼任或荣休等原职位。已读正文与研究信息已整理分开标明；都不代表已确认研究生指导资格或名额。','field-help'));
              const names=node('ul');
              entry.profileLeads.forEach(lead=>{const li=node('li');append(li,observedProfileLink((lead.name||lead.directoryLabel)+' ↗',lead.url,entry.sourceIds),node('span',' · '+(lead.reviewNote||(lead.facultyId?'研究信息已整理':lead.profileBodyStatus==='body_read'?'正文已读，研究信息待补':'主页待核')),'field-help'));names.append(li);});
              pending.append(names);
            }else{
              pending.append(node('summary','按官网页码浏览 '+entry.profileLeads.length+' 个主页'));
              pending.addEventListener('toggle',()=>{
                if(!pending.open||pending.childElementCount>1)return;
                const rosterPages=entry.pageSourceIds.map(id=>C.sources.find(source=>source.id===id));
                rosterPages.forEach((page,index)=>{
                  const roster=node('details',null,'source-details');
                  roster.append(node('summary','第 '+(index+1)+' 页'));
                  roster.addEventListener('toggle',()=>{
                    if(!roster.open||roster.childElementCount>1)return;
                    const names=node('ul');
                    for(const lead of entry.profileLeads.filter(person=>person.observedOn===page.url)){
                      const person=node('li');
                      append(person,observedProfileLink(lead.name+' ↗',lead.url,[page.id]),node('span',' · '+lead.directoryLabel,'field-help'));
                      names.append(person);
                    }
                    append(roster,names,verifiedLink('打开官网第 '+(index+1)+' 页 ↗',L.sourceUrl(C,page)));
                  });
                  pending.append(roster);
                });
              });
            }
            section.append(pending);
          }
        });}
        else if(!supportUnit)section.append(node('p','还需要从这个单位继续找完整师资目录，再逐个打开教师主页。','field-help'));
        if(unit.sourceIds.length)section.append(evidence(unit.sourceIds));list.append(section);
      });
      append(school,list,evidence(row.sourceIds));target.append(school);
    });
    target.append(node('p','也可以从下方师资目录直接查看老师。','evidence-note'));
  }
  function renderFunding() { const items=L.fundingFor(C,state.profile);$('funding-results').hidden=!items.length;clear($('funding-cards'));items.forEach(f=>{const box=node('article',null,'funding-card');append(box,node('h3',f.title),node('p',f.note||'资格和资助结果以官方审核为准，不是自动获奖。'));box.append(deadlineCard({label:'相关申请日期',at:f.deadline,cycle:f.cycle},state.profile.cycle));box.append(evidence(f.sourceIds));$('funding-cards').append(box);}); }
  function renderResults() {
    const target=$('results');clear(target);resultCards=[];resultBookmarkButtons.clear();const items=mode==='programs'?L.programsFor(C,state.profile):mode==='directories'?L.directoriesFor(C,state.profile):L.facultyFor(C,state.profile);
    $('result-count').textContent=mode==='faculty'?'找到 '+items.length+' 位老师（已整理研究方向）':items.length+(mode==='directories'?' 个目录':' 条项目路线');$('results-jump').textContent='查看筛选结果（'+items.length+'）';
    $('filter-note').textContent=mode==='programs'?'按学校、学位和入学轮次查看项目，再把材料和日期加入清单。':mode==='directories'?'选学院，再打开相关院系和师资目录。':'按研究词找老师，打开主页了解近期工作，再加入自己的清单。';
    const preparation=L.preparationNote(state.profile);$('preparation-note').textContent=preparation;$('preparation-note').hidden=!preparation||mode!=='programs';
    const shown=mode==='faculty'?items.slice(0,facultyLimit):items;shown.forEach(item=>{const card=mode==='programs'?programCard(item):mode==='directories'?directoryCard(item):facultyCard(item,true);resultCards.push(card);target.append(card);});
    $('show-more-faculty').hidden=mode!=='faculty'||shown.length>=items.length;$('show-more-faculty').textContent='再看一些老师（已显示 '+shown.length+' / '+items.length+'）';
    if(!items.length)empty(target,'这组条件下暂时没有已核到的资料。','可以清除部分筛选，或查看院系目录。未收录不等于没有项目、没有导师或不招生。');renderAcademicCoverage();renderFunding();
  }
  function chooseMode(value) { mode=value;facultyLimit=24;[['show-programs','programs'],['show-faculty','faculty'],['show-directories','directories']].forEach(([id,target])=>$(id).setAttribute('aria-pressed',String(mode===target)));renderResults(); }
  let subjectLimit=12,coverageTarget=null,coverageGroupTarget=null,coverageTargetElement=null;
  const subjectOptions=L.researchOptions(C);
  function renderSubjectOptions() {
    const results=L.searchResearchOptions(subjectOptions,$('subject-search').value,$('subject-kind').value),target=$('subject-options');clear(target);
    $('subject-scope').textContent='可输入中文关键词或官网英文名，也可切换查看范围。';
    $('subject-count').textContent=results.length?'找到 '+results.length+' 项，当前显示 '+Math.min(subjectLimit,results.length)+' 项。':'没有找到。试试专业英文名，或切换到“学院、院系与相关学科”继续查找。';
    results.slice(0,subjectLimit).forEach(item=>{const action=button(item.label,()=>{
      if(item.kind==='unit'){
        state.profile.universityIds=[item.universityId];state.profile.interests=[];state.profile.researchQuery='';coverageTarget=item.unitId;coverageGroupTarget=item.groupTitle||null;populateProfile();chooseMode('directories');showView('explore');coverageTargetElement?.focus();
      }else if(item.kind==='category'){
        state.profile.universityIds=[];state.profile.interests=[item.value];state.profile.researchQuery='';populateProfile();chooseMode('faculty');
      }else{
        if(item.value.length>160){notify('这条原文较长，请在上方输入其中的核心研究词；原文仍完整保留。');return;}
        state.profile.universityIds=[];state.profile.interests=[];state.profile.researchQuery=item.value;populateProfile();chooseMode('faculty');
      }
    },'subject-option');action.setAttribute('aria-label',(item.kind==='unit'?'看院系：':item.kind==='category'?'按方向查老师：':'用研究词查老师：')+item.label);append(target,action,node('span',item.kind==='unit'?(item.scopeLabel||'学院与院系目录'):item.kind==='category'?'方向分类':'教师研究原词','subject-kind'));});
    $('subject-more').hidden=results.length<=subjectLimit;
  }
  $('subject-search').addEventListener('input',()=>{subjectLimit=12;renderSubjectOptions();});
  $('subject-search').addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
  $('subject-kind').addEventListener('change',()=>{subjectLimit=12;renderSubjectOptions();});
  $('subject-more').addEventListener('click',()=>{subjectLimit+=24;renderSubjectOptions();});
  renderSubjectOptions();
  function updateInterestSummary() { $('interest-summary').textContent=state.profile.interests.length?'按方向再筛选 · 已选 '+state.profile.interests.length+' 项':'按方向再筛选（选填）'; }
  function readProfile() { state.profile={degree:new FormData($('profile-form')).get('degree'),cycle:$('intake-cycle').value,universityIds:[...document.querySelectorAll('[name=university]:checked')].map(x=>x.value),interests:[...document.querySelectorAll('[name=interest]:checked')].map(x=>x.value),researchQuery:$('research-query').value,education:$('education').value,english:$('english').value,gpaNote:$('gpa-note').value};updateInterestSummary(); }
  function populateProfile() { document.querySelectorAll('[name=degree]').forEach(x=>{x.checked=x.value===state.profile.degree;});document.querySelectorAll('[name=university]').forEach(x=>{x.checked=state.profile.universityIds.includes(x.value);});document.querySelectorAll('[name=interest]').forEach(x=>{x.checked=state.profile.interests.includes(x.value);});$('intake-cycle').value=state.profile.cycle||'';$('research-query').value=state.profile.researchQuery||'';$('education').value=state.profile.education;$('english').value=state.profile.english;$('gpa-note').value=state.profile.gpaNote;updateInterestSummary(); }
  function buildFilters() { $('intake-cycle').append(new Option(L.cycleLabel(''),''));L.cyclesFor(C).forEach(cycle=>$('intake-cycle').append(new Option(L.cycleLabel(cycle),cycle)));C.universities.forEach(u=>{const label=node('label',null,'check-label'),input=node('input');input.type='checkbox';input.name='university';input.value=u.id;append(label,input,node('span',u.short||u.name),node('span',u.region,'campus-label'));$('university-filters').append(label);});L.INTERESTS.forEach(tag=>{const label=node('label',null,'interest-label'),input=node('input');input.type='checkbox';input.name='interest';input.value=tag;append(label,input,node('span',tag));$('interest-filters').append(label);});populateProfile(); }
  function renderShortlist() {
    const saved=$('saved-faculty');clear(saved);state.shortlist.forEach(id=>{const f=C.faculty.find(x=>x.id===id);if(f)saved.append(facultyCard(f));});if(!state.shortlist.length)empty(saved,'先留下一两位想了解的老师。','在“找学校和导师”里选择“找相关老师”，读过研究说明和来源后再收藏。这里不会替你发邮件。');
    const tasks=$('tasks');clear(tasks);state.tasks.forEach(t=>{const li=node('li'),label=node('label'),input=node('input');input.type='checkbox';input.checked=t.done;const span=node('span',t.text,t.done?'done':'');input.addEventListener('change',()=>{t.done=input.checked;persist(false);renderShortlist();});append(label,input,span);append(li,label,button('移除',()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);persist(false);renderShortlist();},'remove-button'));tasks.append(li);});if(!state.tasks.length)tasks.append(node('li','还没有待办。可以从项目卡片加入，或写一件自己的小事。','field-help'));
    const history=$('catalog-history');clear(history);const versions=state.catalogHistory||[];$('catalog-history-panel').hidden=!versions.length;versions.forEach(entry=>history.append(node('li','核查日期：'+(entry.checkedDate||'未知')+' · '+(entry.snapshotId?entry.snapshotId:'当时未注明资料摘要'))));
  }
  const sourcePageSize=36;
  let sourceIndex,sourceMatches=[],sourcesShown=0;
  const sourceKind=s=>s.evidenceLevel==='official_entry_access_failed'?'官方入口（未读到正文）':s.evidenceLevel==='teacher_page_linked_from_official_profile'?'教师个人网站（院系提供链接）':'官方资料';
  const sourceSearchKey=text=>text.normalize('NFKC').toLowerCase();
  function appendSourcePage(focusFirst=false) {
    const list=$('source-list'),page=sourceMatches.slice(sourcesShown,sourcesShown+sourcePageSize);
    let firstTitle;
    page.forEach(s=>{
      const card=node('article',null,'source-card'),title=node('h2',s.title),claims=node('ul');
      if(!firstTitle)firstTitle=title;
      append(card,node('p',sourceKind(s)+' · 核查 '+(s.checkedAt||'日期未知'),'source-meta'),title,node('p','适用范围：'+(s.scope||'待核实')));
      (s.claims||[]).forEach(text=>claims.append(node('li',text)));
      card.append(claims);
      (s.knownIssues||[]).forEach(text=>card.append(node('p','待留意：'+text,'evidence-note')));
      card.append(verifiedLink('打开原始来源 ↗',L.sourceUrl(C,s)));
      list.append(card);
    });
    sourcesShown+=page.length;
    $('source-count').textContent=sourceMatches.length?'显示 '+sourcesShown+' / '+sourceMatches.length+' 条来源':'没有匹配的来源。试试学校、项目或老师的名称。';
    $('show-more-sources').hidden=sourcesShown>=sourceMatches.length;
    if(focusFirst&&firstTitle){firstTitle.setAttribute('tabindex','-1');firstTitle.focus();}
  }
  function filterSources() {
    if(!sourceIndex)sourceIndex=C.sources.map(s=>[s,sourceSearchKey([s.title,s.scope,s.url,s.checkedAt,sourceKind(s),...(s.claims||[])].filter(Boolean).join(' '))]);
    const terms=sourceSearchKey($('source-query').value).trim().split(/[\s,，]+/).filter(Boolean);
    sourceMatches=sourceIndex.filter(([,key])=>terms.every(term=>key.includes(term))).map(([source])=>source);
    sourcesShown=0;clear($('source-list'));appendSourcePage();
  }
  function showView(name) { if(!['explore','shortlist','sources','community'].includes(name))name='explore';document.querySelectorAll('.view').forEach(view=>{view.hidden=view.id!=='view-'+name;});document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(name==='shortlist')renderShortlist();if(name==='sources'&&!sourceIndex)filterSources();history.replaceState(null,'','#'+name); }
  function renderCommunityPrograms() { const universityId=$('community-university').value;clear($('community-program'));$('community-program').append(new Option('请选择项目',''));C.programs.filter(p=>p.universityId===universityId).forEach(p=>$('community-program').append(new Option(p.name+' · '+L.applicationDegrees(C,p).join('/'),p.id))); }
  buildFilters();chooseMode(state.profile.researchQuery.trim()?'faculty':'programs');renderShortlist();
  $('data-stamp').replaceChildren(node('strong','资料更新 · '+(C.checkedDate||'日期待更新')),node('span','申请前可打开项目官网确认最新安排'));
  $('faculty-coverage').textContent='先查项目要求，再比较老师的研究方向。想按专业查找时，展开左侧的“搜索专业、院系和研究方向”。';
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('source-query').addEventListener('input',filterSources);
  $('show-more-sources').addEventListener('click',()=>appendSourcePage(true));
  $('profile-form').addEventListener('input',event=>{readProfile();facultyLimit=24;if(event.target.id==='research-query')chooseMode('faculty');else renderResults();});$('profile-form').addEventListener('submit',event=>{event.preventDefault();readProfile();if(persist(true))notify('已保存在这个浏览器中。备份到文件后，才能换设备恢复。');});
  [['show-programs','programs'],['show-faculty','faculty'],['show-directories','directories']].forEach(([id,value])=>$(id).addEventListener('click',()=>chooseMode(value)));
  $('show-more-faculty').addEventListener('click',()=>{const previous=facultyLimit;facultyLimit+=24;renderResults();if(resultCards[previous])resultCards[previous].focus();});
  $('clear-filters').addEventListener('click',()=>{state.profile.universityIds=[];state.profile.interests=[];state.profile.researchQuery='';facultyLimit=24;populateProfile();renderResults();notify('已清除学校和方向筛选，学位、入学轮次及保存的清单保留。');});
  $('task-form').addEventListener('submit',event=>{event.preventDefault();const text=$('task-text').value.trim();if(!text)return;if(state.tasks.length>=200){notify('待办已到 200 条，请先整理现有清单。',true);return;}state.tasks.push({id:'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),text,done:false,programId:null,facultyId:null});persist(false);$('task-text').value='';renderShortlist();});
  $('export-local').addEventListener('click',()=>{try{download('研向-完整备份.json',L.portable(C,{...state,sourceIds:sourceIdsForState()}));notify('已请求浏览器保存备份，请核对文件是否实际保存。');}catch(e){notify(e.message,true);}});
  let importSequence=0;
  $('import-local').addEventListener('change',async event=>{const sequence=++importSequence,file=event.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('备份超过 1 MiB，请保留原文件。');const next=L.parsePortable(await file.text(),C),prepared=L.portable(C,next);if(sequence!==importSequence)return;localStorage.setItem(KEY,JSON.stringify(prepared));state=prepared;savedProfile=structuredClone(prepared.profile);populateProfile();if(state.profile.researchQuery.trim())chooseMode('faculty');else renderResults();renderShortlist();notify(next.catalogSnapshotId&&next.catalogSnapshotId===C.snapshotId?'已载入完整备份。原文件没有修改，来源编号也已核对。':'已载入你的清单，并保留旧资料版本信息。页面显示当前资料，请重新核对政策。');}catch(e){if(sequence===importSequence)notify('没有替换当前清单：'+e.message,true);}finally{if(sequence===importSequence)event.target.value='';}});
  $('reset-local').addEventListener('click',()=>{try{localStorage.removeItem(KEY);state={profile:L.defaultProfile(C),shortlist:[],tasks:[],sourceIds:[]};savedProfile=L.defaultProfile(C);populateProfile();renderResults();renderShortlist();notify('已清空这个浏览器的记录。你下载的文件不会被删除。');}catch(e){notify('本机记录暂时无法清空：'+e.message,true);}});
  $('community-university').append(new Option('请选择学校 / 校区',''));C.universities.forEach(u=>$('community-university').append(new Option(u.name+' · '+u.region,u.id)));$('community-university').addEventListener('change',renderCommunityPrograms);renderCommunityPrograms();$('community-cycle').value=C.cycle||'';
  $('community-form').addEventListener('submit',event=>{event.preventDefault();if(!$('community-consent').checked)return;const uid=$('community-university').value,pid=$('community-program').value;if(!C.programs.some(p=>p.id===pid&&p.universityId===uid)){notify('请先选对应学校的项目。',true);return;}const draft={kind:'anonymous-community-draft',schemaVersion:1,publiclySubmitted:false,consentToLocalExport:true,universityId:uid,programId:pid,cycle:$('community-cycle').value.trim(),outcome:$('community-outcome').value,notes:$('community-notes').value.trim(),scope:'个人匿名经历草稿，非官方要求，不用于计算录取率。'};download('研向-匿名经历草稿.json',draft);notify('已发起草稿下载，可在浏览器下载列表中查看。');});
  showView(location.hash.slice(1));
  $('explore-workspace').hidden=false;
  $('faculty-coverage').hidden=false;
  const quickProjects=$('startup-projects');
  if(!quickProjects.contains?.(document.activeElement))quickProjects.hidden=true;
}());
