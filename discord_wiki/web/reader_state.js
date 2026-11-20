"use strict";
/* Portable, deliberate reader state. Automatic visits stay separate in SQLite. */
window.ReaderState=(()=>{
  const STORE="discordWikiInterestsV1",TYPE="discord-wiki-reader-state";
  const TYPES=new Set(["chapter","term","message"]);
  const key=(d,t,k)=>JSON.stringify([d,t,k]);
  const valid=x=>x&&typeof x.dataset_id==="string"&&x.dataset_id.length>0&&x.dataset_id.length<=100&&
    TYPES.has(x.target_type)&&typeof x.target_key==="string"&&x.target_key.length>0&&x.target_key.length<=300;
  let entries=new Map(),storeError="";
  try{
    const raw=localStorage.getItem(STORE);
    if(raw){
      const data=JSON.parse(raw);
      if(data.version!==1||!Array.isArray(data.items)||data.items.length>20000)throw Error("Unrecognized saved format");
      for(const x of data.items){
        if(!valid(x)||typeof x.label!=="string"||x.label.length>300)throw Error("Invalid interest");
        entries.set(key(x.dataset_id,x.target_type,x.target_key),x);
      }
    }
  }catch(e){storeError=e.message;}
  const flagged=(t,k)=>entries.has(key(state.dataset,t,k));
  const named=id=>state.datasets.find(d=>d.id===id)?.name||id;
  function persist(next){
    localStorage.setItem(STORE,JSON.stringify({version:1,items:[...next.values()]}));
    entries=next;storeError="";refresh();
  }
  function mark(t,k,label){
    if(storeError){notice("Saved interests unreadable: "+storeError+". Import a backup before editing.",true);return;}
    if(!state.dataset)return;
    const id=key(state.dataset,t,k),next=new Map(entries);
    if(next.has(id))next.delete(id);
    else next.set(id,{dataset_id:state.dataset,dataset_name:named(state.dataset),target_type:t,
      target_key:k,label:String(label||k).slice(0,300),marked_at:new Date().toISOString()});
    try{persist(next);notice(next.has(id)?"Added to interests.":"Removed from interests.");}
    catch(e){notice("Could not save interest: "+e.message,true);}
  }
  function sync(node){
    const wrap=node.closest(".reader-item-wrap");
    if(!wrap)return;
    const t=node.dataset.noteType,k=node.dataset.noteKey;
    const star=wrap.querySelector(".reader-star"),pencil=wrap.querySelector(".reader-note");
    if(star){
      const yes=flagged(t,k);
      star.textContent=yes?"★":"☆";star.classList.toggle("active",yes);
      star.setAttribute("aria-pressed",String(yes));
      star.title=yes?"Remove from interests":"Mark as an interest";
    }
    if(pencil){
      pencil.classList.toggle("has-note",!!noteFor(t,k));
      pencil.title=noteFor(t,k)?"Edit note":"Add note";
    }
  }
  function decorate(node){
    const t=node.dataset.noteType,k=node.dataset.noteKey,label=node.dataset.noteLabel||k;
    const wrap=el("div","reader-item-wrap"),actions=el("div","reader-item-actions");
    const star=el("button","reader-star","☆");
    star.type="button";star.setAttribute("aria-label","Toggle interest: "+label);
    star.onclick=e=>{e.stopPropagation();mark(t,k,label);};
    const pencil=el("button","reader-note","✎");
    pencil.type="button";pencil.setAttribute("aria-label","Add or edit note: "+label);
    pencil.onclick=e=>{e.stopPropagation();openSticky(node,t,k,label,e.clientX,e.clientY);};
    actions.append(star,pencil);wrap.append(node,actions);sync(node);
    return wrap;
  }
  function refresh(){
    const n=[...entries.values()].filter(x=>x.dataset_id===state.dataset).length;
    $("interest-count").textContent=n?" "+n:"";
    document.querySelectorAll(".reader-item-wrap [data-note-type][data-note-key]").forEach(sync);
    if(!$("interests-overlay").hidden)render();
  }
  function close(){
    $("interests-overlay").hidden=true;
    $("interest-button").focus();
  }
  async function open(item){
    const ds=state.datasets.find(d=>d.id===item.dataset_id);
    if(!ds){notice("Import the matching community archive before opening this item.",true);return;}
    if(ds.id!==state.dataset)await chooseDataset(ds);
    $("interests-overlay").hidden=true;
    const selector=item.target_type==="chapter"?".chapter":item.target_type==="term"?".topic":null;
    if(selector){
      const node=[...document.querySelectorAll(selector)].find(x=>x.dataset.noteKey===item.target_key);
      if(node){node.click();node.scrollIntoView({block:"nearest"});}
      else notice("This item is no longer in the generated index. The saved interest is preserved.",true);
    }else{
      await showContext(item.target_key);
      document.querySelector(".source-pane")?.scrollIntoView({block:"nearest"});
    }
  }
  function render(){
    const box=$("interests-list");clear(box);
    const items=[...entries.values()].sort((a,b)=>String(b.marked_at||"").localeCompare(String(a.marked_at||"")));
    $("interests-summary").textContent=items.length+" interests deliberately marked · "+state.notes.size+
      " notes in this community. Automatically visited items are excluded.";
    if(!items.length){box.append(el("p","hint","Select ☆ beside a chapter, glossary entry, or source message to mark an interest."));return;}
    for(const item of items){
      const row=el("div","interest-entry"),copy=el("div","interest-entry-copy");
      copy.append(el("strong",null,item.label||item.target_key));
      copy.append(el("small",null,(item.dataset_name||item.dataset_id)+" · "+item.target_type));
      if(item.dataset_id===state.dataset){
        const note=noteFor(item.target_type,item.target_key);
        if(note)copy.append(el("p",null,note));
      }
      const jump=el("button","quiet","Open");jump.type="button";
      jump.onclick=()=>open(item).catch(e=>notice(e.message,true));
      const remove=el("button","quiet","Unmark");remove.type="button";
      remove.onclick=()=>{
        const next=new Map(entries);next.delete(key(item.dataset_id,item.target_type,item.target_key));
        try{persist(next);notice("Interest removed.");}catch(e){notice(e.message,true);}
      };
      row.append(copy,jump,remove);box.append(row);
    }
  }
  async function pack(){
    const notes=[];
    for(const ds of state.datasets){
      const found=await api(url("/api/notes",{dataset:ds.id}));
      for(const n of found.notes||[]){
        notes.push({dataset_id:ds.id,dataset_name:ds.name,target_type:n.target_type,
          target_key:n.target_key,note:n.note,updated_at:n.updated_at});
      }
    }
    return {type:TYPE,version:1,exported_at:new Date().toISOString(),
      purpose:"Explicit interests and personal notes for research continuation; not automatic reading history or verified claims.",
      communities:state.datasets.map(x=>({id:x.id,name:x.name})),
      interests:[...entries.values()],notes,seen_included:false};
  }
  async function download(){
    const p=await pack(),u=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)+"\n"],{type:"application/json"}));
    const a=el("a");a.href=u;a.download="discord-wiki-interests-"+new Date().toISOString().slice(0,10)+".json";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
    notice("Exported "+p.interests.length+" interests and "+p.notes.length+" notes.");
  }
  async function copy(){
    const p=await pack();
    if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable; use Download JSON.");
    await navigator.clipboard.writeText(JSON.stringify(p,null,2));
    notice("Copied interests and notes for an LLM.");
  }
  async function importFile(file){
    if(file.size>4*1024*1024)throw Error("Import exceeds 4 MB.");
    const p=JSON.parse(await file.text());
    if(!p||p.type!==TYPE||p.version!==1||!Array.isArray(p.interests)||!Array.isArray(p.notes)||
      p.interests.length>20000||p.notes.length>20000)throw Error("Expected a Discord-Wiki reader-state v1 export.");
    for(const x of p.interests){
      if(!valid(x)||typeof x.label!=="string"||x.label.length>300)throw Error("Malformed interest.");
    }
    for(const x of p.notes){
      if(!valid(x)||typeof x.note!=="string"||x.note.length>4000)throw Error("Malformed note.");
    }
    const known=new Set(state.datasets.map(d=>d.id));
    const applicable=p.notes.filter(n=>known.has(n.dataset_id)),skipped=p.notes.length-applicable.length;
    if(!confirm("Import "+p.interests.length+" interests and "+applicable.length+" notes?"+
      (skipped?" "+skipped+" notes require importing their archive first.":"")+
      " Matching notes will be updated; other local data is kept."))return;
    const next=new Map(entries);
    for(const x of p.interests)next.set(key(x.dataset_id,x.target_type,x.target_key),x);
    let completed=0;
    for(const n of applicable){
      try{
        await api("/api/note",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({dataset:n.dataset_id,target_type:n.target_type,target_key:n.target_key,note:n.note})});
        completed++;
      }catch(e){throw Error("Imported "+completed+" notes before failure: "+e.message+". Retry the backup.");}
    }
    try{persist(next);}catch(e){throw Error("Notes restored, but localStorage could not save interests: "+e.message);}
    if(state.dataset)await loadReaderState();
    document.querySelectorAll("[data-note-type][data-note-key]").forEach(syncSticky);
    refresh();
    notice("Imported "+p.interests.length+" interests and "+completed+" notes."+
      (skipped?" "+skipped+" unmatched notes skipped; import the matching archive and retry the same file.":"")+
      " Visits were unchanged.");
  }
  $("interest-button").onclick=()=>{closeSticky();$("interests-overlay").hidden=false;render();};
  $("interests-close").onclick=close;
  $("interests-overlay").addEventListener("mousedown",e=>{if(e.target===$("interests-overlay"))close();});
  $("interests-download").onclick=()=>download().catch(e=>notice(e.message,true));
  $("interests-copy").onclick=()=>copy().catch(e=>notice(e.message,true));
  $("interests-import").onclick=()=>$("reader-import-file").click();
  $("reader-import-file").onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{await importFile(f);}catch(error){notice("Import failed: "+error.message,true);}
    finally{e.target.value="";}
  };
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("interests-overlay").hidden)close();});
  if(storeError)notice("Saved interests unreadable: "+storeError+". Import a valid backup to recover.",true);
  return {decorate,sync,refresh};
})();
