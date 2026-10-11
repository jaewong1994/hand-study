/* Outlines from the installed print font. Korean annotations stay native text. */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg';
function apply(root){
 const data=window.HandFigureGlyphs;if(!data)return;
 for(const text of root.querySelectorAll('svg text:not([data-figure-native])')){
  const value=text.textContent;if(!value)continue;
  const doc=text.ownerDocument,make=(name,attrs)=>{const e=doc.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,v);return e;};
  const x=Number(text.getAttribute('x')||0),y=Number(text.getAttribute('y')||0),size=Number(text.getAttribute('font-size')||14)*1.22,scale=size/data.units;
  const group=make('g',{'data-figure-label':value,'data-font-sha256':data.sha256,role:'img','aria-label':value,fill:text.getAttribute('fill')||'#30486d'});
  const title=make('title');title.textContent=value;group.append(title);
  let cursor=0,run='';
  function flush(){if(!run)return;const t=make('text',{x:x+cursor,y,'font-size':size,'font-family':'"Noto Serif KR", "Batang", serif','data-figure-native':'true','aria-hidden':'true'});t.textContent=run;group.append(t);cursor+=Array.from(run).reduce((n,c)=>n+(c===' '?size*.3:size),0);run='';}
  const roman=new Set();for(const match of value.matchAll(/(?:sin|cos|tan|log|ln)(?=[( α-ωa-z0-9]|$)/g))for(let i=match.index;i<match.index+match[0].length;i++)roman.add(i);
  let pos=0;
  for(const ch of value){const g=data.glyphs[ch+':'+(roman.has(pos)?'rm':'it')];pos+=ch.length;
   if(!g){run+=ch;continue;}flush();
   if(g.d){const p=make('path',{d:g.d,transform:`translate(${x+cursor} ${y}) scale(${scale} ${-scale})`,'data-codepoint':g.cp,'aria-hidden':'true'});group.append(p);}cursor+=g.advance*scale;
  }flush();
  // Keep the white halo without changing the actual glyph outlines.
  group.setAttribute('paint-order','stroke');group.setAttribute('stroke','white');group.setAttribute('stroke-width','.55');group.setAttribute('stroke-linejoin','round');
  for(const p of group.querySelectorAll('path'))p.setAttribute('vector-effect','non-scaling-stroke');
  group.dataset.anchorX=text.dataset.anchorX||x;group.dataset.anchorY=text.dataset.anchorY||y;
  text.replaceWith(group);
 }
 requestAnimationFrame(()=>{for(const svg of root.querySelectorAll('svg'))arrange(svg);});
}
function arrange(svg){
 const engine=window.NGD2FigureLabelLayout;if(!engine||!svg.isConnected)return;
 if(svg.dataset.figureArranged)return;svg.dataset.figureArranged='true';
 const elements=[...svg.querySelectorAll('[data-figure-label]')];if(!elements.length||elements.length>64)return;
 const labels=elements.map((el,i)=>{const b=el.getBBox(),annotation=/[가-힣]/.test(el.dataset.figureLabel);return{id:String(i),targetId:'anchor-'+i,anchor:annotation?{x:b.x+b.width/2,y:b.y+b.height/2}:{x:Number(el.dataset.anchorX),y:Number(el.dataset.anchorY)},box:{x:b.x,y:b.y,width:b.width,height:b.height}};}).filter(l=>l.box.width>0&&l.box.height>0);
 const obstacles=[];
 for(const [i,el]of [...svg.querySelectorAll('polyline,polygon,line,circle')].entries()){
  if(el.closest('[data-figure-label]'))continue;
  const id='shape-'+i,strokeWidth=Number(el.getAttribute('stroke-width')||1);
  if(el.tagName==='circle'){const x=Number(el.getAttribute('cx')),y=Number(el.getAttribute('cy')),r=Number(el.getAttribute('r'));obstacles.push({id,type:'rect',box:{x:x-r,y:y-r,width:r*2,height:r*2},strokeWidth});}
  else{let points;if(el.tagName==='line')points=[{x:Number(el.getAttribute('x1')),y:Number(el.getAttribute('y1'))},{x:Number(el.getAttribute('x2')),y:Number(el.getAttribute('y2'))}];else{points=Array.from(el.points,p=>({x:p.x,y:p.y}));if(el.tagName==='polygon'&&points.length)points.push(points[0]);}if(points.length>=2)obstacles.push({id,type:'polyline',points,strokeWidth});}
 }
 const v=svg.viewBox.baseVal,baseHeight=v.height;let footerY=baseHeight+10;
 // Long prose is a diagram annotation, not a point label. Give it a clear footer.
 for(const l of labels){const el=elements[Number(l.id)];if(!/[가-힣]/.test(el.dataset.figureLabel)||el.dataset.figureLabel.length<9)continue;
  const dy=footerY-l.box.y;l.box.y+=dy;l.anchor={x:l.box.x+l.box.width/2,y:l.box.y+l.box.height/2};el.dataset.footerDy=dy;el.dataset.figureFooter='true';el.setAttribute('transform',`translate(0 ${dy})`);svg.append(el);footerY+=l.box.height+10;
 }
 if(footerY>baseHeight+10)svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.width} ${footerY}`);
 const scene={mode:'new_authoring',viewport:{x:v.x,y:v.y,width:v.width,height:v.height},labels,obstacles,clearance:2,margin:5,maxMove:28};
 const result=engine.layout(scene);svg.dataset.labelLayout=result.status;
 svg.dataset.layoutAudit=JSON.stringify({labels,result});
 if(result.status==='placed')for(const p of result.placements){const l=labels.find(l=>l.id===p.id),el=elements[Number(p.id)];el.setAttribute('transform',`translate(${p.box.x-l.box.x} ${p.box.y-l.box.y+Number(el.dataset.footerDy||0)})`);}
 svg.dataset.labelIssues=String(result.after?.issues?.length??result.before?.issues?.length??0);svg.dataset.labelReason=result.reason||'';
}
window.HandFigureType=Object.freeze({apply});
})();
