(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APP_LOGIC = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INTERESTS = ['人工智能','机器学习','计算机视觉','自然语言处理','机器人与控制','数据挖掘','网络与系统','理论与优化','数学与统计','金融与精算','生物医学与健康','软件工程与编程语言','网络安全','人机交互','数据库与数据系统','计算机图形学','计算机音乐与音频','环境与可持续发展','物理与化学','材料与能源','土木与机械工程','经济与管理','人文与社会科学','教育学','设计与创意','旅游与酒店管理','电子与集成电路'];
  const KEYWORDS = [
    /人工智能|artificial intelligence|(?:^|\W)ai(?:$|\W)|ai4science/i,
    /机器学习|深度学习|machine learning|deep learning|distributed learning|reinforcement learning/i,
    /计算机视觉|视觉|computer vision|image|vision/i,
    /自然语言|语言处理|natural language|(?:^|\W)nlp(?:$|\W)|speech|language model/i,
    /机器人|控制|robot|control|autonomous|multi.agent|cyber.physical/i,
    /数据挖掘|data mining|data science|analytics|recommendation/i,
    /网络|系统|network|systems|computing|security|internet|iot/i,
    /理论|优化|theory|optimization|game|mathematics/i,
    /数学|统计|math|statistic/i,
    /金融|精算|financ|fintech|actuari/i,
    /生物医学|健康|biomed|health/i,
    /软件工程|编程语言|software engineering|programming languages/i,
    /网络安全|cybersecurity|security|cryptograph/i,
    /人机交互|human.computer|human.ai interaction/i,
    /数据库|数据系统|database|data systems/i,
    /计算机图形学|computer graphics/i,
    /计算机音乐|音频|computer music|audio/i,
    /环境|可持续|environment|sustainab|climate/i,
    /物理|化学|physics|chemistry/i,
    /材料|能源|materials|energy/i,
    /土木|机械工程|civil engineering|mechanical engineering/i,
    /经济|管理|economics|management/i,
    /人文|社会科学|humanities|social sciences/i,
    /教育|education/i,
    /设计|创意|design|creative/i,
    /旅游|酒店|tourism|hospitality/i,
    /集成电路|微电子|半导体|芯片|integrated circuit|microelectronic|semiconductor|vlsi|photonic|electronic design automation/i
  ];
  const OFFICIAL_HOSTS = ['hku.hk','cuhk.edu.hk','hkust.edu.hk','ust.hk','polyu.edu.hk','cityu.edu.hk','cuhk.edu.cn','hkust-gz.edu.cn','ugc.edu.hk','rgc.edu.hk'];
  const EDUCATION = ['','undergraduate','bachelor','master','other'];
  const ENGLISH = ['','planning','scheduled','available','exemption'];
  const RESEARCH_ALIASES = [
    ['多模态','multimodal','multi-modal'],['多模态大模型','multimodal large language models','multimodal language models'],
    ['人工智能','artificial intelligence','ai'],['自动化','automation'],
    ['机器人','robot','robotics'],['控制','control'],['网络化控制','networked control'],['智能控制','intelligent control'],
    ['自适应控制','adaptive control'],['强化学习','reinforcement learning'],['多智能体','multi-agent','multiagent'],
    ['具身智能','embodied ai','embodied intelligence'],['无人机','uav','unmanned aerial vehicle'],
    ['机器学习','machine learning'],['深度学习','deep learning'],['迁移学习','transfer learning'],
    ['图机器学习','graph machine learning'],['推荐系统','recommendation','recommender systems'],
    ['计算机视觉','computer vision'],['三维重建','3d reconstruction'],['自然语言处理','natural language processing','nlp'],
    ['大语言模型','large language models','large language model','llm','llms'],['数据挖掘','data mining'],
    ['分布式系统','distributed systems'],['分布式机器学习','distributed machine learning'],['优化','optimization'],
    ['统计','统计学','statistics','statistical'],['概率','概率论','probability'],['贝叶斯','bayesian'],
    ['因果推断','causal inference'],['时间序列','time series'],['随机矩阵','random matrices','random matrix theory'],
    ['金融科技','financial technology','fintech'],['量化金融','quantitative finance'],['金融工程','financial engineering'],
    ['风险管理','risk management'],['生存分析','survival analysis'],['精准医疗','precision medicine'],
    ['软件工程','software engineering'],['编程语言','programming languages'],['程序分析','program analysis'],
    ['人机交互','human-computer interaction','human computer interaction'],['可视化','visualization'],
    ['数据库','database','databases'],['网络安全','cybersecurity','network security'],
    ['密码学','cryptography'],['差分隐私','differential privacy'],['计算机图形学','computer graphics'],
    ['可持续发展','可持续性','sustainability','sustainable development'],['气候变化','climate change'],
    ['空气污染','air pollution'],['环境工程','environmental engineering'],['可再生能源','renewable energy'],
    ['旅游','tourism'],['酒店管理','hospitality management','hotel management'],['旅游经济学','tourism economics'],
    ['消费者行为','consumer behavior','consumer behaviour'],['目的地营销','destination marketing'],
    ['设计','design'],['教育','education'],['公共政策','public policy'],
    ['计算机音乐','computer music'],['音频工程','audio engineering'],
    ['集成电路','integrated circuits','integrated circuit','ic design'],['微电子','microelectronics','microelectronic'],
    ['电子设计自动化','electronic design automation','eda'],['硬件安全','hardware security'],
    ['芯片设计','chip design','vlsi design'],['半导体','semiconductor','semiconductors'],
    ['光子集成电路','photonic integrated circuits'],['光子计算','photonic computing'],
    ['大气化学','atmospheric chemistry'],['空气质量','air quality'],['储能','energy storage'],
    ['固态电池','solid-state batteries','solid state batteries'],['钙钛矿','perovskite','perovskites']
  ];
  function officialUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && OFFICIAL_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.'+h)) ? url.href : null; }
    catch (_) { return null; }
  }
  function defaultProfile(catalog) { return {degree:'MPhil',cycle:catalog?catalog.cycle:'',universityIds:[],interests:[],researchQuery:'',education:'',english:'',gpaNote:''}; }
  function publicHttps(value) {
    try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:null;}catch(_){return null;}
  }
  function sourceUrl(catalog,source) {
    const official=officialUrl(source.url);if(official)return official;
    if(source.evidenceLevel!=='teacher_page_linked_from_official_profile')return null;
    const parent=catalog.sources.find(s=>s.id===source.parentSourceId);
    return parent&&officialUrl(parent.url)&&(parent.discoveredLinks||[]).includes(source.url)?publicHttps(source.url):null;
  }
  function facultyLinks(catalog,faculty) {
    return (faculty.extraLinks||[]).flatMap(item=>{
      const parent=catalog.sources.find(s=>s.id===item.parentSourceId);
      const url=publicHttps(item.url);
      if(!url||!parent||!officialUrl(parent.url)||parent.url!==faculty.profileUrl||
        !faculty.sourceIds.includes(parent.id)||!(parent.discoveredLinks||[]).includes(item.url))return [];
      return [{...item,url}];
    });
  }
  function cyclesFor(catalog) { return [...new Set([catalog.cycle,...catalog.programs.flatMap(p=>[p.cycle,...(p.deadlines||[]).map(d=>d.cycle)])].filter(Boolean))]; }
  function cycleLabel(value) { const spring=/^(\d{4}\/\d{2}) Spring$/.exec(value||'');return !value?'先看全部已核轮次':spring?(Number(spring[1].slice(0,4))+1)+'年春季（'+spring[1]+'学年）':value+'学年'; }
  function matchedTopics(faculty, interests) {
    return interests.filter(tag => INTERESTS.includes(tag) && (faculty.topics||[]).some(topic=>
      INTERESTS.includes(topic)?topic===tag:KEYWORDS[INTERESTS.indexOf(tag)].test(topic)));
  }
  function programsFor(catalog, profile) {
    return catalog.programs.filter(p => (p.degrees || []).includes(profile.degree) &&
      (!profile.universityIds.length || profile.universityIds.includes(p.universityId)) &&
      (!profile.cycle || p.cycle===profile.cycle || (p.deadlines||[]).some(d=>d.cycle===profile.cycle&&(!d.degree||d.degree===profile.degree))));
  }
  function facultyFor(catalog, profile) {
    return catalog.faculty.filter(f => (!profile.universityIds.length || profile.universityIds.includes(f.universityId)) &&
      (!profile.interests.length || matchedTopics(f, profile.interests).length) &&
      (!profile.researchQuery?.trim() || matchedResearchTerms(f,profile.researchQuery).length));
  }
  function matchedResearchTerms(faculty,query) {
    if(typeof query!=='string'||!query.trim())return [];
    const normalize=text=>text.normalize('NFKC').toLocaleLowerCase('en-US').trim();
    const queries=[...new Set(query.split(/[,，、;；\n]+/).map(normalize).filter(Boolean))];
    const terms=faculty.researchKeywords?.length?faculty.researchKeywords:(faculty.topics||[]);
    const includes=(term,needle)=>{
      if(/^[a-z0-9\s+.\-]+$/i.test(needle)){
        const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
        return new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(term);
      }
      return term.includes(needle);
    };
    return terms.filter(term=>queries.some(q=>{const aliases=RESEARCH_ALIASES.find(group=>group.includes(q))||[q];return aliases.some(alias=>includes(normalize(term),alias));}));
  }
  function directoriesFor(catalog,profile) { return (catalog.directories||[]).filter(d=>!profile.universityIds.length||profile.universityIds.includes(d.universityId)); }
  function reviewedForDirectory(catalog,directory) { return catalog.faculty.filter(f=>(f.directorySourceIds||[]).some(id=>directory.sourceIds.includes(id))).length; }
  function requirementsFor(program, profile) {
    return (program.requirements||[]).filter(item=>!item.degrees||item.degrees.includes(profile.degree));
  }
  function financesFor(program, profile) {
    return (program.finances||[]).filter(item=>!item.degrees||item.degrees.includes(profile.degree));
  }
  function financeRates(item, profile) {
    const year=/^\d{4}\/\d{2}/.exec(profile.cycle||'')?.[0];
    const matches=rate=>!!profile.cycle&&((rate.basis==='intake'&&rate.cycle===profile.cycle)||(rate.basis==='academic_year'&&rate.cycle===year));
    return {matched:(item.rates||[]).filter(matches),reference:(item.rates||[]).filter(rate=>!matches(rate))};
  }
  function financeRateText(rate) {
    const units={academic_year:'学年',year:'年',month:'月',application:'次申请'};
    const scope=rate.basis==='intake'?cycleLabel(rate.cycle)+'入学':rate.basis==='academic_year'?rate.cycle+'学年':'当前网页参考 · 未注明轮次';
    return rate.currency+' '+new Intl.NumberFormat('en-US').format(rate.value)+' / '+units[rate.unit]+' · '+scope+' · '+rate.condition;
  }
  function preparationNote(profile) {
    const parts=[];
    if(profile.education==='undergraduate')parts.push('本科在读可以先整理在读证明、现有成绩单和预计毕业时间；是否接受申请及何时补最终证明，要看具体项目。');
    if(profile.degree==='PhD'&&['undergraduate','bachelor'].includes(profile.education))parts.push('想从本科申请博士，先看本项目是否有相应学历路径；这里不会替学校认定同等资格。');
    if(['planning','scheduled'].includes(profile.english))parts.push('报名或考试前，先核对项目接受的考试形式、单项要求和有效期。已预约不等于可以在截止后补交。');
    if(profile.english==='available')parts.push('已有成绩也要核对考试日期、形式、单项及正式送分要求；本页没有判定成绩是否达标。');
    if(profile.english==='exemption')parts.push('准备走英语授课学历等替代路径时，先核对项目接受哪种证明，再向学校确认。');
    return parts.join(' ');
  }
  function deadlineState(deadline, selectedCycle, now) {
    if (deadline.cycle && selectedCycle && deadline.cycle !== selectedCycle) return {code:'out_of_scope',text:'其他入学轮次，不适用本次筛选'};
    const value=deadline.at || deadline.date;
    if (!value) return {code:'unknown',text:'时间待核实，不能据此判断申请开放'};
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T.*(?:Z|[+-]\d\d:\d\d))?$/.test(value)) return {code:'unknown',text:'日期格式待核实'};
    const current = now === undefined ? Date.now() : +new Date(now);
    if (/^\d{4}-\d\d-\d\d$/.test(value)) {
      if (!Number.isFinite(current)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) return {code:'unknown',text:'日期待核实'};
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(current);
      const pick=kind=>parts.find(part=>part.type===kind).value;
      const today=pick('year')+'-'+pick('month')+'-'+pick('day');
      return value<today ? {code:'expired',text:'这个日期已过，请查下一轮安排'} : {code:'date_only',text:'官网只写了日期，具体几点截止还需核对'};
    }
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp) || !Number.isFinite(current)) return {code:'unknown',text:'时间待核实'};
    return stamp < current ? {code:'expired',text:'这个日期已过，请查下一轮安排'} : {code:'dated',text:'官方页面列出此日期；开放状态仍请核对原页'};
  }
  function isHongKongUniversity(university) {
    const identity = [university.id,university.name,university.short,university.en,university.region].join(' ');
    if (/深圳|广州|shenzhen|guangzhou|hkust.?gz|cuhk.?sz/i.test(identity)) return false;
    return /香港|hong kong/i.test(identity) && /hku|cuhk|hkust|polyu|cityu|香港大學|香港大学|香港中文|香港科技|香港理工|香港城市/i.test(identity);
  }
  function fundingFor(catalog, profile) {
    if (profile.degree !== 'PhD') return [];
    const ids = catalog.universities.filter(u => isHongKongUniversity(u) &&
      (!profile.universityIds.length || profile.universityIds.includes(u.id))).map(u=>u.id);
    return (catalog.funding || []).filter(f => f.degree === 'PhD' && (!profile.cycle||f.cycle===profile.cycle) && (f.universities || []).some(id=>ids.includes(id)));
  }
  function deadlinesFor(program, profile, university) {
    return (program.deadlines||[]).filter(d=>(!d.degree || d.degree===profile.degree) && (!profile.cycle||(d.cycle||program.cycle)===profile.cycle) &&
      (!/hkpfs/i.test([d.route,d.label].join(' ')) || (profile.degree==='PhD' && university && isHongKongUniversity(university))));
  }
  function availabilityText(faculty) {
    const availability=faculty.availability || {};
    return availability.state === 'advertised' ? '页面有招生说明；是否仍有名额，需进一步确认。' : '当前名额未知，不等于不招生。';
  }
  function text(value, max, field) {
    if (typeof value !== 'string' || value.length > max) throw new Error(field+'格式或长度不符合要求。');
    return value;
  }
  function ids(value, allowed, field) {
    if (!Array.isArray(value) || value.length > allowed.length || new Set(value).size !== value.length || value.some(id=>!allowed.includes(id))) throw new Error(field+'中有当前资料不认识的编号，请保留原文件并核对版本。');
    return value.slice();
  }
  function normalizeProfile(value, catalog) {
    if (!value || !['MPhil','PhD'].includes(value.degree) || !EDUCATION.includes(value.education) || !ENGLISH.includes(value.english)) throw new Error('个人选择格式不正确。');
    const cycle=value.cycle===undefined?'':value.cycle;
    if(typeof cycle!=='string'||(cycle!==''&&!cyclesFor(catalog).includes(cycle)))throw new Error('这份备份的入学轮次不在本版目录中，请保留原文件并核对资料版本。');
    return {degree:value.degree,cycle,universityIds:ids(value.universityIds,catalog.universities.map(u=>u.id),'学校清单'),
      interests:ids(value.interests,INTERESTS,'研究方向'),researchQuery:text(value.researchQuery??'',160,'研究关键词'),education:value.education,english:value.english,gpaNote:text(value.gpaNote,2000,'学业备注')};
  }
  function portable(catalog, state) {
    const catalogHistory=validateCatalogHistory(state.catalogHistory);
    if(state.catalogCheckedDate!==undefined&&(state.catalogSnapshotId!==catalog.snapshotId||state.catalogCheckedDate!==catalog.checkedDate)){
      const previous={snapshotId:state.catalogSnapshotId??null,checkedDate:state.catalogCheckedDate};
      if(!catalogHistory.some(entry=>entry.snapshotId===previous.snapshotId&&entry.checkedDate===previous.checkedDate))catalogHistory.push(previous);
    }
    const value={kind:'research-admissions-navigator-local',schemaVersion:3,catalogCheckedDate:catalog.checkedDate,catalogSnapshotId:catalog.snapshotId||null,
      catalogHistory,profile:state.profile,shortlist:state.shortlist,tasks:state.tasks,sourceIds:state.sourceIds || []};
    return validatePortable(value,catalog);
  }
  function validateCatalogHistory(value) {
    if(value===undefined)return [];
    if(!Array.isArray(value)||value.length>256)throw new Error('资料版本历史格式不正确或超过256项，请保留原备份，不要删除历史后硬载入。');
    const seen=new Set();
    return value.map(entry=>{
      if(!entry||!(entry.snapshotId===null||(typeof entry.snapshotId==='string'&&/^sha256:[0-9a-f]{64}$/.test(entry.snapshotId))))throw new Error('资料版本历史的摘要不正确，请保留原备份。');
      const checkedDate=text(entry.checkedDate,30,'资料版本历史日期'),key=JSON.stringify([entry.snapshotId,checkedDate]);
      if(seen.has(key))throw new Error('资料版本历史有重复项，请保留原备份并核对来源。');
      seen.add(key);return {snapshotId:entry.snapshotId,checkedDate};
    });
  }
  function validatePortable(value, catalog) {
    if (!value || value.kind !== 'research-admissions-navigator-local' || ![1,2,3].includes(value.schemaVersion)) throw new Error('这不是当前版本可载入的完整研向备份。若来自更新版本，请用对应版本打开，并保留原文件。');
    if(value.schemaVersion>=2&&!Array.isArray(value.catalogHistory))throw new Error('这份备份缺少资料版本历史，请保留完整原文件。');
    if(value.schemaVersion===3&&typeof value.profile?.researchQuery!=='string')throw new Error('这份备份缺少研究关键词字段，请保留完整原文件。');
    const profile=normalizeProfile(value.profile,catalog), shortlist=ids(value.shortlist,catalog.faculty.map(f=>f.id),'导师清单');
    const sourceIds=ids(value.sourceIds,catalog.sources.map(s=>s.id),'来源清单');
    if (!Array.isArray(value.tasks) || value.tasks.length>200) throw new Error('待办数量或格式不正确。');
    const knownTaskIds=new Set();
    const tasks=value.tasks.map(t=>{
      if (!t || typeof t.id!=='string' || !/^task-[a-z0-9-]{1,80}$/.test(t.id) || knownTaskIds.has(t.id) || typeof t.done!=='boolean') throw new Error('待办编号或完成状态不正确。');
      knownTaskIds.add(t.id);
      if (t.programId!==null && !catalog.programs.some(p=>p.id===t.programId)) throw new Error('待办中的项目编号已不匹配。');
      if (t.facultyId!==null && !catalog.faculty.some(f=>f.id===t.facultyId)) throw new Error('待办中的导师编号已不匹配。');
      return {id:t.id,text:text(t.text,500,'待办'),done:t.done,programId:t.programId,facultyId:t.facultyId};
    });
    const snapshot=value.catalogSnapshotId===undefined?null:value.catalogSnapshotId;
    if(snapshot!==null&&(typeof snapshot!=='string'||!/^sha256:[0-9a-f]{64}$/.test(snapshot)))throw new Error('资料版本编号不正确，请保留原文件。');
    return {kind:value.kind,schemaVersion:value.schemaVersion,catalogCheckedDate:text(value.catalogCheckedDate,30,'资料日期'),catalogSnapshotId:snapshot,catalogHistory:validateCatalogHistory(value.catalogHistory),profile,shortlist,tasks,sourceIds};
  }
  function parsePortable(raw, catalog) {
    if (typeof raw!=='string' || new TextEncoder().encode(raw).length>1024*1024) throw new Error('备份超过 1 MiB，请保留原文件，不要删改后硬载入。');
    let value;try { value=JSON.parse(raw); } catch (_) { throw new Error('JSON 文件不完整或格式有误，请换回完整备份。'); }
    return validatePortable(value,catalog);
  }
  return {INTERESTS,officialUrl,sourceUrl,facultyLinks,defaultProfile,cyclesFor,cycleLabel,matchedTopics,matchedResearchTerms,programsFor,facultyFor,directoriesFor,reviewedForDirectory,requirementsFor,financesFor,financeRates,financeRateText,preparationNote,deadlineState,isHongKongUniversity,fundingFor,deadlinesFor,availabilityText,portable,validatePortable,parsePortable};
}));
