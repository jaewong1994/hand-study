/* Local, deterministic label layout. Coordinates are final SVG user units.
 * This module never edits geometry, text, font sizes, or target identities. */
(function (root) {
  'use strict';
  const VERSION = '1.0.0-alpha.1';
  const finite = Number.isFinite;
  const point = p => p && finite(p.x) && finite(p.y);
  const box = b => point(b) && finite(b.width) && finite(b.height) && b.width > 0 && b.height > 0;
  const center = b => ({x: b.x + b.width / 2, y: b.y + b.height / 2});
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const expand = (b, p) => ({x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p});
  const intersects = (a, b) => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
  function segmentHitsBox(a, b, r) {
    let lo = 0, hi = 1;
    for (const [start, delta, min, max] of [[a.x, b.x-a.x, r.x, r.x+r.width], [a.y, b.y-a.y, r.y, r.y+r.height]]) {
      if (Math.abs(delta) < 1e-12) { if (start < min || start > max) return false; }
      else {
        const u = (min-start)/delta, v = (max-start)/delta;
        lo = Math.max(lo, Math.min(u,v)); hi = Math.min(hi, Math.max(u,v));
        if (lo > hi) return false;
      }
    }
    return true;
  }
  function obstacleHits(b, o, clearance) {
    const area = expand(b, clearance + (o.padding || 0) + (o.strokeWidth || 0)/2);
    if (o.type === 'rect') return intersects(area, o.box);
    for (let i=1; i<o.points.length; i++) if (segmentHitsBox(o.points[i-1], o.points[i], area)) return true;
    return false;
  }
  function validate(scene) {
    const errors = [];
    if (!scene || !box(scene.viewport)) return ['viewport-invalid'];
    if (!['new_authoring','source_faithful'].includes(scene.mode)) errors.push('mode-required');
    if (!Array.isArray(scene.labels) || scene.labels.length > 64) errors.push('labels-invalid-or-limit');
    if (!Array.isArray(scene.obstacles) || scene.obstacles.length > 10000) errors.push('obstacles-invalid-or-limit');
    for (const name of ['clearance','margin','maxMove']) if (scene[name] !== undefined && (!finite(scene[name]) || scene[name] < 0)) errors.push(name+'-invalid');
    const ids = new Set();
    for (const l of Array.isArray(scene.labels) ? scene.labels : []) {
      if (!l || typeof l.id !== 'string' || !l.id || ids.has(l.id) || typeof l.targetId !== 'string' || !l.targetId || !point(l.anchor) || !box(l.box)) errors.push('label-invalid');
      if (l) ids.add(l.id);
    }
    for (const o of Array.isArray(scene.obstacles) ? scene.obstacles : []) {
      if (!o || !['polyline','rect'].includes(o.type) || (o.type === 'rect' ? !box(o.box) : !Array.isArray(o.points) || o.points.length < 2 || o.points.length > 20000 || !o.points.every(point))) errors.push('obstacle-invalid');
      for (const k of ['padding','strokeWidth']) if (o && o[k] !== undefined && (!finite(o[k]) || o[k]<0)) errors.push('obstacle-width-invalid');
    }
    return errors;
  }
  function settings(scene) { return {clearance:scene.clearance ?? 3, margin:scene.margin ?? 3, maxMove:scene.maxMove ?? 36}; }
  function outside(b, v, margin) {
    return b.x < v.x+margin || b.y < v.y+margin || b.x+b.width > v.x+v.width-margin || b.y+b.height > v.y+v.height-margin;
  }
  function geometryIssues(scene, l, b, opts) {
    const issues = [];
    if (outside(b,scene.viewport,opts.margin)) issues.push({kind:'clipping',labelId:l.id});
    for (const o of scene.obstacles) if (obstacleHits(b,o,opts.clearance)) issues.push({kind:'geometry-overlap',labelId:l.id,obstacleId:o.id});
    return issues;
  }
  function audit(scene, placements) {
    const errors = validate(scene);
    if (placements !== undefined && (!Array.isArray(placements) || placements.some(p=>!p || typeof p.id!=='string'))) errors.push('placements-invalid');
    if (errors.length) return {ok:false,errors,issues:[]};
    const opts = settings(scene), byId = new Map((placements || scene.labels).map(l=>[l.id,l]));
    const issues = [], placed = [];
    if (byId.size !== scene.labels.length || (placements && placements.length !== scene.labels.length)) errors.push('placement-cardinality');
    for (const l of scene.labels) {
      const p = byId.get(l.id);
      if (!p || !box(p.box) || p.targetId !== l.targetId || p.box.width !== l.box.width || p.box.height !== l.box.height) { errors.push('placement-identity-or-size:'+l.id); continue; }
      const moved = distance(center(l.box),center(p.box));
      if ((scene.mode === 'source_faithful' || l.locked) && moved > 1e-7) errors.push('locked-label-moved:'+l.id);
      if (moved > opts.maxMove+1e-7) errors.push('movement-limit:'+l.id);
      issues.push(...geometryIssues(scene,l,p.box,opts));
      for (const other of placed) if (intersects(expand(p.box,opts.clearance/2),expand(other.box,opts.clearance/2))) issues.push({kind:'label-overlap',labelId:l.id,otherId:other.id});
      placed.push(p);
    }
    return {ok:!errors.length && !issues.length,errors,issues};
  }
  function candidates(scene,l,opts) {
    const original = {...l.box}, c0 = center(original);
    if (scene.mode === 'source_faithful' || l.locked) return geometryIssues(scene,l,original,opts).length ? [] : [{box:original,cost:0}];
    const choices = [original];
    // The full measured rectangle, not just its baseline, must clear the anchor.
    for (const gap of [opts.clearance+1,opts.clearance+5,opts.clearance+10,opts.clearance+16]) for (let i=0;i<16;i++) {
      const a=i*Math.PI/8, dx=Math.cos(a), dy=Math.sin(a);
      const radius = Math.min(Math.abs(dx)>1e-9 ? original.width/2/Math.abs(dx) : Infinity, Math.abs(dy)>1e-9 ? original.height/2/Math.abs(dy) : Infinity) + gap;
      choices.push({x:l.anchor.x+dx*radius-original.width/2,y:l.anchor.y+dy*radius-original.height/2,width:original.width,height:original.height});
    }
    const seen = new Set(), result = [];
    for (const b of choices) {
      const c=center(b), movement=distance(c,c0), key=b.x.toFixed(6)+','+b.y.toFixed(6);
      if (seen.has(key) || movement>opts.maxMove || geometryIssues(scene,l,b,opts).length) continue;
      seen.add(key);
      // Do not put A visibly closer to a different point than to its own point.
      if (scene.labels.some(other=>other.targetId!==l.targetId && distance(other.anchor,l.anchor)>1e-7 && distance(c,other.anchor)+1e-7<distance(c,l.anchor))) continue;
      result.push({box:b,cost:movement+distance(c,l.anchor)*0.03});
    }
    return result.sort((a,b)=>a.cost-b.cost || a.box.x-b.box.x || a.box.y-b.box.y);
  }
  function layout(scene) {
    const before=audit(scene);
    if (before.errors.length) return {version:VERSION,status:'invalid',before,placements:[],changedIds:[]};
    const originals=scene.labels.map(l=>({id:l.id,targetId:l.targetId,box:{...l.box}}));
    if (scene.mode === 'source_faithful' || before.ok) return {version:VERSION,status:before.ok?'unchanged':'needs_review',before,after:before,placements:originals,changedIds:[]};
    const opts=settings(scene), domains=scene.labels.map(l=>({label:l,choices:candidates(scene,l,opts)})).sort((a,b)=>a.choices.length-b.choices.length || a.label.id.localeCompare(b.label.id,'en'));
    const fail = reason => ({version:VERSION,status:'needs_review',reason,before,after:before,placements:originals,changedIds:[]});
    if (domains.some(d=>!d.choices.length)) return fail('no-safe-candidate');
    let beam=[{cost:0,placements:[]}];
    for (const d of domains) {
      const next=[];
      for (const branch of beam) for (const c of d.choices) {
        if (branch.placements.some(p=>intersects(expand(c.box,opts.clearance/2),expand(p.box,opts.clearance/2)))) continue;
        next.push({cost:branch.cost+c.cost,placements:[...branch.placements,{id:d.label.id,targetId:d.label.targetId,box:c.box}]});
      }
      next.sort((a,b)=>a.cost-b.cost); beam=next.slice(0,48);
      if (!beam.length) return fail('joint-placement-search-exhausted');
    }
    const map=new Map(beam[0].placements.map(l=>[l.id,l])), placements=scene.labels.map(l=>map.get(l.id));
    const after=audit(scene,placements);
    if (!after.ok) return fail('post-layout-verification');
    return {version:VERSION,status:'placed',before,after,placements,changedIds:placements.filter((p,i)=>distance(center(p.box),center(originals[i].box))>1e-7).map(p=>p.id)};
  }
  const api={VERSION,validate,audit,layout,segmentHitsBox,obstacleHits};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.NGD2FigureLabelLayout=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
