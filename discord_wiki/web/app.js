"use strict";
const $ = id => document.getElementById(id);
const state = {
  dataset:null, datasets:[], topics:[], book:null, parent:null, selected:null,
  notes:new Map(), seen:new Set(), sticky:null, theme:"paper",
  pendingImport:null
};

function el(tag, className, text) {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined && text!==null) node.textContent=String(text);
  return node;
}
function clear(node){node.replaceChildren();}
function notice(text,error=false){
  $("notice").textContent=text;
  $("notice").classList.toggle("error",!!error);
}
async function api(url,opts={}){
  const res=await fetch(url,opts);
  let body;
  try{body=await res.json();}catch(_){throw new Error("Invalid server response");}
  if(!res.ok) throw new Error(body.error||("HTTP "+res.status));
  return body;
}
function url(path,params){
  const u=new URL(path,location.origin);
  for(const [key,value] of Object.entries(params)) u.searchParams.set(key,value);
  return u;
}

const THEME_NAMES={paper:"Paper",sage:"Sage",lavender:"Lavender",sky:"Sky"};
function applyTheme(name){
  name=THEME_NAMES[name]?name:"paper";
  state.theme=name;
  document.documentElement.dataset.theme=name;
  $("theme-name").textContent=THEME_NAMES[name];
  localStorage.setItem("discordWikiTheme",name);
}
function initials(name){
  const parts=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return "+";
  return parts.slice(0,2).map(x=>x[0]).join("").toUpperCase();
}
function hueFor(text){
  let h=0;for(const ch of String(text||""))h=(h*31+ch.charCodeAt(0))%360;
  return h;
}
function renderCommunitySwitcher(){
  const ds=state.datasets.find(x=>x.id===state.dataset);
  $("community-name").textContent=ds?ds.name:"Add a community";
  $("community-meta").textContent=ds?ds.message_count.toLocaleString()+" messages":"Choose an archive";
  $("community-avatar").textContent=ds?initials(ds.name):"+";
  $("community-avatar").style.setProperty("--avatar-hue",ds?hueFor(ds.name):220);
}
function renderCommunityMenu(){
  const list=$("datasets");clear(list);
  if(!state.datasets.length)list.append(el("p","hint","No communities yet."));
  for(const ds of state.datasets){
    const item=el("button","dataset"+(state.dataset===ds.id?" selected":""));
    const avatar=el("span","mini-avatar",initials(ds.name));
    avatar.style.setProperty("--avatar-hue",hueFor(ds.name));
    const copy=el("span","dataset-copy");
    copy.append(el("strong",null,ds.name));
    copy.append(el("small",null,ds.message_count.toLocaleString()+" messages"));
    item.append(avatar,copy);
    item.onclick=()=>{
      $("community-menu").hidden=true;
      $("community-switcher").setAttribute("aria-expanded","false");
      chooseDataset(ds);
    };
    list.append(item);
  }
}
function toggleMenu(id,buttonId){
  const menu=$(id),opening=menu.hidden;
  $("community-menu").hidden=true;
  $("theme-menu").hidden=true;
  if(opening)menu.hidden=false;
  if(buttonId)$(buttonId).setAttribute("aria-expanded",String(opening));
}

const MAP_SEMANTICS=["content","attachments","author","timestamp","id","reply_to","channel_id"];
function mapValue(path){return path?JSON.stringify(path):"";}
function currentMapCandidate(){
  if(!state.pendingImport)return null;
  return state.pendingImport.inspection.candidates[Number($("mapper-records").value)||0];
}
function fillMapSelect(id,candidate,semantic){
  const select=$(id);clear(select);
  select.append(el("option",null,"Not included"));
  select.options[0].value="";
  for(const field of candidate.fields||[]){
    const option=el("option",null,field.label);
    option.value=mapValue(field.path);
    select.append(option);
  }
  const suggested=candidate.suggested?.[semantic];
  if(suggested) select.value=mapValue(suggested);
}
function renderMapCandidate(){
  const candidate=currentMapCandidate();
  if(!candidate)return;
  fillMapSelect("map-content",candidate,"content");
  fillMapSelect("map-attachments",candidate,"attachments");
  fillMapSelect("map-author",candidate,"author");
  fillMapSelect("map-timestamp",candidate,"timestamp");
  fillMapSelect("map-id",candidate,"id");
  fillMapSelect("map-reply_to",candidate,"reply_to");
  fillMapSelect("map-channel_id",candidate,"channel_id");

  const preview=$("mapper-preview");clear(preview);
  preview.append(el("div","mapper-preview-title",
    candidate.count.toLocaleString()+" records · "+(candidate.label||"Top level")));
  for(const record of (candidate.preview||[]).slice(0,3)){
    const card=el("div","mapper-sample");
    for(const [key,value] of Object.entries(record).slice(0,7)){
      const row=el("div","mapper-sample-row");
      row.append(el("strong",null,key==="\$value"?"item":key));
      row.append(el("span",null,value));
      card.append(row);
    }
    preview.append(card);
  }
}
function openImportMapper(file,inspection){
  state.pendingImport={file,inspection};
  const records=$("mapper-records");clear(records);
  (inspection.candidates||[]).forEach((candidate,i)=>{
    const option=el("option",null,
      (candidate.label||"Top level")+" · "+candidate.count.toLocaleString()+" records");
    option.value=String(i);
    records.append(option);
  });
  records.value=String(inspection.recommended||0);
  $("mapper-note").textContent=
    "We can read "+file.name+", but its layout is unfamiliar. Match what you have; everything except text or attachments can be left out.";
  renderMapCandidate();
  $("import-mapper").hidden=false;
}
function closeImportMapper(){
  $("import-mapper").hidden=true;
  state.pendingImport=null;
}
function selectedPath(id){
  const value=$(id).value;
  return value?JSON.parse(value):null;
}
async function sendArchive(file,mapping=null){
  const raw=await file.arrayBuffer();
  const headers={
    "Content-Type":file.type||"application/octet-stream",
    "X-Filename":encodeURIComponent(file.name)
  };
  if(mapping) headers["X-Import-Mapping"]=encodeURIComponent(JSON.stringify(mapping));
  const res=await fetch("/api/import",{method:"POST",headers,body:raw});
  let body;
  try{body=await res.json();}catch(_){throw new Error("Invalid server response");}
  if(res.status===422&&body.mapping_required){
    openImportMapper(file,body.inspection);
    return null;
  }
  if(!res.ok)throw new Error(body.error||body.message||("HTTP "+res.status));
  return body;
}
async function finishArchiveImport(result){
  await loadDatasets();
  const ds=(await api("/api/datasets")).datasets.find(d=>d.id===result.id);
  if(ds)await chooseDataset(ds);
  notice((result.cached?"Already added: ":"Added: ")+
    result.count.toLocaleString()+" messages from "+result.name+".");
}

function noteId(type,key){return type+"\n"+key;}
function noteFor(type,key){return state.notes.get(noteId(type,key))||"";}
function isSeen(type,key){return state.seen.has(noteId(type,key));}
function addLines(parent,items){
  clear(parent);
  const list=el("ul","scan-list");
  for(const item of items.filter(Boolean)) list.append(el("li",null,item));
  parent.append(list);
}
function syncSticky(node){
  const type=node.dataset.noteType,key=node.dataset.noteKey;
  node.querySelector(":scope > .sticky-badge")?.remove();
  const note=noteFor(type,key);
  node.classList.toggle("noted",!!note);
  node.classList.toggle("seen",isSeen(type,key));
  node.title=note ? note : (isSeen(type,key)?"Encountered · right-click to add a note":"Right-click to add a personal note");
  if(note){
    const badge=el("span","sticky-badge","▰");
    badge.title=note;
    badge.setAttribute("aria-label","Personal note");
    badge.onclick=ev=>{
      ev.preventDefault();ev.stopPropagation();
      openSticky(node,type,key,node.dataset.noteLabel||key,ev.clientX,ev.clientY);
    };
    node.append(badge);
  }
}
function noteable(node,type,key,label){
  node.dataset.noteType=type;
  node.dataset.noteKey=key;
  node.dataset.noteLabel=label||key;
  node.oncontextmenu=ev=>{
    ev.preventDefault();
    openSticky(node,type,key,label||key,ev.clientX,ev.clientY);
  };
  syncSticky(node);
  return node;
}
function openSticky(node,type,key,label,x,y){
  state.sticky={node,type,key,label};
  $("sticky-title").textContent=label;
  $("sticky-text").value=noteFor(type,key);
  $("sticky-remove").hidden=!noteFor(type,key);
  const editor=$("sticky-editor");
  editor.hidden=false;
  const width=330,height=285,pad=12;
  const left=Math.max(pad,Math.min(x||window.innerWidth/2,window.innerWidth-width-pad));
  const top=Math.max(pad,Math.min(y||window.innerHeight/3,window.innerHeight-height-pad));
  editor.style.left=left+"px";
  editor.style.top=top+"px";
  setTimeout(()=>$("sticky-text").focus(),0);
}
function closeSticky(){
  $("sticky-editor").hidden=true;
  state.sticky=null;
}
async function saveSticky(remove=false){
  if(!state.sticky||!state.dataset) return;
  const {node,type,key}=state.sticky;
  const note=remove ? "" : $("sticky-text").value.trim();
  try{
    await api("/api/note",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dataset:state.dataset,target_type:type,target_key:key,note})
    });
    if(note) state.notes.set(noteId(type,key),note);
    else state.notes.delete(noteId(type,key));
    syncSticky(node);
    updateNoteCounts();
    closeSticky();
    notice(note?"Personal note saved locally.":"Personal note removed.");
  }catch(e){notice(e.message,true);}
}
function updateNoteCounts(){
  const chapterNotes=[...state.notes.keys()].filter(x=>x.startsWith("chapter\n")).length;
  const termNotes=[...state.notes.keys()].filter(x=>x.startsWith("term\n")).length;
  const chapterSeen=[...state.seen].filter(x=>x.startsWith("chapter\n")).length;
  const termSeen=[...state.seen].filter(x=>x.startsWith("term\n")).length;
  const chapters=state.book?.chapters?.length||0;
  $("chapter-count").textContent=chapters+" parts"+(chapterSeen?" · "+chapterSeen+" seen":"")+(chapterNotes?" · "+chapterNotes+" noted":"");
  $("topic-count").textContent=state.topics.length+" entries"+(termSeen?" · "+termSeen+" seen":"")+(termNotes?" · "+termNotes+" noted":"");
}
async function markSeen(type,key,node){
  if(!state.dataset||isSeen(type,key)) return;
  state.seen.add(noteId(type,key));
  if(node) syncSticky(node);
  updateNoteCounts();
  try{
    await api("/api/seen",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dataset:state.dataset,target_type:type,target_key:key})});
  }catch(e){
    state.seen.delete(noteId(type,key));
    if(node) syncSticky(node);
    updateNoteCounts();
  }
}
async function loadReaderState(){
  const [notesData,seenData]=await Promise.all([
    api(url("/api/notes",{dataset:state.dataset})),
    api(url("/api/seen",{dataset:state.dataset}))
  ]);
  state.notes=new Map((notesData.notes||[]).map(n=>[noteId(n.target_type,n.target_key),n.note]));
  state.seen=new Set((seenData.seen||[]).map(n=>noteId(n.target_type,n.target_key)));
}

async function loadDatasets(){
  const data=await api("/api/datasets");
  state.datasets=data.datasets;
  renderCommunityMenu();
  renderCommunitySwitcher();
  if(!state.dataset&&state.datasets.length) await chooseDataset(state.datasets[0]);
}
async function chooseDataset(ds){
  state.dataset=ds.id;state.parent=null;state.selected=null;
  renderCommunitySwitcher();
  renderCommunityMenu();
  $("results-title").textContent="Explore";
  $("certificate").hidden=true;
  clear($("results"));
  $("results").append(el("div","empty","Choose something from Key Contents or the Glossary, or ask a question."));
  clear($("source-detail"));
  $("source-detail").append(el("div","empty","Select a source to see the surrounding conversation."));
  $("evidence-count").textContent="";
  notice(ds.message_count.toLocaleString()+" messages ready to explore.");
  const [indexData,bookData]=await Promise.all([
    api(url("/api/index",{dataset:ds.id})),
    api(url("/api/book",{dataset:ds.id})),
    loadReaderState()
  ]);
  state.topics=indexData.topics;
  state.book=bookData;
  renderBook();
  renderChapters();
  renderTopics();
  await loadHistory();
}

function renderBook(){
  const cover=$("book-cover");
  if(!state.book){cover.hidden=true;return;}
  const p=state.book.profile;
  cover.hidden=false;
  $("book-type").textContent=p.headline;
  const uses=[p.primary.purpose];
  if(p.secondary) uses.push(p.secondary.purpose);
  addLines($("book-purpose"),uses);
  addLines($("book-topology"),String(p.topology||"").split(" + "));
  addLines($("book-why"),(p.why&&p.why.length)?p.why:[p.boundary]);
}
function renderChapters(){
  const list=$("chapters");clear(list);
  const chapters=state.book?.chapters||[];
  if(!chapters.length){
    list.append(el("p","hint","No broad parts yet; use the glossary or ask a question."));
    updateNoteCounts();return;
  }
  chapters.forEach((chapter,i)=>{
    const item=noteable(el("button","chapter"),"chapter",chapter.key,chapter.title);
    const n=el("span","chapter-no",String(i+1).padStart(2,"0"));
    const text=el("span","chapter-text");
    text.append(el("strong",null,chapter.title));
    const sub=(chapter.subtopics||[]).slice(0,3).join(" · ");
    text.append(el("small",null,(sub?sub+" · ":"")+chapter.source_count+" source messages"));
    item.prepend(n,text);
    item.onclick=async()=>{
      markSeen("chapter",chapter.key,item);
      try{
        notice("Opening "+chapter.title+".");
        const data=await api(url("/api/chapter",{dataset:state.dataset,key:chapter.key}));
        $("certificate").hidden=true;
        showEvidence(data.messages,"Part "+(i+1)+": "+chapter.title);
      }catch(e){notice(e.message,true);}
    };
    list.append(item);
  });
  updateNoteCounts();
}
function renderTopics(){
  const filter=$("topic-filter").value.trim().toLowerCase();
  const topics=state.topics.filter(x=>x.term.includes(filter));
  const list=$("topics");clear(list);
  if(!state.topics.length) list.append(el("p","hint","Not enough recurring terms to make a glossary."));
  for(const topic of topics){
    const item=noteable(el("button","topic"),"term",topic.term,topic.term);
    const body=el("span","topic-body",topic.term);
    body.append(el("small",null,topic.df+" source messages · "+topic.kind));
    item.prepend(body);
    item.onclick=async()=>{
      markSeen("term",topic.term,item);
      try{
        notice("Opening "+topic.term+".");
        const data=await api(url("/api/term",{dataset:state.dataset,term:topic.term}));
        $("certificate").hidden=true;
        showEvidence(data.messages,topic.term);
      }catch(e){notice(e.message,true);}
    };
    list.append(item);
  }
  updateNoteCounts();
}
function showEvidence(messages,title){
  $("results-title").textContent=title;
  $("evidence-count").textContent=messages.length+" excerpts";
  const result=$("results");clear(result);
  if(!messages.length){
    result.append(el("div","empty","No source messages found. This does not establish that the claim is false."));
    return;
  }
  for(const msg of messages){
    const hasAuthor=!!msg.author&&msg.author!=="unknown";
    const hasTime=!!msg.ts;
    const card=noteable(el("button","message"),"message",msg.id,
      (hasAuthor?msg.author:"Source")+" · "+(msg.content||"[attachment]").slice(0,70));
    if(hasAuthor||hasTime){
      const head=el("div","message-head");
      if(hasAuthor)head.append(el("strong",null,msg.author));
      if(hasTime)head.append(el("span",null,new Date(msg.ts).toLocaleString()));
      card.prepend(head);
    }
    const content=msg.content||((msg.attachments||[]).length?"[attachment only]":"[empty message]");
    card.insertBefore(el("pre",null,content.length>850?content.slice(0,850)+"…":content),
                      card.querySelector(".sticky-badge"));
    if(!String(msg.id).startsWith("synthetic:")){
      card.insertBefore(el("div","id","source:"+msg.id),card.querySelector(".sticky-badge"));
    }
    card.onclick=async()=>{
      markSeen("message",msg.id,card);
      document.querySelectorAll(".message").forEach(x=>x.classList.remove("selected"));
      card.classList.add("selected");
      try{
        await showContext(msg.id);
        if(window.innerWidth<=1050){
          document.querySelector(".source-pane")?.scrollIntoView({behavior:"smooth",block:"start"});
        }
      }catch(e){notice(e.message,true);}
    };
    result.append(card);
  }
}
async function showContext(mid,radius=3){
  state.selected=mid;
  const data=await api(url("/api/context",{dataset:state.dataset,message:mid,radius}));
  const pane=$("source-detail");clear(pane);
  const sourcePane=document.querySelector(".source-pane");
  if(sourcePane) sourcePane.scrollTop=0;
  if(!data.messages.length){
    pane.append(el("div","empty","Original message was not found."));return;
  }
  pane.append(el("p","hint","Nearby messages are shown in time order. Replies are included when available."));
  const lengths=data.messages.map(m=>(m.content||"").trim().length).filter(Boolean);
  const average=lengths.length?lengths.reduce((a,b)=>a+b,0)/lengths.length:1;
  const keyMessage=data.messages.find(m=>m.id===mid);
  const keyLength=Math.max(1,(keyMessage?.content||"").trim().length);
  const densityReference=Math.max(80,(average+keyLength)/2);
  if(radius<25){
    const more=el("button","history-item",radius<12?"Show wider context (±12 messages)":"Show wider context (±25 messages)");
    more.onclick=()=>showContext(mid,radius<12?12:25).catch(e=>notice(e.message,true));
    pane.append(more);
  }
  for(const msg of data.messages){
    const row=noteable(el("div","context-item"+(msg.id===mid?" active":"")),
      "message",msg.id,(msg.author||"unknown")+" · "+(msg.content||"[attachment]").slice(0,70));
    const textLength=(msg.content||"").trim().length;
    const density=Math.max(.05,Math.min(4,textLength/densityReference));
    // Regularized visual multiplier: discrete bands stay distinguishable at a
    // glance, while the cap prevents long messages from dominating the pane.
    let level=0;
    if(density>=.55) level=1;
    if(density>=.90) level=2;
    if(density>=1.35) level=3;
    if(density>=2.00) level=4;
    const baseAlpha=.026, shadeMultiplier=1.72;
    const alpha=msg.id===mid ? .030 : Math.min(.23,baseAlpha*Math.pow(shadeMultiplier,level));
    row.style.setProperty("--context-alpha",alpha.toFixed(3));
    row.dataset.densityLevel=String(msg.id===mid?0:level);
    const hasAuthor=!!msg.author&&msg.author!=="unknown";
    const hasTime=!!msg.ts;
    if(hasAuthor||hasTime){
      const label=el("div");
      if(hasAuthor)label.append(el("strong",null,msg.author));
      if(hasTime)label.append(el("span","timestamp",new Date(msg.ts).toLocaleString()));
      row.prepend(label);
    }
    row.insertBefore(el("pre",null,msg.content||"[no text]"),row.querySelector(".sticky-badge"));
    const metadata=[];
    if(!String(msg.id).startsWith("synthetic:"))metadata.push("Source ID: "+msg.id);
    if(msg.reply_to)metadata.push("Replies to: "+msg.reply_to);
    if(msg.attachments?.length)metadata.push("Attachments: "+msg.attachments.join(", "));
    if(metadata.length){
      row.insertBefore(el("div","metadata",metadata.join(" · ")),row.querySelector(".sticky-badge"));
    }
    pane.append(row);
  }
}
async function loadHistory(){
  const box=$("history");clear(box);
  if(!state.dataset)return;
  const data=await api(url("/api/history",{dataset:state.dataset}));
  if(!data.history.length) box.append(el("div","hint","No questions yet."));
  for(const investigation of data.history){
    const item=el("button","history-item",investigation.question);
    item.title="Ask a follow-up question";
    item.onclick=()=>{
      $("question").value=investigation.question+"\nFollow up: ";
      state.parent=investigation.id;
      $("question").focus();
      notice("Follow-up ready. Your original question will stay connected.");
    };
    box.append(item);
  }
}
function field(parent,label,value,cls=""){
  const line=el("div","certificate-field "+cls);
  line.append(el("label",null,label));
  const body=el("div","certificate-value");
  const values=Array.isArray(value)?value:String(value??"").split(" · ");
  if(values.length>1){
    const ul=el("ul","scan-list compact");
    values.filter(Boolean).forEach(v=>ul.append(el("li",null,v)));
    body.append(ul);
  }else body.textContent=values[0]||"";
  line.append(body);parent.append(line);
}
function displayCertificate(result){
  const pane=$("certificate");clear(pane);
  const hasSources=(result.evidence||[]).length>0;
  const related=(result.orientation||[]).map(x=>x.title).filter(Boolean);
  const hasSummary=!!result.interpretation;
  const hasModelError=!!result.model_error;

  // No internal reasoning scaffold is shown merely because it exists.
  if(!hasSources&&!hasSummary&&!hasModelError){
    pane.hidden=true;
    return;
  }

  pane.hidden=false;
  pane.className="certificate finding-card";
  pane.append(el("h3",null,"Found in this community"));

  const summary=el("div","finding-summary");
  summary.append(el("strong",null,hasSources?
    (result.evidence.length+" source"+(result.evidence.length===1?"":"s")):
    "No close sources found"));
  summary.append(el("span",null,hasSources?
    "Open any source to see the original conversation.":
    "Try a different wording or browse Key Contents."));
  pane.append(summary);

  if(related.length){
    const block=el("div","finding-block");
    block.append(el("label",null,"Related"));
    const chips=el("div","finding-chips");
    related.slice(0,4).forEach(term=>chips.append(el("span","finding-chip",term)));
    block.append(chips);
    pane.append(block);
  }

  if(hasSummary){
    const block=el("div","finding-block ai-finding");
    block.append(el("label",null,"AI summary"));
    block.append(el("div","finding-text",result.interpretation));
    pane.append(block);
  }else if(hasModelError){
    const block=el("div","finding-block model-note");
    block.append(el("label",null,"AI"));
    block.append(el("div","finding-text","AI couldn't add a summary. The source messages are still available below."));
    pane.append(block);
  }
}

applyTheme(localStorage.getItem("discordWikiTheme")||"paper");
$("community-switcher").onclick=()=>toggleMenu("community-menu","community-switcher");
$("theme-button").onclick=()=>toggleMenu("theme-menu","theme-button");
document.querySelectorAll("[data-theme-choice]").forEach(button=>{
  button.onclick=()=>{
    applyTheme(button.dataset.themeChoice);
    $("theme-menu").hidden=true;
    $("theme-button").setAttribute("aria-expanded","false");
  };
});
$("mapper-records").addEventListener("change",renderMapCandidate);
$("mapper-cancel").onclick=closeImportMapper;
$("mapper-use").onclick=async()=>{
  const pending=state.pendingImport;
  const candidate=currentMapCandidate();
  if(!pending||!candidate)return;
  const fields={};
  for(const semantic of MAP_SEMANTICS){
    const path=selectedPath("map-"+semantic);
    if(path)fields[semantic]=path;
  }
  if(!fields.content&&!fields.attachments){
    notice("Choose message text or attachments. Everything else can be left out.",true);
    return;
  }
  const mapping={record_path:candidate.record_path||[],fields};
  $("mapper-use").disabled=true;
  try{
    $("import-mapper").hidden=true;
    notice("Reading "+pending.file.name+" with your mapping…");
    const result=await sendArchive(pending.file,mapping);
    if(result){
      state.pendingImport=null;
      await finishArchiveImport(result);
    }
  }catch(e){
    $("import-mapper").hidden=false;
    notice(e.message,true);
  }finally{$("mapper-use").disabled=false;}
};
$("topic-filter").addEventListener("input",renderTopics);
$("sticky-save").onclick=()=>saveSticky(false);
$("sticky-remove").onclick=()=>saveSticky(true);
$("sticky-cancel").onclick=closeSticky;
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeSticky();});
document.addEventListener("mousedown",ev=>{
  const editor=$("sticky-editor");
  if(!editor.hidden&&!editor.contains(ev.target)&&!ev.target.closest?.(".sticky-badge")){
    closeSticky();
  }
  if(!ev.target.closest?.(".community-section")){
    $("community-menu").hidden=true;
    $("community-switcher").setAttribute("aria-expanded","false");
  }
  if(!ev.target.closest?.(".topbar-actions")){
    $("theme-menu").hidden=true;
    $("theme-button").setAttribute("aria-expanded","false");
  }
});

$("upload").addEventListener("change",async ev=>{
  const file=ev.target.files?.[0];
  if(!file)return;
  try{
    notice("Reading "+file.name+"…");
    $("upload").disabled=true;
    const result=await sendArchive(file);
    if(result)await finishArchiveImport(result);
  }catch(e){notice(e.message,true);}
  finally{$("upload").disabled=false;ev.target.value="";}
});
$("ask-form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  if(!state.dataset){notice("Add an archive first.",true);return;}
  const question=$("question").value.trim();
  if(!question)return;
  const parentId=state.parent;
  state.parent=null;
  const button=$("ask");
  button.disabled=true;
  notice("Finding useful sources…");
  try{
    const result=await api("/api/investigate",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dataset:state.dataset,question,parent_id:parentId,reason:$("reason").checked})});
    displayCertificate(result);
    showEvidence(result.evidence,"Sources for: "+question);
    await loadHistory();
    notice(result.interpretation?"AI summary ready. Open any source to check the original conversation.":
      result.evidence.length?"Sources ready. Open any message for its surrounding conversation.":
      "No relevant messages found. Try a narrower or alternate formulation.");
  }catch(e){notice(e.message,true);}
  finally{button.disabled=false;}
});
loadDatasets().catch(e=>notice(e.message,true));
