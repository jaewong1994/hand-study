/* Reviewed explanations belong to the same stable step as their mathematics. */
(function (root) {
  'use strict';
  const forbidden = /\\(?:href|url|includegraphics|html\w*|def|gdef|newcommand|renewcommand|require)\b|<\/?(?:script|iframe)/i;
  function validate(note) {
    if (note == null) return true;
    if (typeof note !== 'object' || typeof note.title !== 'string' || !note.title.trim() || note.title.length > 120 ||
        typeof note.body !== 'string' || !note.body.trim() || note.body.length > 5000 || forbidden.test(note.body) ||
        !Array.isArray(note.skillTags) || note.skillTags.length > 8 ||
        note.skillTags.some(tag => typeof tag !== 'string' || !/^[a-z가-힣][a-z0-9가-힣_.-]{0,99}$/.test(tag))) {
      throw Error('풀이 설명의 형식이 올바르지 않습니다.');
    }
    return true;
  }
  function append(parent, note, stepId, doc) {
    if (!note) return;
    validate(note);
    const box = doc.createElement('aside');
    box.className = 'hs-explanation';
    box.dataset.stepId = stepId;
    box.dataset.skillTags = note.skillTags.join(' ');
    const title = doc.createElement('h3');
    title.className = 'hs-explanation-title';
    title.textContent = note.title;
    box.append(title);
    for (const paragraph of note.body.split(/\n\s*\n/)) {
      const p = doc.createElement('p');
      p.textContent = paragraph;
      box.append(p);
    }
    if (typeof root.renderMathInElement === 'function') root.renderMathInElement(box, {
      delimiters: [{left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}],
      preProcess: root.HandStudyTypography.inline,
      throwOnError: true, strict: 'ignore', trust: false
    });
    parent.append(box);
  }
  const api = Object.freeze({validate, append});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HandStudyExplanations = api;
})(typeof window === 'object' ? window : globalThis);
