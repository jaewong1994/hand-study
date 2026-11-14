(() => {
'use strict';
// 손풀이 노트 목록: 과목(2022 개정) 탭 → 학년 → 월로 묶고, 문제가 보이는 카드로 보여 준다.
const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const SUBJECTS = (window.HandStudySubjects || []).map(s => s[0]);
const SLUG = Object.fromEntries(window.HandStudySubjects || []);
const source = r => r.sourceKind === 'csat' || /수능/.test(r.sourceLabel) ? '수능' : /평가원/.test(r.sourceLabel) || (Number(r.grade) === 3 && [6, 9].includes(Number(r.month))) ? '평가원' : '교육청';
const monthLabel = r => source(r) === '수능' ? '수능' : `${r.month}월`;
const monthKey = r => source(r) === '수능' ? 11.5 : Number(r.month);
const examLine = r => source(r) === '수능' ? `${Number(r.adminYear) + 1}학년도 수능` : `${r.adminYear} · ${r.month}월 ${source(r)}`;
const key = r => String(r.sourceKey || r.itemId);
const records = (window.HandStudyCatalog || []).filter(r => /^(items|external-items)\/[\w.-]+\.html$/.test(r.href));
const searchText = r => `${r.adminYear} ${r.adminYear}년 고${r.grade} ${monthLabel(r)} ${source(r)} ${r.subject} ${r.number}번 ${r.sourceLabel || ''}`;
const counts = {}; for (const r of records) counts[r.subject] = (counts[r.subject] || 0) + 1;
const tabs = SUBJECTS.filter(s => counts[s]);

const params = new URLSearchParams(location.search);
const st = {
  subject: tabs.includes(params.get('subject')) ? params.get('subject') : tabs[0],
  grade: params.get('grade') || '', month: params.get('month') || '', year: params.get('year') || '',
  q: params.get('q') || '', board: params.get('board') === '1'
};

const app = document.querySelector('#library-app'); app.replaceChildren();
const main = make('main', 'cards-library'); main.id = 'library-main';
const header = make('header', 'cards-header');
// 파종 디자인(2026-11-12): 리틱체 제목은 빌드 때 그린 윤곽선 SVG, 아래에 밭고랑과 과목 색 씨앗
const T = window.HandStudyTitle || null;
const h1 = make('h1', 'cards-title');
if (T) {
  const eb = make('div', 'cards-eyebrow'); eb.innerHTML = T.eyebrow;
  h1.innerHTML = T.svg; h1.append(make('span', 'sr', '손풀이 노트'));
  header.append(eb);
} else h1.textContent = '손풀이 노트';
header.append(h1, make('p', '', `평가원 · 교육청 · 수능 기출 ${records.length.toLocaleString('ko-KR')}문항`));
if (T) { const fw = make('div', 'cards-furrow'); fw.innerHTML = T.furrow; header.append(fw); }
const subjColor = s => (T && T.colors && T.colors[s]) || '#1C2532';
main.append(header);

const tabBar = make('nav', 'subject-tabs'); tabBar.setAttribute('aria-label', '과목');
const tabBtns = {};
for (const s of tabs) {
  const b = make('button', 'subject-tab'); b.type = 'button'; b.style.setProperty('--subj', subjColor(s));
  b.append(make('span', 'st-name', s), make('span', 'st-count', counts[s].toLocaleString('ko-KR')));
  b.addEventListener('click', () => { st.subject = s; st.grade = ''; st.month = ''; render(true); });
  tabBar.append(b); tabBtns[s] = b;
}
main.append(tabBar);

const filters = make('div', 'cards-filters');
const gradeBox = make('div', 'grade-chips'); gradeBox.setAttribute('role', 'group'); gradeBox.setAttribute('aria-label', '학년');
const monthSel = make('select'), yearSel = make('select');
const lab = (t, el) => { const l = make('label', 'cf-field'); l.append(make('span', '', t), el); return l; };
const search = make('input'); search.type = 'search'; search.placeholder = '예: 2024 6월 22번'; search.value = st.q;
const boardLab = make('label', 'cf-check'), boardChk = make('input'); boardChk.type = 'checkbox'; boardChk.checked = st.board;
boardLab.append(boardChk, make('span', '', '판서형 풀이만'));
filters.append(gradeBox, lab('월', monthSel), lab('연도', yearSel), lab('찾기', search), boardLab);
main.append(filters);
monthSel.addEventListener('change', () => { st.month = monthSel.value; render(); });
yearSel.addEventListener('change', () => { st.year = yearSel.value; render(); });
let timer; search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = search.value.trim(); render(); }, 120); });
boardChk.addEventListener('change', () => { st.board = boardChk.checked; render(); });

const status = make('p', 'cards-status'); status.setAttribute('role', 'status');
const list = make('div', 'cards-list');
const more = make('button', 'cards-more', '더 보기'); more.type = 'button';
main.append(status, list, more);
const foot = make('footer', 'cards-footer');
foot.append(make('p', '', '문항 출처: 한국교육과정평가원·시도교육청 시행 시험. 과목은 2022 개정 교육과정 기준으로 묶었어요.'));
main.append(foot);
app.append(main);

const options = (sel, vals, cur, all) => {
  sel.replaceChildren(); const o = make('option', '', all); o.value = ''; sel.append(o);
  for (const [v, t] of vals) { const x = make('option', '', t); x.value = v; sel.append(x); }
  sel.value = vals.some(([v]) => String(v) === cur) ? cur : ''; return sel.value;
};

// 과목별 문제 HTML은 처음 볼 때 한 번만 받는다.
const shards = {};
const previewVersion = new URL(document.currentScript.src).searchParams.get('v') || '';
const loadShard = s => shards[s] || (shards[s] = fetch(`assets/previews/${SLUG[s]}.json?v=${encodeURIComponent(previewVersion)}`).then(r => r.ok ? r.json() : {}).catch(() => ({})));
const typeset = el => {
  if (!window.renderMathInElement) return false;
  try { window.renderMathInElement(el, { delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch (e) { /* 카드 하나의 수식 실패가 목록을 막지 않게 */ }
  return true;
};
const pending = new Set();
const fill = async body => {
  const data = await loadShard(body.dataset.subject);
  const q = data[body.dataset.key];
  body.innerHTML = q || '<p class="pc-missing">문제 미리보기가 없어요. 눌러서 풀이 화면에서 보세요.</p>';
  body.querySelectorAll('img').forEach(i => { i.loading = 'lazy'; i.decoding = 'async'; i.alt = i.alt || '문제 그림'; });
  if (!typeset(body)) pending.add(body);
  body.dataset.filled = '1';
};
window.addEventListener('load', () => { for (const b of pending) typeset(b); pending.clear(); });
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); }
}, { rootMargin: '600px 0px' }) : null;

const PAGE = 48;
let rows = [], shown = 0, lastGroup = null, groupGrid = null;
function card(r) {
  const a = make('a', 'pcard'); a.href = r.href; a.style.setProperty('--subj', subjColor(r.subject));
  const head = make('div', 'pc-head');
  head.append(make('span', 'pc-exam', examLine(r)), make('span', 'pc-no', `${r.number}번`));
  if (r.board) head.append(make('span', 'pc-badge', '판서형'));
  const body = make('div', 'pc-body'); body.dataset.key = key(r); body.dataset.subject = r.subject;
  a.setAttribute('aria-label', `${examLine(r)} 고${r.grade} ${r.number}번 풀이 보기`);
  a.append(head, body);
  if (io) io.observe(body); else fill(body);
  return a;
}
function appendPage() {
  const end = Math.min(rows.length, shown + PAGE);
  for (; shown < end; shown++) {
    const r = rows[shown], g = `고${r.grade} · ${monthLabel(r)}`;
    if (g !== lastGroup) {
      lastGroup = g;
      const sec = make('section', 'cards-group');
      const n = rows.filter(x => `고${x.grade} · ${monthLabel(x)}` === g).length;
      const h = make('h2', 'cg-title', g); h.append(make('span', 'cg-count', `${n}문항`));
      groupGrid = make('div', 'cg-grid');
      sec.append(h, groupGrid); list.append(sec);
    }
    groupGrid.append(card(r));
  }
  more.hidden = shown >= rows.length;
  more.textContent = `더 보기 (${(rows.length - shown).toLocaleString('ko-KR')}문항 남음)`;
}
more.addEventListener('click', appendPage);

function render(scrollTop) {
  for (const s of tabs) { tabBtns[s].classList.toggle('on', s === st.subject); tabBtns[s].setAttribute('aria-pressed', s === st.subject); }
  const inSub = records.filter(r => r.subject === st.subject);
  const grades = [...new Set(inSub.map(r => Number(r.grade)))].sort();
  if (!grades.includes(Number(st.grade))) st.grade = '';
  gradeBox.replaceChildren();
  for (const g of ['', ...grades]) {
    const b = make('button', 'gchip' + (String(g) === String(st.grade) ? ' on' : ''), g ? `고${g}` : '전체'); b.type = 'button';
    b.setAttribute('aria-pressed', String(g) === String(st.grade));
    b.addEventListener('click', () => { st.grade = String(g); st.month = ''; render(); });
    gradeBox.append(b);
  }
  const inGrade = inSub.filter(r => !st.grade || String(r.grade) === st.grade);
  const months = [...new Map(inGrade.map(r => [monthLabel(r), monthKey(r)])).entries()].sort((a, b) => a[1] - b[1]);
  st.month = options(monthSel, months.map(([l]) => [l, l]), st.month, '전체');
  const inMonth = inGrade.filter(r => !st.month || monthLabel(r) === st.month);
  const years = [...new Set(inMonth.map(r => Number(r.adminYear)))].sort((a, b) => b - a);
  st.year = options(yearSel, years.map(y => [String(y), `${y}년 시행`]), st.year, '전체');
  const words = st.q.split(/\s+/).filter(Boolean);
  rows = inMonth.filter(r => (!st.year || String(r.adminYear) === st.year) && (!st.board || r.board) &&
    words.every(w => searchText(r).includes(w)))
    .sort((a, b) => a.grade - b.grade || monthKey(a) - monthKey(b) || b.adminYear - a.adminYear || a.number - b.number);
  status.textContent = `${st.subject} · ${rows.length.toLocaleString('ko-KR')}문항`;
  list.replaceChildren(); shown = 0; lastGroup = null; groupGrid = null;
  if (!rows.length) list.append(make('p', 'cards-empty', '조건에 맞는 문항이 없어요.'));
  appendPage();
  const p = new URLSearchParams();
  p.set('subject', st.subject);
  for (const k of ['grade', 'month', 'year', 'q']) if (st[k]) p.set(k, st[k]);
  if (st.board) p.set('board', '1');
  history.replaceState(null, '', `${location.pathname}?${p}`);
  if (scrollTop) tabBar.scrollIntoView({ block: 'start' });
  loadShard(st.subject);
}
render();
})();
