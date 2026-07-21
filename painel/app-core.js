// app-core.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. helpers/estado ($, S, save), navegação, aparência, curso. CARREGA PRIMEIRO.
/* ============================================================
   PAINEL UFRGS/ENEM — app.js
   Estado em localStorage. Sem dependências externas.
   ============================================================ */
"use strict";
const LS_PREFIX = "painelUFRGS_v1";           // estado por perfil: `${LS_PREFIX}__${id}`
const LS_LEGACY = "painelUFRGS_v1";           // chave antiga (perfil único) — migrada 1x
const LS_INDEX  = "painelUFRGS_index";        // índice de perfis + perfil ativo
const DAY = 86400000;
// Data-teste = UFRGS 2027 (diagnóstico do ciclo curto). Fonte única: fases-data.js
// (carregado antes do app.js). Fallback caso o arquivo não esteja presente.
const PROVA_TESTE = (typeof DATAS_PROVA!=="undefined" && DATAS_PROVA.ufrgs2027) || new Date("2026-11-28T00:00:00");

/* ---------- ID determinístico de tópico ---------- */
function topicId(discId, ei, ti){ return `${discId}.${ei}.${ti}`; }

/* ---------- Perfis ---------- */
const profKey = id => `${LS_PREFIX}__${id}`;
function loadIndex(){
  try{ const raw = localStorage.getItem(LS_INDEX); if(raw) return JSON.parse(raw); }catch(e){}
  const legacy = localStorage.getItem(LS_LEGACY);
  // 1ª execução com perfil-seed.js (kit presenteável): cria o perfil da pessoa, sem "Alex"
  const seed = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && PERFIL_SEED.nome && !legacy) ? PERFIL_SEED : null;
  if(seed){
    const idx = { active:"seed", profiles:[{ id:"seed", nome:String(seed.nome).trim(), emoji:seed.emoji||"🌱" }] };
    if(!localStorage.getItem(profKey("seed")) && seed.curso && CURSOS[seed.curso])
      localStorage.setItem(profKey("seed"), JSON.stringify({ version:1, curso:seed.curso }));
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
    return idx;
  }
  // 1ª execução normal: cria perfil "Alex" e migra o estado legado (perfil único), se houver
  const idx = { active:"alex", profiles:[{ id:"alex", nome:"Alex", emoji:"🌅" }] };
  if(legacy && !localStorage.getItem(profKey("alex"))){
    localStorage.setItem(profKey("alex"), legacy);
    localStorage.removeItem(LS_LEGACY);
  }
  localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  return idx;
}
let IDX = loadIndex();
function saveIndex(){ localStorage.setItem(LS_INDEX, JSON.stringify(IDX)); }
function activeProfile(){ return IDX.profiles.find(p=>p.id===IDX.active) || IDX.profiles[0]; }

function switchProfile(id){ if(id===IDX.active) return; save(); IDX.active=id; saveIndex(); location.reload(); }
function addProfile(nome){
  nome = (nome||"").trim(); if(!nome) return;
  const id = "p"+Date.now().toString(36);
  IDX.profiles.push({ id, nome, emoji:"🌱" });
  save(); IDX.active=id; saveIndex();
  localStorage.setItem(profKey(id), JSON.stringify(structuredClone(DEFAULT_STATE)));
  location.reload();
}
function renameProfile(id, nome){ const p=IDX.profiles.find(x=>x.id===id); if(p && nome.trim()){ p.nome=nome.trim(); saveIndex(); } }
function deleteProfile(id){
  if(IDX.profiles.length<=1) return;
  localStorage.removeItem(profKey(id));
  IDX.profiles = IDX.profiles.filter(p=>p.id!==id);
  if(IDX.active===id) IDX.active = IDX.profiles[0].id;
  saveIndex(); location.reload();
}

/* ---------- Estado ---------- */
const DEFAULT_STATE = { version:1, curso:"geral", migCursoGeral:true, foco:null, focoConfirmado:false, topics:{}, sessions:[], questions:[], simulados:[], redacoes:[], rascunhos:{}, chat:[], bancoResp:{}, trilha:{semana:1}, created:Date.now() };
let S = load();

function load(){
  try{
    const raw = localStorage.getItem(profKey(IDX.active));
    if(!raw) return structuredClone(DEFAULT_STATE);
    const p = JSON.parse(raw);
    // Migração 2026-07-19: o curso padrão deixou de ser "cic" (ele "ficava voltando").
    // Perfil salvo ANTES da marca existir e ainda em cic herdou aquele default antigo →
    // vira "geral" uma única vez. A marca vem no DEFAULT_STATE, então escolher CiC de
    // propósito DEPOIS disto fica salvo junto com ela e é respeitado para sempre.
    const herdouCic = p.curso === "cic" && !("migCursoGeral" in p);
    const s = Object.assign(structuredClone(DEFAULT_STATE), p);
    if(herdouCic) s.curso = "geral";
    return s;
  }catch(e){ console.warn("load falhou",e); return structuredClone(DEFAULT_STATE); }
}
function save(){ localStorage.setItem(profKey(IDX.active), JSON.stringify(S)); if(typeof Sync!=="undefined" && Sync.onSaved) Sync.onSaved(); }

/* topic record helper (lazy) */
function tRec(id){
  if(!S.topics[id]) S.topics[id] = { status:0, note:"", link:"", srs:null };
  return S.topics[id];
}
function topicStatus(id){ return S.topics[id]?.status || 0; }

/* ---------- Util ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const esc = s => (s==null?"":String(s)).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const todayKey = () => new Date().toISOString().slice(0,10);
const daysBetween = (a,b)=>Math.round((b-a)/DAY);

/* enumera todos os tópicos: {id, disc, eixo, topic} */
function allTopics(){
  const out=[];
  DISCIPLINAS.forEach(d=>d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    out.push({ id:topicId(d.id,ei,ti), disc:d, eixo:ex, topic:tp });
  })));
  return out;
}
function discProgress(d){
  let sum=0,tot=0;
  d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    tot++; const s=topicStatus(topicId(d.id,ei,ti));
    sum += s===2?1 : s===1?0.5 : 0;
  }));
  return tot? sum/tot : 0;
}
function overallProgress(){
  const ts=allTopics(); if(!ts.length) return 0;
  let s=0; ts.forEach(x=>{const st=topicStatus(x.id); s+= st===2?1:st===1?0.5:0;});
  return s/ts.length;
}
/* domínio ponderado pelo peso do curso (por prova) */
function weightedProgress(){
  const pesos = CURSOS[S.curso].pesos;
  // agrupa disciplinas por prova
  let num=0, den=0;
  const byProva={};
  DISCIPLINAS.forEach(d=>{
    (byProva[d.prova] ||= []).push(discProgress(d));
  });
  for(const pv of PROVAS){
    const arr=byProva[pv]||[0]; const avg=arr.reduce((a,b)=>a+b,0)/arr.length;
    const w=pesos[pv]||1; num+=avg*w; den+=w;
  }
  return den? num/den : 0;
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function go(tab){
  $$(".nav button").forEach(b=>b.classList.toggle("on", b.dataset.tab===tab));
  $$(".tab").forEach(t=>t.classList.toggle("on", t.id==="tab-"+tab));
  window.scrollTo({top:0,behavior:"instant"});
  if(tab==="metricas") renderMetricas();
  if(tab==="edital") renderEdital($("#editalDiscs"));   // acerto por tópico muda ao responder no banco
  if(tab==="analise") renderAnalise();
  if(tab==="recursos") renderRecursos();
  if(tab==="revisao") renderRevisao();
  if(tab==="simulador") renderSim();
  if(tab==="banco"){ renderBanco(); renderBancoOficial(); }
  if(tab==="redacao") renderRedacao();
  if(tab==="leituras") renderLeituras();
  if(tab==="painel") renderPainel();
  location.hash = tab;
  botSync(tab);
}
$("#nav").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) go(b.dataset.tab); });

/* ============================================================
   NAV INFERIOR (celular) — as 10 abas são 3 modos
   ------------------------------------------------------------
   Painel, Questões e Redação são o dia a dia: vão direto na barra.
   O resto se agrupa em "Estudar" e "Medir", que abrem uma folha.
   Assim as 10 telas continuam TODAS alcançáveis (1 ou 2 toques),
   sem a tira que rolava de lado e escondia metade delas.
   ============================================================ */
const BOT_GRUPOS = {
  estudar: { nome:"Estudar", itens:[
    { tab:"edital",    ic:"🗺",  t:"Mapa do Edital", d:"os tópicos que caem, disciplina por disciplina" },
    { tab:"revisao",   ic:"🔁",  t:"Cronograma",     d:"revisão espaçada — o que vence hoje" },
    { tab:"recursos",  ic:"🌐",  t:"Recursos",       d:"onde aprender cada assunto" },
    { tab:"leituras",  ic:"📖",  t:"Leituras",       d:"as obras obrigatórias da UFRGS" },
  ]},
  medir: { nome:"Medir", itens:[
    { tab:"metricas",  ic:"📈",  t:"Métricas",  d:"progresso, ritmo e tempo de estudo" },
    { tab:"analise",   ic:"🔍",  t:"Análise",   d:"o que mais cai × onde você erra" },
    { tab:"simulador", ic:"⚖️", t:"Argumento", d:"simule sua nota final por curso" },
  ]},
};
const BOT_TAB2GRP = (()=>{ const m={};
  Object.entries(BOT_GRUPOS).forEach(([k,g]) => g.itens.forEach(i => { m[i.tab]=k; }));
  return m; })();

/* acende o item da barra que corresponde à aba atual (direto ou pelo grupo dela) */
function botSync(tab){
  $$("#botNav button").forEach(b=>{
    const ativo = b.dataset.go ? b.dataset.go===tab : b.dataset.grp===BOT_TAB2GRP[tab];
    b.classList.toggle("on", !!ativo);
  });
}
function botGrupo(k){
  const g = BOT_GRUPOS[k]; if(!g) return;
  const atual = ($(".tab.on")||{id:""}).id.replace("tab-","");
  $("#sheetTit").textContent = g.nome;
  const box = $("#sheetItens"); box.innerHTML = "";
  g.itens.forEach(i=>{
    const b = el("button", "sheet-it" + (i.tab===atual ? " on" : ""),
      `<span class="ic">${i.ic}</span><span class="tx">
         <span class="tt">${esc(i.t)}</span><span class="dd">${esc(i.d)}</span></span>`);
    b.onclick = ()=>{ $("#dlgGrupo").close(); go(i.tab); };
    box.appendChild(b);
  });
  $("#dlgGrupo").showModal();
}
$("#botNav").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.go) go(b.dataset.go);
  else if(b.dataset.grp) botGrupo(b.dataset.grp);
});
// tocar fora da folha fecha (o <dialog> sozinho não faz isso)
$("#dlgGrupo").addEventListener("click", e=>{ if(e.target.id==="dlgGrupo") $("#dlgGrupo").close(); });

/* ============================================================
   APARÊNCIA — três eixos ortogonais, preferência POR APARELHO:
     • data-theme (cor):    escuro (quente) / guaiba (navy) / claro / gradiente
     • data-style (forma):  literaria / linear / atelie / aurora  (os 4 Looks)
     • data-nav  (layout):  lateral (padrão) / topo / inferior — ONDE fica a nav.
                            Só vale no desktop; no celular a nav é sempre a barra inferior.
   Os eixos seguem ortogonais no CSS (um bloco data-style nunca define cor; um
   data-nav só mexe em posição/fluxo, nunca em cor). Acoplamento só no clique:
   cada Look TRAZ seu tema NATIVO (LOOK_TEMA) porque a elevação de cada Look é
   calibrada p/ um fundo (Ateliê p/ claro, Aurora p/ escuro…) — depois o seletor
   de cor continua livre p/ recolorir. O <script> no <head> já aplicou os três
   antes do paint; aqui sincronizamos os seletores,
   tratamos o clique e tocamos a transição "pôr-do-sol" (#fxWipe). Não entram no
   S nem no sync: aparência é gosto do aparelho, não do perfil. Ver DESIGN-SYSTEM.md.
   ============================================================ */
const TEMA_COR  = { escuro:"#0c0f16", guaiba:"#070f1e", claro:"#eef1f8", gradiente:"#0a0e24" };
const LOOK_TEMA = { literaria:"escuro", linear:"guaiba", atelie:"claro", aurora:"gradiente" };
function temaAtual(){ return document.documentElement.dataset.theme || "escuro"; }
function estiloAtual(){ return document.documentElement.dataset.style || "literaria"; }
function navAtual(){ return document.documentElement.dataset.nav || "lateral"; }
function aparenciaSync(){
  const t = temaAtual(), s = estiloAtual(), n = navAtual();
  $$(".theme-pick button").forEach(b => b.classList.toggle("on", b.dataset.theme===t));
  $$(".style-pick button").forEach(b => b.classList.toggle("on", b.dataset.style===s));
  $$(".nav-pick button").forEach(b => b.classList.toggle("on", b.dataset.nav===n));
}
/* Cobre a tela com o "pôr-do-sol" e faz o swap no pico, escondendo o reflow.
   Respeita prefers-reduced-motion (aplica na hora, sem animação). */
let _wipeT = [];
function withWipe(apply){
  const fx = document.getElementById("fxWipe");
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!fx || rm){ apply(); return; }
  _wipeT.forEach(clearTimeout); _wipeT = [];
  fx.classList.add("on");
  _wipeT.push(setTimeout(apply, 220));                          // troca no pico
  _wipeT.push(setTimeout(() => fx.classList.remove("on"), 430));
}
function applyTema(t){
  if(t==="escuro") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try{ localStorage.setItem("painelTema", t); }catch(e){}
  // a barra de status do navegador/PWA acompanha o fundo do tema
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute("content", TEMA_COR[t] || TEMA_COR.escuro);
}
function setTema(t){ withWipe(() => { applyTema(t); aparenciaSync(); }); }
function setEstilo(s){
  withWipe(() => {
    if(s==="literaria") delete document.documentElement.dataset.style;
    else document.documentElement.dataset.style = s;
    try{ localStorage.setItem("painelEstilo", s); }catch(e){}
    const nt = LOOK_TEMA[s];            // cada Look chega com seu tema nativo
    if(nt) applyTema(nt);
    aparenciaSync();
  });
}
/* data-nav: só posição, nunca cor nem tema nativo (não é gosto de aparência, é de layout).
   'lateral' é o padrão → apaga o atributo (mesma convenção de escuro/literaria). */
function applyNav(n){
  if(n==="lateral") delete document.documentElement.dataset.nav;
  else document.documentElement.dataset.nav = n;
  try{ localStorage.setItem("painelNav", n); }catch(e){}
}
function setNav(n){ withWipe(() => { applyNav(n); aparenciaSync(); }); }
$$(".theme-pick button").forEach(b => b.addEventListener("click", () => setTema(b.dataset.theme)));
$$(".style-pick button").forEach(b => b.addEventListener("click", () => setEstilo(b.dataset.style)));
$$(".nav-pick button").forEach(b => b.addEventListener("click", () => setNav(b.dataset.nav)));
aparenciaSync();

/* ============================================================
   CURSO
   ============================================================ */
function fillCursoSelect(){
  const sel=$("#cursoSel"); sel.innerHTML="";
  Object.entries(CURSOS).forEach(([k,v])=>{
    const o=el("option"); o.value=k; o.textContent=v.nome; sel.appendChild(o);
  });
  sel.value=S.curso;
  sel.onchange=()=>{ S.curso=sel.value; save(); renderPainel(); renderSim(); renderMetricas(); };
}

