#!/usr/bin/env node
/* Auditoria headless do painel — gera painel/audit-<modo>.html com sondas injetadas.
   Uso:  node pipeline/auditar_painel.js <estatico|abas|fluxo|overflow|ia>
   Depois abra o audit-*.html gerado no Chrome headless e leia o <pre> final:
     chrome --headless=new --disable-gpu --user-data-dir=/tmp/a --virtual-time-budget=25000 \
            --dump-dom "file://$PWD/painel/audit-fluxo.html" | grep -o 'AUDIT.*' | head -c 4000
   (no modo `ia` use --virtual-time-budget=60000: faz UMA chamada real ao Gemini)
   Os audit-*.html são descartáveis — apagar depois (não commitar).
   Escrito na auditoria de 2026-07-10 (ver pesquisa/analise/REFATORACAO-FRONTEND.md §1). */
const fs = require("fs");
const path = require("path");
const BASE = path.resolve(__dirname, "..");
const PAINEL = path.join(BASE, "painel");
const html = fs.readFileSync(path.join(PAINEL, "index.html"), "utf8");
const modo = process.argv[2];

const COLETOR = `<script>
window.__audit={boot:[],res:[],cerr:[],cwarn:[]};
window.addEventListener("error",e=>{
  if(e.target&&e.target!==window&&(e.target.src||e.target.href))__audit.res.push(String(e.target.src||e.target.href).split("/").pop());
  else __audit.boot.push((e.message||"?")+" @"+(e.filename||"").split("/").pop()+":"+e.lineno);
},true);
window.addEventListener("unhandledrejection",e=>__audit.boot.push("promise: "+(e.reason&&e.reason.message||e.reason)));
(function(){const ce=console.error,cw=console.warn;
console.error=(...a)=>{__audit.cerr.push(a.map(String).join(" ").slice(0,200));ce(...a)};
console.warn=(...a)=>{__audit.cwarn.push(a.map(String).join(" ").slice(0,200));cw(...a)};})();
</` + `script>`;

function emitir(nome, sonda, comColetor = true) {
  let out = comColetor ? html.replace(/<head>/i, "<head>" + COLETOR) : html;
  out = out.replace("</body>", sonda + "</body>");
  const arq = path.join(PAINEL, `audit-${nome}.html`);
  fs.writeFileSync(arq, out);
  console.log(`gerado: painel/audit-${nome}.html`);
}

if (modo === "estatico") {
  // ids referenciados no app.js que não existem no index.html + onclick órfãos
  const appjs = fs.readFileSync(path.join(PAINEL, "app.js"), "utf8");
  const refs = new Set();
  for (const m of appjs.matchAll(/\$\(\s*["'`]#([A-Za-z0-9_-]+)["'`]\s*\)/g)) refs.add(m[1]);
  for (const m of appjs.matchAll(/getElementById\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*\)/g)) refs.add(m[1]);
  const ids = new Set([...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  const fnCalls = new Set([...html.matchAll(/onclick="(\w+)\(/g)].map(m => m[1]));
  const fnDef = new Set([...appjs.matchAll(/function\s+(\w+)\s*\(/g)].map(m => m[1]));
  console.log(JSON.stringify({
    // atenção: elementos criados via innerHTML dinâmico (ex.: rdAddQ) aparecem aqui
    // como falso positivo — conferir se há guard `if(el)` antes de acusar bug.
    idsSemElemento: [...refs].filter(id => !ids.has(id)),
    onclickSemFuncao: [...fnCalls].filter(f => !fnDef.has(f) && !ids.has(f)),
  }, null, 1));
} else if (modo === "abas") {
  emitir("abas", `<script>
window.addEventListener("load",()=>setTimeout(()=>{
  const R={};
  for(const t of [...document.querySelectorAll('#nav button')].map(b=>b.dataset.tab)){
    const erros=[]; const n0=__audit.boot.length+__audit.cerr.length;
    try{ go(t); }catch(e){ erros.push("go(): "+e.message); }
    if(!document.getElementById("tab-"+t)) erros.push("#tab-"+t+" NAO EXISTE");
    const extra=(__audit.boot.length+__audit.cerr.length)-n0;
    if(extra) erros.push(extra+" erro(s) de console");
    R[t]=erros.length?erros:"ok";
  }
  const pre=document.createElement("pre");
  pre.textContent="AUDIT_ABAS:"+JSON.stringify({abas:R,boot:__audit.boot,cerr:__audit.cerr,res:__audit.res},null,1);
  document.body.appendChild(pre);
},800));
</` + `script>`);
} else if (modo === "fluxo") {
  emitir("fluxo", `<script>
window.addEventListener("load",()=>setTimeout(()=>{
  const R=[];
  const passo=(nome,fn)=>{ const n0=__audit.boot.length+__audit.cerr.length;
    try{ fn(); }catch(e){ R.push({nome,ERRO:e.message}); return; }
    const extra=(__audit.boot.length+__audit.cerr.length)-n0;
    R.push(extra? {nome,consoleErros:extra} : {nome,ok:1}); };
  passo("go(edital)", ()=>go("edital"));
  passo("abrir 1a disciplina", ()=>document.querySelector("#editalDiscs .disc").classList.add("open"));
  passo("cycleStatus x6", ()=>{ const ds=[...document.querySelectorAll("#editalDiscs .dot")].slice(0,6);
    if(!ds.length) throw new Error("nenhum .dot"); ds.forEach(d=>{d.click();d.click();}); });
  passo("openRelacoes", ()=>{ const rb=document.querySelector("#editalDiscs .rel-btn");
    if(!rb) throw new Error("sem .rel-btn"); rb.click(); document.getElementById("dlgRel").close(); });
  passo("openNote+saveNote", ()=>{ document.querySelector("#editalDiscs .topic").click();
    const ta=document.querySelector("#dlgNote textarea"); if(ta) ta.value="nota de teste"; saveNote(); });
  passo("logSession 45min", ()=>{ go("revisao"); document.getElementById("logMin").value="45"; logSession(); });
  passo("reviewCard", ()=>{ const b=document.querySelector("#dueList button, #tab-revisao .due-item button");
    if(!b) throw new Error("nenhum card devido"); b.click(); });
  passo("openQ+saveQ", ()=>{ go("banco"); openQ();
    document.getElementById("dlgQ").querySelectorAll("input,textarea,select").forEach(el=>{
      if(el.tagName==="SELECT")el.selectedIndex=0; else if(!el.value) el.value="probe"; });
    saveQ(); });
  passo("attemptQ", ()=>{ const q=S.questions&&S.questions[0]; if(!q) throw new Error("questao nao salva");
    attemptQ(q.id,true); });
  passo("prova completa+corrigir", ()=>{
    const rows=[...document.querySelectorAll("#pvGrid .pv-row")]; if(!rows.length) throw new Error("grade vazia");
    rows.forEach(r=>{ const b=r.querySelector(".pv-opt"); if(b) b.click(); });
    corrigirProva();
    if(document.getElementById("pvScore").style.display==="none") throw new Error("pvScore nao apareceu");
    if(!(S.simulados&&S.simulados.length)) throw new Error("simulado nao salvo"); });
  passo("openRed+saveRed", ()=>{ go("redacao"); openRed();
    document.getElementById("dlgRed").querySelectorAll("input").forEach(el=>{
      if(el.type==="number")el.value="800"; else if(!el.value)el.value="probe"; }); saveRed(); });
  passo("openCorrige (sem API)", ()=>{ openCorrige();
    const sel=document.querySelector("#dlgCorrige select");
    if(sel){ sel.selectedIndex=1; sel.dispatchEvent(new Event("change")); }
    document.getElementById("dlgCorrige").close(); });
  passo("simulador", ()=>{ go("simulador"); simPreset(600); simFromDom(); });
  passo("metricas+analise", ()=>{ go("metricas"); go("analise"); });
  // addProfile/deleteProfile/exportData FORA: reload/download penduram o headless
  const pre=document.createElement("pre");
  pre.textContent="AUDIT_FLUXO:"+JSON.stringify({passos:R,boot:__audit.boot,cerr:__audit.cerr,res:__audit.res},null,1);
  document.body.appendChild(pre);
},800));
</` + `script>`);
} else if (modo === "overflow") {
  emitir("overflow", `<script>
window.addEventListener("load",()=>setTimeout(()=>{
  const R={largura:innerWidth, abas:{}};
  for(const t of [...document.querySelectorAll('#nav button')].map(b=>b.dataset.tab)){
    try{ go(t); }catch(e){}
    const de=document.documentElement;
    const largos=[...document.querySelectorAll('#tab-'+t+' *')]
      .filter(el=>el.scrollWidth>de.clientWidth+2).slice(0,4)
      .map(el=>el.tagName.toLowerCase()+(el.className?'.'+String(el.className).split(' ')[0]:''));
    R.abas[t]={pagina:de.scrollWidth>de.clientWidth+2?de.scrollWidth+'>'+de.clientWidth:'ok', largos};
  }
  const pre=document.createElement("pre");
  pre.textContent="AUDIT_OVERFLOW:"+JSON.stringify(R,null,1);
  document.body.appendChild(pre);
},800));
</` + `script>`, false);
} else if (modo === "ia") {
  emitir("ia", `<script>
window.addEventListener("load",()=>setTimeout(async()=>{
  const R={};
  try{ go("ia"); R.chave=!!IA_KEY;
    await iaEnviar("Responda só com a palavra: pronto");
    const u=S.chat[S.chat.length-1]; R.papel=u.r; R.texto=String(u.t).slice(0,120);
  }catch(e){ R.excecao=e.message; }
  const pre=document.createElement("pre");
  pre.textContent="AUDIT_IA:"+JSON.stringify(R,null,1);
  document.body.appendChild(pre);
},600));
</` + `script>`);
} else {
  console.log("modo? estatico | abas | fluxo | overflow | ia");
  process.exit(1);
}
