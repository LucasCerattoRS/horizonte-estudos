// app.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Selects/export/import/reset, INIT, PWA. CARREGA POR ÚLTIMO (boot: mergeCorpus/init).
/* ============================================================
   SELECTS auxiliares / export / import / reset
   ============================================================ */
function fillDiscSelect(sel){
  sel.innerHTML="";
  DISCIPLINAS.forEach(d=>{ const o=el("option"); o.value=d.id; o.textContent=`${d.icon} ${d.nome}`; sel.appendChild(o); });
}
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  const a=el("a"); a.href=URL.createObjectURL(blob);
  const slug=activeProfile().nome.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  a.download=`painel-ufrgs-${slug||"perfil"}-${todayKey()}.json`; a.click();
}

/* ---------- Seletor de perfil (header) ---------- */
function renderProfiles(){
  const sel=$("#profileSel"); if(!sel) return;
  sel.innerHTML="";
  IDX.profiles.forEach(p=>{ const o=el("option"); o.value=p.id; o.textContent=`${p.emoji||"👤"} ${p.nome}`; if(p.id===IDX.active)o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>switchProfile(sel.value);
  const add=$("#profileAdd");   if(add)   add.onclick   =()=>{ const n=prompt("Nome do novo perfil:"); if(n) addProfile(n); };
  const ren=$("#profileRename");if(ren)   ren.onclick   =()=>{ const p=activeProfile(); const n=prompt("Renomear perfil:",p.nome); if(n){ renameProfile(p.id,n); location.reload(); } };
  const del=$("#profileDel");   if(del){  del.onclick   =()=>{ const p=activeProfile(); if(IDX.profiles.length<=1){ alert("É o único perfil — não dá para apagar."); return; } if(confirm(`Apagar o perfil "${p.nome}" e TODO o progresso dele? (irreversível)`)) deleteProfile(p.id); };
    del.style.display = IDX.profiles.length<=1 ? "none" : ""; }
}
function importData(){
  const inp=el("input"); inp.type="file"; inp.accept="application/json";
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ S=Object.assign(structuredClone(DEFAULT_STATE),JSON.parse(r.result)); save(); location.reload(); }
      catch(e){ alert("Arquivo inválido."); } }; r.readAsText(f); };
  inp.click();
}
function resetAll(){ if(confirm(`Zerar TODO o progresso do perfil "${activeProfile().nome}"? Faça um backup antes.`)){ localStorage.removeItem(profKey(IDX.active)); location.reload(); } }

/* ---------- Dedicatória (kit presenteável — perfil-seed.js) ---------- */
const DEDIC_FLAG = "painelUFRGS_dedicatoria_v1";
function dedicSeed(){ return (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && PERFIL_SEED.dedicatoria) ? PERFIL_SEED.dedicatoria : null; }
function openDedicatoria(){
  const d = dedicSeed(); if(!d) return;
  $("#dedicTitulo").textContent = d.titulo || `Para ${activeProfile().nome}`;
  const msg=$("#dedicMsg"); msg.innerHTML="";
  String(d.mensagem||"").split(/\n\s*\n/).forEach(par=>{
    const p=el("p"); p.textContent=par.trim(); if(p.textContent) msg.appendChild(p);
  });
  $("#dedicAss").textContent = d.assinatura || "";
  const fw=$("#dedicFotos"); fw.innerHTML="";
  (d.fotos||[]).forEach((src,i)=>{
    const im=el("img"); im.src=src; im.alt="";
    im.style.setProperty("--rot", ((i%2 ? 1 : -1)*(1.5 + (i*37)%3)) + "deg");
    im.onerror=()=>im.remove();
    fw.appendChild(im);
  });
  $("#dedic").hidden=false; document.body.style.overflow="hidden";
}
function closeDedicatoria(){
  $("#dedic").hidden=true; document.body.style.overflow="";
  localStorage.setItem(DEDIC_FLAG,"1");
}
/* bilhetes (kit): meta batida (≥70%) / dia difícil (≤40%) na correção de prova — máx. 1/dia.
   meta/animo aceitam string ou array (pool — um bilhete sorteado por vez). */
function sorteioSeed(v){ return Array.isArray(v) ? v[Math.floor(Math.random()*v.length)] : v; }
function mostrarBilhete(pct){
  const m = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED) ? PERFIL_SEED.mensagens : null;
  if(!m) return;
  const txt = pct>=70 ? sorteioSeed(m.meta) : pct<=40 ? sorteioSeed(m.animo) : null;
  if(!txt) return;
  const k="painelUFRGS_bilhete_dia";
  if(localStorage.getItem(k)===todayKey()) return;
  localStorage.setItem(k, todayKey());
  const img=$("#dlBilheteImg");
  const lote = m.imagens ? (pct>=70 ? m.imagens.meta : m.imagens.animo) : null;
  if(lote && lote.length){ img.src=lote[Math.floor(Math.random()*lote.length)]; img.style.display="block"; }
  else img.style.display="none";
  const body=$("#dlBilheteBody"); body.innerHTML="";
  String(txt).split(/\n\s*\n/).forEach(par=>{
    const p=el("p"); p.textContent=par.trim(); if(p.textContent) body.appendChild(p);
  });
  $("#dlgBilhete").showModal();
}

/* ============================================================
   INIT
   ============================================================ */
function init(){
  fillCursoSelect();
  fillDiscSelect($("#logDisc"));
  // filtros do banco
  const qf=$("#qFilter"); DISCIPLINAS.forEach(d=>{ const o=el("option"); o.value=d.id; o.textContent=`${d.icon} ${d.nome}`; qf.appendChild(o); });
  fillProvaSelects(); renderProva();
  fillBqFilters();
  renderPainel();
  renderEdital($("#editalDiscs"));
  // deep-link por hash. Só nome de aba: o hash também carrega o #token=… do login por QR
  // (sync.js o consome depois), e "#tab-token=abc" é seletor inválido — quebrava o init inteiro.
  const h=location.hash.slice(1);
  if(/^[a-z-]+$/.test(h) && $("#tab-"+h)) go(h);
  // saudação por horário (nome do perfil ativo)
  const nome = activeProfile().nome;
  const hr=new Date().getHours();
  $("#heroTitle").textContent = hr<6?`Madrugada de estudo, ${nome}.`:hr<12?`Bom dia, ${nome}.`:hr<18?`Boa tarde, ${nome}.`:`Boa noite, ${nome}.`;
  renderProfiles();
  // O rodapé dizia "sem servidor" — mentira no site publicado, onde o ☁ sincroniza pelo D1.
  const fe=$("#footEstado");
  if(fe) fe.textContent = (typeof Sync!=="undefined" && Sync.ativo && Sync.ativo())
    ? "Progresso sincronizado entre os seus aparelhos (☁ no cabeçalho)."
    : "Progresso salvo neste navegador. Para sincronizar com o celular, cole seu token no ☁.";
  // kit presenteável: título da janela + dedicatória (1ª abertura; 💌 relê)
  if(typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && PERFIL_SEED.titulo) document.title = PERFIL_SEED.titulo;
  // kit: saudação de abertura sorteada do pool do seed no lugar do lede padrão
  const sds = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && PERFIL_SEED.mensagens) ? PERFIL_SEED.mensagens.saudacoes : null;
  if(Array.isArray(sds) && sds.length) $("#heroLede").textContent = sorteioSeed(sds);
  if(dedicSeed()){
    const bd=$("#btnDedic"); bd.style.display=""; bd.onclick=openDedicatoria;
    if(!localStorage.getItem(DEDIC_FLAG)) openDedicatoria();
  }
}
/* ---------- Corpus de redações corrigidas (redacoes-corpus.js, gitignorado) ----------
   Gerado por pipeline/importar_redacoes.py a partir dos exports Aprova Total/Glau.
   Mescla por id (idempotente); correções humanas entram com fonte:"humana". */
function mergeCorpus(){
  if(typeof REDACOES_CORPUS==="undefined" || !Array.isArray(REDACOES_CORPUS)) return;
  const have=new Set(S.redacoes.map(r=>r.id));
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const props=PROPS().filter(p=>p.id!=="livre");
  let add=0;
  REDACOES_CORPUS.forEach(r=>{
    if(!r || !r.id || have.has(r.id)) return;
    const rec=structuredClone(r);
    if(!rec.propId){   // liga à proposta do wizard quando o tema bate (acende o status no grid)
      const p=props.find(p=>norm(p.tema)===norm(rec.tema));
      if(p && (!rec.banca || rec.banca===p.banca)) rec.propId=p.id;
    }
    S.redacoes.push(rec); add++;
  });
  if(add){
    S.redacoes.sort((a,b)=>(a.date||"").localeCompare(b.date||"")||String(a.id).localeCompare(String(b.id)));
    save();
  }
}
mergeCorpus();
init();

/* ============================================================
   PWA — registra o service worker e oferece "instalar".
   Condicionado a http(s): em file:// o navegador não tem service worker
   (origem opaca), então nada disto roda e o painel local segue idêntico.
   ============================================================ */
(function pwa(){
  if(!/^https?:$/.test(location.protocol)) return;
  if("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(()=>{});   // sem SW o app só perde o offline

  // O Chrome guarda o convite de instalação neste evento; o iOS não tem equivalente
  // (lá é Compartilhar → Adicionar à Tela de Início) — por isso o botão só aparece
  // quando o navegador realmente oferece.
  let convite=null;
  window.addEventListener("beforeinstallprompt", e=>{
    e.preventDefault(); convite=e;
    const host=document.querySelector(".profile-pick")||document.querySelector(".brand");
    if(!host||document.getElementById("btnInstalar")) return;
    const b=document.createElement("button");
    b.id="btnInstalar"; b.className="pbtn"; b.title="Instalar o Horizonte Estudos como app";
    b.textContent="⤓";
    b.onclick=async()=>{ b.disabled=true; convite.prompt();
      const {outcome}=await convite.userChoice;
      if(outcome==="accepted") b.remove(); else b.disabled=false; };
    host.appendChild(b);
  });
  window.addEventListener("appinstalled", ()=>{ const b=document.getElementById("btnInstalar"); if(b) b.remove(); });
})();
