// ==UserScript==
// @name         Discord Wiki — Sparse Explorer
// @namespace    https://github.com/JadanPoll/Discord-Wiki
// @version      0.10.0
// @description  Source-backed topics and selective reading inside Discord. No account credentials or background retrieval.
// @match        https://discord.com/*
// @run-at       document-end
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setClipboard
// ==/UserScript==

(async function () {
  'use strict';
  if(window.top!==window.self)return;
  const VERSION = '0.10.0', KEY = 'dw-sparse-v1', ROOT = 'dw-sparse-explorer';
  if(document.getElementById(ROOT)||document.getElementById('dw-boot'))return;
  // Independent diagnostics: mount before the storage/application layer.
  const started=new Date().toISOString(),journal=[],failures=[];
  let bootStep='storage',extraReport=()=>({});
  const metrics={appearance:{explicitToggles:0,repairs:0,viewportResizes:0,focusEvents:0,blurEvents:0},canvas:{opens:0,closes:0,pans:0,pinches:0,zooms:0,cancels:0,inspections:0,sourceJumps:0,labels:0,serverOpens:0,serverJumps:0,folderToggles:0,flings:0,flingStops:0,fitCount:0,peakVelocity:0,historyAttempts:0,historyAdded:0,historyEmpty:0,historyBlocked:0},marks:{favorite:0,note:0},scans:0,scanMs:0,maxScanMs:0,storageReads:0,storageWrites:0,storageVerified:0,storageMismatch:0,actions:{},selection:{attempts:0,resolved:0,rejected:0},navigation:{channelChanges:0,messageJumps:0},clipboard:{attempts:0,success:0,fallback:0}};
  const diagnostic=document.createElement('div');diagnostic.id='dw-boot';
  diagnostic.style.cssText='all:initial!important;position:fixed!important;top:3px!important;right:8px!important;z-index:2147483647!important;display:block!important';
  const ds=diagnostic.attachShadow({mode:'open'});
  const st=document.createElement('style');st.textContent=':host{color:#222;font:13px system-ui}button{font:13px system-ui;background:white;color:#222;border:1px solid #94a3b8;border-radius:6px;padding:7px 10px;cursor:pointer}section{position:fixed;top:52px;right:12px;width:min(560px,calc(100vw - 24px));max-height:85vh;overflow:auto;background:#fff;color:#222;border:1px solid #94a3b8;border-radius:10px;padding:12px;box-sizing:border-box;box-shadow:0 6px 28px #0005;font:13px system-ui}textarea{width:100%;height:min(50vh,360px);box-sizing:border-box;resize:vertical;font:12px monospace;color:#111;background:#f8fafc}header{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px}strong{flex:1}p{margin:7px 0} [hidden]{display:none!important}';ds.append(st);
  const boot=document.createElement('button');boot.textContent='Wiki · starting';boot.style.cssText='font-size:12px;line-height:16px;padding:4px 7px;white-space:nowrap';ds.append(boot);
  const diagPanel=document.createElement('section');diagPanel.hidden=true;ds.append(diagPanel);
  const header=document.createElement('header');diagPanel.append(header);
  const heading=document.createElement('strong');heading.textContent='Discord Wiki · Diagnostics';header.append(heading);
  function db(label,fn){const btn=document.createElement('button');btn.textContent=label;btn.onclick=fn;header.append(btn);return btn}
  const diagStatus=document.createElement('p');diagPanel.append(diagStatus);
  const area=document.createElement('textarea');area.readOnly=true;area.setAttribute('aria-label','Diagnostic report');diagPanel.append(area);
  const privacy=document.createElement('p');privacy.textContent='No conversation text, links, account credentials or raw console logs.';diagPanel.append(privacy);
  function safeError(e){
    const allowed=new Set(['Error','TypeError','ReferenceError','SyntaxError','RangeError','NotAllowedError','SecurityError','QuotaExceededError','InvalidStateError','AbortError','DataCloneError']);
    const name=allowed.has(e?.name)?e.name:'UnknownError';
    const msg=String(e?.message||'');
    const structural=/^(?:[A-Za-z_$][\w$]* is not defined|Cannot access '[\w$]+' before initialization|Cannot read properties of (?:null|undefined) \(reading '[\w$]+'\)|[\w.$]+ is not a function)$/;
    return {name,detail:structural.test(msg)?msg:undefined};
  }
  function fail(stage,e){failures.push({at:new Date().toISOString(),stage,...safeError(e)});if(failures.length>30)failures.shift();boot.textContent='Wiki · errors '+failures.length}
  function count(selector){try{return document.querySelectorAll(selector).length}catch{return null}}
  function snapshot(){let app={};try{app=extraReport()}catch(e){app={snapshotError:safeError(e)}}
    return {schema:1,version:VERSION,started,exported:new Date().toISOString(),phase:bootStep,
      browser:{viewport:[innerWidth,innerHeight],touchPoints:navigator.maxTouchPoints,readyState:document.readyState,body:!!document.body,shadowDOM:typeof Element.prototype.attachShadow==='function',clipboard:typeof navigator.clipboard?.writeText==='function'},
      storage:{legacyRead:typeof GM_getValue==='function',legacyWrite:typeof GM_setValue==='function',modernRead:typeof GM!=='undefined'&&typeof GM.getValue==='function',modernWrite:typeof GM!=='undefined'&&typeof GM.setValue==='function'},
      page:{channelRoute:location.pathname.startsWith('/channels/'),messageContents:count('[id^="message-content-"]'),messageRows:count('[id^="chat-messages-"]'),reactions:count('[class*="reactions_"]'),focusClass:document.documentElement.classList.contains('dw-focus'),overlayPresent:!!document.getElementById(ROOT)},app,metrics,failures,journal};
  }
  function refreshReport(){area.value=JSON.stringify(snapshot(),null,2);diagStatus.textContent='Phase: '+bootStep+' · '+failures.length+' errors';}
  function showReport(){diagPanel.hidden=false;refreshReport()}
  db('Refresh',refreshReport);
  db('Copy report',async()=>{refreshReport();try{
    if(typeof GM_setClipboard==='function')await GM_setClipboard(area.value,'text');
    else if(typeof GM!=='undefined'&&typeof GM.setClipboard==='function')await GM.setClipboard(area.value,'text');
    else await navigator.clipboard.writeText(area.value);
    diagStatus.textContent='Report copied — paste into ChatGPT.';
  }catch(e){fail('report-copy',e);refreshReport();area.focus();area.select();diagStatus.textContent='Clipboard unavailable. Long-press and copy the selected report.'}});
  db('Select all',()=>{area.focus();area.select();area.setSelectionRange(0,area.value.length)});
  db('Close',()=>{diagPanel.hidden=true});
  boot.onclick=()=>{if(diagPanel.hidden)showReport();else diagPanel.hidden=true};
  (document.body||document.documentElement).append(diagnostic);
  try {
  if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const gmLegacy=typeof GM_getValue==='function'&&typeof GM_setValue==='function';
  const gmModern=typeof GM!=='undefined'&&typeof GM.getValue==='function'&&typeof GM.setValue==='function';
  const storage=gmLegacy?'legacy GM':gmModern?'modern GM':'session only';
  const volatile=new Map();
  async function read(key,def){
    metrics.storageReads++;
    if(gmLegacy)return (await GM_getValue(key,def))??def;
    if(gmModern)return (await GM.getValue(key,def))??def;
    return volatile.has(key)?volatile.get(key):def;
  }
  async function write(key,value){
    metrics.storageWrites++;
    if(gmLegacy)return await GM_setValue(key,value);
    if(gmModern)return await GM.setValue(key,value);
    volatile.set(key,value);
  }
  async function copy(text){
    metrics.clipboard.attempts++;
    if(typeof GM_setClipboard==='function'){await GM_setClipboard(text,'text');metrics.clipboard.success++;return;}
    if(typeof GM!=='undefined'&&typeof GM.setClipboard==='function'){await GM.setClipboard(text,'text');metrics.clipboard.success++;return;}
    try{await navigator.clipboard.writeText(text);metrics.clipboard.success++;return;}catch{}
    metrics.clipboard.fallback++;
    const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;inset:12% 5%;width:90%;height:70%;z-index:2147483647;background:white;color:black;font:14px monospace';
    const close=document.createElement('button');close.textContent='Close copy box';close.style.cssText='position:fixed;top:4%;right:5%;z-index:2147483647;background:white;color:black;padding:10px';
    close.onclick=()=>{t.remove();close.remove()};document.body.append(t,close);t.focus();t.select();
    throw Error('Automatic clipboard unavailable; copy from the selected text box.');
  }
  const fresh = () => ({schema:1, sources:{}, topics:{}, visits:[], conversations:[], marks:{}});
  let data, topic = 'General', opened = false, picked = null, packet = [], packetOrigin = '', warning = '';
  const log = [];
  function record(event, detail = '') {
    log.push({at:new Date().toISOString(), event, detail});
    if (log.length > 60) log.shift();
    journal.push({at:new Date().toISOString(),event,detail});if(journal.length>60)journal.shift();
    console.info('[DW]', event, detail);
  }
  const isId = s => typeof s === 'string' && /^\d{15,22}$/.test(s);
  function parseLink(raw) {
    try {
      const u = new URL(raw);
      if (u.origin !== 'https://discord.com') return null;
      const m = u.pathname.match(/^\/channels\/(\d{15,22})\/(\d{15,22})\/(\d{15,22})\/?$/);
      if (!m) return null; // intentionally excludes DMs and ambiguous source links
      const [,guild,channel,message] = m;
      return {guild,channel,message,url:'https://discord.com/channels/'+guild+'/'+channel+'/'+message};
    } catch { return null; }
  }
  function keyOf(s) { return s.guild+'/'+s.channel+'/'+s.message; }
  function topicName(v) {
    const s = String(v || '').trim();
    if (!s || s.length > 120 || (s === 'prototype' || Object.hasOwn(Object.prototype,s))) throw Error('Invalid topic name');
    return s;
  }
  function region(raw) {
    const title=String(raw?.title||'').trim().slice(0,180);
    if(!title||!Array.isArray(raw.messages)||!raw.messages.length||raw.messages.length>100)throw Error('Expected title and 1–100 message links');
    const links=[...new Set(raw.messages.map(u=>{const p=parseLink(u);if(!p)throw Error('Invalid message link');return p.url}))];
    const first=parseLink(links[0]);
    if(links.some(u=>{const p=parseLink(u);return p.guild!==first.guild||p.channel!==first.channel}))throw Error('A conversation must belong to one channel');
    links.sort((a,b)=>{const x=BigInt(parseLink(a).message),y=BigInt(parseLink(b).message);return x<y?-1:x>y?1:0});
    return {id:keyOf(parseLink(links[0])),title,messages:links,topics:[...new Set((Array.isArray(raw.topics)?raw.topics:[]).map(topicName))].slice(0,20),note:String(raw.note||'').slice(0,4000),verified:raw.verified===true};
  }
  function upsert(next,raw){
    const r=region(raw),i=next.conversations.findIndex(x=>x.id===r.id);
    if(i<0)next.conversations.push(r);else next.conversations[i]=r;
    return r;
  }
  function normalize(input) {
    if (!input || input.schema !== 1 || !input.sources || !input.topics) throw Error('Expected Sparse Explorer schema 1');
    const out = fresh();
    for (const value of Object.values(input.sources)) {
      const s = parseLink(value?.url);
      if (!s) throw Error('Invalid source link');
      out.sources[keyOf(s)] = s;
    }
    for (const [name, entries] of Object.entries(input.topics)) {
      const t = topicName(name);
      if (!Array.isArray(entries)) throw Error('Invalid topic entries');
      out.topics[t] = [];
      for (const e of entries) {
        if (!e || !Object.hasOwn(out.sources,e.source)) throw Error('Topic contains unresolved source');
        const note = String(e.note || '').slice(0,4000);
        if (!out.topics[t].some(x => x.source === e.source && x.note === note))
          out.topics[t].push({source:e.source,note});
      }
    }
    if (Array.isArray(input.visits)) out.visits = input.visits.filter(v =>
      v && isId(v.guild) && isId(v.channel) && typeof v.at === 'string'
    ).map(v => ({guild:v.guild,channel:v.channel,at:v.at})).slice(-500);
    if(input.conversations!==undefined){
      if(!Array.isArray(input.conversations))throw Error('Invalid conversations');
      for(const r of input.conversations)upsert(out,r);
    }
    for(const [url,m] of Object.entries(input.marks||{})){
      const src=parseLink(url);if(!src||!m||typeof m!=='object')continue;
      const note=String(m.note||'').slice(0,4000),favorite=m.favorite===true;
      if(favorite||note)out.marks[src.url]={favorite,note,text:String(m.text||'').slice(0,12000),at:typeof m.at==='string'?m.at:''};
    }
    return out;
  }
  try { data = normalize(await read(KEY,fresh())); }
  catch(e) { data = fresh(); warning = 'Saved data could not be loaded; changes blocked until reload or valid import.'; record('load-failed');fail('load-storage',e); }
  async function latest() {
    if (warning) throw Error(warning);
    return normalize(await read(KEY,fresh()));
  }
  async function save(next, event) {
    if (warning && event !== 'import') throw Error(warning);
    await write(KEY,next);
    const check=normalize(await read(KEY,fresh()));
    if(JSON.stringify(check)!==JSON.stringify(normalize(next))){metrics.storageMismatch++;throw Error('Saved workspace readback differs from requested state');}
    metrics.storageVerified++;data=check; warning = ''; record(event); render();
  }
  async function merge(incoming) {
    const next = warning ? fresh() : await latest();
    Object.assign(next.sources,incoming.sources);
    for (const [name,entries] of Object.entries(incoming.topics)) {
      const target = next.topics[name] ||= [];
      for (const entry of entries) if (!target.some(e => e.source===entry.source && e.note===entry.note)) target.push(entry);
    }
    const seen = new Set(next.visits.map(v=>JSON.stringify(v)));
    for (const v of incoming.visits) if (!seen.has(JSON.stringify(v))) { next.visits.push(v); seen.add(JSON.stringify(v)); }
    next.visits = next.visits.slice(-500);
    for(const r of incoming.conversations)if(!next.conversations.some(x=>x.id===r.id))next.conversations.push(r);
    for(const [url,m] of Object.entries(incoming.marks))if(!next.marks[url])next.marks[url]=m;
    await save(next,'import');
  }
  function el(tag, text, parent) {
    const node=document.createElement(tag); if(text!==undefined) node.textContent=text;
    if(parent) parent.append(node); return node;
  }
  bootStep='interface';
  const host=el('div'); host.id=ROOT; document.body.append(host);
  const shadow=host.attachShadow({mode:'open'});
  const css=el('style',`
    :host{all:initial;position:fixed!important;right:12px!important;top:3px!important;right:108px!important;bottom:auto!important;z-index:2147483646!important;font:13px system-ui,sans-serif;color:#1e293b}
    *{box-sizing:border-box} button,input,textarea,select{font:inherit} button{cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1e293b;padding:6px 9px}
    button:hover{background:#eaf0ff} button:focus-visible,a:focus-visible{outline:2px solid #5265c9} .primary{background:#4663b5;color:white;border-color:#4663b5}
    .panel{position:fixed;right:12px;top:52px;bottom:12px;width:min(310px,calc(100vw - 24px));overflow:auto;background:#f4f1f8;border:1px solid #dedbe5;border-radius:9px;padding:13px;box-shadow:0 4px 18px #27364a14;scrollbar-gutter:stable}
    .launcher{justify-content:flex-end;background:#f7f3ec;padding:0 2px;border:0;border-radius:5px;gap:4px;flex-wrap:nowrap}
    .launcher button{font-size:12px;line-height:16px;padding:4px 7px;white-space:nowrap;touch-action:manipulation}
    .canvas{position:fixed;z-index:3;background:#f7f3ec;color:#283342;border:1px solid #ded9d0;border-radius:9px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 18px #27364a18}
    .canvas-head{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 9px;background:#fffdfa;border-bottom:1px solid #e3ded5}
    .canvas-head button{padding:5px 8px;min-height:30px;touch-action:manipulation}
    .canvas-count{flex:1;min-width:110px;font-size:12px;color:#657487}
    .canvas-view{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none;overscroll-behavior:contain;user-select:none;cursor:grab;background-color:#f5f2eb;background-image:radial-gradient(#d8d4ca 1px,transparent 1px);background-size:20px 20px}
    .canvas-view.dragging{cursor:grabbing}
    .canvas-world{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform;touch-action:none}
    .canvas-card{position:absolute;width:300px;height:174px;overflow:hidden;box-sizing:border-box;padding:11px 13px;text-align:left;border:1px solid #d9dce3;border-radius:8px;background:#fffdfa;color:#283342;display:flex;flex-direction:column;gap:6px;touch-action:none;cursor:pointer}
    .canvas-card[data-density="1"]{background:#f8f6f1}.canvas-card[data-density="2"]{background:#f2f1f7}.canvas-card[data-density="3"]{background:#eaeaf3}
    .canvas-card[data-low="1"]{color:#8792a1;background:#f7f4ee;border-color:#e7e2d9}
    .canvas-card[data-saved="1"]{border-left:4px solid #4663b5}
    .canvas-card[data-favorite="1"]{border-left:4px solid #c39b38}.canvas-markbar{display:flex;gap:4px;position:absolute;right:7px;bottom:5px;background:inherit;border-radius:5px}.canvas-markbar button,.mark-action{min-width:29px;min-height:26px;padding:2px 6px;border:1px solid transparent;background:transparent;color:#687689;font-size:16px;line-height:1}.canvas-markbar button[aria-pressed="true"],.mark-action[aria-pressed="true"]{color:#9a7018;background:#fff1c7}.canvas-preview{padding-bottom:18px}.note-editor{position:fixed;z-index:20;top:54px;right:12px;width:min(360px,calc(100vw - 24px));background:#fff6d9;border:1px solid #d9bf74;border-radius:8px;padding:12px;box-shadow:0 6px 25px #27364a33}.note-editor textarea{min-height:110px;background:#fffdf4}.saved-mark{border-left:3px solid #c39b38;padding-left:8px}
    .canvas-card:focus-visible{outline:3px solid #4663b5}
    .canvas-meta{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .canvas-label{font-size:12px;color:#4663b5;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .canvas-preview{font-size:14px;line-height:1.45;white-space:pre-wrap;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical}
    .canvas-detail{position:absolute;z-index:4;right:10px;bottom:10px;width:min(400px,calc(100% - 20px));max-height:65%;overflow:auto;padding:12px;background:#fffdfa;border:1px solid #cbd4ed;border-radius:9px;box-shadow:0 6px 30px #27364a28;user-select:text}
    .canvas-detail p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;margin:8px 0}
    .canvas-detail .row{margin:4px 0}
    .canvas-day{position:absolute;font-size:12px;color:#687689;font-weight:650;white-space:nowrap}
    .server-card{width:224px;height:84px;justify-content:center;background:#fffdfa}.server-name{font-size:16px;font-weight:650;line-height:1.3;overflow-wrap:anywhere}.server-card[data-saved="1"]{background:#e9eefc}
    @media(max-width:480px){.launcher{flex-wrap:wrap}}
    .panel details{border-top:1px solid #e1dce7;padding:9px 0}.panel summary{cursor:pointer;font-weight:500;color:#53647b}
    .panel .entry{background:#fffdfa;border-color:#e1dce7}
    .panel .scroll{max-height:none;overflow:visible}
    .panel h3{color:#27364a}
    @media(max-width:900px){.panel{width:min(340px,calc(100vw - 24px));box-shadow:0 5px 24px #27364a44}}
    @media(max-width:480px){:host{right:8px!important;top:48px!important}.panel{top:88px}}
    .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:7px 0} .grow{flex:1;min-width:0} input,textarea,select{border:1px solid #cbd5e1;background:white;color:#1e293b;padding:7px;border-radius:5px;width:100%}
    textarea{min-height:65px;resize:vertical} .muted{font-size:11px;color:#64748b} .status{margin:7px 0;overflow-wrap:anywhere} .entry{background:white;padding:8px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;overflow-wrap:anywhere;white-space:pre-wrap}
    a{color:#384da5} h3{margin:0;font-size:14px} .scroll{max-height:34vh;overflow:auto} [hidden]{display:none!important}
  `,shadow);
  // Focus is reversible CSS only. Keep conversation text, author identity,
  // replies, attachments, navigation and search available.
  // Selector precedents: 3pm-dev/vencord-ui-compact-customization/custom.css,
  // bildpunkt/focus-discord/focus.theme.css. No remote stylesheet dependency.
  const focusStyle=el('style',`
    html.dw-focus :is([id^="chat-messages-"],[class*="searchResult_"]) [class*="reactions_"],
    html.dw-focus :is([role="menu"],[aria-label="Message Actions"]) :is([id*="message-quickreact"],[id*="message-actions-quickreact"],[aria-label^="Click to react with"]),
    html.dw-focus [class*="avatarDecoration_"],
    html.dw-focus [class*="profileEffects_"],
    html.dw-focus :is([role="button"],button):is([aria-label="Send a gift"],[aria-label="Open sticker picker"],[aria-label="Open GIF picker"],[aria-label="Select emoji"]) {display:none!important}
    html.dw-focus [data-dw-low="1"] {opacity:.48!important}
    html.dw-focus [data-dw-low="1"]:hover,html.dw-focus [data-dw-low="1"]:focus-within {opacity:1!important}
    html.dw-focus [data-dw-label]::before {content:attr(data-dw-label);display:block;color:var(--text-normal,#64748b);font-size:12px;font-weight:600;padding:5px 0 3px;border-top:1px solid var(--background-modifier-accent,#9ca3af);white-space:normal;pointer-events:none}
    html.dw-focus [id^="message-content-"] img.emoji {filter:grayscale(1);opacity:.68}
    html.dw-focus [id^="message-content-"] img.emoji:hover {filter:none;opacity:1}
    html.dw-focus [id^="message-content-"] img.emoji[class*="jumboable"] {width:1.3em!important;height:1.3em!important;object-fit:contain}
    html.dw-focus #channels :is([class*="name_"],[class*="nameContainer_"]) {filter:grayscale(1)}
    html.dw-focus [aria-label="Servers sidebar"] img {filter:grayscale(.85)}
    html.dw-focus [aria-label="Servers sidebar"] img:hover {filter:none}
    html.dw-focus [data-list-id="chat-messages"] [class*="guildTag_"],
    html.dw-focus [data-list-id="chat-messages"] [class*="nameplate_"],
    html.dw-focus [class*="channelTextArea_"] [class*="emojiButtonNormal_"] {display:none!important}
    html.dw-focus [data-list-id="chat-messages"] [class*="username_"] {color:var(--text-default,inherit)!important}
    html.dw-focus [data-list-id="chat-messages"] [class*="timestamp_"] {color:var(--text-muted,inherit)!important}
    html.dw-focus [data-list-id="chat-messages"] [id^="message-content-"] {line-height:1.45}
    html.dw-focus [data-dw-label]::before {color:var(--text-default,#94a3b8);border-color:var(--border-subtle,#64748b)}
    html.dw-focus #channels img.emoji {filter:grayscale(1)}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"] {filter:grayscale(.85);opacity:.72}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"]:hover {filter:none;opacity:1}
    html.dw-focus [id^="chat-messages-"] [class*="username_"] {color:var(--text-default,inherit)!important}
  `,document.head);
  // Notebook palette and layout, grounded in the captured native list/header/grid
  // and Discord-Wiki's own paper theme. No rearrangement of React message nodes.
  const notebookStyle=el('style',`
    html.dw-focus,html.dw-focus :is(.theme-dark,.theme-darker,.theme-light){
      color-scheme:light!important;
      --app-frame-background:#f2ede3!important;--app-frame-border:#e3ded5!important;
      --background-base-low:#fffdfa!important;--background-base-lower:#f2ede3!important;--background-base-lowest:#eae5dc!important;
      --background-surface-high:#fffdfa!important;--background-surface-higher:#fffdfa!important;--background-surface-highest:#fff!important;
      --background-primary:#fffdfa!important;--background-secondary:#f2ede3!important;--background-secondary-alt:#eee9df!important;--background-tertiary:#eae5dc!important;
      --chat-background:#fffdfa!important;--chat-background-default:#fffdfa!important;--chat-border:#e3ded5!important;
      --channel-background-default:#f2ede3!important;--channeltextarea-background:#f7f3ec!important;
      --background-mod-muted:#27364a08!important;--background-mod-subtle:#27364a0b!important;--background-mod-normal:#27364a12!important;--background-mod-strong:#27364a1a!important;
      --background-modifier-hover:#4663b50b!important;--background-modifier-active:#4663b514!important;--background-modifier-selected:#e9eefc!important;
      --interactive-background-hover:#4663b50c!important;--interactive-background-active:#e9eefc!important;--interactive-background-selected:#e9eefc!important;--interactive-background-default:#eae5dc!important;
      --text-default:#283342!important;--text-strong:#1c2734!important;--text-muted:#6a788a!important;--text-subtle:#657487!important;--text-normal:#283342!important;
      --header-primary:#283342!important;--header-secondary:#687689!important;--channels-default:#46546a!important;--channel-icon:#748195!important;
      --interactive-text-default:#46546a!important;--interactive-text-hover:#26374a!important;--interactive-text-active:#26374a!important;
      --interactive-icon-default:#687689!important;--interactive-icon-hover:#334257!important;--interactive-icon-active:#334257!important;
      --interactive-normal:#657487!important;--interactive-hover:#334257!important;--interactive-active:#334257!important;
      --icon-default:#46546a!important;--icon-strong:#26374a!important;--icon-subtle:#778497!important;--icon-muted:#8290a1!important;
      --border-subtle:#e3ded5!important;--border-muted:#eee9e2!important;--border-normal:#d6dce5!important;--border-strong:#bbc5d3!important;--border-focus:#4663b5!important;
      --input-background-default:#fffdfa!important;--input-border-default:#d6dce5!important;--input-text-default:#283342!important;--input-placeholder-text-default:#748195!important;
      --channel-text-area-placeholder:#748195!important;--text-link:#3557a6!important;--text-brand:#4663b5!important;--icon-link:#3557a6!important;
      --text-code:#283342!important;--text-code-keyword:#a03b58!important;--text-code-string:#386849!important;--text-code-comment:#6a788a!important;--text-code-number:#975a27!important;--background-code:#eef1f5!important;
      --scrollbar-auto-thumb:#c8c8c4!important;--scrollbar-auto-scrollbar-color-thumb:#c8c8c4!important;--scrollbar-auto-scrollbar-color-track:#f7f3ec!important;--scrollbar-thin-thumb:#c8c8c4!important;
      --custom-message-margin-left-content-cozy:24px!important;--custom-message-margin-horizontal:18px!important;--custom-message-spacing-vertical-container-cozy:3px!important;
    }
    html.dw-focus body{background:#f7f3ec!important;color:#283342!important}
    html.dw-focus :is([class*="base_"],[class*="page_"]):has([data-list-id="chat-messages"]){background:#f7f3ec}
    html.dw-focus [class*="sidebarList_"]{background:#f2ede3!important;border-color:#e3ded5!important}
    html.dw-focus #channels{background:#f2ede3!important;padding:3px 6px!important}
    html.dw-focus [aria-label="Servers sidebar"]{background:#eae5dc!important}
    html.dw-focus.dw-server-channel [class*="sidebar_"]:has(#channels){--custom-guild-sidebar-width:258px!important;--custom-guild-list-width:54px!important}
    html.dw-focus.dw-server-channel:not(.dw-communities) [class*="sidebar_"]:has(#channels){--custom-guild-sidebar-width:205px!important;--custom-guild-list-width:0px!important}
    html.dw-focus.dw-server-channel:not(.dw-communities) nav[aria-label="Servers sidebar"]{display:none!important}
    html.dw-focus #channels a[href^="/channels/"] [class*="iconContainer_"],
    html.dw-focus #channels a[href^="/channels/"] [class*="iconItem_"],
    html.dw-focus #channels a[href^="/channels/"] [class*="children_"],
    html.dw-focus #channels [class*="basicChannelRowLink_"] > svg,
    html.dw-focus [aria-label="Channel header"] [class*="channelIcon_"],
    html.dw-focus [aria-label="Channel header"] [class*="dot_"],
    html.dw-focus [class*="headerEllipseBackdrop_"],
    html.dw-focus [class*="headerEllipseForeground_"],
    html.dw-focus [class*="headerGlass_"],
    html.dw-focus [class*="inviteButton_"],
    html.dw-focus [data-list-id="chat-messages"] img[class*="avatar_"],
    html.dw-focus [data-list-id="chat-messages"] [class*="avatarDecoration_"],
    html.dw-focus [data-list-id="chat-messages"] [class*="timestampVisibleOnHover_"],
    html.dw-focus [aria-label="Channel header"] [aria-label="Notification Settings"]{display:none!important}
    html.dw-focus #channels a[href^="/channels/"]{padding:4px 7px!important;border-radius:5px!important}
    html.dw-focus #channels a[href^="/channels/"] [class*="name_"]{font-size:13px;line-height:1.5;color:#46546a!important}
    html.dw-focus #channels [class*="modeSelected_"] a{background:#e9eefc!important;box-shadow:inset 2px 0 #4663b5}
    html.dw-focus #channels [class*="modeSelected_"] [class*="name_"]{color:#26374a!important;font-weight:650}
    html.dw-focus #channels [class*="name_"][data-dw-clean-name]{font-size:0!important}
    html.dw-focus #channels [data-dw-clean-name]>*{display:none!important}
    html.dw-focus #channels [data-dw-clean-name]::after{content:attr(data-dw-clean-name);font-size:13px;line-height:1.5;color:inherit}
    html.dw-focus #channels h3{color:#718098!important;font-size:11px!important;letter-spacing:.4px}
    html.dw-focus #channels [class*="unread_"]{opacity:.45}
    html.dw-focus [aria-label="Channel header"] [class*="title_"][data-dw-clean-name]{font-size:0!important}
    html.dw-focus [aria-label="Channel header"] [data-dw-clean-name]::after{content:attr(data-dw-clean-name);font-size:16px;color:#283342;font-weight:700}
    html.dw-focus #channels h3[data-dw-clean-name]::after{font-size:11px}
    html.dw-focus [aria-label="Channel header"]{background:#f7f3ec!important;color:#283342!important;border-color:#e3ded5!important}
    html.dw-focus [aria-label="Channel header"] h1{font-size:16px!important;font-weight:700!important;color:#283342!important}
    html.dw-focus main[class*="chatContent_"],html.dw-focus [class*="messagesWrapper_"]{background:#fffdfa!important}
    html.dw-focus [data-list-id="chat-messages"]{padding-inline:12px!important}
    html.dw-focus [data-list-id="chat-messages"] > li[id^="chat-messages-"] > [role="article"]{padding-inline:12px!important;border-radius:5px;box-sizing:border-box}
    html.dw-focus [data-list-id="chat-messages"] [class*="header_"]{padding-inline-start:0!important;margin-inline-start:0!important;font-size:12px!important}
    html.dw-focus [data-list-id="chat-messages"] [class*="username_"]{font-size:12px!important;font-weight:650!important;color:#526174!important}
    html.dw-focus [data-list-id="chat-messages"] [class*="timestamp_"]{font-size:11px!important;color:#748195!important}
    html.dw-focus [data-list-id="chat-messages"] [id^="message-content-"]{font-size:15px;line-height:1.55;color:#283342}
    html.dw-focus [data-list-id="chat-messages"] [data-dw-density="1"]{background:#f8f6f1}
    html.dw-focus [data-list-id="chat-messages"] [data-dw-density="2"]{background:#f2f1f7}
    html.dw-focus [data-list-id="chat-messages"] [data-dw-density="3"]{background:#eaeaf3}
    html.dw-focus [data-dw-label]::before{color:#4663b5!important;font-size:13px!important;font-weight:700!important;border-color:#cbd4ed!important;padding:7px 0 5px!important}
    html.dw-focus .dw-native-marks{display:inline-flex;gap:2px;vertical-align:middle;margin-left:8px}html.dw-focus .dw-native-marks button{font:15px system-ui;color:#758195;background:transparent;border:0;padding:2px 6px;cursor:pointer}html.dw-focus .dw-native-marks button[aria-pressed="true"]{color:#9a7018;background:#fff1c7;border-radius:4px}html:not(.dw-focus) .dw-native-marks{display:none!important}
    html.dw-focus [data-dw-low="1"]{opacity:.52!important}
    html.dw-focus [data-dw-low="1"]:hover,html.dw-focus [data-dw-low="1"]:focus-within{opacity:1!important}
    html.dw-focus [class*="channelTextArea_"] [class*="scrollableContainer_"]{background:#f7f3ec!important;border:1px solid #e3ded5!important;border-radius:8px}
    html.dw-focus [data-dw-clean-name]{overflow:hidden;text-overflow:ellipsis}
    @media(min-width:901px){html.dw-focus.dw-contents-open [class*="page_"]:has([data-list-id="chat-messages"]){padding-inline-end:324px!important;box-sizing:border-box!important}}
    @media(max-width:900px){html.dw-focus.dw-server-channel [class*="sidebar_"]:has(#channels){--custom-guild-sidebar-width:225px!important}html.dw-focus.dw-server-channel:not(.dw-communities) [class*="sidebar_"]:has(#channels){--custom-guild-sidebar-width:171px!important}}
  `,document.head);
  let focus=true;try{focus=(await read('dw-focus',true))!==false}catch(e){record('focus-load-failed');fail('load-focus',e)}
  const launcher=el('div',undefined,shadow);launcher.className='row launcher';launcher.style.margin='0';
  const communities=el('button','Servers',launcher);communities.title='Browse communities spatially';
  let communitiesOpen=false;
  function updateRouteStyle(){const root=document.documentElement;const onServer=!!channelRoute();root.classList.toggle('dw-server-channel',onServer);root.classList.toggle('dw-communities',communitiesOpen);communities.hidden=!focus;communities.setAttribute('aria-expanded',String(communitiesOpen));}
  communities.addEventListener('click',()=>{try{openCanvas('servers')}catch(e){fail('server-map',e);showReport()}});
  const focusToggle=el('button','');
  focusToggle.title='Switch between notebook and original Discord';
  function applyFocus(){
    document.documentElement.classList.toggle('dw-focus',focus);
    focusToggle.textContent=focus?'Reading: on':'Reading: off';
    focusToggle.setAttribute('aria-pressed',String(focus));updateRouteStyle();
  }
  focusToggle.addEventListener('click',async(e)=>{
    if(!e.isTrusted)return;
    focus=!focus;metrics.appearance.explicitToggles++;record('appearance-toggle',String(focus));applyFocus();
    try{await write('dw-focus',focus);record('focus',String(focus))}catch(e){record('focus-save-failed');fail('save-focus',e)}
  });
  applyFocus();
  const toggle=el('button','Contents',launcher); toggle.className='primary';
  const panel=el('section',undefined,shadow); panel.className='panel'; panel.hidden=true;
  const titleRow=el('div',undefined,panel); titleRow.className='row';
  const title=el('h3','Saved',titleRow); title.className='grow';
  function btn(parent,label,fn,primary=false) {
    const b=el('button',label,parent); if(primary)b.className='primary';
    b.addEventListener('click',async()=>{const m=metrics.actions[label]||=( {attempts:0,completed:0,failed:0} );m.attempts++;if(b.disabled)return;b.disabled=true;try{await fn();m.completed++}catch(e){m.failed++;status('Error: '+e.message);record('action-failed',label);fail('action:'+label,e);showReport()}finally{b.disabled=false}}); return b;
  }
  btn(titleRow,'Hide',()=>setOpen(false));
  const canvasToggle=btn(launcher,'Canvas',()=>openCanvas('messages'));launcher.insertBefore(canvasToggle,toggle);
  const stats=el('div','',panel); stats.className='muted';
  const captureBox=el('details',undefined,panel);el('summary','Label a conversation',captureBox);
  const row=el('div',undefined,captureBox); row.className='row';
  const topics=el('select',undefined,row); topics.className='grow'; topics.setAttribute('aria-label','Current topic');
  topics.addEventListener('change',()=>{topic=topics.value;render()});
  btn(row,'New topic',async()=>{const n=prompt('Topic name (e.g. MEMS / Fabrication)');if(n===null)return;const t=topicName(n);const next=await latest();next.topics[t] ||= [];topic=t;await save(next,'topic-created')});
  const sourceInput=el('input',undefined,captureBox);sourceInput.placeholder='Paste Discord message link';sourceInput.setAttribute('aria-label','Source message link');
  sourceInput.addEventListener('input',()=>{picked=null;packet=[];packetOrigin=''});
  const labelInput=el('input',undefined,captureBox);labelInput.placeholder='Conversation title (optional)';labelInput.setAttribute('aria-label','Conversation title');
  const note=el('textarea',undefined,captureBox);note.placeholder='Why is this worth returning to? Optional personal annotation.';note.setAttribute('aria-label','Personal annotation');
  const actions=el('div',undefined,captureBox);actions.className='row';
  btn(actions,'Save',async()=>{
    const source=parseLink(sourceInput.value.trim()) || (!sourceInput.value.trim() ? picked : null);
    if(!source)throw Error('Select a message in its original channel or paste its Copy Message Link URL.');
    const selected = picked && source.url === picked.url && packet.length ? packet.map(p=>p.source) : [source];
    const next=await latest(), entries=next.topics[topic] ||= [], text=note.value.trim().slice(0,4000);
    for(const src of selected){
      const id=keyOf(src);next.sources[id]=src;
      if(!entries.some(e=>e.source===id && e.note===text))entries.push({source:id,note:text});
    }
    if(labelInput.value.trim()){const r=region({title:labelInput.value,messages:selected.map(p=>p.url),topics:[topic],note:text,verified:true});if(next.conversations.some(x=>x.id===r.id)&&!confirm('Replace existing conversation label?'))return;upsert(next,r);}
    await save(next,'capture');sourceInput.value='';note.value='';labelInput.value='';picked=null;packet=[];packetOrigin='';status('Saved '+selected.length+' source(s) in '+topic);
  },true);
  btn(actions,'Use visible messages',async()=>{
    const rows=visibleRows();if(!rows.length)throw Error('No visible messages recognized. Copy report to diagnose.');
    stage(rows.slice(0,30),'visible');
  });
  btn(actions,'Copy conversation',async()=>{
    if(!packet.length)throw Error('Select text spanning the messages you want to explore first.');
    await write('dw-last-packet',packet.map(p=>p.source.url));
    await copy(JSON.stringify({topic,messages:packet.map(packetJSON)},null,2),'text');
    status('Copied '+packet.length+' selected message(s) for LLM exploration. Review before sharing.');
    record('conversation-copied',String(packet.length));
  });
  async function copyForLabels(){
    if(!packet.length||packetOrigin==='loaded'||packetOrigin==='visible'){const rows=visibleRows(true);if(!rows.length)throw Error('No loaded channel messages recognized');const bounded=[];let chars=0;for(const p of rows){if(bounded.length>=100||chars+p.text.length>60000)break;bounded.push(p);chars+=p.text.length;}stage(bounded,'loaded');record('loaded-window',String(rows.length));}
    await write('dw-last-packet',packet.map(p=>p.source.url));
    await copy(JSON.stringify({instruction:'Propose concise specific conversation titles. Group related messages; ignore trivial chatter. Windows may contain chronological gaps, so do not assume every adjacent record belongs to the same conversation. Use only the supplied exact URLs. Return JSON: {"conversations":[{"title":"...","messages":["exact URL"],"topics":["..."],"note":"optional"}]}',messages:packet.map(packetJSON)},null,2),'text');
    status('Copied '+packet.length+' messages. Paste into ChatGPT, then Import LLM labels.');record('label-packet',String(packet.length));packetOrigin='loaded';
  }
  const quick=el('div',undefined,panel);quick.className='row';panel.insertBefore(quick,captureBox);
  btn(quick,'Copy for AI',()=>copyResearch(),true);
  const hint=el('div','Select messages, or use visible messages. Save a title to return later. AI copy uses selected messages or the loaded channel window, not the entire channel.',captureBox);hint.className='muted';
  const msg=el('div','',panel);msg.className='status';msg.setAttribute('role','status');
  function status(s){msg.textContent=s}
  const indexHeader=el('div',undefined,panel);indexHeader.className='row';
  const indexLabel=el('h3','Favorites & notes',indexHeader);indexLabel.className='grow';
  const scope=el('select',undefined,indexHeader);scope.style.width='auto';
  for(const [value,label] of [['channel','This channel'],['all','All channels']]){const o=el('option',label,scope);o.value=value;}
  scope.addEventListener('change',()=>renderIndex());
  const filter=el('input',undefined,panel);filter.placeholder='Find conversation or topic';filter.addEventListener('input',()=>renderIndex());
  const index=el('div',undefined,panel);index.className='scroll';
  const proposalBox=el('details',undefined,panel);el('summary','Import AI organization',proposalBox);
  const proposalInput=el('textarea',undefined,proposalBox);proposalInput.placeholder='Paste JSON returned by ChatGPT';
  const preview=el('div',undefined,proposalBox);
  btn(proposalBox,'Review',async()=>{
    const raw=JSON.parse(proposalInput.value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,''));
    if(!Array.isArray(raw.conversations)||raw.conversations.length>50)throw Error('Expected up to 50 conversations');
    const allow=new Set(await read('dw-last-packet',[]));
    if(!allow.size)throw Error('Copy a labeling packet first.');
    const candidates=raw.conversations.map(x=>region({...x,verified:false}));
    if(candidates.some(r=>r.messages.some(u=>!allow.has(u))))throw Error('Proposal contains URLs not in last copied packet');
    preview.replaceChildren();
    for(const r of candidates){
      const item=el('div',undefined,preview);item.className='entry';
      const label=el('input',undefined,item);label.value=r.title;
      el('div',r.messages.length+' messages · '+r.topics.join(' / '),item).className='muted';
      if(r.note)el('div',r.note,item);
      const a=el('a','Open source',item);a.href=r.messages[0];a.target='_blank';a.rel='noopener';
      btn(item,'Accept',async()=>{const next=await latest();const existing=next.conversations.find(x=>x.id===r.id);if(existing&&!confirm('Replace existing label: '+existing.title+'?'))return;upsert(next,{...r,title:label.value,verified:true});await save(next,'label-accepted');item.remove();status('Label accepted');});
      btn(item,'Ignore',()=>item.remove());
    }
    status(candidates.length+' proposals ready.');
  });
  const legacy=el('details',undefined,panel);el('summary','Individual bookmarks',legacy);
  const list=el('div',undefined,legacy);list.className='scroll';
  const tools=el('details',undefined,panel);el('summary','Settings / backup',tools);tools.append(focusToggle,captureBox,legacy);captureBox.querySelector('summary').textContent='Advanced manual capture';
  btn(tools,'Native server rail',()=>{communitiesOpen=!communitiesOpen;updateRouteStyle();record('communities',String(communitiesOpen));setOpen(false)});
  const footer=el('div',undefined,tools);footer.className='row';
  btn(footer,'Copy JSON',async()=>{await copy(JSON.stringify(await latest(),null,2),'text');status('Workspace copied (links + your notes).')});
  btn(footer,'Import JSON',async()=>{const raw=prompt('Paste exported workspace JSON to merge');if(raw===null)return;await merge(normalize(JSON.parse(raw)));status('Merged workspace.')});
  // Diagnostics already has an independent persistent launcher.
  extraReport=()=>({storageMode:storage,topics:Object.keys(data.topics).length,sources:Object.keys(data.sources).length,conversations:data.conversations.length,staged:packet.length,packetOrigin,stagedCharacters:packet.reduce((n,p)=>n+p.text.length,0),nativeListCount:count('[data-list-id="chat-messages"]'),nativeRowCount:count('[data-list-id="chat-messages"] > li[id^="chat-messages-"]'),storageWarning:!!warning,marks:Object.keys(data.marks).length,focus,recognition:recognitionReport(),geometry:geometryReport(),canvas:{open:canvasOpen,mode:canvasMode,serverEntries:serverRows.length,world:[canvasSize.w,canvasSize.h],messages:canvasRows.length,historyBusy,historyStatus,nativeScroller:(()=>{const n=nativeScroller();return n?{top:Math.round(n.scrollTop),height:n.clientHeight,scrollHeight:n.scrollHeight}:null})(),encountered:encountered.size,zoom:Math.round(camera.z*100)/100,x:Math.round(camera.x),y:Math.round(camera.y),width:canvasView.clientWidth,height:canvasView.clientHeight},notebook:{communitiesOpen,cleanNames:count('[data-dw-clean-name]'),densityCards:count('[data-dw-density]'),channelIcons:effectReport('#channels a[href^="/channels/"] [class*="iconContainer_"]'),themeBackground:getComputedStyle(document.querySelector('main[class*="chatContent_"]')||document.body).backgroundColor},effects:{reactions:effectReport('[class*="reactions_"]'),emoji:effectReport('[id^="message-content-"] img.emoji'),lowSignal:effectReport('[data-dw-low]'),avatarDecorations:effectReport('[class*="avatarDecoration_"]'),inlineLabels:count('[data-dw-label]')},indexEntries:index.children.length});

  function channelRoute(){return location.pathname.match(/^\/channels\/(\d{15,22})\/(\d{15,22})(?:\/|$)/);}
  function classifySource(node){
    const route=channelRoute();
    if(!route)return {reason:'no-server-channel'};
    if(node.closest('[class*="searchResult"],[class*="searchResults"],[class*="searchResultGroup"]'))return {reason:'search-result'};
    const row=node.closest('li[id^="chat-messages-"]');
    if(!row)return {reason:'no-message-row'};
    if(!row.parentElement?.matches('[data-list-id="chat-messages"]'))return {reason:'outside-native-message-list'};
    const match=row.id.match(/^chat-messages-(\d{15,22})-(\d{15,22})$/);
    if(!match)return {reason:'row-id-shape'};
    const mid=node.id.slice('message-content-'.length);
    if(match[1]!==route[2])return {reason:'channel-mismatch'};
    if(match[2]!==mid)return {reason:'message-mismatch'};
    const source=parseLink('https://discord.com/channels/'+route[1]+'/'+route[2]+'/'+mid);
    return source?{reason:'recognized',source}:{reason:'link-invalid'};
  }
  function sourceFor(node){return classifySource(node).source||null;}
  function recognitionReport(){
    const reasons={},visibleReasons={},unique=new Set();let duplicate=0;
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      const r=classifySource(node),box=node.getBoundingClientRect();
      reasons[r.reason]=(reasons[r.reason]||0)+1;
      if(box.bottom>0&&box.top<innerHeight&&box.width>0&&box.height>0)visibleReasons[r.reason]=(visibleReasons[r.reason]||0)+1;
      if(r.source){const id=keyOf(r.source);if(unique.has(id))duplicate++;unique.add(id);}
    }
    return {reasons,visibleReasons,uniqueRecognized:unique.size,duplicates:duplicate};
  }
  function effectReport(selector){
    const nodes=[...document.querySelectorAll(selector)],out={matched:nodes.length,hidden:0,faded:0,grayscale:0};
    for(const n of nodes){const c=getComputedStyle(n);if(c.display==='none'||c.visibility==='hidden')out.hidden++;if(Number(c.opacity)<.95)out.faded++;if(c.filter.includes('grayscale'))out.grayscale++;}
    return out;
  }
  function geometryReport(){
    const box=node=>{const r=node.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),overflowBottom:Math.max(0,Math.round(r.bottom-innerHeight)),scrollHeight:node.scrollHeight,clientHeight:node.clientHeight}};
    return {opened,panel:box(panel),launcher:box(launcher),visualViewport:window.visualViewport?[Math.round(visualViewport.width),Math.round(visualViewport.height)]:null};
  }
  // Native list is the identity contract, not arbitrary chat-messages containers.
  function messagePacket(node,source){
    const row=node.closest('li[id^="chat-messages-"]');
    const author=row?.querySelector('h3 [class*="username_"]');
    const time=row?.querySelector('time[datetime]');
    const reply=row?.querySelector('[class*="repliedMessage_"]');
    const date=new Date(Number(BigInt(source.message)>>22n)+1420070400000);
    return {source,text:node.innerText||node.textContent||'',author:author?.textContent?.trim()||null,
      timestamp:time?.getAttribute('datetime')||(Number.isFinite(date.getTime())?date.toISOString():null),
      reply:reply?.innerText?.trim().slice(0,1000)||null,
      attachments:row?.querySelectorAll('[class*="attachment_"],[class*="embedFull_"]').length||0};
  }
  function packetJSON(p){return {url:p.source.url,text:p.text,author:p.author,timestamp:p.timestamp,reply:p.reply,attachments:p.attachments}}
  function visibleRows(loaded=false){
    const result=[],seen=new Set();
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      if(!loaded){const r=node.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight||r.width===0||r.height===0)continue;}
      const source=sourceFor(node);if(source&&!seen.has(keyOf(source))){seen.add(keyOf(source));result.push(messagePacket(node,source));}
    }
    return result;
  }
  // Stable chronological grid, adapted from RSM_Tree_Viewer's atlas camera.
  // Snapshot the currently rendered window; no automatic history requests.
  let canvasOpen=false,canvasMode='messages',canvasRows=[],serverRows=[],canvasSize={w:0,h:0},canvasFrame=0;
  let canvasSlots=[],messageCols=0,historyBusy=false,historyStatus='',historyGeneration=0,edgeDirection='',edgeTravel=0,lastHistoryAt=0;const HISTORY_LIMIT=400;
  let inertiaFrame=0,velocity={x:0,y:0},lastMotion=0;const PAN_GAIN=1.85,PINCH_GAIN=1.65,FRICTION_MS=245;
  const encountered=new Map();let encounteredChannel='';
  const camera={x:0,y:0,z:1},pointers=new Map();let pinch=null,dragged=false,suppressUntil=0;
  const canvas=el('section',undefined,shadow);canvas.className='canvas';canvas.hidden=true;canvas.setAttribute('aria-label','Conversation canvas');
  const canvasHead=el('div',undefined,canvas);canvasHead.className='canvas-head';
  const canvasCount=el('span','',canvasHead);canvasCount.className='canvas-count';
  btn(canvasHead,'−',()=>zoomCanvas(camera.z/1.6));
  btn(canvasHead,'+',()=>zoomCanvas(camera.z*1.6));
  btn(canvasHead,'Fit',fitCanvas);
  const canvasCopy=btn(canvasHead,'Copy for AI',()=>copyResearch(canvasRows));
  const canvasView=el('div',undefined,canvas);canvasView.className='canvas-view';canvasView.setAttribute('aria-label','Drag to pan, pinch to zoom');
  const world=el('div',undefined,canvasView);world.className='canvas-world';
  const detail=el('section',undefined,canvas);detail.className='canvas-detail';detail.hidden=true;
  // The two human actions share one message identity and one local record.
  const noteEditor=el('section',undefined,shadow);noteEditor.className='note-editor';noteEditor.hidden=true;
  el('strong','Note',noteEditor);
  const noteField=el('textarea',undefined,noteEditor);noteField.placeholder='What matters to you?';
  const noteActions=el('div',undefined,noteEditor);noteActions.className='row';
  let noteTarget=null,markQueue=Promise.resolve();
  function mutateMark(p,change){
    const task=markQueue.then(async()=>{
      const next=await latest(),url=p.source.url;
      const old=next.marks[url]||{favorite:false,note:'',text:'',at:''};
      const m={...old,...change(old),text:String(p.text||old.text||'').slice(0,12000),at:new Date().toISOString()};
      if(m.favorite||m.note)next.marks[url]=m;else delete next.marks[url];
      await save(next,'mark-saved');
    });
    markQueue=task.catch(()=>{});return task;
  }
  function editMarkNote(p){
    noteTarget=p;noteField.value=data.marks[p.source.url]?.note||'';noteEditor.hidden=false;noteField.focus();
  }
  btn(noteActions,'Save',async()=>{if(!noteTarget)return;const target=noteTarget;await mutateMark(target,()=>({note:noteField.value.trim().slice(0,4000)}));metrics.marks.note++;noteEditor.hidden=true;noteTarget=null});
  btn(noteActions,'Cancel',()=>{noteEditor.hidden=true;noteTarget=null});
  function syncMarkButton(b){
    const m=data.marks[b.dataset.dwMarkUrl],isNote=b.dataset.dwMarkKind==='note',active=isNote?!!m?.note:!!m?.favorite;
    const glyph=isNote?(active?'▣':'▤'):(active?'★':'☆');
    if(b.textContent!==glyph)b.textContent=glyph;
    b.setAttribute('aria-pressed',String(active));
    const name=isNote?'Note':'Favorite';b.setAttribute('aria-label',name);b.title=name;
    const card=b.closest('.canvas-card');if(card){if(m?.favorite)card.dataset.favorite='1';else delete card.dataset.favorite;}
  }
  function syncMarks(){
    for(const b of [...shadow.querySelectorAll('[data-dw-mark-url]'),...document.querySelectorAll('[data-dw-mark-url]')])syncMarkButton(b);
  }
  function addMarkControls(parent,p,native=false){
    for(const kind of ['favorite','note']){
      const b=el('button',undefined,parent);b.type='button';b.className='mark-action';b.dataset.dwMarkUrl=p.source.url;b.dataset.dwMarkKind=kind;
      b.addEventListener('click',async e=>{
        e.stopPropagation();e.preventDefault();if(Date.now()<suppressUntil&&canvasOpen)return;
        if(kind==='note'){editMarkNote(p);return}
        if(b.disabled)return;b.disabled=true;
        try{await mutateMark(p,m=>({favorite:!m.favorite}));metrics.marks.favorite++}catch(err){fail('favorite',err);showReport()}finally{b.disabled=false}
      });syncMarkButton(b);
    }
  }
  async function copyResearch(rows=null){
    const state=await latest(),route=channelRoute();
    const all=scope.value==='all'&&!rows;
    const matches=url=>{const p=parseLink(url);return p&&(all||route&&p.guild===route[1]&&p.channel===route[2])};
    const sourceRows=rows||visibleRows(true);
    const marks=Object.entries(state.marks).filter(([url])=>matches(url)).map(([url,m])=>({url,...m}));
    // Favorited material remains recoverable even when its original row is unloaded.
    const messages=boundedRows(sourceRows).map(packetJSON);
    const saved=[];let bytes=messages.reduce((n,p)=>n+p.text.length,0);
    for(const m of marks){const text=m.text.slice(0,Math.max(0,60000-bytes-m.note.length));if(saved.length>=100||bytes+m.note.length>60000)break;saved.push({...m,text});bytes+=text.length+m.note.length}
    if(!messages.length&&!saved.length)throw Error('No messages or saved notes to copy');
    await write('dw-last-packet',[...new Set([...messages.map(m=>m.url),...saved.map(m=>m.url)])]);
    await copy(JSON.stringify({instruction:'Explore these source-backed messages and personal notes. Preserve source URLs. If useful, propose concise conversation titles and topics. Return JSON {"conversations":[{"title":"...","messages":["exact supplied URL"],"topics":["..."],"note":"optional"}]}. Each conversation must belong to one channel. Chronological gaps may exist. Notes are personal interpretations, not source claims.',messages,saved,omittedSaved:marks.length-saved.length},null,2));
    record('research-copied',messages.length+' messages, '+saved.length+' saved');
    status('Copied '+messages.length+' messages and '+saved.length+' saved notes/favorites.');
    if(canvasOpen){historyStatus='Copied '+messages.length+' messages + '+saved.length+' saved';scheduleCamera();}
  }
  function boundedRows(rows){const result=[];let chars=0;for(const r of rows){if(result.length>=100||chars+r.text.length>60000)break;result.push(r);chars+=r.text.length}return result}
  function rememberWindow(rows){
    const route=channelRoute(),key=route?route[1]+'/'+route[2]:'';
    if(key!==encounteredChannel){encountered.clear();encounteredChannel=key}
    if(!key)return;
    for(const p of rows){const id=keyOf(p.source);if(p.source.guild+'/'+p.source.channel!==key)continue;encountered.delete(id);encountered.set(id,p)}
    while(encountered.size>100)encountered.delete(encountered.keys().next().value);
  }
  function chronological(rows){return [...rows].sort((a,b)=>{const x=BigInt(a.source.message),y=BigInt(b.source.message);return x<y?-1:x>y?1:0})}
  function positionCanvas(){
    const main=document.querySelector('main[class*="chatContent_"]')||document.querySelector('[class*="messagesWrapper_"]');
    const r=main?.getBoundingClientRect();
    const left=r&&r.width>260?Math.max(8,Math.round(r.left)+5):8;
    const top=r?Math.max(48,Math.round(r.top)+3):48;
    canvas.style.left=left+'px';canvas.style.top=top+'px';canvas.style.right='8px';canvas.style.bottom='8px';
  }
  function stopInertia(){if(inertiaFrame){cancelAnimationFrame(inertiaFrame);inertiaFrame=0;metrics.canvas.flingStops++}velocity={x:0,y:0}}
  function boundAxis(pos,extent,viewport){
    if(extent<=viewport)return Math.max((viewport-extent)/2-64,Math.min((viewport-extent)/2+64,pos));
    return Math.max(viewport-extent-64,Math.min(64,pos));
  }
  function constrainCamera(){
    const w=canvasView.clientWidth,h=canvasView.clientHeight;if(!w||!h)return;
    camera.x=boundAxis(camera.x,canvasSize.w*camera.z,w);camera.y=boundAxis(camera.y,canvasSize.h*camera.z,h);
  }
  function startInertia(){
    if(Math.hypot(velocity.x,velocity.y)<.12)return;
    metrics.canvas.flings++;let last=performance.now();
    function tick(now){
      inertiaFrame=0;if(!canvasOpen||pointers.size)return;
      const dt=Math.min(40,Math.max(1,now-last));last=now;
      const decay=Math.exp(-dt/FRICTION_MS),travel=FRICTION_MS*(1-decay);
      const x=camera.x,y=camera.y;
      camera.x+=velocity.x*travel;camera.y+=velocity.y*travel;constrainCamera();
      velocity.x*=decay;velocity.y*=decay;
      if(Math.abs(camera.x-x)<.01)velocity.x=0;if(Math.abs(camera.y-y)<.01)velocity.y=0;
      scheduleCamera();
      if(Math.hypot(velocity.x,velocity.y)>.025)inertiaFrame=requestAnimationFrame(tick);
    }
    inertiaFrame=requestAnimationFrame(tick);
  }
  function applyCamera(){
    canvasFrame=0;world.style.transform='translate('+camera.x+'px,'+camera.y+'px) scale('+camera.z+')';
    canvasCount.textContent=(canvasMode==='servers'?serverRows.length+' navigation entries':canvasRows.length+' encountered messages')+' · '+Math.round(camera.z*100)+'%'+(canvasMode==='messages'&&historyStatus?' · '+historyStatus:'');
    canvasCount.title=canvasMode==='servers'?'Native server and folder entries; select a folder to expand it.':'Up to 100 messages encountered in this channel in this page session; chronological gaps may exist.';
  }
  function scheduleCamera(){if(!canvasFrame)canvasFrame=requestAnimationFrame(applyCamera)}
  function clampScale(z){return Math.max(.025,Math.min(3.5,z))}
  function zoomCanvas(z,px=canvasView.clientWidth/2,py=canvasView.clientHeight/2){
    stopInertia();const next=clampScale(z);const wx=(px-camera.x)/camera.z,wy=(py-camera.y)/camera.z;
    camera.x=px-wx*next;camera.y=py-wy*next;camera.z=next;constrainCamera();metrics.canvas.zooms++;scheduleCamera()
  }
  function fitCanvas(){
    stopInertia();const w=canvasView.clientWidth,h=canvasView.clientHeight;if(!w||!h||!canvasSize.w||!canvasSize.h)return;
    metrics.canvas.fitCount++;camera.z=clampScale(Math.min(1,(w-28)/canvasSize.w,(h-28)/canvasSize.h));
    camera.x=(w-canvasSize.w*camera.z)/2;camera.y=(h-canvasSize.h*camera.z)/2;scheduleCamera();
  }
  function inspectCanvas(p){
    metrics.canvas.inspections++;detail.replaceChildren();detail.hidden=false;
    const head=el('div',undefined,detail);head.className='row';
    const name=el('strong',p.author||'Message',head);name.className='grow';
    btn(head,'Close',()=>{detail.hidden=true});
    el('div',p.timestamp||'',detail).className='muted';
    if(p.reply)el('p','Reply context: '+p.reply,detail).className='muted';
    el('p',p.text||'(No text in this rendered message)',detail);
    if(p.attachments)el('div',p.attachments+' attachment / embed indicators · open source to view',detail).className='muted';
    const actions=el('div',undefined,detail);actions.className='row';
    const link=el('a','Open original',actions);link.href=p.source.url;link.addEventListener('click',()=>{metrics.canvas.sourceJumps++;closeCanvas()});
    addMarkControls(actions,p);
  }
  function renderCanvas(){
    world.replaceChildren();
    const labels=new Map();for(const r of data.conversations)for(const url of r.messages){if(!labels.has(url))labels.set(url,r.title)}
    const strideX=316,strideY=190,margin=10;
    const cols=messageCols||gridColumns(canvasRows.length,strideX,strideY);messageCols=cols;
    let row=0,col=0;
    for(const p of canvasSlots){
      if(!p){if(++col>=cols){col=0;row++}continue;}
      const day=p.timestamp?.slice(0,10)||'';
      const card=el('div',undefined,world);card.tabIndex=0;card.setAttribute('role','group');card.className='canvas-card';
      card.style.left=(margin+col*strideX)+'px';card.style.top=(margin+row*strideY)+'px';
      const title=labels.get(p.source.url);
      if(title){card.dataset.saved='1';el('div',title,card).className='canvas-label'}
      const time=p.timestamp?.slice(11,16)||'';
      el('div',[p.author||'Message',day,time,p.attachments?p.attachments+' attachments':''].filter(Boolean).join(' · '),card).className='canvas-meta';
      el('div',p.text||'(Attachment or no text)',card).className='canvas-preview';
      const n=p.text.length;card.dataset.density=n>=400?'3':n>=150?'2':n>=60?'1':'0';
      if(!p.attachments&&!p.reply&&lowSignal(p.text))card.dataset.low='1';
      const markbar=el('div',undefined,card);markbar.className='canvas-markbar';addMarkControls(markbar,p);
      card.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();return}inspectCanvas(p)});
      card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspectCanvas(p)}});
      if(++col>=cols){col=0;row++}
    }
    canvasSize={w:margin*2+cols*strideX-16,h:margin*2+(row+(col?1:0))*strideY-16};
    world.style.width=canvasSize.w+'px';world.style.height=canvasSize.h+'px';
  }
  function gridColumns(n,sx,sy){
    const aspect=Math.max(.5,Math.min(3,(canvasView.clientWidth||800)/(canvasView.clientHeight||500)));
    return Math.min(Math.max(1,n),Math.max(1,Math.round(Math.sqrt(n*aspect*sy/sx))));
  }
  function readServers(){
    const rail=document.querySelector('nav[aria-label="Servers sidebar"]');if(!rail)return [];
    const result=[];
    for(const node of rail.querySelectorAll('[role="treeitem"][data-list-item-id^="guildsnav___"]')){
      const raw=node.querySelector('[class*="hiddenVisually_"]')?.textContent?.trim()||'';
      const id=node.getAttribute('data-list-item-id')?.slice('guildsnav___'.length)||'';
      const folder=node.hasAttribute('aria-expanded');
      if(!raw||(!folder&&id!=='home'&&(!/^\d{15,22}$/.test(id)||!node.hasAttribute('aria-selected'))))continue;
      const name=raw.replace(/^(?:Unread messages,\s*|\d+\s+mentions?,\s*)+/i,'').replace(/,\s*(?:Voice call active|folder)$/i,'').trim();
      result.push({id,name:name||raw,folder,expanded:node.getAttribute('aria-expanded')==='true',selected:node.getAttribute('aria-selected')==='true',node});
    }
    return result;
  }
  function renderServers(refit=true){
    serverRows=readServers();world.replaceChildren();detail.hidden=true;
    const sx=236,sy=96,margin=10,cols=gridColumns(serverRows.length,sx,sy);
    for(const [i,item] of serverRows.entries()){
      const card=el('button',undefined,world);card.type='button';card.className='canvas-card server-card';
      card.style.left=(margin+(i%cols)*sx)+'px';card.style.top=(margin+Math.floor(i/cols)*sy)+'px';
      if(item.selected)card.dataset.saved='1';
      el('div',item.folder?(item.expanded?'Folder · expanded':'Folder · tap to expand'):(item.selected?'Current community':'Community'),card).className='canvas-meta';
      el('div',item.name,card).className='server-name';
      card.addEventListener('click',()=>{
        if(Date.now()<suppressUntil)return;
        if(!item.node.isConnected){renderServers(false);return}
        if(item.folder){
          metrics.canvas.folderToggles++;item.node.click();
          // Native React state owns folder expansion; re-read after the render settles.
          setTimeout(()=>{if(canvasOpen&&canvasMode==='servers'){renderServers(false);constrainCamera();scheduleCamera()}},200);
        }else{metrics.canvas.serverJumps++;closeCanvas();item.node.click()}
      });
    }
    canvasSize={w:margin*2+cols*sx-12,h:margin*2+Math.ceil(serverRows.length/cols)*sy-12};
    world.style.width=canvasSize.w+'px';world.style.height=canvasSize.h+'px';
    if(refit)fitCanvas();else scheduleCamera();
  }
  function openCanvas(mode='messages'){
    if(canvasOpen&&canvasMode===mode){closeCanvas();return}
    if(mode==='messages'){
      rememberWindow(visibleRows(true));const rows=chronological([...encountered.values()]);if(!rows.length)throw Error('No loaded channel messages recognized');
      canvasRows=rows.slice(-100);canvasSlots=[...canvasRows];messageCols=0;historyStatus='Drag past an edge for more';
    }else if(!readServers().length)throw Error('No native server entries recognized');
    if(canvasOpen)closeCanvas();
    setOpen(false);canvasMode=mode;canvasOpen=true;canvas.hidden=false;canvasCopy.hidden=mode!=='messages';
    communities.textContent=mode==='servers'?'Back to chat':'Servers';canvasToggle.textContent=mode==='messages'?'Timeline':'Canvas';
    positionCanvas();if(mode==='servers'){renderServers(false);metrics.canvas.serverOpens++}else renderCanvas();
    requestAnimationFrame(()=>{if(canvasOpen&&canvasMode===mode)fitCanvas()});metrics.canvas.opens++;record('canvas-open',mode+':'+(mode==='servers'?serverRows.length:canvasRows.length));
  }
  function closeCanvas(){
    if(!canvasOpen)return;historyGeneration++;historyBusy=false;edgeDirection='';edgeTravel=0;stopInertia();canvasOpen=false;canvas.hidden=true;detail.hidden=true;pointers.clear();pinch=null;dragged=false;
    canvasView.classList.remove('dragging');canvasToggle.textContent='Canvas';communities.textContent='Servers';metrics.canvas.closes++;record('canvas-close');
  }
  function trackHistoryEdge(dy){
    if(!canvasOpen||canvasMode!=='messages'||historyBusy||!dy)return;
    const h=canvasView.clientHeight,extent=canvasSize.h*camera.z;
    const center=(h-extent)/2,top=extent<=h?center:0,bottom=extent<=h?center:h-extent;
    const dir=dy>0&&camera.y>=top-30?'older':dy<0&&camera.y<=bottom+30?'newer':'';
    if(!dir){edgeTravel=0;edgeDirection='';return}
    if(dir!==edgeDirection){edgeDirection=dir;edgeTravel=0}
    edgeTravel+=Math.abs(dy);
  }
  function nativeScroller(){
    const list=document.querySelector('[data-list-id="chat-messages"]');
    for(let n=list?.parentElement;n&&n!==document.body;n=n.parentElement){
      if(/auto|scroll|overlay/.test(getComputedStyle(n).overflowY)&&n.clientHeight>0)return n;
    }
    return null;
  }
  function integrateHistory(rows,dir){
    const ids=new Set(canvasRows.map(p=>p.source.url)),ordered=chronological(canvasRows);
    const edge=BigInt((dir==='older'?ordered[0]:ordered[ordered.length-1]).source.message);
    const extra=chronological(rows.filter(p=>!ids.has(p.source.url)&&(dir==='older'?BigInt(p.source.message)<edge:BigInt(p.source.message)>edge)));
    const room=HISTORY_LIMIT-canvasRows.length,add=dir==='older'?extra.slice(-room):extra.slice(0,room);
    if(!room||!add.length)return 0;
    if(dir==='older'){
      const blanks=(messageCols-add.length%messageCols)%messageCols;
      canvasSlots=[...add,...Array(blanks).fill(null),...canvasSlots];
      camera.y-=Math.ceil(add.length/messageCols)*190*camera.z;
    }else canvasSlots.push(...add);
    canvasRows=chronological([...canvasRows,...add]);renderCanvas();constrainCamera();scheduleCamera();return add.length;
  }
  async function loadHistory(dir){
    if(!canvasOpen||canvasMode!=='messages'||historyBusy||Date.now()-lastHistoryAt<600)return;
    if(canvasRows.length>=HISTORY_LIMIT){historyStatus='400-message session limit';scheduleCamera();metrics.canvas.historyBlocked++;return}
    const scroller=nativeScroller();if(!scroller){historyStatus='Native history scroller not found';metrics.canvas.historyBlocked++;scheduleCamera();return}
    historyBusy=true;lastHistoryAt=Date.now();const gen=historyGeneration;metrics.canvas.historyAttempts++;
    historyStatus='Loading '+dir+' messages…';scheduleCamera();record('history-request',dir);
    try{
      // Only drive Discord's existing scroll surface on an explicit edge gesture.
      // No fetch interception, private API, automatic paging loop or credentials.
      scroller.scrollTop=dir==='older'?0:scroller.scrollHeight;
      for(const delay of [250,450,750,1000]){
        await new Promise(resolve=>setTimeout(resolve,delay));
        if(gen!==historyGeneration||!canvasOpen||canvasMode!=='messages')return;
        const n=integrateHistory(visibleRows(true),dir);
        if(n){metrics.canvas.historyAdded+=n;historyStatus='+'+n+' '+dir+' messages';record('history-added',dir+':'+n);return}
      }
      metrics.canvas.historyEmpty++;historyStatus='No additional '+dir+' messages loaded';record('history-empty',dir);
    }catch(e){fail('history-load',e);historyStatus='History load failed'}
    finally{if(gen===historyGeneration){historyBusy=false;edgeDirection='';edgeTravel=0;scheduleCamera()}}
  }
  function midpoint(){const [a,b]=[...pointers.values()];if(!a||!b)return null;const r=canvasView.getBoundingClientRect();return {x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}}
  canvasView.addEventListener('touchmove',e=>{if(pointers.size&&e.cancelable)e.preventDefault()},{passive:false});
  canvasView.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    stopInertia();lastMotion=performance.now();edgeDirection='';edgeTravel=0;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false});
    if(pointers.size===2){const m=midpoint();pinch={d:m.d,z:camera.z,wx:(m.x-camera.x)/camera.z,wy:(m.y-camera.y)/camera.z};dragged=true;metrics.canvas.pinches++}
  });
  window.addEventListener('pointermove',e=>{
    if(!canvasOpen)return;const p=pointers.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    const now=performance.now(),dt=Math.max(8,Math.min(70,now-lastMotion));lastMotion=now;
    if(Math.hypot(p.x-p.sx,p.y-p.sy)>6&&!p.moved){p.moved=true;metrics.canvas.pans++}
    if(pointers.size>=2&&pinch){const m=midpoint();camera.z=clampScale(pinch.z*Math.pow(m.d/pinch.d,PINCH_GAIN));camera.x=m.x-pinch.wx*camera.z;camera.y=m.y-pinch.wy*camera.z;dragged=true}
    else if(p.moved){trackHistoryEdge(dy*PAN_GAIN);camera.x+=dx*PAN_GAIN;camera.y+=dy*PAN_GAIN;dragged=true;const cap=v=>Math.max(-5,Math.min(5,v));velocity.x=.35*velocity.x+.65*cap(dx*PAN_GAIN/dt);velocity.y=.35*velocity.y+.65*cap(dy*PAN_GAIN/dt);metrics.canvas.peakVelocity=Math.max(metrics.canvas.peakVelocity,Math.round(Math.hypot(velocity.x,velocity.y)*100)/100)}
    else return;
    canvasView.classList.add('dragging');constrainCamera();scheduleCamera();
  });
  function endCanvasPointer(e){
    const p=pointers.get(e.pointerId);if(!p)return;const wasPinch=!!pinch;pointers.delete(e.pointerId);pinch=null;
    if(wasPinch){velocity={x:0,y:0};for(const other of pointers.values()){other.sx=other.x;other.sy=other.y;other.moved=false}}
    if(dragged||p.moved)suppressUntil=Date.now()+300;
    if(e.type==='pointercancel'){metrics.canvas.cancels++;record('canvas-pointer-cancel',e.pointerType||'unknown')}
    if(pointers.size===0){dragged=false;canvasView.classList.remove('dragging');if(e.type==='pointerup'&&!wasPinch&&edgeTravel>65&&edgeDirection){stopInertia();loadHistory(edgeDirection)}else if(e.type==='pointerup'&&!wasPinch&&p.moved&&performance.now()-lastMotion<90)startInertia();else stopInertia()}
  }
  window.addEventListener('pointerup',endCanvasPointer);window.addEventListener('pointercancel',endCanvasPointer);
  canvasView.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation()}},true);
  canvasView.addEventListener('wheel',e=>{e.preventDefault();const r=canvasView.getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoomCanvas(camera.z*Math.exp(-Math.max(-110,Math.min(110,e.deltaY))*.015),e.clientX-r.left,e.clientY-r.top);else{const unit=e.deltaMode===1?16:e.deltaMode===2?canvasView.clientHeight:1;stopInertia();trackHistoryEdge(-e.deltaY*unit*1.65);if(edgeTravel>65&&edgeDirection){loadHistory(edgeDirection);edgeTravel=0}camera.x-=e.deltaX*unit*1.65;camera.y-=e.deltaY*unit*1.65;constrainCamera();metrics.canvas.pans++;scheduleCamera()}},{passive:false});
  window.addEventListener('resize',()=>{if(canvasOpen)positionCanvas()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&canvasOpen){if(!detail.hidden)detail.hidden=true;else closeCanvas()}});
  function stage(rows,origin='selection'){
    if(!rows.length||rows.length>100||rows.reduce((n,p)=>n+p.text.length,0)>60000)throw Error('Select up to 100 messages / 60,000 characters');
    packet=rows;packetOrigin=origin;picked=rows[0].source;sourceInput.value=picked.url;
    record('source-staged',String(rows.length));setOpen(true);status(rows.length+' messages selected. Save a label or copy for AI.');
  }
  function renderIndex(){
    const route=channelRoute(),q=filter.value.toLowerCase();
    index.replaceChildren();
    for(const [url,m] of Object.entries(data.marks).reverse()){
      const src=parseLink(url);if(!src||scope.value!=='all'&&(!route||src.guild!==route[1]||src.channel!==route[2]))continue;
      if(![m.text,m.note].join(' ').toLowerCase().includes(q))continue;
      const item=el('div',undefined,index);item.className='entry saved-mark';
      const a=el('a',(m.favorite?'★ ':'')+(m.text||m.note||'Saved message').slice(0,150),item);a.href=url;
      if(m.note)el('div',m.note,item);
      const controls=el('div',undefined,item);controls.className='row';addMarkControls(controls,{source:src,text:m.text});
    }
    const regions=data.conversations.filter(r=>(scope.value==='all'||(route&&r.id.startsWith(route[1]+'/'+route[2]+'/')))&&[r.title,...r.topics,r.note].join(' ').toLowerCase().includes(q));
    regions.sort((a,b)=>{const x=BigInt(parseLink(a.messages[0]).message),y=BigInt(parseLink(b.messages[0]).message);return x>y?-1:x<y?1:0});
    for(const r of regions){
      const item=el('div',undefined,index);item.className='entry';
      const a=el('a',r.title,item);a.href=r.messages[0];
      const day=new Date(Number(BigInt(parseLink(r.messages[0]).message)>>22n)+1420070400000);
      el('div',(Number.isFinite(day.getTime())?day.toISOString().slice(0,10):'Unknown date')+' · '+r.messages.length+' messages · '+r.topics.join(' / '),item).className='muted';
      if(r.note)el('div',r.note,item);
      const controls=el('div',undefined,item);controls.className='row';
      btn(controls,'Edit',async()=>{const title=prompt('Conversation title',r.title);if(title===null)return;const tags=prompt('Topics (comma separated)',r.topics.join(', '));if(tags===null)return;const next=await latest();upsert(next,{...r,title,topics:tags.split(',').map(x=>x.trim()).filter(Boolean),verified:true});await save(next,'label-edited')});
      btn(controls,'Remove',async()=>{if(!confirm('Remove conversation label?'))return;const next=await latest();next.conversations=next.conversations.filter(x=>x.id!==r.id);await save(next,'label-removed')});
    }
    if(!index.children.length)el('div','Star a message or add a note to find it here later.',index).className='muted';
  }
  function lowSignal(text){
    return /^(?:lol+|lmao+|lmfao+|rofl|ha(?:ha)+|he(?:he)+|nice+|bruh+|xd)[.!\s]*$/i.test(text.trim());
  }
  function cleanName(raw){
    // Drop pictographic decorations and leading/trailing separators, retain meaningful words.
    const out=raw.replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\u20E3/gu,'').replace(/^[\s|•·‣—–─│┃｜︱┆┊-]+|[\s|•·‣—–─│┃｜︱┆┊-]+$/g,'').trim();
    return out||raw;
  }
  function annotateNavigation(){
    for(const node of document.querySelectorAll('#channels a[href^="/channels/"] [class*="name_"],#channels h3[class*="name_"],[aria-label="Channel header"] [class*="title_"]')){
      const raw=(node.textContent||'').trim();const clean=cleanName(raw);
      if(clean!==raw){if(node.dataset.dwCleanName!==clean)node.dataset.dwCleanName=clean}
      else if(node.hasAttribute('data-dw-clean-name'))delete node.dataset.dwCleanName;
    }
  }
  function annotateDOM(){
    const t=performance.now();metrics.scans++;
    reconcileAppearance('scan');updateRouteStyle();annotateNavigation();
    const labels=new Map(data.conversations.map(r=>[r.id,r.title]));
    const encounteredRows=[];
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      const source=sourceFor(node),row=node.closest('li[id^="chat-messages-"]');
      const text=(node.innerText||node.textContent||'').trim();
      const protectedContent=node.querySelector('a,code,pre,img:not(.emoji),video')||row?.querySelector('[class*="attachment"],[class*="repliedMessage"],[class*="sticker"],[class*="embed"]');
      if(source&&!protectedContent&&(lowSignal(text)||(!text&&node.querySelector('img.emoji'))))node.dataset.dwLow='1';else delete node.dataset.dwLow;
      if(row&&source){
        const p=messagePacket(node,source);encounteredRows.push(p);
        let marks=row.querySelector('.dw-native-marks');if(marks?.dataset.source!==source.url){marks?.remove();marks=el('span',undefined);marks.className='dw-native-marks';marks.dataset.source=source.url;node.insertAdjacentElement('afterend',marks);addMarkControls(marks,p,true)}
        const n=text.length;const level=n>=400?'3':n>=150?'2':n>=60?'1':'';
        const article=row.querySelector('[role="article"]');
        if(article){if(level)article.dataset.dwDensity=level;else delete article.dataset.dwDensity}
      }
      const label=source&&labels.get(keyOf(source));
      if(label)node.dataset.dwLabel=label;else delete node.dataset.dwLabel;
    }
    rememberWindow(encounteredRows);syncMarks();
    metrics.scanMs=Math.round((performance.now()-t)*10)/10;metrics.maxScanMs=Math.max(metrics.maxScanMs,metrics.scanMs);
  }
  function render(){
    renderIndex();annotateDOM();
    stats.textContent=Object.keys(data.marks).length+' saved messages · '+data.conversations.length+' conversation labels';syncMarks();
    topics.replaceChildren();
    const names=[...new Set([topic,...Object.keys(data.topics)])].sort();
    for(const name of names){const option=el('option',name,topics);option.value=name}
    topics.value=topic;list.replaceChildren();
    for(const entry of (data.topics[topic] || []).slice().reverse()){
      const s=data.sources[entry.source];if(!s)continue;
      const item=el('div',undefined,list);item.className='entry';
      const a=el('a','Open source · '+s.message,item);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';
      if(entry.note)el('div',entry.note,item);
      const r=el('div',undefined,item);r.className='row';
      btn(r,'Cherry-pick',async()=>{const raw=prompt('Copy to topic',topic);if(raw===null)return;const name=topicName(raw), next=await latest(), arr=next.topics[name] ||= [];
        if(!arr.some(e=>e.source===entry.source && e.note===entry.note))arr.push({...entry});
        await save(next,'cherry-pick');status('Added to '+name);
      });
      btn(r,'Remove',async()=>{if(!confirm('Remove this annotation from '+topic+'?'))return;const next=await latest();next.topics[topic]=next.topics[topic].filter(e=>!(e.source===entry.source&&e.note===entry.note));await save(next,'remove')});
    }
    if(!list.children.length)el('div','No sources in this topic yet.',list).className='muted';
    if(warning)status(warning);
  }
  async function refresh(){ if(warning)return;try{data=await latest();render()}catch(e){status('Refresh failed: '+e.message);record('refresh-failed');fail('refresh',e)} }
  function reconcileAppearance(origin){
    const root=document.documentElement;
    if(root.classList.contains('dw-focus')!==focus){
      metrics.appearance.repairs++;record('appearance-repaired',origin);root.classList.toggle('dw-focus',focus);
    }
    if(root.classList.contains('dw-contents-open')!==opened)root.classList.toggle('dw-contents-open',opened);
    if(!focusStyle.isConnected)document.head.append(focusStyle);
    if(!notebookStyle.isConnected)document.head.append(notebookStyle);
  }
  new MutationObserver(()=>reconcileAppearance('root-class')).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  window.addEventListener('focus',()=>{metrics.appearance.focusEvents++;reconcileAppearance('window-focus');refresh()});
  window.addEventListener('blur',()=>{metrics.appearance.blurEvents++});
  document.addEventListener('focusin',()=>reconcileAppearance('focus-in'));
  document.addEventListener('focusout',()=>reconcileAppearance('focus-out'));
  window.visualViewport?.addEventListener('resize',()=>{metrics.appearance.viewportResizes++;reconcileAppearance('viewport-resize');if(canvasOpen)positionCanvas()});
  function setOpen(v){if(v&&canvasOpen)closeCanvas();opened=v;panel.hidden=!v;toggle.hidden=v;document.documentElement.classList.toggle('dw-contents-open',v);if(v)refresh()}
  toggle.addEventListener('click',()=>setOpen(true));
  function captureSelection(){
    const sel=window.getSelection();if(!sel||sel.isCollapsed||sel.rangeCount!==1)return;
    const element=n=>n?.nodeType===1?n:n?.parentElement;
    const a=element(sel.anchorNode)?.closest('[id^="message-content-"]');
    const b=element(sel.focusNode)?.closest('[id^="message-content-"]');
    if(!captureBox.open||!a||!b)return;metrics.selection.attempts++;
    if(!sourceFor(a)||!sourceFor(b)){metrics.selection.rejected++;record('selection-unresolved');return}
    const range=sel.getRangeAt(0), rows=[];
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      if(!range.intersectsNode(node))continue;
      const source=sourceFor(node);if(!source)continue;
      if(!rows.some(p=>keyOf(p.source)===keyOf(source)))rows.push(messagePacket(node,source));
    }
    if(!rows.length||rows.length>100||rows.reduce((n,p)=>n+p.text.length,0)>60000){
      picked=null;packet=[];packetOrigin='';sourceInput.value='';setOpen(true);status('Select a smaller group (up to 100 messages / 60,000 characters).');return;
    }
    metrics.selection.resolved++;stage(rows);captureBox.open=true;
  }
  document.addEventListener('mouseup',captureSelection);document.addEventListener('touchend',()=>setTimeout(captureSelection,250),{passive:true});
  let lastPath=location.pathname,queued=false;
  function scheduleScan(){if(queued)return;queued=true;setTimeout(async()=>{queued=false;try{
    if(lastPath!==location.pathname){const previous=lastPath;lastPath=location.pathname;const base=p=>p.split('/').slice(0,4).join('/');if(base(previous)!==base(lastPath)){metrics.navigation.channelChanges++;closeCanvas();canvasRows=[];encountered.clear();encounteredChannel='';packet=[];packetOrigin='';picked=null;sourceInput.value='';labelInput.value='';note.value='';await refresh();record('channel-changed')}else{metrics.navigation.messageJumps++;record('message-jump')}}
    annotateDOM();
  }catch(e){record('scan-failed');fail('scan',e)}},200)}
  new MutationObserver(scheduleScan).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{if(lastPath!==location.pathname)scheduleScan()},1000);
  record('ready',storage);render();
  if(storage==='session only')status('No userscript storage API available; export JSON before closing.');
  bootStep='ready';boot.textContent=failures.length?'Wiki · errors '+failures.length:'Diagnostics';
  } catch(e){bootStep='startup failed';fail('startup',e);boot.textContent='Wiki startup failed';showReport();console.error('[DW] startup failed',e);}
})();
