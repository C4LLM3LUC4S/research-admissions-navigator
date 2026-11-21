(function () {
  'use strict';
  const logic=window.APP_LOGIC;
  if(!logic)return;
  let index, searchSequence=0;
  const form=document.getElementById('startup-search');
  const input=document.getElementById('startup-research-query');
  const status=document.getElementById('startup-search-status');
  const results=document.getElementById('startup-search-results');
  const more=document.getElementById('startup-search-more');
  let matches=[], shown=0, searched=false, catalogUnavailable=false;
  function showStatus() {
    const details=catalogUnavailable?'完整资料暂时无法载入。':'详细资料和清单正在载入。';
    if(!searched)status.textContent=catalogUnavailable?details:'';
    else status.textContent=matches.length
      ? '找到 '+matches.length+' 位老师。'+details
      : '没有找到匹配的老师，可以换个姓名写法或研究词。';
  }
  function appendResults() {
    for(const [name, school, profileUrl, terms] of matches.slice(shown, shown+12)){
      const item=document.createElement('li');
      const url=logic.officialUrl(profileUrl);
      if(url){
        const anchor=document.createElement('a');
        anchor.textContent=name;
        anchor.href=url;
        anchor.target='_blank';
        anchor.rel='noopener noreferrer';
        item.append(anchor);
      }else item.append(name);
      item.append(' · '+index.schools[school]);
      if(terms.length)item.append(' · '+terms.slice(0, 4).join('、'));
      results.append(item);
    }
    shown=results.children.length;
    more.hidden=shown>=matches.length;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const sequence=++searchSequence;
    const query=input.value.trim();
    searched=Boolean(query);
    results.replaceChildren();
    matches=[];
    shown=0;
    more.hidden=true;
    if(query){
      if(!window.APP_LOAD_FACULTY_INDEX && !window.APP_FACULTY_INDEX){
        status.textContent='教师检索正在准备，请稍后再试。';
        return;
      }
      status.textContent='正在读取教师检索资料…';
      try { index=window.APP_FACULTY_INDEX || await window.APP_LOAD_FACULTY_INDEX(); }
      catch(error) {
        if(sequence===searchSequence)status.textContent=error.message;
        return;
      }
      if(sequence!==searchSequence || input.value.trim()!==query)return;
      const search=logic.facultySearch(query);
      for(const [name, school, profileUrl, researchKeywords] of index.faculty){
        const terms=search.matchedTerms({researchKeywords});
        if(terms.length || search.matchesName(name))matches.push([name, school, profileUrl, terms]);
      }
    }
    if(query)showStatus();
    else status.textContent='请输入老师姓名或研究关键词。';
    appendResults();
  });
  more.addEventListener('click',appendResults);
  form.addEventListener('catalog-unavailable',()=>{
    catalogUnavailable=true;
    showStatus();
  });
  form.hidden=false;
}());
