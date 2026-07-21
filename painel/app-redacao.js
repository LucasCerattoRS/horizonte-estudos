// app-redacao.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Redação, wizard de correção, leituras.
/* ============================================================
   REDAÇÃO — registro por competência + evolução + biblioteca
   ============================================================ */
const NIVEIS_ENEM = [0,40,80,120,160,200];

function redTipoUI(){
  const enem = $("#drTipo").value==="enem";
  $("#drCompBox").style.display = enem?"":"none";
  $("#drNotaBox").style.display = enem?"none":"flex";
  if(!enem && !$("#drMax").value) $("#drMax").value = $("#drTipo").value==="ufrgs" ? 30 : 1000;
}
/* opts = {tema, tipo} vem do editor ("Registrar nota manual"), para não redigitar o tema.
   O <select> de tipo só conhece enem/ufrgs/treino — banca sem entrada lá cai em "treino". */
function openRed(opts){
  opts = opts || {};
  $("#drData").value=todayKey(); $("#drTema").value=opts.tema||""; $("#drObs").value="";
  $("#drNota").value=""; $("#drMax").value="";
  const box=$("#drCompBox"); box.innerHTML="";
  ENEM_COMP.forEach((c,i)=>{
    const row=el("div","comp-row");
    const sel=`<select id="drC${i}">${NIVEIS_ENEM.map(n=>`<option value="${n}" ${n===120?"selected":""}>${n}</option>`).join("")}</select>`;
    row.innerHTML=`<label title="${esc(c.nome)}">C${i+1} · ${esc(c.curta)}</label>${sel}`;
    box.appendChild(row);
  });
  $("#drTipo").value = (opts.tipo==="enem"||opts.tipo==="ufrgs") ? opts.tipo : "enem";
  redTipoUI();
  $("#dlgRed").showModal();
}

/* Do editor para o lançamento da nota: fecha (o "close" já salva o rascunho) e abre
   o registro manual com o tema/banca preenchidos. */
function crRegistrarNota(){
  const tema=$("#crTema").value.trim(), banca=$("#crBanca").value;
  $("#dlgCorrige").close();
  openRed({ tema, tipo:banca });
}
function saveRed(){
  const tipo=$("#drTipo").value, tema=$("#drTema").value.trim();
  const r={ id:"r"+Date.now(), date:$("#drData").value||todayKey(), tipo, tema, obs:$("#drObs").value.trim() };
  if(tipo==="enem"){
    r.comp=ENEM_COMP.map((_,i)=>+$("#drC"+i).value);
    r.nota=r.comp.reduce((a,b)=>a+b,0); r.max=1000;
  } else {
    r.nota=+$("#drNota").value; r.max=+$("#drMax").value||30;
    if(!(r.nota>=0) || !(r.max>0) || r.nota>r.max){ alert("Confira nota e nota máxima."); return; }
  }
  S.redacoes.push(r); save(); $("#dlgRed").close(); renderRedacao();
}
function delRed(id){ S.redacoes=S.redacoes.filter(r=>r.id!==id); save(); renderRedacao(); }

function renderRedacao(){
  const rs=[...S.redacoes].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  // stats
  const enems=rs.filter(r=>r.tipo==="enem");
  const media=enems.length?Math.round(enems.reduce((a,r)=>a+r.nota,0)/enems.length):null;
  $("#redStats").textContent = rs.length
    ? `${rs.length} redaç${rs.length>1?"ões":"ão"} · ${enems.length} ENEM${media!=null?" (média "+media+")":""}`
    : "nenhuma registrada ainda";
  renderRedWizard(); chartRed(rs); chartComp(enems); renderRedList(rs); renderRedBib();
}
const TIPO_RED={enem:{n:"ENEM",clr:"var(--azul)"},ufrgs:{n:"UFRGS",clr:"var(--sunset)"},treino:{n:"treino",clr:"var(--verde)"},fuvest:{n:"FUVEST",clr:"var(--amarelo)"},glau:{n:"tema livre",clr:"var(--cinza)"}};
const _tipoRed = t => TIPO_RED[t] || {n:t||"?",clr:"var(--muted)"};   // tolera tipos futuros
function chartRed(rs){
  const svg=$("#chartRed"); svg.innerHTML="";
  const W=720,H=200,padL=38,padR=16,padT=14,padB=26;
  [0,.25,.5,.75,1].forEach(g=>{
    const y=H-padB-g*(H-padT-padB);
    svg.appendChild(svgNS("line",{x1:padL,y1:y,x2:W-padR,y2:y,stroke:"var(--border-soft)","stroke-width":1}));
    svg.appendChild(svgNS("text",{x:padL-6,y:y+3,fill:"var(--faint)","font-size":10,"text-anchor":"end"})).textContent=Math.round(g*100);
  });
  if(!rs.length){
    svg.appendChild(svgNS("text",{x:W/2,y:H/2,fill:"var(--faint)","font-size":12,"text-anchor":"middle"})).textContent="Registre a primeira redação para ver a curva.";
    return;
  }
  const step=(W-padL-padR)/Math.max(rs.length,2);
  const pts=rs.map((r,i)=>({x:padL+step*(i+0.5), y:H-padB-(r.nota/r.max)*(H-padT-padB), r}));
  if(pts.length>1)
    svg.appendChild(svgNS("polyline",{points:pts.map(p=>`${p.x},${p.y}`).join(" "),fill:"none",stroke:"var(--border)","stroke-width":1.5}));
  pts.forEach(p=>{
    const c=svgNS("circle",{cx:p.x,cy:p.y,r:4.5,fill:_tipoRed(p.r.tipo).clr});
    c.appendChild(svgNS("title",{})).textContent=`${p.r.date} · ${_tipoRed(p.r.tipo).n} · ${p.r.nota}/${p.r.max}`;
    svg.appendChild(c);
    svg.appendChild(svgNS("text",{x:p.x,y:H-8,fill:"var(--faint)","font-size":9,"text-anchor":"middle"})).textContent=p.r.date.slice(5);
  });
}
function chartComp(enems){
  const svg=$("#chartComp"); svg.innerHTML="";
  const hint=$("#compHint");
  if(!enems.length){
    svg.appendChild(svgNS("text",{x:360,y:100,fill:"var(--faint)","font-size":12,"text-anchor":"middle"})).textContent="Sem redações ENEM ainda.";
    hint.textContent=""; return;
  }
  const med=ENEM_COMP.map((_,i)=>enems.reduce((a,r)=>a+(r.comp?.[i]||0),0)/enems.length);
  const worst=med.indexOf(Math.min(...med));
  const W=720,H=200,padL=150,padR=52,padT=10,padB=10;
  const bw=(H-padT-padB)/5, maxW=W-padL-padR;
  med.forEach((m,i)=>{
    const y=padT+i*bw+bw*0.2, h=bw*0.6;
    svg.appendChild(svgNS("rect",{x:padL,y,width:maxW,height:h,rx:5,fill:"var(--raised)"}));
    svg.appendChild(svgNS("rect",{x:padL,y,width:Math.max(2,(m/200)*maxW),height:h,rx:5,
      fill:i===worst?"var(--vermelho)":m>=160?"var(--verde)":"var(--azul)"}));
    svg.appendChild(svgNS("text",{x:padL-8,y:y+h/2+4,fill:"var(--ink)","font-size":11.5,"text-anchor":"end"})).textContent=`C${i+1} ${ENEM_COMP[i].curta}`;
    svg.appendChild(svgNS("text",{x:padL+maxW+6,y:y+h/2+4,fill:"var(--muted)","font-size":11,"font-family":"var(--mono)"})).textContent=Math.round(m);
  });
  hint.textContent=`Ponto fraco: C${worst+1} — ${ENEM_COMP[worst].nome}.`;
}
function renderRedList(rs){
  const box=$("#redList"); box.innerHTML="";
  if(!rs.length){
    box.innerHTML=`<div class="empty" style="grid-column:1/-1">Nenhuma redação ainda — escreva a primeira pelo wizard acima. ✍</div>`;
    return;
  }
  [...rs].reverse().forEach(r=>{
    const pct=Math.round(r.nota/r.max*100);
    const bKey = (r.banca && BANCA_INFO[r.banca]) ? r.banca : (BANCA_INFO[r.tipo] ? r.tipo : "livre");
    const badge = BANCA_INFO[bKey]===BANCA_INFO.livre ? _tipoRed(r.tipo).n.toUpperCase() : _biBanca(bKey).badge;
    const clr = pct>=80?"var(--verde)":pct>=60?"var(--amarelo)":"var(--vermelho)";
    const resumo = r.comentarioIA || r.obs || "";
    const item=el("div","rh");
    item.innerHTML=`
      <div class="top">
        <span class="badge-b" style="background:${_biBanca(bKey).clr};color:var(--bg)">${esc(badge)}</span>
        <span class="tag">${esc(r.date)}</span>
        ${r.fonte==="ia"?'<span class="tag" title="corrigida automaticamente pela rubrica da banca">✦ IA</span>':""}
        <span class="nota" style="color:${clr};margin-left:auto">${r.nota}/${r.max}</span>
      </div>
      ${r.tema?`<div class="top"><span class="tm">${esc(r.tema)}</span></div>`:""}
      ${r.comp?`<div class="red-comps">${r.comp.map((v,i)=>`<span title="${esc(ENEM_COMP[i].nome)}">C${i+1} ${v}</span>`).join("")}</div>`:""}
      ${resumo?`<p>${esc(resumo)}</p>`:""}
      <div class="acts">
        ${(r.criterios||r.texto)?`<button class="chip" data-a="ler">reler correção</button>`:""}
        <button class="chip" data-a="re">reescrever</button>
        <button class="chip" data-a="del" style="margin-left:auto;border-color:#5a3030;color:var(--vermelho)">excluir</button>
      </div>`;
    item.querySelector('[data-a="ler"]')?.addEventListener("click",()=>relerCorrecao(r.id));
    item.querySelector('[data-a="re"]').onclick=()=>reescrever(r.id);
    item.querySelector('[data-a="del"]').onclick=()=>{ if(confirm("Excluir este registro?")) delRed(r.id); };
    box.appendChild(item);
  });
}
const _NOTAMIL = typeof REDACOES_NOTAMIL !== "undefined" ? REDACOES_NOTAMIL : [];
const _RUBRICAS = typeof RUBRICAS !== "undefined" ? RUBRICAS : {};
const _PROPOSTAS = typeof PROPOSTAS_REDACAO !== "undefined" ? PROPOSTAS_REDACAO : [];
const _PUFRGS = typeof PROPOSTAS_UFRGS !== "undefined" ? PROPOSTAS_UFRGS : [];
const _TMODELO = typeof TEXTOS_MODELO !== "undefined" ? TEXTOS_MODELO : [];

/* Abre uma redação nota-1000 transcrita (cartilha c, redação r) no leitor. */
function openLeitura(c, r){
  const cart=_NOTAMIL[c]; if(!cart) return; const red=cart.redacoes[r]; if(!red) return;
  $("#dlLeiTit").textContent = red.autor;
  $("#dlLeiMeta").textContent = `Nota 1000 · ENEM ${cart.ano} · tema: ${cart.tema}`;
  $("#dlLeiCorpo").textContent = red.texto;
  $("#dlgLeitura").showModal();
}

/* Abre um texto autoral modelo (TEXTOS_MODELO[i]) no mesmo leitor. */
function openTextoModelo(i){
  const t=_TMODELO[i]; if(!t) return;
  $("#dlLeiTit").textContent = `${t.titulo} — ${t.autor}`;
  $("#dlLeiMeta").textContent = `${t.ano} · ${t.contexto}`;
  $("#dlLeiCorpo").textContent = t.texto;
  $("#dlgLeitura").showModal();
}

/* ============================================================
   R2 — WIZARD Critério → Tema → Escrever & corrigir
   Propostas oficiais unificadas (UFRGS + FUVEST + temas ENEM das
   cartilhas nota-mil) + tema livre; status por proposta vem de
   S.redacoes (propId) e S.rascunhos.
   ============================================================ */
const BANCA_INFO = {
  ufrgs:  { badge:"UFRGS",      capa:"b-ufrgs",  clr:"var(--sunset)" },
  enem:   { badge:"ENEM",       capa:"b-enem",   clr:"var(--azul)" },
  fuvest: { badge:"FUVEST",     capa:"b-fuvest", clr:"#a98ad8" },
  glau:   { badge:"GLAU",       capa:"b-livre",  clr:"var(--verde)" },
  livre:  { badge:"TEMA LIVRE", capa:"b-livre",  clr:"var(--verde)" },
};
const _biBanca = b => BANCA_INFO[b] || BANCA_INFO.livre;
let WIZ = { passo:1, banca:null, propId:null, filtro:"todas" };

let _PROPSCACHE=null;
function PROPS(){
  if(_PROPSCACHE) return _PROPSCACHE;
  const out=[];
  _PUFRGS.forEach(p=>out.push({ id:`ufrgs-${p.ano}`, banca:"ufrgs", ano:p.ano, tema:p.tema,
    genero:p.genero||"Dissertação", comando:p.comando||"", coletanea:p.coletanea||"", pdf:p.pdf }));
  _PROPOSTAS.forEach(p=>out.push({ id:`${p.banca}-${p.ano}`, banca:p.banca, ano:p.ano, tema:p.tema,
    genero:p.tipo||"Dissertação", comando:"", coletanea:p.coletanea||"", pdf:p.pdf }));
  _NOTAMIL.forEach(c=>out.push({ id:`enem-${c.ano}`, banca:"enem", ano:c.ano, tema:c.tema,
    genero:"Dissertativo-argumentativo (ENEM)",
    comando:"Redija a partir da situação-problema do tema oficial; a proposta de intervenção (agente, ação, meio, resultado, detalhamento) é obrigatória.",
    coletanea:`Tema oficial do ENEM ${c.ano}. ${c.redacoes.length} redações nota-mil deste tema estão na biblioteca abaixo — leia 2–3 antes de escrever.` }));
  out.sort((a,b)=>b.ano-a.ano);
  out.push({ id:"livre", banca:"livre", ano:null, tema:"",
    genero:"Tema livre", comando:"", coletanea:"Treine com um tema seu, do caderno ou da Glau — defina o tema no editor." });
  return _PROPSCACHE=out;
}
function propStatus(id){
  const rs=S.redacoes.filter(r=>r.propId===id && r.nota!=null);
  if(rs.length){
    const best=rs.reduce((a,b)=>(b.nota/b.max>a.nota/a.max?b:a));
    return { cls:"ok", txt:`✓ corrigida · ${best.nota}/${best.max}` };
  }
  if(S.rascunhos && S.rascunhos[id]) return { cls:"pend", txt:"rascunho salvo" };
  return { cls:"novo", txt:"nunca escrita" };
}

function renderRedWizard(){
  const wrap=$("#redWizard"), body=$("#redWizBody");
  if(!wrap) return;
  const rb=WIZ.banca?_RUBRICAS[WIZ.banca]:null;
  const prop=WIZ.propId?PROPS().find(p=>p.id===WIZ.propId):null;
  const p1sub = rb ? `${rb.nome} · escala ${rb.escala}` : "como sua redação será avaliada";
  const p2sub = prop ? (prop.id==="livre" ? "tema livre" : `${_biBanca(prop.banca).badge}${prop.ano?" "+prop.ano:""} — escolhido`)
                     : "proposta oficial ou tema livre";
  const cls=n=>{
    if(WIZ.passo===n) return "passo atual";
    if(n===1&&rb) return "passo feito";
    if(n===2&&prop) return "passo feito";
    if((n===2&&!rb)||(n===3&&(!rb||!prop))) return "passo trava";
    return "passo";
  };
  wrap.innerHTML=`
    <button class="${cls(1)}" onclick="wizIr(1)"><span class="num">PASSO 1</span><b>Critério</b><span class="d">${esc(p1sub)}</span></button>
    <button class="${cls(2)}" onclick="wizIr(2)"><span class="num">PASSO 2</span><b>Tema</b><span class="d">${esc(p2sub)}</span></button>
    <button class="${cls(3)}" onclick="wizIr(3)"><span class="num">PASSO 3</span><b>Escrever &amp; corrigir</b><span class="d">editor + correção pela rubrica ${rb?esc(rb.nome):"da banca"}</span></button>`;
  body.innerHTML = WIZ.passo===1 ? wizPasso1() : WIZ.passo===2 ? wizPasso2() : wizPasso3();
}
function wizIr(n){
  if(n===2&&!WIZ.banca) return;
  if(n===3&&(!WIZ.banca||!WIZ.propId)) return;
  WIZ.passo=n; renderRedWizard();
}
function wizPasso1(){
  const cards=Object.entries(_RUBRICAS).map(([k,rb])=>{
    const crit=rb.criterios.map(c=>{
      const p=c.peso!=null?` · peso ${c.peso}`:c.max!=null?` · 0–${c.max}`:"";
      return `<li title="${esc(c.desc)}">${esc(c.curta)}${p}</li>`;
    }).join("");
    const extra = rb.holistica
      ? `<div class="note-hint" style="margin-top:4px">correção holística — dimensões de peso igual · mín. 30 linhas na prova real</div>` : "";
    return `<button class="rub-card${WIZ.banca===k?" sel":""}" onclick="wizBanca('${k}')">
      <span class="rb-nm">${esc(rb.nome)}</span><span class="rb-esc">escala ${rb.escala}</span>
      ${extra}<ul>${crit}</ul>
      <div class="note-hint" style="margin-top:8px;font-size:10.5px">${esc(rb.fonte)}</div></button>`;
  }).join("");
  return `<div class="eyebrow" style="margin-bottom:10px">Como sua redação deve ser avaliada?</div>
    <div class="rub-pick">${cards}</div>`;
}
function wizBanca(k){
  WIZ.banca=k; WIZ.passo=2;
  WIZ.filtro = PROPS().some(p=>p.banca===k) ? k : "todas";
  renderRedWizard();
}
function wizPasso2(){
  const bancas=[...new Set(PROPS().filter(p=>p.id!=="livre").map(p=>p.banca))];
  const chips=[`<button class="${WIZ.filtro==="todas"?"on":""}" onclick="wizFiltro('todas')">Todas</button>`]
    .concat(bancas.map(b=>`<button class="${WIZ.filtro===b?"on":""}" onclick="wizFiltro('${b}')">${esc((_RUBRICAS[b]||{}).nome||b.toUpperCase())}</button>`))
    .join("");
  const props=PROPS().filter(p=>p.id==="livre"||WIZ.filtro==="todas"||p.banca===WIZ.filtro);
  const cards=props.map(p=>{
    const bi=_biBanca(p.banca), st=propStatus(p.id);
    return `<div class="tema-card" onclick="wizTema('${p.id}')">
      <div class="capa ${bi.capa}"><span class="badge-b">${bi.badge}${p.ano?" "+p.ano:""}</span>
        ${p.pdf?`<a class="badge-b" href="${encodeURI(p.pdf)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="abrir a prova original (PDF)">📄</a>`:""}</div>
      <div class="corpo"><b>${esc(p.tema||"Treinar com um tema seu (ou do caderno)")}</b>
        <span style="font-size:11px;color:var(--faint)">${esc(p.genero||"")}</span>
        <span class="st-faixa ${st.cls}">${st.txt}</span></div></div>`;
  }).join("");
  return `<div class="eyebrow" style="margin-bottom:10px">Escolha a proposta · badge = banca · faixa = seu status</div>
    <div class="tema-filtros">${chips}</div><div class="grid-tema">${cards}</div>`;
}
function wizFiltro(f){ WIZ.filtro=f; renderRedWizard(); }
function wizTema(id){ WIZ.propId=id; WIZ.passo=3; renderRedWizard(); abrirEditor(); }
function wizPasso3(){
  const rb=_RUBRICAS[WIZ.banca], prop=PROPS().find(p=>p.id===WIZ.propId);
  if(!rb||!prop) return `<div class="empty">Escolha o critério e o tema acima.</div>`;
  const st=propStatus(prop.id);
  return `<div class="card" style="border-color:var(--sunset-deep)">
    <div class="eyebrow" style="margin-bottom:6px">Pronto para escrever</div>
    <div style="font-size:15px;font-weight:600;margin-bottom:4px">${esc(prop.tema||"Tema livre")}</div>
    <div style="font-size:12.5px;color:var(--muted)">Rubrica ${esc(rb.nome)} · escala ${rb.escala}${prop.ano?` · proposta oficial ${_biBanca(prop.banca).badge} ${prop.ano}`:""} · <span class="st-faixa ${st.cls}" style="margin:0">${st.txt}</span></div>
    <div class="toolbar" style="margin:12px 0 0">
      <button class="btn primary" onclick="abrirEditor()">✏ Abrir o editor</button>
      <button class="chip" onclick="wizIr(2)">trocar tema</button>
      <button class="chip" onclick="WIZ.passo=1;renderRedWizard()">trocar critério</button>
    </div></div>`;
}
function abrirEditor(){
  const prop = WIZ.propId && WIZ.propId!=="livre" ? PROPS().find(p=>p.id===WIZ.propId) : null;
  openCorrige({ banca:WIZ.banca||undefined, prop, propId:WIZ.propId||null });
}

/* ---- Correção de redação por IA, pela rubrica da banca escolhida ---- */
let _corrigeProp = null;    // proposta oficial em uso no editor (ou null)
let _corrigePropId = null;  // id da proposta (p/ status e rascunho)

function openCorrige(opts){
  opts = opts || {};
  const sel=$("#crBanca");
  sel.innerHTML = Object.entries(_RUBRICAS)
    .map(([k,rb])=>`<option value="${k}">${esc(rb.nome)}</option>`).join("");
  if(opts.banca && _RUBRICAS[opts.banca]) sel.value=opts.banca;
  _corrigeProp = opts.prop || null;
  _corrigePropId = opts.propId || null;
  $("#crTema").value = opts.prop ? opts.prop.tema : (opts.tema||"");
  const pb=$("#crProp");
  if(opts.prop && opts.prop.id!=="livre"){
    pb.innerHTML = `<b>${esc(opts.prop.genero||"Proposta")}</b>${opts.prop.comando?` — ${esc(opts.prop.comando)}`:""}
      ${opts.prop.coletanea?`<br><span style="color:var(--faint)">Coletânea: ${esc(opts.prop.coletanea)}</span>`:""}
      ${opts.prop.pdf?` · <a href="${encodeURI(opts.prop.pdf)}" target="_blank" rel="noopener">abrir a prova (PDF)</a>`:""}`;
    pb.style.display="";
  } else { pb.innerHTML=""; pb.style.display="none"; }
  const draft = _corrigePropId && S.rascunhos ? S.rascunhos[_corrigePropId] : null;
  $("#crTexto").value = opts.texto!=null ? opts.texto : (draft ? draft.texto : "");
  // O editor é para ESCREVER: o rascunho fica salvo por proposta e a nota entra pelo
  // botão "Registrar nota manual". A rubrica da banca (abaixo) diz por onde você é avaliado.
  $("#crResultado").innerHTML='<div class="empty">Escreva ou cole a redação aqui — o rascunho fica salvo sozinho. Terminou? Use <b>Registrar nota manual</b> para lançar a nota pela rubrica da banca.</div>';
  crBancaUI(); $("#dlgCorrige").showModal();
}

function crBancaUI(){
  const rb=_RUBRICAS[$("#crBanca").value]; if(!rb) return;
  const crit=rb.criterios.map(c=>{
    const p=c.peso!=null?` (peso ${c.peso})`:c.max!=null?` (0–${c.max})`:"";
    return `${esc(c.curta)}${p}`;
  }).join(" · ");
  $("#crRubrica").innerHTML = `<b>${esc(rb.nome)}</b> · escala ${rb.escala} · ${crit}`
    + (rb.pendente?" · ⏳ rubrica ainda não conferida na fonte":"");
}

/* HTML da correção (usado no editor e no "reler correção" do histórico) */
function correcaoHTML(rb, res){
  const byId=Object.fromEntries((res.criterios||[]).map(c=>[c.id,c]));
  const linhas=rb.criterios.map(c=>{
    const r=byId[c.id]||{nota:"?",comentario:"—"};
    const teto=c.max!=null?c.max:rb.escala;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border-soft)">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <b>${esc(c.curta)}</b><span style="font-family:var(--mono);color:var(--sunset)">${r.nota}${c.max!=null?"/"+teto:""}</span></div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${esc(r.comentario||"")}</div></div>`;
  }).join("");
  const av=res._aval;
  const avBadge = av ? `<div class="note-hint" style="margin:2px 0 6px">${
    av.modo==="modalidades"
      ? `Processo UFRGS: modalidade <b>analítica</b> + <b>holística</b> por examinadores distintos${av.terceiro?`, 3º examinador chamado (discrepância ${av.distancia})`:` (distância ${av.distancia})`}.${av.conversao!=null?` Escore no concurso ≈ <b>${av.conversao}</b>/${rb.conversao}.`:""}`
      : `<b>${av.n} avaliadores</b> independentes${av.terceiro?` + <b>3º avaliador</b> (houve discrepância${rb.aval&&rb.aval.terceiroPrevalece?"; a nota dele prevalece":""})`:" (dentro da tolerância da banca)"} — a nota é a agregação oficial da banca.${
          rb.notaFinal==="soma-ponderada"?` Cada aspecto vale de ${rb.criterios[0].min} a ${rb.criterios[0].max}; multiplicados pelos pesos ${rb.criterios.map(c=>c.peso).join(", ")}, dão a nota ponderada de ${rb.notaMin} a ${rb.escala}.`:""}`
  }</div>` : "";
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div class="eyebrow" style="margin:0">Correção ${esc(rb.nome)}</div>
      <div style="font-size:22px;font-weight:700">${res.nota_final}<span style="font-size:13px;color:var(--muted)">/${rb.escala}</span></div></div>
    ${avBadge}
    ${linhas}
    <div style="margin-top:10px;font-size:13px;line-height:1.6"><b>Comentário geral:</b> ${esc(res.comentario_geral||"")}</div>
    <div class="note-hint" style="margin-top:8px">Correção automática (Gemini) pela rubrica ${esc(rb.nome)} — orientação, não nota oficial.</div></div>`;
}

/* rascunho: guarda o texto ao fechar o editor sem corrigir (por proposta) */
$("#dlgCorrige").addEventListener("close", ()=>{
  if(!_corrigePropId) return;
  const t=$("#crTexto").value.trim();
  S.rascunhos ||= {};
  if(t) S.rascunhos[_corrigePropId]={ texto:t, ts:Date.now() };
  else if(!t) delete S.rascunhos[_corrigePropId];
  save();
  if($("#tab-redacao").classList.contains("on")) renderRedWizard();
});

/* reler a correção salva + reescrever o mesmo tema */
function relerCorrecao(id){
  const r=S.redacoes.find(x=>x.id===id); if(!r) return;
  const rb=_RUBRICAS[r.banca];
  $("#rlTit").textContent = r.tema || "Correção";
  let html="";
  if(rb && r.criterios)
    html += correcaoHTML(rb, { criterios:r.criterios, nota_final:r.nota, comentario_geral:r.comentarioIA||"", _aval:r.aval });
  else
    html += `<div class="card">Nota <b>${r.nota}/${r.max}</b>${r.obs?` · ${esc(r.obs)}`:""}<div class="note-hint" style="margin-top:6px">Registro manual — sem correção detalhada salva.</div></div>`;
  if(r.texto)
    html += `<div class="eyebrow" style="margin:14px 0 6px">Seu texto</div>
      <div style="white-space:pre-wrap;font-size:13.5px;line-height:1.65;color:var(--muted)">${esc(r.texto)}</div>`;
  $("#rlBody").innerHTML=html;
  $("#rlReescrever").onclick=()=>{ $("#dlgReler").close(); reescrever(id); };
  $("#dlgReler").showModal();
}
function reescrever(id){
  const r=S.redacoes.find(x=>x.id===id); if(!r) return;
  const prop = r.propId && r.propId!=="livre" ? PROPS().find(p=>p.id===r.propId) : null;
  const banca = (r.banca && _RUBRICAS[r.banca]) ? r.banca : (_RUBRICAS[r.tipo] ? r.tipo : null);
  if(banca){ WIZ.banca=banca; }
  if(r.propId){ WIZ.propId=r.propId; WIZ.passo=3; renderRedWizard(); }
  openCorrige({ banca:banca||undefined, prop, propId:r.propId||null, tema:r.tema, texto:"" });
}

function renderRedBib(){
  const box=$("#redBib"); if(box.dataset.done) return; box.dataset.done=1;

  // Rubricas e propostas oficiais agora vivem no wizard (passos 1 e 2) —
  // a biblioteca guarda o material de leitura: modelos, nota-mil e cofre.

  // Textos autorais modelo (leitura no painel) — força retórica / estrutura.
  if(_TMODELO.length){
    const chips=_TMODELO.map((t,i)=>
      `<button class="chip" onclick="openTextoModelo(${i})" title="${esc(t.contexto)}">${esc(t.titulo)} — ${esc(t.autor)}</button>`).join(" ");
    box.insertAdjacentHTML("beforeend",
      `<div class="card" style="width:100%"><div class="eyebrow" style="margin:0">Textos autorais modelo (leia no painel)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${chips}</div></div>`);
  }

  // 202 redações nota-1000 transcritas — legíveis no painel, agrupadas por ano.
  box.insertAdjacentHTML("beforeend",
    `<div style="width:100%;margin-top:6px"><div class="eyebrow">Redações nota 1000 (leia no painel · ${_NOTAMIL.reduce((s,c)=>s+c.redacoes.length,0)} textos)</div></div>`);
  _NOTAMIL.forEach((cart, ci)=>{
    const links = cart.redacoes.map((red, ri)=>
      `<button class="chip" onclick="openLeitura(${ci},${ri})" title="${esc(red.autor)}">${esc(red.autor)}</button>`).join(" ");
    box.insertAdjacentHTML("beforeend",
      `<div class="card" style="width:100%">
        <div class="eyebrow" style="margin:0">ENEM ${cart.ano} · ${cart.redacoes.length} nota-mil</div>
        <div style="font-size:13.5px;margin:4px 0 8px">${esc(cart.tema)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${links}</div></div>`);
  });

  if(!semCofre()){  // atalho do cofre só serve a quem tem Obsidian (Alex); a Bia já lê as nota-mil no painel
    const tec=`obsidian://open?vault=${encodeURIComponent(OBS_VAULT)}&file=${encodeURIComponent("Redação/00 Mapa — Redação")}`;
    box.insertAdjacentHTML("beforeend",
      `<a class="bib" href="${tec}"><span class="bt">Cofre Obsidian</span>🗂 Notas de técnica (estrutura, repertório, prática cronometrada)</a>`);
  }
}

/* ============================================================
   LEITURAS OBRIGATÓRIAS — anatomia das obras
   Fonte: leituras-data.js (LEITURAS)
   ============================================================ */
const _LEITURAS = typeof LEITURAS !== "undefined" ? LEITURAS : [];
const LT_LISTA = {
  ingressante: { nome:"Ingressante 2027", curta:"ingressante" },
  remanescente:{ nome:"Remanescente",      curta:"remanescente" },
  coringa:     { nome:"Curinga ENEM",      curta:"curinga · não-UFRGS" },
};
const LT_FILTROS = [
  { k:"todas", nome:"Todas" },
  { k:"ingressante", nome:"Ingressantes (4)" },
  { k:"remanescente", nome:"Remanescentes (8)" },
  { k:"coringa", nome:"Curinga ENEM" },
];
let ltFiltro = "todas";
// nome EXATO da nota no cofre (= tópico do edital, com autor). Sem entrada = sem nota (ex.: curinga)
const LT_NOTA = {
  krenak:"Ideias para adiar o fim do mundo — Ailton Krenak",
  macunaima:"Macunaíma — Mário de Andrade",
  afuria:"A fúria (contos) — Silvina Ocampo",
  anac:"A teus pés (poesia) — Bia Cristina Cesar",
  quincas:"Quincas Borba — Machado de Assis",
  demonio:"O Demônio Familiar — José de Alencar",
  dalloway:"Mrs. Dalloway — Virginia Woolf",
  visaoplantas:"A visão das plantas — Djaimilia P. de Almeida",
  niketche:"Niketche — Paulina Chiziane",
  avesso:"O avesso da pele — Jeferson Tenório",
  falero:"Mas em que mundo tu vive — José Falero",
  lupicinio:"Seleta de Canções — Lupicínio Rodrigues",
};
const obsLeitura = topico =>
  `obsidian://open?vault=${encodeURIComponent(OBS_VAULT)}&file=${encodeURIComponent("Literatura/"+sanO(topico))}`;
const ytLeitura = (titulo, autor) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(titulo+" "+autor+" análise resumo vestibular")}`;

function renderLeituras(){
  // filtros (uma vez)
  const fc = $("#ltFilters");
  if(fc && !fc.dataset.done){
    fc.dataset.done = 1;
    LT_FILTROS.forEach(f=>{
      const b = el("button", f.k===ltFiltro?"on":null, f.nome); b.dataset.k = f.k;
      b.onclick = ()=>{ ltFiltro = f.k; $$("#ltFilters button").forEach(x=>x.classList.toggle("on", x.dataset.k===ltFiltro)); renderLeituras(); };
      fc.appendChild(b);
    });
  }
  const openIds = new Set([...document.querySelectorAll("#ltList .lt.open")].map(c=>c.dataset.id));
  const list = $("#ltList"); list.innerHTML = "";
  const obras = ltFiltro==="todas" ? _LEITURAS : _LEITURAS.filter(o=>o.lista===ltFiltro);
  obras.forEach(o=>{
    const card = el("div","lt "+o.lista); card.dataset.id = o.id;
    const eixos = o.eixos.map(e=>`
      <div class="lt-eixo">
        <div class="et">${esc(e.tema)}</div>
        <div class="ln"><span class="lb">No livro</span>${esc(e.oQue)}</div>
        <div class="ln use"><span class="lb">Como usar</span>${esc(e.comoUsar)}</div>
      </div>`).join("");
    const objs = o.objetivas.map(x=>`
      <div class="lt-obj"><span class="ob-r">${esc(x.rotulo)}</span><span>${esc(x.texto)}</span></div>`).join("");
    const linkNota = (LT_NOTA[o.id] && !semCofre()) ?
      `<a href="${obsLeitura(LT_NOTA[o.id])}" title="abrir nota no cofre Obsidian">🗂 nota no cofre</a>` : "";
    card.innerHTML = `
      <div class="lt-h">
        <span class="tt">${esc(o.titulo)}</span>
        <span class="au">${esc(o.autor)}</span>
        <span class="meta">${esc(o.ano)} · ${esc(o.genero)}</span>
        <span class="badge">${esc(LT_LISTA[o.lista].curta)}</span>
        <span class="caret">▸</span>
      </div>
      <div class="lt-body">
        <div class="lt-frase">💡 ${esc(o.frase)}</div>
        <div class="lt-seclabel">✍️ Na redação — repertório</div>
        ${eixos}
        <div class="lt-seclabel">📝 Na objetiva — o que cai</div>
        ${objs}
        ${o.conexao?`<div class="lt-conx">🔗 ${esc(o.conexao)}</div>`:""}
        <div class="lt-links">
          <a href="${ytLeitura(o.titulo,o.autor)}" target="_blank" rel="noopener">▶ análise no YouTube</a>
          ${linkNota}
        </div>
      </div>`;
    card.querySelector(".lt-h").onclick = ()=>card.classList.toggle("open");
    if(openIds.has(o.id)) card.classList.add("open");
    list.appendChild(card);
  });
}

