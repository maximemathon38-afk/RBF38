const cfg=window.RBF_CONFIG||{};
let sb=null;
let loginChefs=[];
let state={chefs:[],containers:[],catalog:[],items:[],units:[],history:[]};
let session={type:null,chefId:null,containerId:null,name:null};
let adminTab="containers";
let chefTab="container";
let refreshTimer=null;
let realtimeChannel=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const now=()=>new Date().toISOString();
const fmtDate=s=>s?new Date(s).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}):"—";

function configured(){return Boolean((cfg.SUPABASE_URL||"").trim()&&(cfg.SUPABASE_PUBLISHABLE_KEY||"").trim())}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.add("hidden"),3000)}
function setSync(ok,label){const el=$("#syncState");if(!el)return;el.className="sync "+(ok?"online":"offline");el.querySelector(".sync-label").textContent=label||(ok?"Synchronisé":"Hors connexion")}
function modal(title,body,footer=""){$("#modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="close" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:""}</div></div>`}
function closeModal(){$("#modalRoot").innerHTML=""}
function showApp(){$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden")}
function showLogin(){$("#appView").classList.add("hidden");$("#loginView").classList.remove("hidden");$("#chefScreen").classList.add("hidden");$("#adminScreen").classList.add("hidden")}

function chefName(c){return state.chefs.find(x=>x.id===c.chief_id)?.name||"Chef"}
function itemsFor(cid){return state.items.filter(x=>x.container_id===cid)}
function unitsFor(itemId){return state.units.filter(x=>x.container_item_id===itemId).sort((a,b)=>a.unit_no-b.unit_no)}
function getItem(id){return state.items.find(x=>x.id===id)}
function getContainer(id){return state.containers.find(x=>x.id===id)}
function currentContainer(){return getContainer(session.containerId)}
function getDepot(){return state.containers.find(x=>x.kind==="depot")}
function chefContainers(){return state.containers.filter(x=>x.kind==="chef")}

function containerStats(c){
  let p=0,r=0,m=0,e=0;
  for(const i of itemsFor(c.id)){
    e+=+i.expected||0;p+=+i.present||0;r+=+i.repair||0;
    m+=Math.max((+i.expected||0)-(+i.present||0)-(+i.repair||0),0);
  }
  return{p,r,m,e};
}
function itemStatus(i){const m=Math.max(i.expected-i.present-i.repair,0);if(m>0)return["danger",`${m} manquant${m>1?"s":""}`];if(i.repair>0)return["warning",`${i.repair} en réparation`];return["good","Complet"]}

async function ensureAnonymousAuth(){
  const {data:{session:authSession},error}=await sb.auth.getSession();
  if(error)throw error;
  if(authSession)return authSession;
  const r=await sb.auth.signInAnonymously();
  if(r.error)throw r.error;
  return r.data.session;
}

async function loadLoginDirectory(){
  const {data,error}=await sb.rpc("get_login_chefs");
  if(error)throw error;
  loginChefs=data||[];
  renderNames();
}

function renderNames(){
  const root=$("#nameGrid");if(!root)return;
  root.innerHTML=loginChefs.length
    ?loginChefs.map(ch=>`<button class="name-btn" onclick="loginChefPrompt('${ch.id}')">👷 ${esc(ch.name)}</button>`).join("")
    :'<div class="empty" style="grid-column:1/-1">Aucun chef trouvé.</div>';
}

function loginChefPrompt(id){
  const ch=loginChefs.find(x=>x.id===id);if(!ch)return;
  modal(`Connexion — ${esc(ch.name)}`,
    `<div class="field"><label>Mot de passe</label><input id="chefPassword" type="password" autocomplete="current-password" placeholder="Mot de passe" onkeydown="if(event.key==='Enter')submitChefLogin('${id}')"></div>`,
    `<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="submitChefLogin('${id}')">Connexion</button>`
  );
  setTimeout(()=>$("#chefPassword")?.focus(),0);
}

async function submitChefLogin(id){
  const ch=loginChefs.find(x=>x.id===id);if(!ch)return;
  const password=$("#chefPassword")?.value||"";
  if(!password){toast("Saisis le mot de passe.");return}
  try{
    await ensureAnonymousAuth();
    const {data,error}=await sb.rpc("claim_chief_access",{p_chef_id:id,p_password:password});
    if(error)throw error;
    if(!data){toast("Mot de passe incorrect.");return}
    closeModal();
    await resumeAppSession();
    await loadAll();
    subscribeRealtime();
    showApp();
    renderChef();
  }catch(err){console.error(err);toast("Connexion impossible : "+(err.message||err))}
}

function loginAdminPrompt(){
  modal("Accès administrateur",
    `<div class="field"><label>Mot de passe administrateur</label><input id="adminPassword" type="password" autocomplete="current-password" placeholder="Mot de passe" onkeydown="if(event.key==='Enter')submitAdminLogin()"></div>`,
    `<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="submitAdminLogin()">Connexion</button>`
  );
  setTimeout(()=>$("#adminPassword")?.focus(),0);
}

async function submitAdminLogin(){
  const password=$("#adminPassword")?.value||"";
  if(!password){toast("Saisis le mot de passe.");return}
  try{
    await ensureAnonymousAuth();
    const {data,error}=await sb.rpc("claim_admin_access",{p_password:password});
    if(error)throw error;
    if(!data){toast("Mot de passe incorrect.");return}
    closeModal();
    await resumeAppSession();
    await loadAll();
    subscribeRealtime();
    showApp();
    renderAdmin();
  }catch(err){console.error(err);toast("Connexion impossible : "+(err.message||err))}
}

async function loginDepot(){
  try{
    await ensureAnonymousAuth();
    const {data,error}=await sb.rpc("claim_depot_access");
    if(error)throw error;
    if(!data){toast("Accès dépôt impossible.");return}
    await resumeAppSession();
    await loadAll();
    subscribeRealtime();
    showApp();
    renderPublicDepot();
  }catch(err){console.error(err);toast("Accès dépôt impossible : "+(err.message||err))}
}

async function resumeAppSession(){
  const {data,error}=await sb.rpc("get_my_app_session");
  if(error)throw error;
  const s=Array.isArray(data)?data[0]:data;
  if(!s||!s.role){session={type:null,chefId:null,containerId:null,name:null};return false}
  if(s.role==="admin"){
    session={type:"admin",chefId:null,containerId:null,name:"Administrateur"};
    $("#roleSmall").textContent="Administrateur";
    return true;
  }
  if(s.role==="depot"){
    session={type:"depot",chefId:null,containerId:null,name:"Dépôt (accès libre)"};
    $("#roleSmall").textContent="Dépôt · Accès libre";
    return true;
  }
  session={type:"chef",chefId:s.chef_id,containerId:s.container_id,name:s.chef_name||"Chef"};
  $("#roleSmall").textContent=`${session.name} · Chef de chantier`;
  return true;
}

async function logout(){
  try{if(sb)await sb.rpc("release_app_access")}catch(err){console.warn(err)}
  if(realtimeChannel&&sb){try{await sb.removeChannel(realtimeChannel)}catch(_){}}
  realtimeChannel=null;
  session={type:null,chefId:null,containerId:null,name:null};
  state={chefs:[],containers:[],catalog:[],items:[],units:[],history:[]};
  $("#roleSmall").textContent="Rosset Boulon & Fils";
  showLogin();
  renderNames();
}

async function loadAll({quiet=false}={}){
  if(!sb||!session.type)return false;
  try{
    const [a,b,c,d,u,e]=await Promise.all([
      sb.from("chefs").select("id,first_name,last_name,name,created_at").order("name"),
      sb.from("containers").select("*").order("name"),
      sb.from("catalog").select("*").order("name"),
      sb.from("container_items").select("*").order("name"),
      sb.from("equipment_units").select("*").order("unit_no"),
      sb.from("history").select("*").order("created_at",{ascending:false}).limit(500)
    ]);
    for(const r of[a,b,c,d,u,e])if(r.error)throw r.error;
    state={chefs:a.data||[],containers:b.data||[],catalog:c.data||[],items:d.data||[],units:u.data||[],history:e.data||[]};

    if(session.type==="chef"){
      const ch=state.chefs.find(x=>x.id===session.chefId);
      if(ch){session.name=ch.name;$("#roleSmall").textContent=`${ch.name} · Chef de chantier`}
      renderChef();
    }else if(session.type==="admin"){
      if(session.containerId)renderAdminContainer(session.containerId);else renderAdmin();
    }else if(session.type==="depot"){
      renderPublicDepot();
    }
    setSync(true,"Synchronisé");
    return true;
  }catch(err){
    console.error(err);setSync(false,"Erreur synchro");if(!quiet)toast("Erreur de synchronisation : "+(err.message||""));return false;
  }
}

function subscribeRealtime(){
  if(!sb||!session.type)return;
  if(realtimeChannel)sb.removeChannel(realtimeChannel);
  let debounce=null;
  const refresh=()=>{clearTimeout(debounce);debounce=setTimeout(()=>loadAll({quiet:true}),250)};
  realtimeChannel=sb.channel("rbf-v5-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"container_items"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"containers"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"history"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"catalog"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"equipment_units"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"chefs"},async()=>{await loadLoginDirectory();refresh()})
    .subscribe(status=>{if(status==="SUBSCRIBED")setSync(true,"Temps réel actif")});
}

function statsCards(s){
  return `<div class="grid grid-3">
    <div class="card stat"><div><div class="stat-label">PRÉSENT</div><div class="stat-num">${s.p}</div></div><span class="dot ok"></span></div>
    <div class="card stat"><div><div class="stat-label">EN RÉPARATION</div><div class="stat-num">${s.r}</div></div><span class="dot warn"></span></div>
    <div class="card stat"><div><div class="stat-label">MANQUANT</div><div class="stat-num">${s.m}</div></div><span class="dot bad"></span></div>
  </div>`;
}

function inventoryActions(i,{transfer=false}={}){
  return `<div class="actions">
    <button class="btn btn-light btn-sm" onclick="openCount('${i.id}')">✏️ Compter</button>
    <button class="btn btn-danger btn-sm" onclick="openRepair('${i.id}')">🔧 Réparer</button>
    ${i.repair>0?`<button class="btn btn-success btn-sm" onclick="openReturn('${i.id}')">↩ Retour</button>`:""}
    ${i.requires_serial?`<button class="btn btn-accent btn-sm" onclick="openUnits('${i.id}')">#️⃣ N° série</button>`:""}
    ${transfer&&["admin","chef","depot"].includes(session.type)?`<button class="btn btn-primary btn-sm" onclick="openTransfer('${i.id}')">⇄ Transférer</button>`:""}
    <button class="btn btn-light btn-sm" onclick="openItemEdit('${i.id}')">⚙️ Modifier</button>
  </div>`;
}

function inventoryHTML(c,opts={}){
  const list=itemsFor(c.id).filter(i=>!(c.kind==="depot"&&i.expected===0&&i.present===0&&i.repair===0));
  const rows=list.map(i=>{
    const missing=Math.max(i.expected-i.present-i.repair,0),[cl,txt]=itemStatus(i);
    return `<tr><td><div class="item-name">${esc(i.name)}</div><div class="muted">Prévu : ${i.expected}</div></td><td class="qty">${i.present}</td><td class="qty">${i.repair}</td><td class="qty">${missing}</td><td><span class="status ${cl}">${txt}</span></td><td>${inventoryActions(i,opts)}</td></tr>`;
  }).join("");
  const cards=list.map(i=>{
    const missing=Math.max(i.expected-i.present-i.repair,0),[cl,txt]=itemStatus(i);
    return `<div class="item-card"><div class="item-head"><div><div class="item-name">${esc(i.name)}</div><div class="muted">Prévu : ${i.expected}</div></div><span class="status ${cl}">${txt}</span></div><div class="item-stats"><div class="mini"><b>${i.present}</b><span>Présent</span></div><div class="mini"><b>${i.repair}</b><span>Réparation</span></div><div class="mini"><b>${missing}</b><span>Manquant</span></div><div class="mini"><b>${i.expected}</b><span>Prévu</span></div></div>${inventoryActions(i,opts)}</div>`;
  }).join("");
  if(!list.length)return '<div class="card empty">Aucun matériel enregistré.</div>';
  return `<div class="table-card inventory"><table class="table"><thead><tr><th>Matériel</th><th>Présent</th><th>Réparation</th><th>Manquant</th><th>État</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div><div class="mobile-cards">${cards}</div>`;
}

function historyText(h){
  if(h.event_type==="repair")return `${h.qty} ${h.item_name} envoyé(s) en réparation`;
  if(h.event_type==="return")return `${h.qty} ${h.item_name} revenu(s) de réparation`;
  if(h.event_type==="count")return `Comptage : ${h.item_name}`;
  if(h.event_type==="item_add")return `Matériel ajouté : ${h.item_name}`;
  if(h.event_type==="item_edit")return `Matériel modifié : ${h.item_name}`;
  if(h.event_type==="item_delete")return `Matériel supprimé : ${h.item_name}`;
  if(h.event_type==="inventory")return "Inventaire validé";
  if(h.event_type==="serial_update")return `Suivi série / contrôle : ${h.item_name}`;
  if(h.event_type==="transfer_out")return `Transfert sortant : ${h.qty} ${h.item_name}`;
  if(h.event_type==="transfer_in")return `Transfert entrant : ${h.qty} ${h.item_name}`;
  if(h.event_type==="chef_edit")return `Chef de chantier modifié : ${h.item_name}`;
  return h.event_type;
}

function historyHTML(cid=null,limit=25){
  const h=state.history.filter(x=>!cid||x.container_id===cid).slice(0,limit);
  if(!h.length)return '<div class="card empty">Aucun mouvement enregistré.</div>';
  return `<div class="history">${h.map(x=>`<div class="history-row"><div class="history-icon">•</div><div class="history-main"><b>${esc(historyText(x))}</b><small>${esc(x.actor_name||"")} · ${fmtDate(x.created_at)}${x.note?" · "+esc(x.note):""}</small></div></div>`).join("")}</div>`;
}

function transferCardsHTML(c,emptyText){
  const list=itemsFor(c.id).filter(i=>(+i.present||0)>0);
  if(!list.length)return `<div class="card empty">${esc(emptyText)}</div>`;
  return `<div class="grid grid-2">${list.map(i=>`<div class="card transfer-card"><div class="transfer-card-head"><div><div class="item-name">${esc(i.name)}</div><div class="muted">${i.requires_serial?"Suivi par numéro de série · ":""}${i.present} présent${i.present>1?"s":""}</div></div><span class="status good">${i.present} dispo.</span></div><button class="btn btn-primary btn-block" onclick="openTransfer('${i.id}')">⇄ Transférer</button></div>`).join("")}</div>`;
}

function setChefTab(t){
  if(session.type!=="chef")return;
  chefTab=t;renderChef();
}

function renderChef(){
  const c=currentContainer();if(!c)return;
  $("#adminScreen").classList.add("hidden");
  const root=$("#chefScreen");root.classList.remove("hidden");
  root.innerHTML=`
    <div class="brand-panel"><h2>Rosset Boulon &amp; Fils</h2><p>Inventaire et suivi du matériel de ${esc(c.name)}.</p><div class="brand-tags"><span class="brand-tag">${esc(session.name)}</span><span class="brand-tag">${esc(c.name)}</span><span class="brand-tag">Accès privé</span></div></div>
    <div class="tabs chef-tabs">
      <button class="tab ${chefTab==="container"?"active":""}" onclick="setChefTab('container')">Mon container</button>
      <button class="tab ${chefTab==="transfer"?"active":""}" onclick="setChefTab('transfer')">⇄ Transférer</button>
    </div>
    <div id="chefContent" style="margin-top:15px"></div>`;
  renderChefTab();
}

function renderChefTab(){
  const root=$("#chefContent"),c=currentContainer();if(!root||!c)return;
  if(chefTab==="transfer"){renderChefTransfers(root,c);return}
  root.innerHTML=`
    <div class="hero"><div><span class="badge">${esc(c.name)}</span><h1>Mon container</h1><p>${c.location?esc(c.location)+" · ":""}Dernier inventaire : ${c.last_inventory?fmtDate(c.last_inventory):"jamais"}</p></div><div class="hero-actions"><button class="btn btn-light" onclick="loadAll()">↻ Actualiser</button><button class="btn btn-accent" onclick="openItemAdd('${c.id}')">＋ Ajouter matériel</button><button class="btn btn-primary" onclick="validateInventory('${c.id}')">✓ Valider inventaire</button></div></div>
    ${statsCards(containerStats(c))}
    <div class="section-title"><h2>Inventaire</h2><span>${itemsFor(c.id).length} types de matériel</span></div>
    ${inventoryHTML(c)}
    <div class="section-title"><h2>Historique</h2><span>Mises à jour en temps réel</span></div>
    ${historyHTML(c.id,12)}`;
}

function renderChefTransfers(root,c){
  const d=getDepot();
  if(!d){root.innerHTML='<div class="card empty">Dépôt introuvable.</div>';return}
  root.innerHTML=`
    <div class="depot-note"><b>Transferts :</b> vous pouvez déposer du matériel de votre container au dépôt, ou récupérer du matériel du dépôt pour votre chantier. Les quantités et numéros de série sont déplacés automatiquement.</div>
    <div class="transfer-section">
      <div class="section-title"><h2>↓ Transférer au dépôt</h2><span>${esc(c.name)} → Dépôt</span></div>
      ${transferCardsHTML(c,"Aucun matériel présent à transférer vers le dépôt.")}
    </div>
    <div class="transfer-section">
      <div class="section-title"><h2>↑ Transférer sur mon chantier</h2><span>Dépôt → ${esc(c.name)}</span></div>
      ${transferCardsHTML(d,"Aucun matériel disponible au dépôt.")}
    </div>
    <div class="section-title"><h2>Mes derniers transferts</h2></div>
    ${historyHTML(c.id,20)}`;
}

function renderPublicDepot(){
  if(session.type!=="depot"){toast("Accès dépôt requis.");return}
  $("#adminScreen").classList.add("hidden");
  const root=$("#chefScreen");root.classList.remove("hidden");
  const d=getDepot();
  if(!d){root.innerHTML='<div class="card empty">Dépôt introuvable dans Supabase.</div>';return}
  root.innerHTML=`
    <div class="brand-panel"><h2>Rosset Boulon &amp; Fils</h2><p>Espace dépôt commun accessible sans mot de passe.</p><div class="brand-tags"><span class="brand-tag">Dépôt RB&amp;F</span><span class="brand-tag">Accès libre</span><span class="brand-tag">Temps réel</span></div></div>
    <div class="depot-note"><b>Dépôt central :</b> vous pouvez ajouter et gérer le matériel du dépôt, puis le transférer vers le container du chef de chantier choisi.</div>
    <div class="hero"><div><span class="badge">DÉPÔT</span><h1>${esc(d.name)}</h1><p>${d.location?esc(d.location):"Stock central RB&F"}</p></div><div class="hero-actions"><button class="btn btn-accent" onclick="openItemAdd('${d.id}')">＋ Ajouter au dépôt</button><button class="btn btn-light" onclick="loadAll()">↻ Actualiser</button></div></div>
    ${statsCards(containerStats(d))}
    <div class="section-title"><h2>Matériel au dépôt</h2><span>${itemsFor(d.id).filter(i=>i.expected||i.present||i.repair).length} types</span></div>
    ${inventoryHTML(d,{transfer:true})}
    <div class="section-title"><h2>Historique du dépôt</h2><span>Transferts et mouvements</span></div>
    ${historyHTML(d.id,40)}`;
}

function renderAdmin(){
  if(session.type!=="admin"){toast("Accès administrateur requis.");return}
  session.containerId=null;
  $("#chefScreen").classList.add("hidden");
  const root=$("#adminScreen");root.classList.remove("hidden");
  root.innerHTML=`
    <div class="brand-panel"><h2>Rosset Boulon &amp; Fils</h2><p>Suivi général des containers, du dépôt et des transferts.</p><div class="brand-tags"><span class="brand-tag">Administration</span><span class="brand-tag">Temps réel</span><span class="brand-tag">Accès privé</span></div></div>
    <div class="hero"><div><span class="badge">ADMIN</span><h1>Tableau de bord</h1><p>Les changements des chefs apparaissent automatiquement.</p></div><div class="hero-actions"><button class="btn btn-light" onclick="loadAll()">↻ Actualiser</button></div></div>
    <div class="tabs">
      <button class="tab ${adminTab==="containers"?"active":""}" onclick="setAdminTab('containers')">Containers</button>
      <button class="tab ${adminTab==="depot"?"active":""}" onclick="setAdminTab('depot')">Dépôt</button>
      <button class="tab ${adminTab==="history"?"active":""}" onclick="setAdminTab('history')">Historique</button>
      <button class="tab ${adminTab==="modify"?"active":""}" onclick="setAdminTab('modify')">Modifier</button>
    </div>
    <div id="adminContent" style="margin-top:15px"></div>`;
  renderAdminTab();
}

function setAdminTab(t){if(session.type!=="admin"){toast("Accès administrateur requis.");return}adminTab=t;renderAdmin()}

function renderAdminTab(){
  if(session.type!=="admin"){toast("Accès administrateur requis.");return}
  const root=$("#adminContent");if(!root)return;
  if(adminTab==="history"){root.innerHTML=historyHTML(null,150);return}
  if(adminTab==="depot"){renderDepot(root);return}
  if(adminTab==="modify"){renderChefManager(root);return}

  const containers=chefContainers();
  root.innerHTML=`<div class="grid grid-2">${containers.map(c=>{
    const s=containerStats(c),[cl,txt]=s.m?["danger",`${s.m} manquant(s)`]:s.r?["warning",`${s.r} en réparation`]:["good","OK"];
    return `<div class="card container-card" onclick="openAdminContainer('${c.id}')"><div class="container-title"><div><h3>${esc(chefName(c))}</h3><div class="muted">${esc(c.name)}${c.location?" · "+esc(c.location):""}</div></div><span class="status ${cl}">${txt}</span></div><div class="summary"><div><b>${s.p}</b><span>présents</span></div><div><b>${s.r}</b><span>réparation</span></div><div><b>${s.m}</b><span>manquants</span></div></div></div>`;
  }).join("")}</div>`;
}

function renderDepot(root){
  const d=getDepot();
  if(!d){root.innerHTML='<div class="card empty">Dépôt introuvable dans Supabase.</div>';return}
  root.innerHTML=`
    <div class="depot-note"><b>Dépôt central :</b> ajoutez du matériel directement ici, ou transférez du matériel entre le dépôt et un container chef.</div>
    <div class="hero"><div><span class="badge">DÉPÔT</span><h1>${esc(d.name)}</h1><p>${d.location?esc(d.location):"Stock central RB&F"}</p></div><div class="hero-actions"><button class="btn btn-accent" onclick="openItemAdd('${d.id}')">＋ Ajouter au dépôt</button><button class="btn btn-light" onclick="loadAll()">↻ Actualiser</button></div></div>
    ${statsCards(containerStats(d))}
    <div class="section-title"><h2>Matériel au dépôt</h2><span>${itemsFor(d.id).filter(i=>i.expected||i.present||i.repair).length} types</span></div>
    ${inventoryHTML(d,{transfer:true})}
    <div class="section-title"><h2>Historique du dépôt</h2></div>
    ${historyHTML(d.id,40)}`;
}

function renderChefManager(root){
  if(session.type!=="admin"){toast("Accès administrateur requis.");return}
  root.innerHTML=`
    <div class="section-title"><h2>Chefs de chantier</h2><span>Modifier nom et prénom</span></div>
    <div class="grid grid-2">${state.chefs.map(ch=>`<div class="card"><div class="chef-edit-row"><div><h3>${esc(ch.name)}</h3><div class="muted">Mot de passe actuel basé sur le prénom : RBF${esc(ch.first_name)}</div></div><button class="btn btn-light" onclick="openChefEdit('${ch.id}')">✏️ Modifier</button></div></div>`).join("")}</div>`;
}

function openAdminContainer(id){session.containerId=id;renderAdminContainer(id)}

function renderAdminContainer(id){
  const c=getContainer(id);if(!c)return;
  $("#chefScreen").classList.add("hidden");
  const root=$("#adminScreen");root.classList.remove("hidden");
  root.innerHTML=`
    <div class="hero"><div><button class="btn btn-light btn-sm" onclick="session.containerId=null;renderAdmin()">← Retour</button><h1 style="margin-top:12px">${esc(chefName(c))}</h1><p>${esc(c.name)}${c.location?" · "+esc(c.location):""}</p></div><div class="hero-actions"><button class="btn btn-light" onclick="openContainerMeta('${c.id}')">⚙️ Container</button><button class="btn btn-accent" onclick="openItemAdd('${c.id}')">＋ Ajouter matériel</button></div></div>
    ${statsCards(containerStats(c))}
    <div class="depot-note">Depuis cet écran, le bouton <b>Transférer</b> permet de déposer du matériel de ce container vers le dépôt central.</div>
    <div class="section-title"><h2>Inventaire</h2><span>${itemsFor(c.id).length} types</span></div>
    ${inventoryHTML(c,{transfer:true})}
    <div class="section-title"><h2>Historique</h2></div>
    ${historyHTML(c.id,40)}`;
}

async function syncUnitsToExpected(item){
  if(!item.requires_serial)return;
  const expected=Math.max(+item.expected||0,0);
  const existing=unitsFor(item.id);
  const existingNos=new Set(existing.map(x=>x.unit_no));
  const rows=[];
  for(let n=1;n<=expected;n++)if(!existingNos.has(n))rows.push({container_item_id:item.id,unit_no:n});
  if(rows.length){const {error}=await sb.from("equipment_units").insert(rows);if(error)throw error}
  const extraIds=existing.filter(u=>u.unit_no>expected).map(u=>u.id);
  if(extraIds.length){const {error}=await sb.from("equipment_units").delete().in("id",extraIds);if(error)throw error}
  await loadAll({quiet:true});
}

async function openUnits(id){
  let item=getItem(id);if(!item)return;
  try{await syncUnitsToExpected(item)}catch(e){toast("Erreur unités : "+e.message);return}
  item=getItem(id);
  const units=unitsFor(id),isLaser=!!item.requires_laser_control;
  const rows=units.map(u=>`<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="item-name" style="margin-bottom:8px">Exemplaire ${u.unit_no}</div><div class="form-grid"><div class="field ${isLaser?"":"full"}"><label>Numéro de série</label><input id="serial_${u.id}" value="${esc(u.serial_number||"")}" placeholder="N° de série"></div>${isLaser?`<div class="field"><label>Date du contrôle</label><input id="control_${u.id}" type="date" value="${u.control_date||""}"></div><div class="field full"><label>Date à faire contrôler</label><input id="next_${u.id}" type="date" value="${u.next_control_date||""}"></div>`:""}</div></div>`).join("");
  modal(isLaser?"Suivi des boîtes de laser":"Numéros de série",`<div class="muted" style="margin-bottom:10px">${esc(item.name)} · ${units.length} exemplaire(s)</div>${rows||'<div class="empty">Aucun exemplaire.</div>'}`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveUnits('${id}')">Enregistrer</button>`);
}

async function saveUnits(itemId){
  const item=getItem(itemId);if(!item)return;
  const units=unitsFor(itemId);
  try{
    for(const u of units){
      const patch={serial_number:($(`#serial_${u.id}`)?.value||"").trim()};
      if(item.requires_laser_control){patch.control_date=$(`#control_${u.id}`)?.value||null;patch.next_control_date=$(`#next_${u.id}`)?.value||null}
      const {error}=await sb.from("equipment_units").update(patch).eq("id",u.id);if(error)throw error;
    }
    const c=getContainer(item.container_id);
    await addHistory("serial_update",c,item.name,units.length,item.requires_laser_control?"N° série et contrôles laser mis à jour":"N° de série mis à jour");
    closeModal();await loadAll({quiet:true});toast("Suivi matériel enregistré");
  }catch(e){toast("Erreur : "+e.message)}
}

async function addHistory(type,c,itemName="",qty=0,note=""){
  const {error}=await sb.from("history").insert({container_id:c?.id||null,actor_name:session.name||"Administrateur",event_type:type,item_name:itemName,qty,note});
  if(error)throw error;
}

function openCount(id){const i=getItem(id);modal("Compter le matériel",`<div class="form-grid"><div class="field full"><label>Matériel</label><input value="${esc(i.name)}" disabled></div><div class="field"><label>Prévu</label><input value="${i.expected}" disabled></div><div class="field"><label>Réparation</label><input value="${i.repair}" disabled></div><div class="field full"><label>Quantité présente</label><input id="countPresent" type="number" min="0" value="${i.present}"></div></div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveCount('${id}')">Enregistrer</button>`)}
async function saveCount(id){const i=getItem(id),c=getContainer(i.container_id),present=Math.max(0,+$("#countPresent").value||0);const{error}=await sb.from("container_items").update({present}).eq("id",id);if(error){toast("Erreur : "+error.message);return}await addHistory("count",c,i.name,present,"");closeModal();await loadAll({quiet:true});toast("Comptage enregistré")}
function openRepair(id){const i=getItem(id);modal("Envoyer en réparation",`<div class="form-grid"><div class="field full"><label>Matériel</label><input value="${esc(i.name)}" disabled></div><div class="field"><label>Présent</label><input value="${i.present}" disabled></div><div class="field"><label>Quantité à envoyer</label><input id="repairQty" type="number" min="1" max="${Math.max(i.present,1)}" value="1"></div><div class="field full"><label>Remarque</label><textarea id="repairNote" placeholder="Panne, atelier, commentaire..."></textarea></div></div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-danger" onclick="saveRepair('${id}')">Envoyer</button>`)}
async function saveRepair(id){const i=getItem(id),c=getContainer(i.container_id);let q=Math.max(1,+$("#repairQty").value||1);q=Math.min(q,+i.present);if(i.present<=0){toast("Aucun exemplaire présent.");return}const{error}=await sb.from("container_items").update({present:i.present-q,repair:i.repair+q}).eq("id",id);if(error){toast("Erreur : "+error.message);return}await addHistory("repair",c,i.name,q,$("#repairNote").value.trim());closeModal();await loadAll({quiet:true});toast("Envoyé en réparation")}
function openReturn(id){const i=getItem(id);modal("Retour de réparation",`<div class="form-grid"><div class="field full"><label>Matériel</label><input value="${esc(i.name)}" disabled></div><div class="field"><label>En réparation</label><input value="${i.repair}" disabled></div><div class="field"><label>Quantité de retour</label><input id="returnQty" type="number" min="1" max="${i.repair}" value="1"></div><div class="field full"><label>Remarque</label><textarea id="returnNote"></textarea></div></div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-success" onclick="saveReturn('${id}')">Valider le retour</button>`)}
async function saveReturn(id){const i=getItem(id),c=getContainer(i.container_id);let q=Math.max(1,+$("#returnQty").value||1);q=Math.min(q,+i.repair);const{error}=await sb.from("container_items").update({present:i.present+q,repair:i.repair-q}).eq("id",id);if(error){toast("Erreur : "+error.message);return}await addHistory("return",c,i.name,q,$("#returnNote").value.trim());closeModal();await loadAll({quiet:true});toast("Retour enregistré")}

function openItemAdd(containerId){
  const c=getContainer(containerId);if(!c)return;
  modal(c.kind==="depot"?"Ajouter du matériel au dépôt":"Ajouter un matériel",`<div class="form-grid"><div class="field full"><label>Nom</label><input id="itemName" placeholder="Ex. Scie circulaire"></div><div class="field"><label>Quantité prévue</label><input id="itemExpected" type="number" min="0" value="1"></div><div class="field"><label>Quantité présente</label><input id="itemPresent" type="number" min="0" value="1"></div><div class="field full"><label><input id="itemSerial" type="checkbox" style="width:auto"> Suivre le numéro de série</label></div><div class="field full"><label><input id="itemLaser" type="checkbox" style="width:auto"> Matériel laser : ajouter dates de contrôle</label></div></div><div class="muted" style="margin-top:10px">Ajout dans : ${esc(c.name)}.</div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveItemAdd('${c.id}')">Ajouter</button>`);
}

async function saveItemAdd(containerId){
  const c=getContainer(containerId),name=$("#itemName").value.trim(),expected=Math.max(0,+$("#itemExpected").value||0),present=Math.max(0,+$("#itemPresent").value||0),laser=!!$("#itemLaser").checked,serial=!!$("#itemSerial").checked||laser;
  if(!name){toast("Indique un nom.");return}
  const {data,error}=await sb.from("container_items").insert({container_id:c.id,catalog_id:null,name,expected,present,repair:0,requires_serial:serial,requires_laser_control:laser}).select().single();
  if(error){toast("Erreur : "+error.message);return}
  if(serial){const rows=[];for(let n=1;n<=expected;n++)rows.push({container_item_id:data.id,unit_no:n});if(rows.length){const r=await sb.from("equipment_units").insert(rows);if(r.error){toast("Matériel ajouté, mais erreur unités : "+r.error.message);return}}}
  await addHistory("item_add",c,name,expected,c.kind==="depot"?"Ajout au dépôt":"Ajout propre à ce container");
  closeModal();await loadAll({quiet:true});toast("Matériel ajouté");
}

function openItemEdit(id){
  const i=getItem(id);
  modal("Modifier / supprimer",`<div class="form-grid"><div class="field full"><label>Nom</label><input id="editName" value="${esc(i.name)}"></div><div class="field"><label>Prévu</label><input id="editExpected" type="number" min="0" value="${i.expected}"></div><div class="field"><label>Présent</label><input id="editPresent" type="number" min="0" value="${i.present}"></div><div class="field full"><label>En réparation</label><input id="editRepair" type="number" min="0" value="${i.repair}"></div><div class="field full"><label><input id="editSerial" type="checkbox" style="width:auto" ${i.requires_serial?"checked":""}> Suivre le numéro de série</label></div><div class="field full"><label><input id="editLaser" type="checkbox" style="width:auto" ${i.requires_laser_control?"checked":""}> Matériel laser : dates de contrôle</label></div></div>`,`<button class="btn btn-danger" onclick="deleteItem('${id}')">🗑 Supprimer</button><button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveItemEdit('${id}')">Enregistrer</button>`);
}

async function saveItemEdit(id){
  const i=getItem(id),c=getContainer(i.container_id),laser=!!$("#editLaser").checked,serial=!!$("#editSerial").checked||laser;
  const patch={name:$("#editName").value.trim()||i.name,expected:Math.max(0,+$("#editExpected").value||0),present:Math.max(0,+$("#editPresent").value||0),repair:Math.max(0,+$("#editRepair").value||0),requires_serial:serial,requires_laser_control:laser};
  const{error}=await sb.from("container_items").update(patch).eq("id",id);if(error){toast("Erreur : "+error.message);return}
  if(serial){await loadAll({quiet:true});await syncUnitsToExpected(getItem(id))}
  else{const oldUnits=unitsFor(id);if(oldUnits.length){const ids=oldUnits.map(u=>u.id);const r=await sb.from("equipment_units").delete().in("id",ids);if(r.error){toast("Erreur : "+r.error.message);return}}}
  await addHistory("item_edit",c,patch.name,patch.expected,"");closeModal();await loadAll({quiet:true});toast("Matériel modifié");
}

async function deleteItem(id){
  const i=getItem(id),c=getContainer(i.container_id);if(!confirm(`Supprimer « ${i.name} » de ${c.name} ?`))return;
  const{error}=await sb.from("container_items").delete().eq("id",id);if(error){toast("Erreur : "+error.message);return}
  await addHistory("item_delete",c,i.name,0,"");closeModal();await loadAll({quiet:true});toast("Matériel supprimé");
}

async function validateInventory(containerId){
  const c=getContainer(containerId);if(!c)return;const d=now();
  const{error}=await sb.from("containers").update({last_inventory:d}).eq("id",c.id);if(error){toast("Erreur : "+error.message);return}
  await addHistory("inventory",c,"",0,"");await loadAll({quiet:true});toast("Inventaire validé");
}

function openContainerMeta(containerId){
  const c=getContainer(containerId);if(!c)return;
  modal("Modifier le container",`<div class="form-grid"><div class="field full"><label>Nom / numéro</label><input id="contName" value="${esc(c.name)}"></div><div class="field full"><label>Localisation / chantier</label><input id="contLoc" value="${esc(c.location||"")}"></div></div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveContainerMeta('${c.id}')">Enregistrer</button>`);
}

async function saveContainerMeta(containerId){
  const c=getContainer(containerId),patch={name:$("#contName").value.trim()||c.name,location:$("#contLoc").value.trim()};
  const{error}=await sb.from("containers").update(patch).eq("id",c.id);if(error){toast("Erreur : "+error.message);return}
  closeModal();await loadAll({quiet:true});toast("Container mis à jour");
}

function openTransfer(itemId){
  const i=getItem(itemId),source=getContainer(i.container_id);if(!i||!source)return;
  const depot=getDepot();
  let targets=[];

  if(session.type==="admin"){
    if(source.kind==="depot")targets=chefContainers();
    else if(depot)targets=[depot];
  }else if(session.type==="depot"){
    if(source.kind!=="depot"){toast("Depuis l'accès libre, les transferts partent uniquement du dépôt.");return}
    targets=chefContainers();
  }else if(session.type==="chef"){
    const own=currentContainer();
    if(!own){toast("Votre container est introuvable.");return}
    if(source.kind==="depot")targets=[own];
    else if(source.id===own.id&&depot)targets=[depot];
    else{toast("Vous pouvez transférer uniquement entre votre container et le dépôt.");return}
  }else{toast("Accès non autorisé.");return}

  if(!targets.length){toast("Aucune destination disponible.");return}

  const targetOptions=targets.map(c=>`<option value="${c.id}">${source.kind==="depot"?esc(chefName(c))+" — ":""}${esc(c.name)}</option>`).join("");
  const serialUnits=unitsFor(i.id);
  const serialBlock=i.requires_serial?`<div class="field full"><label>Exemplaires à transférer</label><div class="muted">Sélectionnez uniquement les exemplaires physiquement présents. Maximum : ${i.present}.</div><div class="checkbox-list">${serialUnits.map(u=>`<label class="checkbox-row"><input class="transfer-unit" type="checkbox" value="${u.id}"><span><b>Exemplaire ${u.unit_no}</b>${u.serial_number?` — N° ${esc(u.serial_number)}`:" — N° série non renseigné"}</span></label>`).join("")||'<div class="empty">Aucun exemplaire.</div>'}</div></div>`:`<div class="field full"><label>Quantité à transférer</label><input id="transferQty" type="number" min="1" max="${Math.max(i.present,1)}" value="1"></div>`;

  modal(source.kind==="depot"?"Transférer du dépôt vers un chef":"Déposer le matériel au dépôt",`<div class="form-grid"><div class="field full"><label>Matériel</label><input value="${esc(i.name)}" disabled></div><div class="field"><label>Origine</label><input value="${esc(source.name)}" disabled></div><div class="field"><label>Présent disponible</label><input value="${i.present}" disabled></div><div class="field full"><label>Destination</label><select id="transferTarget">${targetOptions}</select></div>${serialBlock}</div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveTransfer('${i.id}')">Valider le transfert</button>`);
}

async function saveTransfer(itemId){
  const i=getItem(itemId);if(!i)return;
  const targetId=$("#transferTarget")?.value;
  if(!targetId){toast("Choisis une destination.");return}
  let qty=0,unitIds=null;
  if(i.requires_serial){
    unitIds=[...document.querySelectorAll(".transfer-unit:checked")].map(x=>x.value);
    qty=unitIds.length;
    if(!qty){toast("Sélectionne au moins un exemplaire.");return}
    if(qty>i.present){toast(`Maximum transférable : ${i.present}.`);return}
  }else{
    qty=Math.max(1,+$("#transferQty")?.value||1);
    if(qty>i.present){toast(`Maximum transférable : ${i.present}.`);return}
  }
  try{
    const {error}=await sb.rpc("transfer_material",{p_source_item_id:itemId,p_target_container_id:targetId,p_qty:qty,p_unit_ids:unitIds});
    if(error)throw error;
    closeModal();await loadAll({quiet:true});toast("Transfert effectué automatiquement");
  }catch(err){console.error(err);toast("Erreur transfert : "+(err.message||err))}
}

function openChefEdit(chefId){
  if(session.type!=="admin"){toast("Accès administrateur requis.");return}
  const ch=state.chefs.find(x=>x.id===chefId);if(!ch)return;
  modal("Modifier le chef de chantier",`<div class="form-grid"><div class="field"><label>Nom</label><input id="chefLastName" value="${esc(ch.last_name||"")}"></div><div class="field"><label>Prénom</label><input id="chefFirstName" value="${esc(ch.first_name||"")}"></div><div class="field full"><div class="depot-note">Le mot de passe sera automatiquement recalculé sous la forme <b>RBF + prénom</b> après l'enregistrement.</div></div></div>`,`<button class="btn btn-light" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="saveChefEdit('${chefId}')">Enregistrer</button>`);
}

async function saveChefEdit(chefId){
  if(session.type!=="admin"){toast("Accès administrateur requis.");return}
  const firstName=$("#chefFirstName").value.trim(),lastName=$("#chefLastName").value.trim();
  if(!firstName||!lastName){toast("Nom et prénom sont obligatoires.");return}
  try{
    const {error}=await sb.rpc("admin_update_chef",{p_chef_id:chefId,p_first_name:firstName,p_last_name:lastName});
    if(error)throw error;
    closeModal();await loadLoginDirectory();await loadAll({quiet:true});toast(`Chef modifié — nouveau mot de passe : RBF${firstName}`);
  }catch(err){console.error(err);toast("Erreur : "+(err.message||err))}
}

async function init(){
  if(!configured()){
    $("#setupNotice").classList.remove("hidden");
    $("#setupNotice").textContent="Configuration Supabase manquante : ajoute l'URL et la clé publiable dans config.js.";
    $("#nameGrid").innerHTML='<div class="empty" style="grid-column:1/-1">Connexion non configurée.</div>';
    return;
  }
  try{
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:10}}});
    await ensureAnonymousAuth();
    await loadLoginDirectory();
    const restored=await resumeAppSession();
    if(restored){
      await loadAll();subscribeRealtime();showApp();
      if(session.type==="chef")renderChef();
      else if(session.type==="admin")renderAdmin();
      else if(session.type==="depot")renderPublicDepot();
    }else showLogin();

    clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(document.visibilityState==="visible"&&session.type&&!$("#modalRoot").children.length)loadAll({quiet:true})},Number(cfg.REFRESH_INTERVAL_MS||10000));
  }catch(err){
    console.error(err);$("#setupNotice").classList.remove("hidden");$("#setupNotice").textContent="Impossible de démarrer Supabase : "+(err.message||err);
  }
}

window.addEventListener("online",()=>{if(session.type)loadAll({quiet:true})});
window.addEventListener("offline",()=>setSync(false,"Hors connexion"));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&sb&&session.type)loadAll({quiet:true})});
init();
