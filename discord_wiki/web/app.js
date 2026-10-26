"use strict";
const $ = id => document.getElementById(id);
const state = {
  dataset:null, topics:[], book:null, parent:null, selected:null,
  notes:new Map(), seen:new Set(), sticky:null
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
  const list=$("datasets");clear(list);
  if(!data.datasets.length) list.append(el("p","hint","No imported exports yet."));
  for(const ds of data.datasets){
    const item=el("button","dataset"+(state.dataset===ds.id?" selected":""),ds.name);
    item.append(el("small",null,ds.message_count.toLocaleString()+" messages"));
    item.onclick=()=>chooseDataset(ds);
    list.append(item);
  }
  if(!state.dataset&&data.datasets.length) await chooseDataset(data.datasets[0]);
}
async function chooseDataset(ds){
  state.dataset=ds.id;state.parent=null;state.selected=null;
  $("dataset-pill").textContent=ds.name;
  $("results-title").textContent="Investigation";
  $("certificate").hidden=true;
  clear($("results"));
  $("results").append(el("div","empty","Choose a part, browse the glossary, or ask a question."));
  clear($("source-detail"));
  $("source-detail").append(el("div","empty","Select an evidence message to inspect source context."));
  $("evidence-count").textContent="";
  notice(ds.message_count.toLocaleString()+" original messages ready.");
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
  await loadDatasetsShallow();
}
async function loadDatasetsShallow(){
  const data=await api("/api/datasets");
  for(const item of $("datasets").children){
    const title=item.firstChild?.textContent||"";
    item.classList.toggle("selected",data.datasets.some(d=>d.id===state.dataset&&d.name===title));
  }
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
        notice("Opening "+chapter.title+". The heading is a useful region, not a rigid taxonomy.");
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
        notice("Opening glossary entry: "+topic.term);
        const data=await api(url("/api/term",{dataset:state.dataset,term:topic.term}));
        $("certificate").hidden=true;
        showEvidence(data.messages,"Glossary: "+topic.term);
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
    const card=noteable(el("button","message"),"message",msg.id,
      (msg.author||"unknown")+" · "+(msg.content||"[attachment]").slice(0,70));
    const head=el("div","message-head");
    head.append(el("strong",null,msg.author||"unknown"));
    head.append(el("span",null,msg.ts?new Date(msg.ts).toLocaleString():"Time unavailable"));
    card.prepend(head);
    const content=msg.content||((msg.attachments||[]).length?"[attachment only]":"[empty message]");
    card.insertBefore(el("pre",null,content.length>850?content.slice(0,850)+"…":content),
                      card.querySelector(".sticky-badge"));
    card.insertBefore(el("div","id","message:"+msg.id),card.querySelector(".sticky-badge"));
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
  if(!data.messages.length){
    pane.append(el("div","empty","Original message was not found."));return;
  }
  pane.append(el("p","hint","Nearby messages are chronological context, not necessarily the same conversation. Reply references are explicit links."));
  if(radius<25){
    const more=el("button","history-item",radius<12?"Show wider context (±12 messages)":"Show wider context (±25 messages)");
    more.onclick=()=>showContext(mid,radius<12?12:25).catch(e=>notice(e.message,true));
    pane.append(more);
  }
  for(const msg of data.messages){
    const row=noteable(el("div","context-item"+(msg.id===mid?" active":"")),
      "message",msg.id,(msg.author||"unknown")+" · "+(msg.content||"[attachment]").slice(0,70));
    const label=el("div");
    label.append(el("strong",null,msg.author));
    label.append(el("span","timestamp",msg.ts?new Date(msg.ts).toLocaleString():"Time unavailable"));
    row.prepend(label);
    row.insertBefore(el("pre",null,msg.content||"[no text]"),row.querySelector(".sticky-badge"));
    row.insertBefore(el("div","metadata","Original ID: "+msg.id+
      (msg.reply_to?" · Replies to: "+msg.reply_to:"")+
      (msg.attachments?.length?" · Attachments: "+msg.attachments.join(", "):"")),
      row.querySelector(".sticky-badge"));
    pane.append(row);
  }
}
async function loadHistory(){
  const box=$("history");clear(box);
  if(!state.dataset)return;
  const data=await api(url("/api/history",{dataset:state.dataset}));
  if(!data.history.length) box.append(el("div","hint","No investigations yet."));
  for(const investigation of data.history){
    const item=el("button","history-item",investigation.question);
    item.title="Continue this investigation while preserving its original goal";
    item.onclick=()=>{
      $("question").value=investigation.question+"\nFollow up: ";
      state.parent=investigation.id;
      $("question").focus();
      notice("Following up this investigation while preserving what you were originally trying to understand.");
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
  const pane=$("certificate");clear(pane);pane.hidden=false;
  pane.append(el("h3",null,"Investigation trail · "+result.mode));
  field(pane,"What you are trying to understand",result.root_goal);
  field(pane,"What this search covered",result.boundary);
  field(pane,"Source status",result.coverage==="no_match"?
    "No matches; this does not mean the idea is false":
    "Relevant discussion found; participant claims are not automatically verified");
  if(result.orientation?.length) field(pane,"Nearby parts of the book",result.orientation.map(x=>x.title));
  if(result.learned_terms?.length) field(pane,"The discussion introduced",result.learned_terms);
  if(result.interpretation) field(pane,"Qualified model interpretation",result.interpretation,"interpretation");
  if(result.model_error) field(pane,"Model",result.model_error);
  field(pane,"Useful next question",result.next_question);
  field(pane,"When enough is enough",result.stopping_condition);
}

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
});

$("upload").addEventListener("change",async ev=>{
  const file=ev.target.files?.[0];
  if(!file)return;
  try{
    notice("Importing and indexing "+file.name+"…");
    $("upload").disabled=true;
    const raw=await file.arrayBuffer();
    const result=await api("/api/import",{method:"POST",
      headers:{"Content-Type":"application/json","X-Filename":encodeURIComponent(file.name)},body:raw});
    await loadDatasets();
    const ds=(await api("/api/datasets")).datasets.find(d=>d.id===result.id);
    if(ds) await chooseDataset(ds);
    notice((result.cached?"Already imported: ":"Imported: ")+result.count.toLocaleString()+" messages from "+result.name);
  }catch(e){notice(e.message,true);}
  finally{$("upload").disabled=false;ev.target.value="";}
});
$("ask-form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  if(!state.dataset){notice("Import a Discord JSON export first.",true);return;}
  const question=$("question").value.trim();
  if(!question)return;
  const parentId=state.parent;
  state.parent=null;
  const button=$("ask");
  button.disabled=true;
  notice("Finding useful evidence…");
  try{
    const result=await api("/api/investigate",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dataset:state.dataset,question,parent_id:parentId,reason:$("reason").checked})});
    displayCertificate(result);
    showEvidence(result.evidence,"Evidence for: "+question);
    await loadHistory();
    notice(result.interpretation?"Source-grounded interpretation ready; inspect its original messages.":
      result.evidence.length?"Evidence ready. Open any message for its original context.":
      "No relevant messages found. Try a narrower or alternate formulation.");
  }catch(e){notice(e.message,true);}
  finally{button.disabled=false;}
});
loadDatasets().catch(e=>notice(e.message,true));
