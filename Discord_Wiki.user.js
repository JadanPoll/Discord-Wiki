// ==UserScript==
// @name         Discord Wiki — Sparse Explorer
// @namespace    https://github.com/JadanPoll/Discord-Wiki
// @version      0.4.1
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
  const VERSION = '0.4.1', KEY = 'dw-sparse-v1', ROOT = 'dw-sparse-explorer';
  if(document.getElementById(ROOT)||document.getElementById('dw-boot'))return;
  const boot=document.createElement('button');
  boot.id='dw-boot';boot.textContent='Wiki 0.4.1 · starting';
  boot.style.cssText='position:fixed!important;top:88px!important;right:12px!important;z-index:2147483647!important;background:#fff!important;color:#222!important;padding:8px 12px!important;border:1px solid #777!important;border-radius:8px!important;font:13px system-ui!important';
  (document.body||document.documentElement).append(boot);
  let bootStep='storage';
  boot.onclick=()=>{prompt('Discord Wiki startup status',JSON.stringify({version:VERSION,step:bootStep,legacyStorage:typeof GM_getValue==='function',modernStorage:typeof GM!=='undefined'&&typeof GM.getValue==='function',body:!!document.body}));};
  try {
  if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const gmLegacy=typeof GM_getValue==='function'&&typeof GM_setValue==='function';
  const gmModern=typeof GM!=='undefined'&&typeof GM.getValue==='function'&&typeof GM.setValue==='function';
  const storage=gmLegacy?'legacy GM':gmModern?'modern GM':'session only';
  const volatile=new Map();
  async function read(key,def){
    if(gmLegacy)return (await GM_getValue(key,def))??def;
    if(gmModern)return (await GM.getValue(key,def))??def;
    return volatile.has(key)?volatile.get(key):def;
  }
  async function write(key,value){
    if(gmLegacy)return await GM_setValue(key,value);
    if(gmModern)return await GM.setValue(key,value);
    volatile.set(key,value);
  }
  async function copy(text){
    if(typeof GM_setClipboard==='function'){await GM_setClipboard(text,'text');return;}
    if(typeof GM!=='undefined'&&typeof GM.setClipboard==='function'){await GM.setClipboard(text,'text');return;}
    try{await navigator.clipboard.writeText(text);return;}catch{}
    const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;inset:12% 5%;width:90%;height:70%;z-index:2147483647;background:white;color:black;font:14px monospace';
    const close=document.createElement('button');close.textContent='Close copy box';close.style.cssText='position:fixed;top:4%;right:5%;z-index:2147483647;background:white;color:black;padding:10px';
    close.onclick=()=>{t.remove();close.remove()};document.body.append(t,close);t.focus();t.select();
    throw Error('Automatic clipboard unavailable; copy from the selected text box.');
  }
  const fresh = () => ({schema:1, sources:{}, topics:{}, visits:[], conversations:[]});
  let data, topic = 'General', opened = false, picked = null, packet = [], warning = '';
  const log = [];
  function record(event, detail = '') {
    log.push({at:new Date().toISOString(), event, detail});
    if (log.length > 60) log.shift();
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
    return out;
  }
  try { data = normalize(await read(KEY,fresh())); }
  catch(e) { data = fresh(); warning = 'Saved data could not be loaded; changes blocked until reload or valid import.'; record('load-failed'); }
  async function latest() {
    if (warning) throw Error(warning);
    return normalize(await read(KEY,fresh()));
  }
  async function save(next, event) {
    if (warning && event !== 'import') throw Error(warning);
    await write(KEY,next); data = next; warning = ''; record(event); render();
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
    :host{all:initial;position:fixed!important;right:12px!important;top:88px!important;bottom:auto!important;z-index:2147483646!important;font:13px system-ui,sans-serif;color:#1e293b}
    *{box-sizing:border-box} button,input,textarea,select{font:inherit} button{cursor:pointer;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1e293b;padding:6px 9px}
    button:hover{background:#eaf0ff} button:focus-visible,a:focus-visible{outline:2px solid #5265c9} .primary{background:#4256bb;color:white;border-color:#4256bb}
    .panel{width:min(410px,calc(100vw - 24px));max-height:80vh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;box-shadow:0 8px 28px #0004}
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
    html.dw-focus #channels :is([class*="name_"],[class*="nameContainer_"]) {color:var(--text-normal,inherit)}
    html.dw-focus #channels img.emoji {filter:grayscale(1)}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"] {filter:grayscale(.85);opacity:.72}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"]:hover {filter:none;opacity:1}
    html.dw-focus [id^="chat-messages-"] [class*="username_"] {color:var(--text-normal,inherit)!important}
  `,document.head);
  let focus=true;try{focus=(await read('dw-focus',true))!==false}catch(e){record('focus-load-failed')}
  const launcher=el('div',undefined,shadow);launcher.className='row';launcher.style.margin='0';
  const focusToggle=el('button','',launcher);
  focusToggle.title='Toggle distraction reduction; no messages are removed';
  function applyFocus(){
    document.documentElement.classList.toggle('dw-focus',focus);
    focusToggle.textContent=focus?'Focus on':'Focus off';
    focusToggle.setAttribute('aria-pressed',String(focus));
  }
  focusToggle.addEventListener('click',async()=>{
    focus=!focus;applyFocus();
    try{await write('dw-focus',focus);record('focus',String(focus))}catch(e){record('focus-save-failed')}
  });
  applyFocus();
  const toggle=el('button','Wiki',launcher); toggle.className='primary';
  const panel=el('section',undefined,shadow); panel.className='panel'; panel.hidden=true;
  const titleRow=el('div',undefined,panel); titleRow.className='row';
  const title=el('h3','Discord Wiki · Explore',titleRow); title.className='grow';
  function btn(parent,label,fn,primary=false) {
    const b=el('button',label,parent); if(primary)b.className='primary';
    b.addEventListener('click',async()=>{try{await fn()}catch(e){status('Error: '+e.message);record('action-failed',label)}}); return b;
  }
  btn(titleRow,'Hide',()=>setOpen(false));
  const stats=el('div','',panel); stats.className='muted';
  const row=el('div',undefined,panel); row.className='row';
  const topics=el('select',undefined,row); topics.className='grow'; topics.setAttribute('aria-label','Current topic');
  topics.addEventListener('change',()=>{topic=topics.value;render()});
  btn(row,'New topic',async()=>{const n=prompt('Topic name (e.g. MEMS / Fabrication)');if(n===null)return;const t=topicName(n);const next=await latest();next.topics[t] ||= [];topic=t;await save(next,'topic-created')});
  const sourceInput=el('input',undefined,panel);sourceInput.placeholder='Paste Discord message link';sourceInput.setAttribute('aria-label','Source message link');
  sourceInput.addEventListener('input',()=>{picked=null;packet=[]});
  const labelInput=el('input',undefined,panel);labelInput.placeholder='Conversation title (optional)';labelInput.setAttribute('aria-label','Conversation title');
  const note=el('textarea',undefined,panel);note.placeholder='Why is this worth returning to? Optional personal annotation.';note.setAttribute('aria-label','Personal annotation');
  const actions=el('div',undefined,panel);actions.className='row';
  btn(actions,'Capture',async()=>{
    const source=parseLink(sourceInput.value.trim()) || (!sourceInput.value.trim() ? picked : null);
    if(!source)throw Error('Select a message in its original channel or paste its Copy Message Link URL.');
    const selected = picked && source.url === picked.url && packet.length ? packet.map(p=>p.source) : [source];
    const next=await latest(), entries=next.topics[topic] ||= [], text=note.value.trim().slice(0,4000);
    for(const src of selected){
      const id=keyOf(src);next.sources[id]=src;
      if(!entries.some(e=>e.source===id && e.note===text))entries.push({source:id,note:text});
    }
    if(labelInput.value.trim())upsert(next,{title:labelInput.value,messages:selected.map(p=>p.url),topics:[topic],note:text,verified:true});
    await save(next,'capture');sourceInput.value='';note.value='';labelInput.value='';picked=null;packet=[];status('Saved '+selected.length+' source(s) in '+topic);
  },true);
  btn(actions,'Stage visible',async()=>{
    const rows=visibleRows();if(!rows.length)throw Error('No visible messages recognized. Copy report to diagnose.');
    stage(rows.slice(0,30));
  });
  btn(actions,'Copy conversation',async()=>{
    if(!packet.length)throw Error('Select text spanning the messages you want to explore first.');
    await write('dw-last-packet',packet.map(p=>p.source.url));
    await copy(JSON.stringify({topic,messages:packet.map(p=>({url:p.source.url,text:p.text}))},null,2),'text');
    status('Copied '+packet.length+' selected message(s) for LLM exploration. Review before sharing.');
    record('conversation-copied',String(packet.length));
  });
  btn(actions,'Copy for labeling',async()=>{
    if(!packet.length)throw Error('Stage visible messages or select a conversation first.');
    await write('dw-last-packet',packet.map(p=>p.source.url));
    await copy(JSON.stringify({instruction:'Propose concise specific conversation titles. Group related messages; ignore trivial chatter. Use only the supplied exact URLs. Return JSON: {"conversations":[{"title":"...","messages":["exact URL"],"topics":["..."],"note":"optional"}]}',messages:packet.map(p=>({url:p.source.url,text:p.text}))},null,2),'text');
    status('Paste packet into ChatGPT, then Import LLM labels.');record('label-packet',String(packet.length));
  });
  const hint=el('div','Select one or several messages in the channel, then Copy conversation or Capture. A pasted message link also works. Use Discord search to reach earlier discussions.',panel);hint.className='muted';
  const msg=el('div','',panel);msg.className='status';msg.setAttribute('role','status');
  function status(s){msg.textContent=s}
  const indexHeader=el('div',undefined,panel);indexHeader.className='row';
  const indexLabel=el('h3','Conversation contents',indexHeader);indexLabel.className='grow';
  const scope=el('select',undefined,indexHeader);scope.style.width='auto';
  for(const [value,label] of [['channel','This channel'],['all','All channels']]){const o=el('option',label,scope);o.value=value;}
  scope.addEventListener('change',()=>renderIndex());
  const filter=el('input',undefined,panel);filter.placeholder='Find conversation or topic';filter.addEventListener('input',()=>renderIndex());
  const index=el('div',undefined,panel);index.className='scroll';
  const proposalBox=el('details',undefined,panel);el('summary','Import LLM labels',proposalBox);
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
  const footer=el('div',undefined,panel);footer.className='row';
  btn(footer,'Copy JSON',async()=>{await copy(JSON.stringify(await latest(),null,2),'text');status('Workspace copied (links + your notes).')});
  btn(footer,'Import JSON',async()=>{const raw=prompt('Paste exported workspace JSON to merge');if(raw===null)return;await merge(normalize(JSON.parse(raw)));status('Merged workspace.')});
  btn(footer,'Copy report',async()=>{
    const report={version:VERSION,topics:Object.keys(data.topics).length,sources:Object.keys(data.sources).length,visits:data.visits.length,
      messageContentElements:document.querySelectorAll('[id^="message-content-"]').length,staged:!!picked,storageWarning:!!warning,focus,conversations:data.conversations.length,lowSignal:document.querySelectorAll('[data-dw-low]').length,inlineLabels:document.querySelectorAll('[data-dw-label]').length,focusMatches:{reactions:document.querySelectorAll('[id^="chat-messages-"] [class*="reactions_"]').length,inlineEmoji:document.querySelectorAll('[id^="message-content-"] img.emoji').length,avatarDecorations:document.querySelectorAll('[class*="avatarDecoration_"]').length},events:log};
    await copy(JSON.stringify(report,null,2),'text');status('Diagnostics copied (no source links or message content).');
  });
  function channelRoute(){return location.pathname.match(/^\/channels\/(\d{15,22})\/(\d{15,22})(?:\/|$)/);}
  function sourceFor(node){
    const route=channelRoute();
    if(!route||node.closest('[class*="searchResult"],[class*="searchResults"],[class*="searchResultGroup"]'))return null;
    const match=node.closest('[id^="chat-messages-"]')?.id.match(/^chat-messages-(\d{15,22})-(\d{15,22})$/);
    const mid=node.id.slice('message-content-'.length);
    if(!match||match[1]!==route[2]||match[2]!==mid)return null;
    return parseLink('https://discord.com/channels/'+route[1]+'/'+route[2]+'/'+mid);
  }
  function visibleRows(){
    const result=[];
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      const r=node.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight||r.width===0||r.height===0)continue;
      const source=sourceFor(node);if(source)result.push({source,text:node.innerText||node.textContent||''});
    }
    return result;
  }
  function stage(rows){
    if(!rows.length||rows.length>30||rows.reduce((n,p)=>n+p.text.length,0)>60000)throw Error('Select up to 30 messages / 60,000 characters');
    packet=rows;picked=rows[0].source;sourceInput.value=picked.url;
    record('source-staged',String(rows.length));setOpen(true);status(rows.length+' rendered message(s) staged.');
  }
  function renderIndex(){
    const route=channelRoute(),q=filter.value.toLowerCase();
    index.replaceChildren();
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
    if(!regions.length)el('div','No indexed conversations here yet.',index).className='muted';
  }
  function lowSignal(text){
    return /^(?:lol+|lmao+|lmfao+|rofl|ha(?:ha)+|he(?:he)+|nice+|bruh+|xd)[.!\s]*$/i.test(text.trim());
  }
  function annotateDOM(){
    const labels=new Map(data.conversations.map(r=>[r.id,r.title]));
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      const source=sourceFor(node),row=node.closest('[id^="chat-messages-"]');
      const text=(node.innerText||node.textContent||'').trim();
      const protectedContent=node.querySelector('a,code,pre,img:not(.emoji),video')||row?.querySelector('[class*="attachment"],[class*="repliedMessage"],[class*="sticker"],[class*="embed"]');
      if(source&&!protectedContent&&(lowSignal(text)||(!text&&node.querySelector('img.emoji'))))node.dataset.dwLow='1';else delete node.dataset.dwLow;
      const label=source&&labels.get(keyOf(source));
      if(label)node.dataset.dwLabel=label;else delete node.dataset.dwLabel;
    }
  }
  function render(){
    renderIndex();annotateDOM();
    stats.textContent=Object.keys(data.sources).length+' sources · '+Object.keys(data.topics).length+' topics · '+data.visits.length+' visits · '+data.conversations.length+' conversations';
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
  async function refresh(){ if(warning)return;try{data=await latest();render()}catch(e){status('Refresh failed: '+e.message);record('refresh-failed')} }
  window.addEventListener('focus',refresh);
  function setOpen(v){opened=v;panel.hidden=!v;toggle.hidden=v;if(v)refresh()}
  toggle.addEventListener('click',()=>setOpen(true));
  document.addEventListener('mouseup',()=>{
    const sel=window.getSelection();if(!sel||sel.isCollapsed||sel.rangeCount!==1)return;
    const element=n=>n?.nodeType===1?n:n?.parentElement;
    const a=element(sel.anchorNode)?.closest('[id^="message-content-"]');
    const b=element(sel.focusNode)?.closest('[id^="message-content-"]');
    if(!a||!b)return;
    if(!sourceFor(a)||!sourceFor(b)){record('selection-unresolved');return}
    const range=sel.getRangeAt(0), rows=[];
    for(const node of document.querySelectorAll('[id^="message-content-"]')){
      if(!range.intersectsNode(node))continue;
      const source=sourceFor(node);if(!source)continue;
      rows.push({source,text:node.innerText||node.textContent||''});
    }
    if(!rows.length||rows.length>30||rows.reduce((n,p)=>n+p.text.length,0)>60000){
      picked=null;packet=[];sourceInput.value='';setOpen(true);status('Select a smaller group (up to 30 messages / 60,000 characters).');return;
    }
    stage(rows);
  });
  let lastPath=location.pathname,queued=false;
  function scheduleScan(){if(queued)return;queued=true;setTimeout(async()=>{queued=false;try{
    if(lastPath!==location.pathname){lastPath=location.pathname;packet=[];picked=null;sourceInput.value='';labelInput.value='';note.value='';await refresh();record('channel-changed')}
    annotateDOM();
  }catch(e){record('scan-failed')}},200)}
  new MutationObserver(scheduleScan).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{if(lastPath!==location.pathname)scheduleScan()},1000);
  record('ready',storage);render();
  if(storage==='session only')status('No userscript storage API available; export JSON before closing.');
  boot.remove();
  } catch(e){bootStep='failed: '+String(e?.message||e);boot.textContent='Wiki startup failed · tap';console.error('[DW] startup failed',e);}
})();
