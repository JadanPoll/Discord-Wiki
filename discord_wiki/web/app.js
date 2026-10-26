"use strict";
const $ = id => document.getElementById(id);
const state = { dataset:null, topics:[], book:null, parent:null, selected:null };
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function clear(node) { node.replaceChildren(); }
function notice(text, error=false) {
  $("notice").textContent=text;
  $("notice").classList.toggle("error", !!error);
}
async function api(url, opts={}) {
  const res=await fetch(url,opts);
  let body;
  try { body=await res.json(); } catch (_) { throw new Error("Invalid server response"); }
  if (!res.ok) throw new Error(body.error || ("HTTP "+res.status));
  return body;
}
function url(path, params) {
  const u = new URL(path, location.origin);
  for (const [key,value] of Object.entries(params)) u.searchParams.set(key,value);
  return u;
}
async function loadDatasets() {
  const data=await api("/api/datasets");
  const list=$("datasets"); clear(list);
  if (!data.datasets.length) list.append(el("p","hint","No imported exports yet."));
  for (const ds of data.datasets) {
    const item=el("button","dataset"+(state.dataset===ds.id?" selected":""),ds.name);
    item.append(el("small",null,ds.message_count.toLocaleString()+" messages"));
    item.onclick=()=>chooseDataset(ds);
    list.append(item);
  }
  if (!state.dataset && data.datasets.length) await chooseDataset(data.datasets[0]);
}
async function chooseDataset(ds) {
  state.dataset=ds.id;state.parent=null;state.selected=null;
  $("dataset-pill").textContent=ds.name;
  $("results-title").textContent="Investigation";
  $("certificate").hidden=true;
  clear($("results"));
  $("results").append(el("div","empty","Choose a topic from the index or ask a question about the imported messages."));
  clear($("source-detail"));
  $("source-detail").append(el("div","empty","Select an evidence message to inspect source context."));
  $("evidence-count").textContent="";
  notice(ds.message_count.toLocaleString()+" original messages ready. Index entries are provisional navigation, not verified technical claims.");
  state.topics=(await api(url("/api/index",{dataset:ds.id}))).topics;
  state.book=await api(url("/api/book",{dataset:ds.id}));
  renderBook();
  renderChapters();
  renderTopics();
  await loadHistory();
  await loadDatasetsShallow();
}
async function loadDatasetsShallow() {
  const data=await api("/api/datasets");
  for (const item of $("datasets").children) {
    const title=item.firstChild?.textContent || "";
    item.classList.toggle("selected",data.datasets.some(d=>d.id===state.dataset && d.name===title));
  }
}

function renderBook() {
  const cover=$("book-cover");
  if(!state.book){cover.hidden=true;return;}
  const p=state.book.profile;
  cover.hidden=false;
  $("book-type").textContent=p.headline;
  const secondary=p.secondary ? " It also benefits from "+p.secondary.purpose+"." : "";
  $("book-purpose").textContent="Best treated as a "+p.primary.grammar+" resource: "+p.primary.purpose+"."+secondary;
  $("book-topology").textContent=p.topology;
  $("book-why").textContent=(p.why||[]).join(" · ") || p.boundary;
}
function renderChapters() {
  const list=$("chapters"); clear(list);
  const chapters=state.book?.chapters||[];
  $("chapter-count").textContent=chapters.length+" parts";
  if(!chapters.length){
    list.append(el("p","hint","No broad chapter regions yet; use the glossary or ask a question."));
    return;
  }
  chapters.forEach((chapter,i)=>{
    const item=el("button","chapter");
    const n=el("span","chapter-no",String(i+1).padStart(2,"0"));
    const text=el("span","chapter-text");
    text.append(el("strong",null,chapter.title));
    const sub=(chapter.subtopics||[]).slice(0,3).join(" · ");
    text.append(el("small",null,(sub?sub+" · ":"")+chapter.source_count+" source messages"));
    item.append(n,text);
    item.onclick=async()=>{
      try{
        notice("Opening a chapter-like region. Its heading is a navigational bundle, not an asserted taxonomy.");
        const data=await api(url("/api/chapter",{dataset:state.dataset,key:chapter.key}));
        $("certificate").hidden=true;
        showEvidence(data.messages,"Chapter "+(i+1)+": "+chapter.title);
      }catch(e){notice(e.message,true);}
    };
    list.append(item);
  });
}
function renderTopics() {
  const filter=$("topic-filter").value.trim().toLowerCase();
  const topics=state.topics.filter(x=>x.term.includes(filter));
  $("topic-count").textContent=state.topics.length+" entries";
  const list=$("topics");clear(list);
  if(!state.topics.length) list.append(el("p","hint","Not enough recurring terms to produce a useful index."));
  for(const topic of topics) {
    const item=el("button","topic",topic.term);
    item.append(el("small",null,topic.df+" source messages · "+topic.kind));
    item.onclick=async()=>{
      try {
        notice("Index term: "+topic.term+" — selecting its original message backreferences.");
        const data=await api(url("/api/term",{dataset:state.dataset,term:topic.term}));
        $("certificate").hidden=true;
        showEvidence(data.messages,"Index: "+topic.term);
      } catch(e) {notice(e.message,true);}
    };
    list.append(item);
  }
}
function showEvidence(messages, title) {
  $("results-title").textContent=title;
  $("evidence-count").textContent=messages.length+" excerpts";
  const result=$("results");clear(result);
  if(!messages.length) {
    result.append(el("div","empty","No source messages found. This does not establish that the claim is false."));
    return;
  }
  for(const msg of messages) {
    const card=el("button","message");
    const head=el("div","message-head");
    head.append(el("strong",null,msg.author||"unknown"));
    head.append(el("span",null,msg.ts?new Date(msg.ts).toLocaleString():"Time unavailable"));
    card.append(head);
    const content=msg.content||((msg.attachments||[]).length?"[attachment only]":"[empty message]");
    card.append(el("pre",null,content.length>850?content.slice(0,850)+"…":content));
    card.append(el("div","id","message:"+msg.id));
    card.onclick=async()=>{
      document.querySelectorAll(".message").forEach(x=>x.classList.remove("selected"));
      card.classList.add("selected");
      try {await showContext(msg.id);} catch(e){notice(e.message,true);}
    };
    result.append(card);
  }
}
async function showContext(mid, radius=3) {
  state.selected=mid;
  const data=await api(url("/api/context",{dataset:state.dataset,message:mid,radius}));
  const pane=$("source-detail");clear(pane);
  if(!data.messages.length) {
    pane.append(el("div","empty","Original message was not found."));
    return;
  }
  const explainer=el("p","hint","Nearby messages are chronological context, not necessarily the same conversation. Reply references are explicit links.");
  pane.append(explainer);
  if(radius<25) {
    const more=el("button","history-item",radius<12?"Show wider context (±12 messages)":"Show wider context (±25 messages)");
    more.onclick=()=>showContext(mid,radius<12?12:25).catch(e=>notice(e.message,true));
    pane.append(more);
  }
  for (const msg of data.messages) {
    const row=el("div","context-item"+(msg.id===mid?" active":""));
    const label=el("div");
    label.append(el("strong",null,msg.author));
    label.append(el("span","timestamp",msg.ts?new Date(msg.ts).toLocaleString():"Time unavailable"));
    row.append(label);
    row.append(el("pre",null,msg.content || "[no text]"));
    row.append(el("div","metadata","Original ID: "+msg.id+
      (msg.reply_to?" · Replies to: "+msg.reply_to:"")+
      (msg.attachments?.length?" · Attachments: "+msg.attachments.join(", "):"")));
    pane.append(row);
  }
}
async function loadHistory() {
  const box=$("history");clear(box);
  if(!state.dataset) return;
  const data=await api(url("/api/history",{dataset:state.dataset}));
  if(!data.history.length) box.append(el("div","hint","No investigations yet."));
  for (const investigation of data.history) {
    const item=el("button","history-item",investigation.question);
    item.title="Continue this investigation while preserving its original goal";
    item.onclick=()=>{
      $("question").value=investigation.question+"\nFollow up: ";
      state.parent=investigation.id;
      $("question").focus();
      notice("Following up an existing investigation. Root goal preserved: "+investigation.root_goal);
    };
    box.append(item);
  }
}
function field(parent,label,value,cls="") {
  const line=el("p",cls);
  line.append(el("label",null,label+": "));
  line.append(document.createTextNode(value==null?"":String(value)));
  parent.append(line);
}
function displayCertificate(result) {
  const pane=$("certificate");clear(pane);pane.hidden=false;
  pane.append(el("h3",null,"RSM investigation certificate · "+result.mode));
  field(pane,"Root purpose",result.root_goal);
  field(pane,"Evidence boundary",result.boundary);
  field(pane,"Coverage",result.coverage==="no_match"?"No matches; do not infer contradiction":"Candidate discussion evidence, not verified conclusions");
  if(result.interpretation) field(pane,"Qualified model interpretation",result.interpretation,"interpretation");
  if(result.model_error) field(pane,"Model",result.model_error);
  field(pane,"Next consequential question",result.next_question);
  field(pane,"Stopping rule",result.stopping_condition);

}
$("topic-filter").addEventListener("input",renderTopics);
$("upload").addEventListener("change",async ev=>{
  const file=ev.target.files?.[0];
  if(!file) return;
  try {
    notice("Importing and indexing "+file.name+"…");
    $("upload").disabled=true;
    const raw=await file.arrayBuffer();
    const result=await api("/api/import",{method:"POST",
      headers:{"Content-Type":"application/json","X-Filename":encodeURIComponent(file.name)},body:raw});
    await loadDatasets();
    const ds=(await api("/api/datasets")).datasets.find(d=>d.id===result.id);
    if(ds) await chooseDataset(ds);
    notice((result.cached?"Already imported: ":"Imported: ")+result.count.toLocaleString()+" messages from "+result.name);
  } catch(e){notice(e.message,true);}
  finally{$("upload").disabled=false;ev.target.value="";}
});
$("ask-form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  if(!state.dataset){notice("Import a Discord JSON export first.",true);return;}
  const question=$("question").value.trim();
  if(!question)return;
  const parentId=state.parent;
  state.parent=null; // Explicit continuation applies only to this next question.
  const button=$("ask");
  button.disabled=true;
  notice("Retrieving evidence and forming the investigation packet…");
  try {
    const result=await api("/api/investigate",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dataset:state.dataset,question,parent_id:parentId,
                           reason:$("reason").checked})});
    displayCertificate(result);
    showEvidence(result.evidence,"Evidence for: "+question);
    await loadHistory();
    notice(result.interpretation?"Source-grounded model interpretation ready; inspect citations and original messages.":result.evidence.length?
      "Evidence packet ready. Messages are candidate sources; their claims have not been independently verified.":
      "No relevant messages found. Try a narrower or alternate formulation.");
  } catch(e){notice(e.message,true);}
  finally{button.disabled=false;}
});
loadDatasets().catch(e=>notice(e.message,true));