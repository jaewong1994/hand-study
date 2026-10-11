(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HandGraphTimeline=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const COLORS={navy:'#30486d',teal:'#187e83',amber:'#b07328',muted:'#8996a8'};
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e9;
 const safeText=s=>typeof s==='string'&&s.length<=200&&!/[<>\u0000-\u001f]/.test(s);
 function validate(plan,steps){
  if(!plan||plan.version!==1||!safeText(plan.title)||!Array.isArray(plan.bounds)||plan.bounds.length!==4||!plan.bounds.every(finite))throw Error('그래프 범위를 확인해 주세요.');
  const [x0,x1,y0,y1]=plan.bounds;if(!(x1>x0&&y1>y0))throw Error('그래프 축 범위가 올바르지 않습니다.');
  if(plan.aspect!=null&&!['equal','free'].includes(plan.aspect))throw Error('그래프 축척을 확인해 주세요.');
  if(!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>30)throw Error('그래프 단계를 확인해 주세요.');
  const ids=steps.map(s=>s.id);let last=-1,vertices=0;
  for(const stage of plan.stages){
   const index=ids.indexOf(stage.stepId);if(index<0||index<=last||!safeText(stage.title))throw Error('풀이와 그래프의 순서가 일치하지 않습니다.');last=index;
   if(!Array.isArray(stage.layers)||stage.layers.length>160)throw Error('그래프 요소가 너무 많습니다.');
   const seen=new Set();
   for(const l of stage.layers){
    if(!safeText(l.id)||seen.has(l.id)||!Object.hasOwn(COLORS,l.color||'navy'))throw Error('그래프 요소를 확인해 주세요.');seen.add(l.id);
    if(l.type==='polyline'||l.type==='polygon'){
     if(!Array.isArray(l.points)||l.points.length<(l.type==='polygon'?3:2)||l.points.length>1200||l.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))throw Error('그래프 좌표를 확인해 주세요.');
     vertices+=l.points.length;
    }else if(l.type==='point'||l.type==='label'){
     if(!finite(l.x)||!finite(l.y)||(l.text!=null&&!safeText(l.text)))throw Error('그래프 표기를 확인해 주세요.');
    }else throw Error('지원하지 않는 그래프 요소입니다.');
   }
  }
  if(vertices>60000)throw Error('그래프 데이터가 너무 큽니다.');return true;
 }
 function sceneAt(plan,steps,visible){
  const count=Math.max(0,Math.min(steps.length,Math.floor(Number(visible)||0)));let scene=null;
  for(const s of plan.stages){if(steps.findIndex(x=>x.id===s.stepId)<count)scene=s;else break;}return scene;
 }
 function project(bounds,width=640,height=360,pad=38,aspect='equal'){
  const [x0,x1,y0,y1]=bounds,scale=Math.min((width-2*pad)/(x1-x0),(height-2*pad)/(y1-y0));
  if(aspect==='free')return {scale:null,xy:(x,y)=>[pad+(x-x0)*(width-2*pad)/(x1-x0),height-pad-(y-y0)*(height-2*pad)/(y1-y0)]};
  const left=(width-(x1-x0)*scale)/2,top=(height-(y1-y0)*scale)/2;
  return {scale,xy:(x,y)=>[left+(x-x0)*scale,height-top-(y-y0)*scale]};
 }
 let instance=0;
 function mount(root,plan,steps){
  validate(plan,steps);root.replaceChildren();
  const doc=root.ownerDocument,NS='http://www.w3.org/2000/svg',clipId='hs-graph-clip-'+(++instance),map=project(plan.bounds,640,360,38,plan.aspect||'equal');let last=null;
  const make=(name,attrs={})=>{const n=doc.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const svg=make('svg',{viewBox:'0 0 640 360',role:'img',class:'hg-canvas','aria-label':plan.title});
  const defs=make('defs'),clip=make('clipPath',{id:clipId});clip.append(make('rect',{x:4,y:4,width:632,height:352}));defs.append(clip);svg.append(defs);
  const drawing=make('g',{'clip-path':'url(#'+clipId+')'});svg.append(drawing);
  const caption=doc.createElement('figcaption');caption.className='hg-title';root.append(svg,caption);root.hidden=true;
  function setVisible(count){
   const scene=sceneAt(plan,steps,count);root.hidden=!scene;if(scene===last)return;
   const prev=new Map((last?.layers||[]).map(l=>[l.id,JSON.stringify(l)]));last=scene;drawing.replaceChildren();svg.querySelectorAll('[data-figure-footer]').forEach(el=>el.remove());delete svg.dataset.figureArranged;svg.setAttribute('viewBox','0 0 640 360');
   root.dataset.graphStage=scene?.stepId||'';if(!scene){caption.textContent='';return;}
   caption.textContent=scene.title;svg.setAttribute('aria-label',plan.title+' — '+scene.title);
   for(const l of scene.layers){
    const color=COLORS[l.color||'navy'],fresh=prev.get(l.id)!==JSON.stringify(l),group=make('g',{'data-layer-id':l.id});
    if(l.type==='polyline'||l.type==='polygon'){
     const points=l.points.map(p=>map.xy(...p).join(',')).join(' ');
     const shape=make(l.type,{points,stroke:color,'stroke-width':l.color==='muted'?1.3:2.2,'stroke-linecap':'round','stroke-linejoin':'round',fill:l.type==='polygon'?color:'none','fill-opacity':l.type==='polygon'?.13:0});
     if(l.dashed)shape.setAttribute('stroke-dasharray','6 5');
     else if(fresh&&l.type==='polyline'){shape.setAttribute('pathLength','1');shape.setAttribute('class','hg-stroke-animate');}
     group.append(shape);
    }else{
     const [x,y]=map.xy(l.x,l.y);
     if(l.type==='point')group.append(make('circle',{cx:x,cy:y,r:3.8,fill:l.hollow?'white':color,stroke:color,'stroke-width':1.8}));
     if(l.text){const text=make('text',{x:x+(l.type==='point'?7:0),y:y-(l.type==='point'?8:0),fill:color,'font-size':14,'font-family':'inherit','paint-order':'stroke',stroke:'white','stroke-width':3,'stroke-linejoin':'round'});text.textContent=l.text;text.dataset.anchorX=x;text.dataset.anchorY=y;group.append(text);}
    }
    drawing.append(group);
   }
   window.HandFigureType?.apply(root);
  }
  return Object.freeze({setVisible});
 }
 return Object.freeze({validate,sceneAt,project,mount});
});
