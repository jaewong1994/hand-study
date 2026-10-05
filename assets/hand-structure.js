// Generated from the canonical display layout helpers by sync_structure.py.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HandStudyStructure=Object.freeze(api);})(typeof window==='object'?window:globalThis,function(){'use strict';
  const DELIMS=[["$$","$$","d"],["\\[","\\]","d"],["\\(","\\)","i"],["$","$","i"]];
  function splitMath(s){
    s=String(s); const out=[]; let i=0, buf="";
    while(i<s.length){
      if(s[i]==="\\" && i+1<s.length && s[i+1]!=="(" && s[i+1]!=="["){ buf+=s[i]+s[i+1]; i+=2; continue; }
      let hit=null;
      for(const d of DELIMS) if(s.startsWith(d[0],i)){ hit=d; break; }
      if(!hit){ buf+=s[i++]; continue; }
      const e=s.indexOf(hit[1], i+hit[0].length);
      if(e<0){ buf+=s[i++]; continue; }                       // 닫히지 않은 구분자는 글자로 둔다
      if(buf){ out.push({t:buf}); buf=""; }
      out.push({m:hit[2], o:hit[0], c:hit[1], b:s.slice(i+hit[0].length, e)});
      i=e+hit[1].length;
    }
    if(buf) out.push({t:buf});
    return out;
  }

  function bogiHead(el){
    const t=String(el&&el.textContent||"").replace(/\s/g,"")
      .replace(/〈/g,"<").replace(/〉/g,">");
    return t==="<보기>";
  }
  function bogiMarkCount(el){
    const m=String(el&&el.textContent||"").match(/[ㄱㄴㄷㄹㅁㅂ]\s*[.,]/g)||[];
    return new Set(m.map(x=>x.replace(/\s/g,""))).size;
  }
  function normalizeBogiBoxes(h){
    const s=String(h==null?"":h);
    if(s.indexOf("hbox")<0 || !/(?:&lt;|〈|<)\s*보\s*기\s*(?:&gt;|〉|>)/.test(s)) return s;
    const box=document.createElement("div");box.innerHTML=s;
    let hit=false;
    const boxes=Array.prototype.slice.call(box.querySelectorAll(".hbox"));
    boxes.forEach(function(outer){
      /* (2026-09-14 페이블 D-123 후속) box 는 분리 DOM 이라 isConnected 가 항상 false 였다 —
         이 함수는 도입 뒤 한 번도 실행되지 않았고 〈보기〉 중복이 그대로 노출됐다(items 표시검수 7건 실측).
         앞 반복에서 교체돼 box 밖으로 떨어진 노드만 건너뛴다. */
      if(!box.contains(outer) || outer.parentElement&&outer.parentElement.closest(".hbox")) return;
      const head=Array.prototype.find.call(outer.querySelectorAll("p,div"),bogiHead);
      if(!head) return;
      const nested=Array.prototype.find.call(outer.querySelectorAll(".hbox .hbox"),x=>bogiMarkCount(x)>=2) ||
                   Array.prototype.find.call(outer.querySelectorAll(".hbox"),x=>x!==outer&&bogiMarkCount(x)>=2);
      const source=nested||outer, out=document.createElement("div"), title=document.createElement("div");
      out.className="hbox hbogi";title.className="hbogit";title.textContent="〈 보 기 〉";out.appendChild(title);
      Array.prototype.slice.call(source.childNodes).forEach(function(n){
        if(n===head || (n.nodeType===1&&bogiHead(n))) return;
        out.appendChild(n.cloneNode(true));
      });
      outer.parentNode.replaceChild(out,outer);hit=true;
    });
    return hit?box.innerHTML:s;
  }


  function conditionFrameTables(h){
    const s=String(h==null?"":h);
    if(s.indexOf("htbl")<0 || !/\(\s*가\s*\)/.test(s)) return s;
    const box=document.createElement("div");box.innerHTML=s;
    let hit=false;
    const blank=function(td){
      return !String(td.textContent||"").replace(/\u00a0/g," ").trim() && !td.querySelector("img,svg,.heq");
    };
    Array.prototype.forEach.call(box.querySelectorAll("table.htbl"),function(tb){
      const rows=Array.prototype.slice.call(tb.rows);
      if(rows.length!==3) return;
      if(!Array.prototype.every.call(rows[0].cells,blank)||!Array.prototype.every.call(rows[2].cells,blank)) return;
      const filled=Array.prototype.slice.call(rows[1].cells).filter(td=>!blank(td));
      if(filled.length!==1) return;
      const core=filled[0],marks=String(core.textContent||"").match(/\(\s*[가나다라마바사]\s*\)/g)||[];
      if(new Set(marks.map(x=>x.replace(/\s/g,""))).size<2) return;
      let out;
      if(core.children.length===1 && core.firstElementChild.classList.contains("hbox")){
        out=core.firstElementChild;
      }else{
        out=document.createElement("div");out.className="hbox hcond";
        while(core.firstChild) out.appendChild(core.firstChild);
      }
      tb.parentNode.replaceChild(out,tb);hit=true;
    });
    return hit?box.innerHTML:s;
  }


  const C_START=/^\s*\(\s*가\s*\)/, C_CONT=/^\s*\(\s*[나다라마바사]\s*\)/;
  const C_MARK=/\(\s*[가나다라마바사]\s*\)/;
  /* 한 줄을 항목 단위로 분할. $…$ 수식 세그먼트 안은 절대 건드리지 않는다.
     mark = 항목 표지 정규식, norm = 표지 정규화 함수. (가)(나)(다) 와 ㄱㄴㄷ 이 같은 엔진을 쓴다. */
  function splitBy(line, mark, norm){
    const segs=String(line).split(/(\$[^$\n]*\$)/);
    let cur="", rows=[];
    segs.forEach((s,i)=>{
      if(i%2){ cur+=s; return; }                      // 수식 세그먼트 통과
      let rest=s, m;
      while((m=rest.match(mark))){
        cur+=rest.slice(0,m.index);
        if(cur.trim()) rows.push(cur.trim());
        cur=norm(m[0]);
        rest=rest.slice(m.index+m[0].length).replace(/^\s+/,"");
      }
      cur+=rest;
    });
    if(cur.trim()) rows.push(cur.trim());
    return rows;
  }
  const splitConds = line => splitBy(line, C_MARK, m=>"("+m.replace(/[\s()]/g,"")+") ");
  /* ── (v1.6) 〈보 기〉 박스 ──
     미러(내신 기출) 평문은 "< 보 기 > ㄱ. … ㄴ. … ㄷ. …" 가 한 줄로 들어와 박스 없이 흘러나온다
     (재웅 실측, 지족고 2025 16번). 시험지 관례대로 머리표를 가운데 얹은 테두리 박스 + 항목별 줄바꿈으로 복원.
     ㄱ~ㅂ 표지가 2개 이상일 때만 박스로 잡는다(오폭 방지). */
  const B_HEAD=/^\s*(?:&lt;|&#60;|〈|<)\s*보\s*기\s*(?:&gt;|&#62;|〉|>)\s*/;
  const B_MARK=/[ㄱㄴㄷㄹㅁㅂ]\s*[.,]/;
  const splitBogi = line => splitBy(line, B_MARK, m=>m.replace(/\s/g,"").replace(/,$/,".")+" ");
  /* 평문 줄배열 → HTML (조건 박스 + 줄바꿈을 한 번에 처리해 박스 주변 잉여 <br> 를 남기지 않는다) */
  /* ── (2026-09-02 재웅 지시 "표 렌더링 엔진") 평문 [표] 규약 ──
     ① 축약: "[표] z=0.5: 0.1915, z=1.0: 0.3413, …" → 표준정규분포표(z | P(0≤Z≤z))
     ② 일반: "[표]" 줄 … "[/표]" 줄 사이 행을 "|" 로 나눈 격자(첫 행 머리행). 셀 안 $…$ 허용.
     조판도구 TableEngine·HML 적재 파이프라인(공식시험)과 같은 규약. 줄 첫머리의 [표] 만 잡으므로
     "다음 [표]와 같다" 같은 산문 속 낱말(exam_items #10004041 실측)은 건드리지 않는다. */
  const T_OPEN=/^\s*\[표(?::([^\]]*))?\]\s*(.*)$/, T_CLOSE=/^\s*\[\/표\]\s*$/, T_Z=/z\s*=\s*([\d.]+)\s*:\s*([\d.]+)/g;
  function tableBlock(lines,i){
    const m=lines[i].match(T_OPEN); if(!m) return null;
    const rest=String(m[2]||"").trim(), zs=[...rest.matchAll(T_Z)];
    if(zs.length) return {end:i,head:["$z$","$\\mathrm{P}(0\\le Z\\le z)$"],rows:zs.map(z=>["$"+z[1]+"$","$"+z[2]+"$"])};
    const rows=[]; let j=i+1;
    for(;j<lines.length&&!T_CLOSE.test(lines[j]);j++){ if(lines[j].trim()) rows.push(splitCells(lines[j])); }
    if(!rows.length) return null;
    return {end:j,head:rows[0],rows:rows.slice(1)};
  }
  /* 셀 구분자 "|" 는 $…$ 수식 밖에서만 — 절댓값 \left|…\right| 을 가르지 않는다(9월 평가원 21번 실측). */
  function splitCells(line){
    const cells=[]; let cur="", inMath=false;
    for(const ch of String(line)){
      if(ch==="$"){inMath=!inMath;cur+=ch;continue;}
      if(ch==="|"&&!inMath){cells.push(cur.trim());cur="";continue;}
      cur+=ch;
    }
    cells.push(cur.trim()); return cells;
  }
  function tableHtml(t){
    const cell=(c,th)=>th?'<th class="htblh">'+c+'</th>':'<td class="htbld">'+c+'</td>';
    return '<table class="htbl ngd2-table">'+(t.head&&t.head.length?'<tr>'+t.head.map(c=>cell(c,true)).join("")+'</tr>':"")
      +t.rows.map(r=>'<tr>'+r.map(c=>cell(c,false)).join("")+'</tr>').join("")+'</table>';
  }
  function linesToHtml(s){
    const lines=String(s).split("\n"), out=[];
    for(let i=0;i<lines.length;i++){
      const tb=tableBlock(lines,i);
      if(tb){ out.push({table:tb}); i=tb.end; continue; }
      if(C_START.test(lines[i])){
        let rows=splitConds(lines[i]);
        while(i+1<lines.length && C_CONT.test(lines[i+1])) rows=rows.concat(splitConds(lines[++i]));
        if(rows.length>=2){ out.push({box:rows}); continue; }
      }
      if(B_HEAD.test(lines[i])){
        const rows=splitBogi(lines[i].replace(B_HEAD,""));
        if(rows.length>=2){ out.push({box:rows,head:"〈보 기〉"}); continue; }
      }
      out.push({t:lines[i]});
    }
    let html="";
    out.forEach((o,idx)=>{
      if(o.table){
        html=html.replace(/(?:<br>\s*)+$/,"");
        html+=tableHtml(o.table);
        return;
      }
      if(o.box){
        html=html.replace(/(?:<br>\s*)+$/,"");
        html+='<div class="hbox hcond'+(o.head?" hbogi":"")+'">'
             +(o.head?'<div class="hbogit">'+o.head+'</div>':"")
             +o.box.map(r=>'<div class="hcondr">'+r+'</div>').join("")+'</div>';
      }else{
        html+=o.t+(idx<out.length-1?"<br>":"");
      }
    });
    return html;
  }

  function condBoxHtml(h){
    if(/hbox|htbl/.test(h)) return h;
    return h.replace(/(<p[^>]*>(?:&emsp;|&nbsp;|\s)*\(\s*가\s*\)[\s\S]*?<\/p>(?:\s*<p[^>]*>(?:&emsp;|&nbsp;|\s)*\(\s*[나다라마바사]\s*\)[\s\S]*?<\/p>)+)/g,
      '<div class="hbox hcond">$1</div>');
  }

  /* (v1.5 재웅 실측) 미리보기 자르기 — "문제 고르기 화면에서 수식이 깨져".
     preview 를 글자수로 뚝 자르면 `$…$` 한가운데가 잘려 닫는 $ 가 사라지고, KaTeX 는 그 조각을 통째로
     포기해 원본 LaTeX 가 그대로 노출된다(한글 글꼴에서 백슬래시가 ₩ 로 보여 더 깨져 보임).
     → 잘린 자리에 열려 있는 수식 구분자가 있으면 그 여는 자리 앞까지 물러나서 자른다. */
  function clip(t,n){
    const s=String(t||"");
    /* KaTeX auto-render 와 같은 순서($$ → \[ → \( → $)로 좌→우 스캔해 '닫히지 않은 수식'의 시작을 찾는다.
       `$y$$= …$`(붙어 있는 두 세그먼트)를 $$ 로 오독하지 않도록 실제 스캔으로 판정한다. */
    const D=[["$$","$$"],["\\[","\\]"],["\\(","\\)"],["$","$"]];
    const openAt=c=>{
      let i=0;
      while(i<c.length){
        let hit=null;
        for(const d of D) if(c.startsWith(d[0],i)){hit=d;break;}
        if(!hit){ i += (c[i]==="\\" ? 2 : 1); continue; }
        const e=c.indexOf(hit[1], i+hit[0].length);
        if(e<0) return [i,hit];
        i=e+hit[1].length;
      }
      return [-1,null];
    };
    /* RPC preview 자체가 이미 160자에서 수식 중간으로 잘려 오는 경우가 있다. 길이가 n 이하라도
       닫히지 않은 구분자를 검사해야 `$\\left...` 원문이 상세창에 그대로 노출되지 않는다. */
    const lengthCut=s.length>n;
    let c=lengthCut?s.slice(0,n):s, shortened=lengthCut;
    const [at,d]=openAt(c);
    if(at>=0){
      /* 조금만 더 가면 닫히는 수식(1.5배 이내)은 통째로 살리고, 아니면 여는 자리 앞에서 자른다.
         반쪽 수식은 절대 남기지 않는다 — KaTeX 가 포기해 LaTeX 원문이 노출되기 때문. */
      const e=s.indexOf(d[1], at+d[0].length);
      if(e>=0 && e+d[1].length<=Math.round(n*1.5)) c=s.slice(0,e+d[1].length);
      else{c=c.slice(0,at);shortened=true;}
    }
    if(!shortened&&c===s)return s;
    return c.replace(/\\+$/,"").replace(/\s+$/,"")+"…";
  }

  const CH_CLEAN = p => p.replace(/<\/?p\b[^>]*>/gi," ").replace(/<br\s*\/?>/gi," ")
                         .replace(/&emsp;|&ensp;|&nbsp;/gi," ").replace(/\s+/g," ").trim();
  /* HML 원문은 탭 사이에도 ②·③·⑤가 있지만 일부 공식시험 적재본은 탭 정리 때
     머리표만 빠졌다. 일반 수식 나열을 선지로 오인하지 않도록 문항 맨 끝에 수식값이
     정확히 3개+2개이고 남은 머리표가 ①·④뿐인 형식만 복원한다(2027 6월 실측 3건). */
  function restoreTabbedFiveChoices(html){
    if(/[②③⑤]/.test(html)||!/[①④]/.test(html))return html;
    const tex='(\\$(?!\\$)(?:\\\\.|[^$])*?\\$)';
    const rx=new RegExp('(①\\s*)'+tex+'\\s*'+tex+'\\s*'+tex+'\\s*(?:<br\\s*\\/?>)\\s*(④\\s*)'+tex+'\\s*'+tex+'\\s*$','s');
    return String(html||'').replace(rx,(_all,one,a,b,c,four,d,e)=>`${one}${a} ② ${b} ③ ${c}<br>${four}${d} ⑤ ${e}`);
  }
  function choiceGrid(html){
    html=restoreTabbedFiveChoices(String(html||''));
    /* 구조 HTML은 이미 .hchoices>.hch라는 정본 선지 구조를 가진다. .nchoices만
       보호하면 hchoices 내부의 ①~⑤를 다시 nchoices로 감싸 invalid span>div가 되고,
       브라우저 재봉합 뒤 빈 hch와 폭 28px짜리 세로 선지가 생긴다(items #20739). */
    /* (2026-09-19 T5, items #21945·#22354·#11432 실측) `hchoicegrid`(그림선지 표)·`hchoice` 도 정본 선지 구조다.
       종전 가드가 `hchoices` 만 봐서, normalizeChoiceTables 가 보존한 그림선지 표를 여기서 다시 첫 ① 부터
       문서 끝까지 잘라 `.nchoices` 로 감쌌다 → 표 태그가 선지 span 사이로 흩어지고 브라우저 재봉합으로 표가 부서졌다. */
    if(/class=["'][^"']*(?:nchoices|hchoice)/.test(html))return html;
    /* (2026-09-14c 페이블, items #11409 실측) 수식 세그먼트($…$·\(…\)) 안의 원문자는 선지 머리표가 아니라
       식 번호(`\cdots \text{①}`)다. 종전 indexOf('①') 이 수식 안 ① 을 선지 시작으로 잡아 수식이 중간에서
       잘리고 뒤 문장 전체가 원시 LaTeX 로 노출됐다 → 수식 밖 텍스트 토큰에서만 머리표를 센다. */
    const outside=new Set(); let first=-1, pos=0;
    for(const k of splitMath(html)){
      if(k.t==null){ pos+=(k.o+k.b+k.c).length; continue; }
      (k.t.match(/[①②③④⑤]/g)||[]).forEach(x=>outside.add(x));
      if(first<0){ const i=k.t.indexOf('①'); if(i>=0) first=pos+i; }
      pos+=k.t.length;
    }
    /* 수식 밖 머리표가 3종 미만이면(`$①$` 처럼 선지 자체가 수식 짝 오류로 수식 안에 갇힌 exam_items 실측 128건)
       종전 규칙(문서 전체 첫 ①)을 그대로 쓴다 — 이 수정은 수식 밖 선지가 온전한 문항에서만 절단 위치를 옮긴다. */
    if(outside.size<3){ const all=[...new Set(html.match(/[①②③④⑤]/g)||[])]; if(all.length<3) return html; first=html.indexOf('①'); }
    if(first<0) return html;
    let region=html.slice(first), trail="";
    /* (2026-09-14 페이블 D-123 후속, items #10523·#8726·#16268 실측) 종전엔 ① 부터 문서 끝까지를 선지로
       잘라 ⑤ 뒤에 저장된 그림·표·조건상자 블록이 ⑤ 칸에 갇혀 폭 50px 로 찌그러졌다(백스캔 204건, 통과 56).
       ⑤ 가 든 문단이 닫힌 뒤 새 블록(p·div·table·figure·그림 래퍼)이 시작되면 거기서부터는 선지 밖 후행 블록이다. */
    const five=region.lastIndexOf('⑤');
    if(five>=0){
      const m=/<\/p>\s*(?=<(?:p|div|table|figure)\b|<span class="hfigwrap")/i.exec(region.slice(five));
      if(m){ const cut=five+m.index+m[0].length; trail=region.slice(cut); region=region.slice(0,cut); }
    }
    const parts=region.split(/(?=[②③④⑤])/);
    /* (v1.2) 선지 블록 앞의 잉여 <br>·빈 여는 문단 제거 — 선지 위에 빈 줄이 하나 더 생기던 문제 */
    const head=html.slice(0,first).replace(/(?:<br\s*\/?>\s*)+$/i,"").replace(/(?:<p\b[^>]*>\s*)+$/i,"");
    return head+'<div class="nchoices">'+parts.map(p=>
      '<span class="nchoice">'+CH_CLEAN(p).replace(/^([①②③④⑤])\s*/,'<span class="ncnum">$1</span> ')+'</span>')
      .join('')+'</div>'+trail;
  }
  /* HWP가 선지와 그림을 한 표에 좌우 배치한 경우 표를 그대로 두면 선지는 한 열,
     그림은 오른쪽 셀에 남는다. 그림형 선지는 보존하고 일반 선지 표만 그림과 분리한다. */
  function normalizeChoiceTables(html){
    const box=document.createElement("div");box.innerHTML=String(html||"");
    box.querySelectorAll("table.hchoice,table.hchoicegrid").forEach(table=>{
      const marks=[...new Set((table.textContent||"").match(/[①②③④⑤]/g)||[])];if(marks.length<3)return;
      const cells=[...table.querySelectorAll("td")],figCells=cells.filter(td=>td.querySelector(".hfigwrap,.hfigs,.nvfig,figure,img,svg"));
      /* (2026-09-19 T5, items #21945·#22354·#11432 실측) HWP 그림선지 표는 두 꼴이다.
         (a) 한 칸에 `① + 그림` 이 같이 든 꼴, (b) `①` 칸과 그림 칸이 번갈아 놓인 꼴(hchoicegrid 의 다수).
         종전 every() 조건은 (a)만 그림선지로 인정해 (b)를 일반 선지표로 보고 평탄화했다 →
         그림 다섯 장은 선지 위 그림영역으로 모이고 번호 ①~⑤ 만 아래 한 줄에 남아 번호-그림 대응이 끊겼다.
         그림 칸이 3개 이상이면서 "머리표만 든 칸"도 3개 이상이면 (b) 꼴 그림선지 표로 보고 구조를 보존한다. */
      const markOnly=cells.filter(td=>{const t=(td.textContent||"").trim();
        return /[①②③④⑤]/.test(t)&&/^[①②③④⑤\s.,)]*$/.test(t)&&!td.querySelector(".hfigwrap,.hfigs,.nvfig,figure,img,svg");});
      const graphical=figCells.length>=3&&(figCells.every(td=>/[①②③④⑤]/.test(td.textContent||""))||markOnly.length>=3);
      if(graphical)return;
      const media=[];
      table.querySelectorAll(".hfigwrap,.hfigs,.nvfig,figure,img,svg").forEach(n=>{
        const c=n.closest(".hfigwrap")||n.closest(".hfigs")||n.closest(".nvfig")||n.closest("figure")||n;
        if(media.some(x=>x===c||x.contains(c))||c.closest(".hbox"))return;media.push(c);
      });
      const clone=table.cloneNode(true);clone.querySelectorAll(".hfigwrap,.hfigs,.nvfig,figure,img,svg").forEach(n=>n.remove());
      const raw=[...clone.querySelectorAll("td")].map(td=>td.innerHTML).join(" ");
      const tmp=document.createElement("div");tmp.innerHTML=choiceGrid(raw);
      const grid=tmp.querySelector(".nchoices");if(!grid)return;
      const frag=document.createDocumentFragment();media.forEach(n=>frag.appendChild(n));frag.appendChild(grid);table.replaceWith(frag);
    });
    return box.innerHTML;
  }
  function choices(html){return choiceGrid(normalizeChoiceTables(html));}
  /* 렌더 후 선지 폭 실측 → 표준 5지선다는 5개 한 줄 → 3+2 → 1개씩만 허용한다.
     최대 선지폭×열수로 어림잡지 않고 실제 열 트랙 폭을 합산한다. 짧은 분수 선지 다섯 개가
     불필요하게 세로로 떨어지는 일을 막고, 긴 선지는 겹치기 전에 3+2 또는 1열로 내린다. */
  const CH_GAP = 14;
  const choiceImageWatches = new WeakSet();
  function layoutChoices(el){
    el.querySelectorAll(".nchoices,.hchoices").forEach(c=>{
      const kids=[...c.children]; if(!kids.length) return;
      c.classList.remove("c5","c4","c3","c2","c1","vert");
      const pending=[...c.querySelectorAll('img')].filter(im=>!im.complete);
      pending.forEach(im=>{
        if(choiceImageWatches.has(im))return;
        choiceImageWatches.add(im);
        const relayout=()=>{if(el.isConnected)layoutChoices(el);};
        im.addEventListener('load',relayout,{once:true});
        im.addEventListener('error',relayout,{once:true});
      });
      // Lazy images have no natural width yet. Keep their choices readable until
      // loading finishes, then measure again using the same 5/3/1-column rules.
      if(pending.length||[...c.querySelectorAll('img')].some(im=>im.complete&&!im.naturalWidth)){c.classList.add('c1');return;}
      /* 자연폭 실측: 잠깐 블록+인라인블록으로 되돌려 각 선지의 내용 폭을 잰다 */
      const cd=c.style.display; c.style.display="block";
      const W=c.clientWidth||el.clientWidth||520;
      const wid=kids.map(k=>{const d=k.style.display;k.style.display="inline-block";
                             const w=k.offsetWidth;k.style.display=d;return w;});
      c.style.display=cd;
      let n=1;
      if(kids.length===5){
        const five=wid.reduce((a,b)=>a+b,0)+CH_GAP*4;
        const three=Math.max(wid[0],wid[3])+Math.max(wid[1],wid[4])+wid[2]+CH_GAP*2;
        n=five<=W+1?5:(three<=W+1?3:1);
      }else{
        const oneRow=wid.reduce((a,b)=>a+b,0)+CH_GAP*Math.max(0,kids.length-1);
        n=oneRow<=W+1?Math.min(5,kids.length):1;
      }
      c.classList.add("c"+n);
    });
  }

const verifiedAnswerSheets={"11749":["\\(1\\)","②","\\(2\\)","①","\\(3\\)","③","\\(4\\)","①","\\(5\\)","⑤","\\(6\\)","④","\\(7\\)","①","\\(8\\)","⑤","\\(9\\)","②","\\(10\\)","③","\\(11\\)","④","\\(12\\)","③","\\(13\\)","①","\\(14\\)","③","\\(15\\)","④","\\(16\\)","③","\\(17\\)","④","\\(18\\)","⑤","\\(19\\)","⑤","\\(20\\)","②","\\(21\\)","⑤","\\(22\\)","\\(5\\)","\\(23\\)","\\(3\\)","\\(24\\)","\\(7\\)","\\(25\\)","\\(19\\)","\\(26\\)","\\(18\\)","\\(27\\)","\\(4\\)","\\(28\\)","\\(6\\)","\\(29\\)","\\(164\\)","\\(30\\)","\\(74\\)"],"17494":["1","➃","2","➀","3","➁","4","➀","5","➂","6","➄","7","➄","8","➀","9","➂","10","➃","11","➁","12","➁","13","➄","14","➄","15","➂","16","7","17","16","18","13","19","4","20","80","21","220","22","58","23","➃","24","➁","25","➄","26","➂","27","➂","28","➀","29","127","30","17"]};

  function verifiedBogiBoxes(html){
    const box=document.createElement('div');box.innerHTML=html;
    for(const outer of [...box.querySelectorAll('.hbox')]){
      if(!box.contains(outer)||outer.parentElement.closest('.hbox'))continue;
      const nested=[...outer.querySelectorAll('.hbox')].find(n=>bogiMarkCount(n)>=2);
      if(nested){
        const clone=outer.cloneNode(true),index=[...outer.querySelectorAll('.hbox')].indexOf(nested);
        clone.querySelectorAll('.hbox')[index].remove();
        for(const h of [...clone.querySelectorAll('p,div')])if(bogiHead(h))h.remove();
        const remaining=clone.textContent.replace(/\s/g,'');
        // Never discard a different second condition block merely because it
        // shares a border. Deduplicate only byte-equivalent visible content.
        if(remaining&&remaining!==nested.textContent.replace(/\s/g,''))continue;
      }
      const normalized=document.createElement('div');normalized.innerHTML=normalizeBogiBoxes(outer.outerHTML);
      outer.replaceWith(...normalized.childNodes);
    }
    return box.innerHTML;
  }

  // Structured HTML is retained. Only text-flow containers enter the plain-line
  // formatter; figures, tables, and existing condition boxes are never flattened.
  function prepare(html,context={}) {
    const original=document.createElement('div');original.innerHTML=String(html||'');
    const expected=verifiedAnswerSheets[context.itemId];
    if(expected){
      const last=original.lastElementChild;
      if(last&&last.tagName==='TABLE'){
        const cells=[...last.querySelectorAll('td')].map(c=>c.textContent.replace(/\s/g,''));
        if(JSON.stringify(cells)===JSON.stringify(expected))last.remove();
      }
    }
    const glyphs='➀➁➂➃➄',numbers='①②③④⑤';
    const source=splitMath(original.innerHTML).map(t=>t.t!=null?t.t.replace(/[➀➁➂➃➄]/g,c=>numbers[glyphs.indexOf(c)]):t.o+t.b+t.c).join('');
    const box=document.createElement('div');box.innerHTML=source;
    // HWP's title-in-the-border table is a frame, not tabular information.
    // Convert only an exact heading plus one content cell; retain real tables.
    for(const table of [...box.querySelectorAll('table.htbl')]){
      const cells=[...table.querySelectorAll('td,th')];
      const filled=cells.filter(c=>c.textContent.trim()||c.querySelector('img,table'));
      const heads=filled.filter(bogiHead),body=filled.filter(c=>!bogiHead(c));
      if(heads.length!==1||body.length!==1||bogiMarkCount(body[0])<2||body[0].querySelector('table'))continue;
      const frame=document.createElement('div');frame.className='hbox';
      const title=document.createElement('p');title.textContent=heads[0].textContent;frame.append(title);
      while(body[0].firstChild)frame.append(body[0].firstChild);
      table.replaceWith(frame);
    }
    for(const el of [...box.querySelectorAll('div,p')]){
      if(!box.contains(el)||el.closest('.hbox,table,.hchoices,.nchoices,.hchoicegrid,.hchoice'))continue;
      if(el.querySelector('div,p,table,figure,img,.hfigwrap'))continue;
      const raw=el.innerHTML;
      if(!/(?:&lt;|〈)\s*보\s*기|\(\s*가\s*\)/.test(raw))continue;
      const lines=raw.split(/<br\s*\/?>|\n/i);
      // A standalone heading and successive ㄱ/ㄴ/ㄷ lines share one box.
      for(let i=0;i<lines.length;i++){
        if(!B_HEAD.test(lines[i]))continue;
        let end=i+1;
        while(end<lines.length && /^\s*(?:[ㄱㄴㄷㄹㅁㅂ]\s*[.,]|$)/.test(lines[end]))end++;
        if(end>i+1)lines.splice(i,end-i,lines.slice(i,end).join(' '));
      }
      const formatted=linesToHtml(lines.join('\n'));
      if(formatted!==raw){
        const replacement=document.createElement('div');replacement.innerHTML=formatted;
        el.replaceWith(replacement);
      }
    }
    let result=conditionFrameTables(verifiedBogiBoxes(condBoxHtml(box.innerHTML)));
    // Formula/algorithm labels are not answer choices. The generic renderer's
    // three-symbol fallback is deliberately not used for this student export.
    const marks=splitMath(result).filter(t=>t.t!=null).map(t=>t.t).join('').match(/[①②③④⑤]/g)||[];
    if(marks.join('')==='①②③④⑤'||/class=["'][^"']*(?:hchoices|nchoices|hchoicegrid|hchoice)/.test(result))result=choices(result);
    return result;
  }

return {prepare,layoutChoices,splitMath};
});
