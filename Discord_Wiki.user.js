// ==UserScript==
// @name         Discord Wiki — Sparse Explorer
// @namespace    https://github.com/JadanPoll/Discord-Wiki
// @version      0.3.0
// @description  Source-backed topics and selective reading inside Discord. No account credentials or background retrieval.
// @match        https://discord.com/channels/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = '0.3.0', KEY = 'dw-sparse-v1', ROOT = 'dw-sparse-explorer';
  if (document.getElementById(ROOT)) return;
  const fresh = () => ({schema:1, sources:{}, topics:{}, visits:[]});
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
    return out;
  }
  try { data = normalize(GM_getValue(KEY,fresh())); }
  catch(e) { data = fresh(); warning = 'Saved data could not be loaded; changes blocked until reload or valid import.'; record('load-failed'); }
  function latest() {
    if (warning) throw Error(warning);
    return normalize(GM_getValue(KEY,fresh()));
  }
  function save(next, event) {
    if (warning && event !== 'import') throw Error(warning);
    GM_setValue(KEY,next); data = next; warning = ''; record(event); render();
  }
  function merge(incoming) {
    const next = warning ? fresh() : latest();
    Object.assign(next.sources,incoming.sources);
    for (const [name,entries] of Object.entries(incoming.topics)) {
      const target = next.topics[name] ||= [];
      for (const entry of entries) if (!target.some(e => e.source===entry.source && e.note===entry.note)) target.push(entry);
    }
    const seen = new Set(next.visits.map(v=>JSON.stringify(v)));
    for (const v of incoming.visits) if (!seen.has(JSON.stringify(v))) { next.visits.push(v); seen.add(JSON.stringify(v)); }
    next.visits = next.visits.slice(-500);
    save(next,'import');
  }
  function el(tag, text, parent) {
    const node=document.createElement(tag); if(text!==undefined) node.textContent=text;
    if(parent) parent.append(node); return node;
  }
  const host=el('div'); host.id=ROOT; document.body.append(host);
  const shadow=host.attachShadow({mode:'open'});
  const css=el('style',`
    :host{all:initial;position:fixed;right:12px;bottom:12px;z-index:9999;font:13px system-ui,sans-serif;color:#1e293b}
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
    html.dw-focus [id^="message-content-"] img.emoji {filter:grayscale(1);opacity:.68}
    html.dw-focus [id^="message-content-"] img.emoji:hover {filter:none;opacity:1}
    html.dw-focus [id^="message-content-"] img.emoji[class*="jumboable"] {width:1.3em!important;height:1.3em!important;object-fit:contain}
    html.dw-focus #channels :is([class*="name_"],[class*="nameContainer_"]) {color:var(--text-normal,inherit)}
    html.dw-focus #channels img.emoji {filter:grayscale(1)}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"] {filter:grayscale(.85);opacity:.72}
    html.dw-focus [id^="chat-messages-"] [class*="avatar_"]:hover {filter:none;opacity:1}
    html.dw-focus [id^="chat-messages-"] [class*="username_"] {color:var(--text-normal,inherit)!important}
  `,document.head);
  let focus=GM_getValue('dw-focus',true)!==false;
  const launcher=el('div',undefined,shadow);launcher.className='row';launcher.style.margin='0';
  const focusToggle=el('button','',launcher);
  focusToggle.title='Toggle distraction reduction; no messages are removed';
  function applyFocus(){
    document.documentElement.classList.toggle('dw-focus',focus);
    focusToggle.textContent=focus?'Focus on':'Focus off';
    focusToggle.setAttribute('aria-pressed',String(focus));
  }
  focusToggle.addEventListener('click',()=>{
    focus=!focus;applyFocus();
    try{GM_setValue('dw-focus',focus);record('focus',String(focus))}catch(e){record('focus-save-failed')}
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
  btn(row,'New topic',()=>{const n=prompt('Topic name (e.g. MEMS / Fabrication)');if(n===null)return;const t=topicName(n);const next=latest();next.topics[t] ||= [];topic=t;save(next,'topic-created')});
  const sourceInput=el('input',undefined,panel);sourceInput.placeholder='Paste Discord message link';sourceInput.setAttribute('aria-label','Source message link');
  sourceInput.addEventListener('input',()=>{picked=null;packet=[]});
  const note=el('textarea',undefined,panel);note.placeholder='Why is this worth returning to? Optional personal annotation.';note.setAttribute('aria-label','Personal annotation');
  const actions=el('div',undefined,panel);actions.className='row';
  btn(actions,'Capture',()=>{
    const source=parseLink(sourceInput.value.trim()) || (!sourceInput.value.trim() ? picked : null);
    if(!source)throw Error('Select a message in its original channel or paste its Copy Message Link URL.');
    const selected = picked && source.url === picked.url && packet.length ? packet.map(p=>p.source) : [source];
    const next=latest(), entries=next.topics[topic] ||= [], text=note.value.trim().slice(0,4000);
    for(const src of selected){
      const id=keyOf(src);next.sources[id]=src;
      if(!entries.some(e=>e.source===id && e.note===text))entries.push({source:id,note:text});
    }
    save(next,'capture');sourceInput.value='';note.value='';picked=null;packet=[];status('Saved '+selected.length+' source(s) in '+topic);
  },true);
  btn(actions,'Copy conversation',()=>{
    if(!packet.length)throw Error('Select text spanning the messages you want to explore first.');
    GM_setClipboard(JSON.stringify({topic,messages:packet.map(p=>({url:p.source.url,text:p.text}))},null,2),'text');
    status('Copied '+packet.length+' selected message(s) for LLM exploration. Review before sharing.');
    record('conversation-copied',String(packet.length));
  });
  const hint=el('div','Select one or several messages in the channel, then Copy conversation or Capture. A pasted message link also works. Use Discord search to reach earlier discussions.',panel);hint.className='muted';
  const msg=el('div','',panel);msg.className='status';msg.setAttribute('role','status');
  function status(s){msg.textContent=s}
  const list=el('div',undefined,panel);list.className='scroll';
  const footer=el('div',undefined,panel);footer.className='row';
  btn(footer,'Copy JSON',()=>{GM_setClipboard(JSON.stringify(latest(),null,2),'text');status('Workspace copied (links + your notes).')});
  btn(footer,'Import JSON',()=>{const raw=prompt('Paste exported workspace JSON to merge');if(raw===null)return;merge(normalize(JSON.parse(raw)));status('Merged workspace.')});
  btn(footer,'Copy report',()=>{
    const report={version:VERSION,topics:Object.keys(data.topics).length,sources:Object.keys(data.sources).length,visits:data.visits.length,
      messageContentElements:document.querySelectorAll('[id^="message-content-"]').length,staged:!!picked,storageWarning:!!warning,focus,focusMatches:{reactions:document.querySelectorAll('[id^="chat-messages-"] [class*="reactions_"]').length,inlineEmoji:document.querySelectorAll('[id^="message-content-"] img.emoji').length,avatarDecorations:document.querySelectorAll('[class*="avatarDecoration_"]').length},events:log};
    GM_setClipboard(JSON.stringify(report,null,2),'text');status('Diagnostics copied (no source links or message content).');
  });
  function render(){
    stats.textContent=Object.keys(data.sources).length+' sources · '+Object.keys(data.topics).length+' topics · '+data.visits.length+' visits';
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
      btn(r,'Cherry-pick',()=>{const raw=prompt('Copy to topic',topic);if(raw===null)return;const name=topicName(raw), next=latest(), arr=next.topics[name] ||= [];
        if(!arr.some(e=>e.source===entry.source && e.note===entry.note))arr.push({...entry});
        save(next,'cherry-pick');status('Added to '+name);
      });
      btn(r,'Remove',()=>{if(!confirm('Remove this annotation from '+topic+'?'))return;const next=latest();next.topics[topic]=next.topics[topic].filter(e=>!(e.source===entry.source&&e.note===entry.note));save(next,'remove')});
    }
    if(!list.children.length)el('div','No sources in this topic yet.',list).className='muted';
    if(warning)status(warning);
  }
  function refresh(){ if(warning)return;try{data=latest();render()}catch(e){status('Refresh failed: '+e.message);record('refresh-failed')} }
  window.addEventListener('focus',refresh);
  function setOpen(v){opened=v;panel.hidden=!v;toggle.hidden=v;if(v)refresh()}
  toggle.addEventListener('click',()=>setOpen(true));
  document.addEventListener('mouseup',()=>{
    const sel=window.getSelection();if(!sel||sel.isCollapsed||sel.rangeCount!==1)return;
    const element=n=>n?.nodeType===1?n:n?.parentElement;
    const a=element(sel.anchorNode)?.closest('[id^="message-content-"]');
    const b=element(sel.focusNode)?.closest('[id^="message-content-"]');
    if(!a||!b)return;
    const route=location.pathname.match(/^\/channels\/(\d{15,22})\/(\d{15,22})(?:\/|$)/);
    const sourceFor=node=>{
      if(!route||node.closest('[class*="searchResult"],[class*="searchResults"],[class*="searchResultGroup"]'))return null;
      const match=node.closest('[id^="chat-messages-"]')?.id.match(/^chat-messages-(\d{15,22})-(\d{15,22})$/);
      const mid=node.id.slice('message-content-'.length);
      if(!match||match[1]!==route[2]||match[2]!==mid)return null;
      return parseLink('https://discord.com/channels/'+route[1]+'/'+route[2]+'/'+mid);
    };
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
    packet=rows;picked=rows[0].source;sourceInput.value=picked.url;
    record('source-staged',String(rows.length));setOpen(true);
    status(rows.length+' rendered message(s) staged. Copy conversation or Capture.');
  });
  record('ready');render();
})();
