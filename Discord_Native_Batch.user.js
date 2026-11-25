// ==UserScript==
// @name         Discord Wiki — Native Batch 100
// @namespace    https://github.com/JadanPoll/Discord-Wiki
// @version      0.1.0
// @description  Increase the selected channel's native history batch to 100. No extra requests, credentials or message capture.
// @match        https://discord.com/channels/*
// @run-at       document-end
// @inject-into  page
// @grant        none
// @noframes
// ==/UserScript==
(function(){
  'use strict';
  if(window.top!==window.self)return;
  const TARGET=100,MODULE=138399,ATTR='data-dw-native-batch';
  const state={version:'0.1.0',status:'waiting',target:TARGET,matched:0,changed:0,skipped:0,last:null};
  function publish(){document.documentElement?.setAttribute(ATTR,JSON.stringify(state))}
  function eligible(o,path,enabled){
    if(!enabled||!o||typeof o!=='object')return false;
    const route=/^\/channels\/\d{15,22}\/(\d{15,22})(?:\/|$)/.exec(path);
    if(!route||o.channelId!==route[1]||!Number.isInteger(o.limit)||o.limit<10||o.limit>30)return false;
    // Preserve focused/around-message jumps, preloads, experiments and special fetches.
    if(o.focus||o.jump?.messageId!=null||o.jump?.returnMessageId!=null||o.isPreload||o.nitroPrefetchKey!=null||o.feature!=null||o.forICYMI||o.before!=null&&o.after!=null)return false;
    return true;
  }
  function knownController(fn){
    if(typeof fn!=='function')return false;
    const src=Function.prototype.toString.call(fn);
    return ['LOAD_MESSAGES_SUCCESS','hasMoreBefore','hasMoreAfter','fetchLocalMessages','limit:'].every(x=>src.includes(x));
  }
  function wrap(owner,original){
    return function(opts,...rest){
      if(!eligible(opts,location.pathname,document.documentElement?.getAttribute('data-dw-batch-mode')!=='off')){
        state.skipped++;publish();return original.call(this,opts,...rest);
      }
      state.matched++;state.changed++;
      state.last={from:opts.limit,to:TARGET,direction:opts.before!=null?'older':opts.after!=null?'newer':'initial'};
      publish();
      // Pass a single coherent limit through native cache, HTTP and reducer logic.
      // The original method owns every request and all of its auth/rate handling.
      return original.call(this,{...opts,limit:TARGET},...rest);
    };
  }
  function install(req){
    if(typeof req!=='function'||!req.m)return false;
    const factory=req.m[MODULE];
    if(typeof factory!=='function'||!Function.prototype.toString.call(factory).includes('LOAD_MESSAGES_SUCCESS_CACHED')){
      state.status='unrecognized-build';publish();return true;
    }
    const owner=req(MODULE)?.A;
    if(owner?.fetchMessages?.__dwBatch100){state.status='already-installed';publish();return true}
    const original=owner?.fetchMessages;
    if(!knownController(original)){state.status='unrecognized-controller';publish();return true}
    const replacement=wrap(owner,original);
    Object.defineProperty(replacement,'__dwBatch100',{value:true});
    owner.fetchMessages=replacement;
    if(owner.fetchMessages!==replacement){state.status='controller-not-writable';publish();return true}
    state.status='active';publish();return true;
  }
  // Use only the identified controller in the captured Webpack build.
  // No token access, request interception, source evaluation or network calls.
  let attempts=0,done=false;
  function start(){
    if(done)return;
    attempts++;
    try{
      const chunk=window.webpackChunkdiscord_app;
      if(Array.isArray(chunk)&&chunk.push!==Array.prototype.push){
        chunk.push([['dw-batch-100-'+Date.now()+'-'+attempts],{},req=>{if(!done)done=install(req)}]);
      }
    }catch{state.status='installation-error';publish();done=true}
    if(!done&&attempts<6)setTimeout(start,300*attempts);
    else if(!done){state.status='runtime-unavailable';publish()}
  }
  publish();start();
})();
