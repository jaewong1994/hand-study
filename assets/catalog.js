(()=>{'use strict';
const HASH=/^[a-f0-9]{64}$/,INTERNAL_HREF=/^items\/\d+-[a-f0-9]{16}\.html$/,EXTERNAL_KEY=/^ebsi:(?:2026:g[12]:\d{2}:q(?:[1-9]|[1-9]\d)|(?:2019|202[0-5]):g1:03:q(?:[1-9]|[1-9]\d)|2026:g3:(?:03|05|07):(?:common|probability-statistics|calculus|geometry):q(?:[1-9]|[1-9]\d))$/,EXTERNAL_HREF=/^external-items\/ebsi-(?:2026-g[12]-\d{2}-q(?:[1-9]|[1-9]\d)|(?:2019|202[0-5])-g1-03-q(?:[1-9]|[1-9]\d)|2026-g3-(?:03|05|07)-(?:common|probability-statistics|calculus|geometry)-q(?:[1-9]|[1-9]\d))-[a-f0-9]{16}\.html$/;
function validRow(r){if(!r||!HASH.test(r.sourceHash||'')||!HASH.test(r.contentHash||''))return false;if(r.sourceKey!=null)return EXTERNAL_KEY.test(r.sourceKey)&&r.itemId==null&&r.dbItemId==null&&EXTERNAL_HREF.test(r.href||'');return Number.isSafeInteger(r.itemId)&&r.itemId>0&&INTERNAL_HREF.test(r.href||'');}
if(typeof module==='object'&&module.exports){module.exports={validRow};return;}
const data=(window.HandStudyCatalog||[]).filter(validRow),get=id=>document.getElementById(id),size=18,SESSION_KEY='hand-study:catalog-view:v2';
let grade='all',page=0;
function option(select,value,label=value){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
[...new Set(data.map(r=>r.adminYear))].sort((a,b)=>b-a).forEach(v=>option(get('year'),String(v),`${v}년`));
[...new Set(data.map(r=>r.track))].sort().forEach(v=>option(get('track'),v));
function safeSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'{}');}catch{return {};}}
function restore(){
 const query=new URLSearchParams(location.search),saved=safeSession();
 const hasQuery=['grade','year','track','page'].some(key=>query.has(key));
 const g=hasQuery?(query.get('grade')||'all'):(saved.grade||'all'),year=hasQuery?(query.get('year')||'all'):(saved.year||'all'),track=hasQuery?(query.get('track')||'all'):(saved.track||'all');
 grade=['all','1','2','3'].includes(g)?g:'all';
 get('year').value=[...get('year').options].some(o=>o.value===year)?year:'all';
 get('track').value=[...get('track').options].some(o=>o.value===track)?track:'all';
 const rawPage=Number(hasQuery?(query.get('page')||1):(saved.page||1));page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage-1:0;
 document.querySelectorAll('[data-grade]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.grade===grade)));
}
function persist(){
 const state={grade,year:get('year').value,track:get('track').value,page:page+1};
 try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(state));}catch{}
 const query=new URLSearchParams();if(grade!=='all')query.set('grade',grade);if(state.year!=='all')query.set('year',state.year);if(state.track!=='all')query.set('track',state.track);if(page)query.set('page',String(page+1));
 const next=location.pathname+(query.size?`?${query}`:'')+location.hash;history.replaceState(null,'',next);
}
function draw(){
 const rows=data.filter(r=>(grade==='all'||String(r.grade)===grade)&&(get('year').value==='all'||String(r.adminYear)===get('year').value)&&(get('track').value==='all'||r.track===get('track').value)).sort((a,b)=>b.adminYear-a.adminYear||b.month-a.month||a.grade-b.grade||a.number-b.number);
 page=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1));const box=get('catalog');box.replaceChildren();get('result-count').textContent=`${rows.length}문항`;get('empty').hidden=!!rows.length;
 for(const r of rows.slice(page*size,(page+1)*size)){
  const a=document.createElement('a');a.className='hs-item';a.href=r.href;
  const source=document.createElement('span');source.className='hs-item-source';source.textContent=`${r.adminYear}년 시행 · ${r.sourceLabel.includes('평가원')?'평가원':'교육청'}`;
  const title=document.createElement('h2');title.textContent=`고${r.grade} ${r.month}월 · ${r.number}번`;
  const meta=document.createElement('span');meta.className='hs-item-meta';meta.textContent=`${r.track} · 4점`;
  const footer=document.createElement('span');footer.className='hs-item-footer';const label=document.createElement('span');label.className='hs-item-state';label.textContent=r.graphStages?`그래프 ${r.graphStages}단계`:'손풀이 학습';const arrow=document.createElement('span');arrow.textContent='펼쳐 보기 →';footer.append(label,arrow);a.append(source,title,meta,footer);box.append(a);
 }
 get('page').textContent=rows.length?`${page+1} / ${Math.ceil(rows.length/size)}`:'0 / 0';get('previous').disabled=page===0;get('next').disabled=(page+1)*size>=rows.length;persist();
}
document.querySelectorAll('[data-grade]').forEach(button=>button.addEventListener('click',()=>{grade=button.dataset.grade;page=0;document.querySelectorAll('[data-grade]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));draw();}));
['year','track'].forEach(id=>get(id).addEventListener('change',()=>{page=0;draw();}));get('previous').onclick=()=>{page--;draw();};get('next').onclick=()=>{page++;draw();};
restore();window.addEventListener('pageshow',draw);draw();
})();
