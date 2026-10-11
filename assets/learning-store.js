(function(root){'use strict';
const KEY='hand-study:learning:v1';
const id=r=>String(r.sourceKey||r.itemId);
let cachedRaw=null,cachedValue={};
function read(){try{const raw=localStorage.getItem(KEY)||'{}';if(raw===cachedRaw)return cachedValue;const v=JSON.parse(raw);cachedRaw=raw;cachedValue=v&&typeof v==='object'&&!Array.isArray(v)?v:{};return cachedValue;}catch{return {};}}
function get(r){const v=read()[id(r)];if(!v||typeof v!=='object')return {};if(v.contentHash!==r.contentHash||v.sourceHash!==r.sourceHash)return {saved:!!v.saved,note:typeof v.note==='string'?v.note:''};return v;}
function update(r,patch){try{const all={...read()};all[id(r)]={...get(r),...patch,contentHash:r.contentHash,sourceHash:r.sourceHash,updated:Date.now()};localStorage.setItem(KEY,JSON.stringify(all));cachedRaw=null;return true;}catch{return false;}}
root.LearningStore=Object.freeze({id,read,get,update});
})(window);
