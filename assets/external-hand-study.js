(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./hand-typography.js') : root.HandStudyTypography, typeof module === 'object' && module.exports ? require('./hand-structure.js') : root.HandStudyStructure);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ExternalHandStudyUI = Object.freeze(api);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.mount(root.ExternalHandStudyRecord));
    else api.mount(root.ExternalHandStudyRecord);
  }
})(typeof window === 'object' ? window : globalThis, function (typography, structure) {
  'use strict';

  const HASH = /^[a-f0-9]{64}$/;
  const SOURCE_KEY = /^ebsi:(?:2026:g[12]:\d{2}:q(?:[1-9]|[1-9]\d)|(?:2019|202[0-5]):g1:03:q(?:[1-9]|[1-9]\d)|2026:g3:(?:03|05|07):(?:common|probability-statistics|calculus|geometry):q(?:[1-9]|[1-9]\d))$/;
  const BLOCKED_LATEX = /\\(?:href|url|includegraphics|html\w*|def|gdef|newcommand|renewcommand|require)\b|<\/?(?:script|iframe)/i;
  const ALLOWED_TAGS = new Set(['P', 'DIV', 'SPAN', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'SUP', 'SUB', 'IMG', 'FIGURE', 'FIGCAPTION', 'SECTION']);
  const QUESTION_CLASSES = new Set(['hp', 'htall', 'hbox', 'htbl', 'hfig', 'hfigr', 'hfigwrap', 'hfiglayer', 'hfiglabel', 'heq', 'hscore', 'hbogi', 'hbogit', 'hcond', 'hcondr', 'hchoices', 'hch', 'nchoices', 'nchoice', 'ncnum', 'hchoice', 'hchoicegrid', 'htblh', 'htbld', 'hnotice', 'hpic']);
  const SAFE_BORDER = /^(?:none|1px solid #333)$/;
  const SAFE_ASPECT = /^(?:\d{1,5}(?:\.\d{1,4})?|\d{1,5}\/\d{1,5})$/;

  function cleanText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, maxLength);
  }

  function gradeLabel(value) {
    if (Number.isInteger(value) && value >= 1 && value <= 3) return `고${value}`;
    const text = cleanText(value, 30);
    if (/^[1-3]$/.test(text)) return `고${text}`;
    if (/^고[1-3]$/.test(text)) return text;
    return '';
  }

  function trackLabel(record) {
    return cleanText(record.track, 50) || cleanText(record.subjectLabel, 50) || '공통';
  }

  function validate(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw Error('학습 자료를 불러오지 못했습니다.');
    if (!SOURCE_KEY.test(record.sourceKey || '') || record.itemId != null || record.dbItemId != null) throw Error('외부 문항 연결 정보가 올바르지 않습니다.');
    if (!cleanText(record.sourceLabel, 100) || !gradeLabel(record.grade)) throw Error('문항 출처 정보가 부족합니다.');
    if (!Number.isInteger(record.adminYear) || record.adminYear < 2000 || record.adminYear > 2100) throw Error('시행연도를 확인해 주세요.');
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) throw Error('시행월을 확인해 주세요.');
    if (!Number.isInteger(record.number) || record.number < 1 || record.number > 100) throw Error('문항 번호를 확인해 주세요.');
    if (!Array.isArray(record.steps) || record.steps.length < 1 || record.steps.length > 30) throw Error('풀이 단계 수를 확인해 주세요.');
    const stepIds = new Set();
    for (const step of record.steps) {
      const id = cleanText(step && step.id, 80);
      const latex = cleanText(step && step.latex, 3000);
      if (!id || stepIds.has(id) || !latex || BLOCKED_LATEX.test(latex)) throw Error('풀이 단계 형식이 올바르지 않습니다.');
      stepIds.add(id);
    }
    if (!HASH.test(record.sourceHash || '') || !HASH.test(record.contentHash || '')) throw Error('자료 연결 해시가 없습니다.');
    if (!cleanText(String(record.answer == null ? '' : record.answer), 300)) throw Error('정답 정보가 없습니다.');
    if (record.questionHtml != null && typeof record.questionHtml !== 'string') throw Error('문항 본문 형식이 올바르지 않습니다.');
    if (record.questionText != null && typeof record.questionText !== 'string') throw Error('문항 본문 형식이 올바르지 않습니다.');
    validateDiagram(record.diagram);
    return true;
  }

  function validateDiagram(diagram) {
    if (diagram == null) return true;
    if (!diagram || !Array.isArray(diagram.points) || !Array.isArray(diagram.lines) || !Array.isArray(diagram.curves)) throw Error('보조 그림 형식이 올바르지 않습니다.');
    if (diagram.points.length > 50 || diagram.lines.length > 100 || diagram.curves.length > 10) throw Error('보조 그림이 너무 복잡합니다.');
    for (const point of [...diagram.points, ...diagram.lines.flat(), ...diagram.curves.flat()]) {
      if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw Error('보조 그림 좌표를 확인해 주세요.');
    }
    return true;
  }

  function sourceLine(record) {
    validate(record);
    return cleanText(record.sourceLabel, 100);
  }

  function displayTitle(record) {
    return `${record.adminYear}년 시행 ${gradeLabel(record.grade)} ${record.month}월 ${record.number}번`;
  }

  function renderStep(latex, katexApi) {
    if (!katexApi || typeof katexApi.renderToString !== 'function') throw Error('수식 표시 도구를 불러오지 못했습니다.');
    if (typeof latex !== 'string' || BLOCKED_LATEX.test(latex)) throw Error('허용되지 않은 수식입니다.');
    return katexApi.renderToString(typography.display(latex), {
      displayMode: true,
      throwOnError: true,
      trust: false,
      strict: 'ignore',
      maxExpand: 300,
      output: 'htmlAndMathml'
    });
  }

  function safeImageSource(value) {
    const src = cleanText(value, 2000);
    if (!src) return '';
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src)) return src;
    if (/^(?:\.{0,2}\/)?[a-z0-9_./%+\-]+(?:\?[a-z0-9_=&.%+\-]*)?$/i.test(src) && !src.startsWith('//')) return src;
    return '';
  }

  function sanitizeQuestionClasses(value) {
    return String(value || '').split(/\s+/).filter(name => QUESTION_CLASSES.has(name));
  }

  function sanitizeQuestionStyle(value, context) {
    const raw = typeof value === 'string' ? value : '';
    if (!raw || /url\s*\(|expression\s*\(|var\s*\(|[{}<>]/i.test(raw)) return '';
    const classes = new Set((context && context.classes) || []);
    const tag = String(context && context.tag || '').toUpperCase();
    const overlay = Boolean(context && context.overlay);
    const figureWrap = classes.has('hfigwrap');
    const figureLayer = classes.has('hfiglayer');
    const figureImage = tag === 'IMG' && classes.has('hfig');
    const figureLabel = classes.has('hfiglabel') || (tag === 'SPAN' && overlay);
    const tableLayout = classes.has('htbl') || tag === 'TABLE' || tag === 'TD' || tag === 'TH';
    const boxLayout = classes.has('hbox') || classes.has('hfigr');
    const allowed = new Set();
    if (figureWrap) ['position','display','width','aspect-ratio','max-width','vertical-align'].forEach(x => allowed.add(x));
    if (figureLayer) ['position','overflow','left','top','width','height'].forEach(x => allowed.add(x));
    if (figureImage) ['width','height','max-width','object-fit','display'].forEach(x => allowed.add(x));
    if (figureLabel) ['position','left','top','width','height','line-height','white-space','display','transform'].forEach(x => allowed.add(x));
    if (tableLayout) ['width','border-top','border-bottom','border-left','border-right','white-space'].forEach(x => allowed.add(x));
    if (boxLayout || tag === 'DIV') ['text-align','font-weight','margin','float','width','max-width'].forEach(x => allowed.add(x));
    const clean = [];
    for (const declaration of raw.split(';')) {
      const split = declaration.indexOf(':');
      if (split < 1) continue;
      const property = declaration.slice(0, split).trim().toLowerCase();
      const candidate = declaration.slice(split + 1).trim().toLowerCase();
      if (!allowed.has(property)) continue;
      let valid = false;
      if (['width','height','max-width'].includes(property)) {
        const match = candidate.match(/^(\d{1,4}(?:\.\d{1,4})?)(px|%)$/);
        valid = candidate === '0' || Boolean(match && Number(match[1]) <= (match[2] === 'px' ? 1200 : 200)) || (property === 'max-width' && candidate === 'none');
      }
      else if (['left','top'].includes(property)) {
        const match = candidate.match(/^(-?\d{1,3}(?:\.\d{1,4})?)%$/);
        valid = candidate === '0' || Boolean(match && Number(match[1]) >= -25 && Number(match[1]) <= 150);
      }
      else if (property === 'aspect-ratio') {
        if (SAFE_ASPECT.test(candidate)) {
          const parts = candidate.split('/').map(Number);
          valid = parts.length === 1 ? parts[0] > 0 && parts[0] <= 10 : parts[0] > 0 && parts[1] > 0;
        }
      }
      else if (property.startsWith('border-')) valid = SAFE_BORDER.test(candidate);
      else if (property === 'position') valid = candidate === 'relative' || candidate === 'absolute';
      else if (property === 'display') valid = candidate === 'inline-block' || candidate === 'block';
      else if (property === 'vertical-align') valid = candidate === 'middle';
      else if (property === 'line-height') valid = candidate === '1';
      else if (property === 'object-fit') valid = candidate === 'fill';
      else if (property === 'overflow') valid = candidate === 'hidden';
      else if (property === 'white-space') valid = candidate === 'nowrap';
      else if (property === 'transform') valid = candidate === 'translatex(-50%)';
      else if (property === 'text-align') valid = candidate === 'center';
      else if (property === 'font-weight') valid = candidate === '700';
      else if (property === 'float') valid = candidate === 'right';
      else if (property === 'margin') valid = /^(?:0|(?:-?\d{1,3}px|0)(?:\s+(?:-?\d{1,3}px|0)){1,3})$/.test(candidate);
      if (valid) clean.push(`${property}:${candidate}`);
    }
    return clean.join(';');
  }

  function appendSanitized(target, html, doc) {
    const parsed = new DOMParser().parseFromString(String(html), 'text/html');
    function copy(node, parent, inFigureOverlay) {
      if (node.nodeType === 3) {
        parent.append(doc.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== 1) return;
      if (!ALLOWED_TAGS.has(node.tagName)) {
        for (const child of node.childNodes) copy(child, parent, inFigureOverlay);
        return;
      }
      const out = doc.createElement(node.tagName.toLowerCase());
      const classes = sanitizeQuestionClasses(node.getAttribute('class'));
      if(classes.length)out.className=classes.join(' ');
      const overlay = inFigureOverlay || classes.includes('hfigwrap') || classes.includes('hfiglayer');
      const style = sanitizeQuestionStyle(node.getAttribute('style'), { tag: node.tagName, classes, overlay });
      if (style) out.setAttribute('style', style);
      if (node.tagName === 'IMG') {
        const src = safeImageSource(node.getAttribute('src') || '');
        if (!src) return;
        out.setAttribute('src', src);
        out.setAttribute('alt', cleanText(node.getAttribute('alt') || '문항 그림', 300));
        out.setAttribute('loading', 'lazy');
        out.setAttribute('decoding', 'async');
      }
      if (node.tagName === 'TH' || node.tagName === 'TD') {
        for (const key of ['colspan','rowspan']) {
          const span = Number(node.getAttribute(key));
          if (Number.isInteger(span) && span >= 1 && span <= 12) out.setAttribute(key, String(span));
        }
      }
      for (const child of node.childNodes) copy(child, out, overlay);
      parent.append(out);
    }
    for (const child of parsed.body.childNodes) copy(child, target, false);
  }

  function drawDiagram(root, diagram, doc) {
    root.replaceChildren();
    if (!diagram) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 420 180');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', cleanText(diagram.caption, 300) || '풀이 보조 그림');
    const coords = [...diagram.points, ...diagram.lines.flat(), ...diagram.curves.flat()];
    const xs = coords.map(p => p[0]);
    const ys = coords.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const x = value => 35 + (value - minX) / Math.max(maxX - minX, .01) * 345;
    const y = value => 148 - (value - minY) / Math.max(maxY - minY, .01) * 115;
    function path(points, color) {
      const line = doc.createElementNS(NS, 'polyline');
      line.setAttribute('points', points.map(point => `${x(point[0])},${y(point[1])}`).join(' '));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1.8');
      svg.append(line);
    }
    diagram.lines.forEach(points => path(points, '#9aa5b4'));
    diagram.curves.forEach(points => path(points, '#243754'));
    diagram.points.forEach(point => {
      const label = doc.createElementNS(NS, 'text');
      label.setAttribute('x', String(x(point[0]) + 5));
      label.setAttribute('y', String(y(point[1]) - 7));
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#243754');
      label.textContent = cleanText(String(point[2] == null ? '' : point[2]), 30);
      svg.append(label);
    });
    root.append(svg);
    if (diagram.caption) {
      const caption = doc.createElement('figcaption');
      caption.textContent = cleanText(diagram.caption, 300);
      root.append(caption);
    }
  }

  function mount(input) {
    const doc = document;
    const byId = id => doc.getElementById(id);
    const error = byId('hs-error');
    try {
      validate(input);
      const record = JSON.parse(JSON.stringify(input));
      let visible = 0;
      let timer = null;
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (window.self !== window.top || new URLSearchParams(location.search).get('embed') === '1') doc.body.classList.add('hs-embedded');
      byId('hs-preview').hidden = record.preview !== true;
      const source = sourceLine(record);
      const title = displayTitle(record);
      byId('hs-source').textContent = source;
      byId('hs-source-mini').textContent = `${record.adminYear}년 ${record.month}월 · ${trackLabel(record)}`;
      byId('hs-title').textContent = title;
      doc.title = `${title} · 손풀이 노트`;
      byId('hs-answer').textContent = `답  ${cleanText(String(record.answer), 300)}`;

      const question = byId('hs-question-body');
      const questionHtml = cleanText(record.questionHtml, 200000);
      const questionText = cleanText(record.questionText, 100000);
      if (questionHtml) appendSanitized(question, structure.prepare(questionHtml, {itemId:record.itemId}), doc);
      else if (questionText) question.textContent = questionText;
      else {
        const empty = doc.createElement('p');
        empty.className = 'hs-question-empty';
        empty.textContent = '이 미리보기에는 문항 본문이 포함되지 않았습니다.';
        question.append(empty);
      }
      if (typeof window.renderMathInElement === 'function') {
        try {
          window.renderMathInElement(question, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false }
            ],
            preProcess: typography.inline,
            throwOnError: false,
            strict: 'ignore',
            trust: false
          });
        } catch (_) { error.textContent = '문항의 일부 수식은 원문으로 표시됩니다.'; }
      }

      structure.layoutChoices(question);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => structure.layoutChoices(question));
      window.addEventListener('resize', () => structure.layoutChoices(question));

      const steps = byId('hs-steps');
      for (const step of record.steps) {
        const node = doc.createElement('div');
        node.className = 'hs-step';
        node.dataset.stepId = cleanText(step.id, 80);
        try { node.innerHTML = renderStep(step.latex, window.katex); }
        catch (_) {
          node.textContent = step.latex;
          node.classList.add('hs-step-fallback');
          error.textContent = '일부 수식은 원문으로 표시됩니다.';
        }
        steps.append(node);
      }
      const diagramRoot = byId('hs-diagram');
      const graph = record.graphPlan && window.HandGraphTimeline && typeof window.HandGraphTimeline.mount === 'function'
        ? window.HandGraphTimeline.mount(diagramRoot, record.graphPlan, record.steps)
        : null;
      if (!graph) drawDiagram(diagramRoot, record.diagram, doc);

      function stop() {
        if (timer) clearTimeout(timer);
        timer = null;
        byId('hs-play').textContent = '무음 재생';
        byId('hs-play').setAttribute('aria-pressed', 'false');
      }
      function sync(announce) {
        [...steps.children].forEach((node, index) => { node.hidden = index >= visible; });
        byId('hs-prompt').hidden = visible > 0;
        byId('hs-answer').hidden = visible < record.steps.length;
        if (graph && typeof graph.setVisible === 'function') {
          diagramRoot.hidden = false;
          graph.setVisible(visible);
        } else diagramRoot.hidden = visible === 0;
        byId('hs-progress').textContent = `${visible} / ${record.steps.length}줄`;
        byId('hs-prev').disabled = visible === 0;
        byId('hs-next').disabled = visible === record.steps.length;
        if (announce) byId('hs-live').textContent = visible === record.steps.length ? '풀이 전체와 정답을 표시했습니다.' : `${visible}번째 풀이 줄을 표시했습니다.`;
        if (visible === record.steps.length) stop();
      }
      function next() { visible = Math.min(record.steps.length, visible + 1); sync(true); }
      function previous() { stop(); visible = Math.max(0, visible - 1); sync(true); }
      function reset() { stop(); visible = 0; sync(true); }
      function showAll() { stop(); visible = record.steps.length; sync(true); }
      function tick() {
        if (!timer) return;
        next();
        if (visible < record.steps.length) timer = setTimeout(tick, Number(byId('hs-speed').value));
      }
      function togglePlay() {
        if (timer) { stop(); return; }
        if (visible === record.steps.length) visible = 0;
        byId('hs-play').textContent = '일시정지';
        byId('hs-play').setAttribute('aria-pressed', 'true');
        timer = setTimeout(tick, reduceMotion ? 80 : 260);
      }

      byId('hs-reset').addEventListener('click', reset);
      byId('hs-prev').addEventListener('click', previous);
      byId('hs-next').addEventListener('click', next);
      byId('hs-all').addEventListener('click', showAll);
      byId('hs-play').addEventListener('click', togglePlay);
      byId('hs-speed').addEventListener('change', stop);
      doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });

      doc.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target.tagName) || event.target.isContentEditable) return;
        const key = event.key.toLowerCase();
        if (key === 'arrowright' || key === ' ') { event.preventDefault(); next(); }
        else if (key === 'arrowleft') { event.preventDefault(); previous(); }
        else if (key === 'h') reset();
        else if (key === 'a') showAll();
        else if (key === 'p') togglePlay();
      });
      sync(false);
      return true;
    } catch (caught) {
      if (error) error.textContent = caught && caught.message ? caught.message : '학습 자료를 표시하지 못했습니다.';
      const shell = doc.querySelector('.hs-shell');
      if (shell) shell.classList.add('hs-load-failed');
      return false;
    }
  }

  return Object.freeze({ validate, validateDiagram, sourceLine, displayTitle, gradeLabel, trackLabel, renderStep, safeImageSource, sanitizeQuestionClasses, sanitizeQuestionStyle, appendSanitized, mount });
});
