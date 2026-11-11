(function () {
  'use strict';
  const index=window.APP_FACULTY_INDEX, logic=window.APP_LOGIC;
  if(!index || !logic)return;
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
      : '没有匹配的研究关键词，可以试试其他中英文词。';
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
      item.append(' · '+index.schools[school]+' · '+terms.slice(0, 4).join('、'));
      results.append(item);
    }
    shown=results.children.length;
    more.hidden=shown>=matches.length;
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const query=input.value.trim();
    searched=Boolean(query);
    results.replaceChildren();
    matches=[];
    shown=0;
    if(query){
      for(const [name, school, profileUrl, researchKeywords] of index.faculty){
        const terms=logic.matchedResearchTerms({researchKeywords},query);
        if(terms.length)matches.push([name, school, profileUrl, terms]);
      }
    }
    if(query)showStatus();
    else status.textContent='请输入想了解的研究关键词。';
    appendResults();
  });
  more.addEventListener('click',appendResults);
  form.addEventListener('catalog-unavailable',()=>{
    catalogUnavailable=true;
    showStatus();
  });
  form.hidden=false;
}());
