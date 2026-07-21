// app-analise.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Análise (incidência, scatter de risco, sub-aba Redações).
/* ============================================================
   ANÁLISE — incidência real por tópico (frequencia-data.js)
   ============================================================ */
const _FREQ = typeof FREQUENCIA !== "undefined" ? FREQUENCIA : null;

/* Rótulos e ordem dos concursos. UFRGS primeiro (é o alvo final), ENEM em seguida
   (é a prova que vem antes), agregado por último — somar os dois esconde a diferença. */
const AN_EXAMES = [
  { id:"UFRGS", nome:"UFRGS" },
  { id:"ENEM",  nome:"ENEM" },
  { id:"TODOS", nome:"Os dois (agregado)" },
];

function renderAnalise(){
  const lista = $("#anLista"), sel = $("#anDisc"), selEx = $("#anExame"), res = $("#anResumo");
  if(!_FREQ || !_FREQ.classificadas){
    sel.style.display = "none"; selEx.style.display = "none"; res.textContent = "";
    const _mc=$("#anMapCard"); if(_mc) _mc.style.display="none";
    lista.innerHTML = `<div class="card" style="color:var(--muted)">
      Ainda não há questões classificadas por tópico.<br><br>
      No terminal, na raiz do projeto:<br>
      <code>python3 pipeline/classificar_questoes.py</code> (usa a API do Gemini)<br>
      <code>python3 pipeline/cruzar_questoes.py && python3 pipeline/gerar_frequencia.py</code><br><br>
      Depois recarregue esta página.</div>`;
    return;
  }
  sel.style.display = ""; selEx.style.display = "";

  const porExame = _FREQ.porExame || { TODOS: { porDisc:_FREQ.porDisc, total:_FREQ.total,
    classificadas:_FREQ.classificadas, anos:_FREQ.anos } };
  const exames = AN_EXAMES.filter(e => porExame[e.id]);
  const exAtual = selEx.value && porExame[selEx.value] ? selEx.value : exames[0].id;
  selEx.innerHTML = exames.map(e=>`<option value="${e.id}"${e.id===exAtual?" selected":""}>${esc(e.nome)}</option>`).join("");
  selEx.onchange = renderAnalise;

  const fx = porExame[exAtual];
  const discs = Object.keys(fx.porDisc)
    .map(id => ({ id, nome: (DISCIPLINAS.find(d=>d.id===id)||{nome:id}).nome }))
    .sort((a,b)=>a.nome.localeCompare(b.nome));
  const atual = sel.value && fx.porDisc[sel.value] ? sel.value : discs[0].id;
  sel.innerHTML = discs.map(d=>`<option value="${d.id}"${d.id===atual?" selected":""}>${esc(d.nome)}</option>`).join("");
  sel.onchange = renderAnalise;

  const fd = fx.porDisc[atual];

  /* O SEU placar no concurso escolhido (as respostas do banco), cruzado com a
     incidência da banca. Sozinha, a incidência só diz o que cai; o que decide
     o que estudar é "cai muito E você erra". */
  const ACERTO = acertoPorTid(exAtual==="TODOS" ? null : exAtual);
  const selOrd = $("#anOrdem");
  const ordem = selOrd && selOrd.value==="prio" ? "prio" : "cai";
  if(selOrd) selOrd.onchange = renderAnalise;

  // todos os tópicos do edital (inclusive os com zero)
  const d = DISCIPLINAS.find(x=>x.id===atual);
  const tops = [];
  d.eixos.forEach((e,ei) => e.topicos.forEach((tp,ti) => {
    const f = fd.topicos[tp.nome], tid = topicId(atual, ei, ti), a = ACERTO[tid] || null;
    const n = f ? f.n : 0;
    tops.push({ nome: tp.nome, eixo: e.nome, n, tid, a, prio: n * riscoDe(a) });
  }));
  const max = Math.max(1, ...tops.map(t=>t.n));
  const esperado = fd.total / Math.max(1, tops.length);
  const meu = tops.reduce((s,t)=>({ resp:s.resp+(t.a?t.a.resp:0), ok:s.ok+(t.a?t.a.ok:0) }), {resp:0, ok:0});

  // os 3 alvos: maior incidência × maior risco. Ficam marcados nas duas ordenações.
  const alvos = tops.filter(t=>t.n>0).sort((x,y)=>y.prio-x.prio).slice(0,3);
  const alvoIds = new Set(alvos.map(t=>t.tid));

  tops.sort(ordem==="prio"
    ? (a,b)=> b.prio-a.prio || b.n-a.n || a.nome.localeCompare(b.nome)
    : (a,b)=> b.n-a.n || a.nome.localeCompare(b.nome));

  res.textContent = `${fx.classificadas}/${fx.total} questões classificadas · `
    + `${fd.total} nesta disciplina · anos ${fx.anos[0]}–${fx.anos[fx.anos.length-1]}`
    + (meu.resp ? ` · você respondeu ${meu.resp} (${Math.round(100*meu.ok/meu.resp)}% de acerto)` : "");

  const cabec = meu.resp
    ? `<div class="card" style="margin-bottom:14px">
        <div class="eyebrow" style="margin:0 0 6px">Atacar primeiro nesta disciplina</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:9px">
          O que mais cai (${exAtual==="TODOS"?"os dois concursos":esc(exAtual)}) × o que você erra — ou ainda
          não testou (sem respostas, o tópico entra com risco médio, não com risco zero).</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${alvos.map(t=>{
          const acc = t.a ? `${t.a.ok}/${t.a.resp}` : "não testado";
          return `<button class="btn" data-alvo="${t.tid}" title="resolver as ${t.n} questões deste tópico">
            🎯 ${esc(t.nome)} <span style="color:var(--faint);font-family:var(--mono);font-size:11px">${t.n}q · ${acc}</span></button>`;
        }).join("")}</div></div>`
    : `<div class="card" style="margin-bottom:14px;color:var(--muted);font-size:13px">
        Você ainda não respondeu questões desta disciplina no <b>Banco de questões</b> — por isso a coluna
        <b>seu acerto</b> está vazia. Responda algumas (clique num tópico abaixo) e esta tela passa a
        cruzar <i>o que mais cai</i> com <i>o que você erra</i>.</div>`;

  lista.innerHTML = cabec + `<div class="card">` + tops.map(t=>{
    const nivel = t.n >= esperado*1.5 ? "alta" : t.n <= esperado*0.6 ? "baixa" : "media";
    const cor = nivel==="alta" ? "var(--sunset)" : nivel==="media" ? "var(--azul)" : "var(--cinza)";
    const est = incidenciaDe(atual, t.nome);
    const diverge = est !== nivel;
    const pct = fd.total ? Math.round(100*t.n/fd.total) : 0;
    const alvo = alvoIds.has(t.tid);
    const acc = t.a
      ? `<span class="an-acc ${accCls(t.a)}" title="você acertou ${t.a.ok} das ${t.a.resp} que respondeu deste tópico">${t.a.ok}/${t.a.resp}</span>`
      : (t.n ? `<span class="an-acc" title="você ainda não respondeu questões deste tópico">—</span>` : "");
    return `<div class="an-row${alvo?" an-alvo":""}"${t.n?` data-tid="${t.tid}" title="abrir as ${t.n} questões deste tópico no banco"`:""}>
      <div><div style="font-size:14px">${alvo?"🎯 ":""}${esc(t.nome)}</div>
        <div style="font-size:11.5px;color:var(--faint)">${esc(t.eixo)}${diverge?` · estimada era <b>${est}</b>`:""}</div></div>
      <div class="an-bar" style="background:var(--raised);border-radius:6px;height:14px;overflow:hidden">
        <div style="width:${Math.round(100*t.n/max)}%;height:100%;background:${cor}"></div></div>
      <div class="an-num">${acc}<span>${t.n}q · ${pct}%${diverge?" ↕":""}${t.n?`<span class="an-go">›</span>`:""}</span></div>
    </div>`;
  }).join("") + `<div style="padding-top:10px;font-size:12px;color:var(--faint)">
    Barra = incidência na banca, comparada à distribuição uniforme (${esperado.toFixed(1)}q esperadas/tópico):
    <span style="color:var(--sunset)">alta ≥150%</span> ·
    <span style="color:var(--azul)">média</span> ·
    <span style="color:var(--cinza)">baixa ≤60%</span>.
    A pílula à direita é <b>o seu acerto</b> nas questões que você respondeu deste tópico
    (<span style="color:var(--verde)">≥70%</span> · <span style="color:var(--amarelo)">40–69%</span> ·
    <span style="color:var(--vermelho)">&lt;40%</span>); 🎯 marca os 3 tópicos onde cai muito e você erra.
    "estimada era" marca onde a incidência real contradiz a curadoria do Recursos.
    <b>Clique num tópico</b> para resolver as questões dele no banco.</div></div>`;
  lista.querySelectorAll(".an-row[data-tid]").forEach(r=>{
    r.onclick = ()=> bqDoTopico(r.dataset.tid, exAtual);
  });
  lista.querySelectorAll("[data-alvo]").forEach(b=>{
    b.onclick = ()=> bqDoTopico(b.dataset.alvo, exAtual);
  });
  renderAnaliseMapa(exAtual);
}

/* ============================================================
   Fase 3 (dataviz) — MAPA DE RISCO: scatter incidência × seu acerto.
   Cada ponto é um tópico do concurso (todas as disciplinas). X = quantas
   questões caem na banca (incidência); Y = seu acerto real (%). A zona
   vermelha (cai muito × você erra) é onde estudar rende mais ponto. Canvas
   puro: escalado por devicePixelRatio, cores lidas das CSS vars (acompanha
   o tema no próximo render), hit-test por Math.hypot p/ tooltip e clique.
   Só plota tópicos que você JÁ respondeu (têm Y); os demais viram o contador
   do estado vazio. Ver RELATORIO-DESIGN.md §Dataviz.
   ============================================================ */
var _anMapEx = null, _anMapDrawn = [], _anMapBound = false;
function anMapPontos(exAtual){
  const porExame = _FREQ.porExame || { TODOS:{ porDisc:_FREQ.porDisc } };
  const fx = porExame[exAtual] || porExame.TODOS;
  if(!fx) return { pts:[], semResp:0 };
  const ACERTO = acertoPorTid(exAtual==="TODOS" ? null : exAtual);
  const pts = []; let semResp = 0;
  DISCIPLINAS.forEach(d=>{
    const fd = fx.porDisc[d.id]; if(!fd) return;
    d.eixos.forEach((e,ei)=> e.topicos.forEach((tp,ti)=>{
      const f = fd.topicos[tp.nome], n = f ? f.n : 0; if(!n) return;
      const tid = topicId(d.id,ei,ti), a = ACERTO[tid];
      if(a && a.resp>0) pts.push({ nome:tp.nome, disc:d.nome, n, resp:a.resp, ok:a.ok, acc:a.ok/a.resp, tid });
      else semResp++;
    }));
  });
  return { pts, semResp };
}
function renderAnaliseMapa(exAtual){
  const cv = $("#anMap"); if(!cv) return;
  _anMapEx = exAtual;
  const card = $("#anMapCard"), empty = $("#anMapEmpty");
  if(card) card.style.display = "";
  const { pts, semResp } = anMapPontos(exAtual);
  if(!pts.length){
    cv.style.display = "none";
    if(empty){ empty.style.display = "";
      empty.innerHTML = semResp
        ? `Você ainda não respondeu questões (com tópico classificado) deste concurso. Responda algumas no <b>Banco de questões</b> — são <b>${semResp}</b> tópicos deste concurso esperando — e o mapa se desenha.`
        : `Sem incidência classificada para este concurso.`; }
    return;
  }
  cv.style.display = ""; if(empty) empty.style.display = "none";
  const wrap = cv.parentElement, cssW = Math.max(280, wrap.clientWidth), cssH = 260;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cssW*dpr); cv.height = Math.round(cssH*dpr);
  cv.style.width = cssW+"px"; cv.style.height = cssH+"px";
  const g = cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,cssW,cssH);
  const cs = getComputedStyle(document.documentElement), C = n=>cs.getPropertyValue(n).trim();
  const faint=C('--faint'), border=C('--border-soft'), surf=C('--surface'), mono=C('--mono')||'monospace';
  const verde=C('--verde'), amarelo=C('--amarelo'), vermelho=C('--vermelho');
  const padL=40, padR=14, padT=14, padB=30, PW=cssW-padL-padR, PH=cssH-padT-padB;
  const maxN = Math.max(...pts.map(p=>p.n)), niceMax = Math.max(5, Math.ceil(maxN/5)*5);
  const xOf = n => padL + (n/niceMax)*PW, yOf = acc => padT + (1-acc)*PH;
  // zona de perigo: cai muito (x ≥ 40% do máximo) × erra (y < 50%)
  g.save(); g.globalAlpha=.09; g.fillStyle=vermelho;
  g.fillRect(xOf(niceMax*0.4), yOf(0.5), xOf(niceMax)-xOf(niceMax*0.4), yOf(0)-yOf(0.5)); g.restore();
  // grades horizontais 0/25/50/75/100% com rótulo
  g.font = "10px "+mono; g.lineWidth=1;
  for(let p=0;p<=100;p+=25){ const y=yOf(p/100);
    g.strokeStyle=border; g.beginPath(); g.moveTo(padL,y); g.lineTo(cssW-padR,y); g.stroke();
    g.fillStyle=faint; g.textAlign="right"; g.textBaseline="middle"; g.fillText(p+"%", padL-6, y);
  }
  g.fillStyle=faint; g.textAlign="center"; g.textBaseline="alphabetic";
  g.fillText("questões que caem na banca →", padL+PW/2, cssH-8);
  // pontos (menor incidência primeiro, p/ os grandes ficarem por cima)
  _anMapDrawn = [];
  pts.slice().sort((a,b)=>a.n-b.n).forEach(p=>{
    const x=xOf(p.n), y=yOf(p.acc);
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI*2);
    g.fillStyle = p.acc>=.7 ? verde : p.acc>=.4 ? amarelo : vermelho; g.fill();
    g.lineWidth=1.5; g.strokeStyle=surf; g.stroke();
    _anMapDrawn.push({ x, y, ...p });
  });
  if(!_anMapBound){ _anMapBound = true; bindAnMap(cv); }
}
function _anMapHit(cv, ev){
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  let best=null, bd=1e9;
  for(const p of _anMapDrawn){ const d=Math.hypot(p.x-mx, p.y-my); if(d<bd){ bd=d; best=p; } }
  return bd<15 ? best : null;
}
function bindAnMap(cv){
  const tip = $("#anMapTip");
  cv.addEventListener("mousemove", ev=>{
    const h = _anMapHit(cv, ev);
    cv.style.cursor = h ? "pointer" : "crosshair";
    if(h && tip){ tip.style.display=""; tip.style.left=h.x+"px"; tip.style.top=h.y+"px";
      tip.innerHTML = `<b>${esc(h.nome)}</b><br>${esc(h.disc)}<br>${h.n} questões · acerto ${h.ok}/${h.resp} (${Math.round(h.acc*100)}%)`; }
    else if(tip) tip.style.display="none";
  });
  cv.addEventListener("mouseleave", ()=>{ if(tip) tip.style.display="none"; });
  cv.addEventListener("click", ev=>{ const h=_anMapHit(cv, ev); if(h) bqDoTopico(h.tid, _anMapEx); });
}
window.addEventListener("resize", ()=>{
  if(_anMapEx!=null && $("#tab-analise")?.classList.contains("on") && $("#anRed")?.style.display==="none")
    renderAnaliseMapa(_anMapEx);
});

/* ============================================================
   R3 — ANÁLISE · sub-aba "Redações": desempenho detalhado por
   banca (padrão Glau): nota média em anel, média por critério,
   última correção, evolução e estado vazio com CTA pro wizard.
   ============================================================ */
let anrBanca = null;
function anSubTab(which){
  $$("#tab-analise .an-tabs button").forEach(b=>b.classList.toggle("on", b.dataset.an===which));
  $("#anQuestoes").style.display = which==="q" ? "" : "none";
  $("#anRed").style.display = which==="red" ? "" : "none";
  if(which==="red") renderAnaliseRed();
}
function anrIrDesempenho(){ go("analise"); anSubTab("red"); }
function anrEscrever(b){
  if(typeof _RUBRICAS!=="undefined" && _RUBRICAS[b]){
    WIZ.banca=b; WIZ.passo=2;
    WIZ.filtro = PROPS().some(p=>p.banca===b) ? b : "todas";
  }
  go("redacao");
}
const anrBancaDe = r => (r.banca && _RUBRICAS[r.banca]) ? r.banca
  : _RUBRICAS[r.tipo] ? r.tipo
  : (!r.tipo || r.tipo==="livre") ? "glau"
  : null;   // banca sem rubrica no painel (ex.: UNESP importada) — só no histórico

function renderAnaliseRed(){
  const box=$("#anRed"); if(!box) return;
  const todas=S.redacoes.filter(r=>r.nota!=null && r.max>0 && anrBancaDe(r));
  const cont={}; todas.forEach(r=>{ const b=anrBancaDe(r); cont[b]=(cont[b]||0)+1; });
  const bancas=Object.keys(_RUBRICAS);
  if(!anrBanca || !bancas.includes(anrBanca))
    anrBanca = bancas.reduce((a,b)=>(cont[b]||0)>(cont[a]||0)?b:a, bancas[0]);

  const selHtml=`<div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div class="eyebrow" style="margin:0">Banca</div>
      <select id="anrSel">${bancas.map(b=>`<option value="${b}"${b===anrBanca?" selected":""}>${esc(_RUBRICAS[b].nome)}${cont[b]?` (${cont[b]})`:""}</option>`).join("")}</select>
      <span style="color:var(--muted);font-size:13px">${todas.length} redaç${todas.length===1?"ão":"ões"} no total · a escala muda por banca, por isso a análise é banca a banca</span>
    </div></div>`;

  const rb=_RUBRICAS[anrBanca];
  const rs=todas.filter(r=>anrBancaDe(r)===anrBanca)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));

  if(!rs.length){
    box.innerHTML = selHtml + `<div class="card" style="text-align:center;padding:40px 20px">
      <div style="font-size:34px;margin-bottom:10px">🌅</div>
      <div style="font-family:var(--serif);font-size:19px;margin-bottom:6px">Você ainda não tem correções na banca ${esc(rb.nome)}</div>
      <div style="color:var(--muted);font-size:13.5px;max-width:46ch;margin:0 auto 16px">Escreva uma redação pela rubrica ${esc(rb.nome)} no wizard — a correção automática alimenta esta análise, critério por critério.</div>
      <button class="btn primary" onclick="anrEscrever('${anrBanca}')">✍ Escrever pela rubrica ${esc(rb.nome)}</button>
    </div>`;
    bindAnrSel(); return;
  }

  /* Números da banca. A escala da rubrica pode MUDAR (a UFRGS virou 0–20 e a FUVEST 10–50
     quando foram conferidas na fonte), e as redações antigas ficaram gravadas na escala de
     então (r.max). Comparar r.nota cru contra rb.escala daria 45% para um 9/10. Por isso
     tudo aqui passa pela fração r.nota/r.max, reprojetada na escala atual. */
  const _naEscala = r => (r.max && r.max!==rb.escala) ? r.nota*rb.escala/r.max : r.nota;
  const media = rs.reduce((a,r)=>a+_naEscala(r),0)/rs.length;
  const melhor = rs.reduce((a,r)=>(r.nota/r.max)>(a.nota/a.max)?r:a);
  const pctMedia = media/rb.escala;
  const escMista = rs.some(r=>r.max!==rb.escala);
  const nIA = rs.filter(r=>r.fonte==="ia").length;
  const fmtN = v => rb.escala>=100 ? Math.round(v) : (Math.round(v*10)/10);

  // médias por critério (ENEM usa comp; demais usam r.criterios da correção IA)
  let crits=[];
  if(anrBanca==="enem"){
    const comps=rs.filter(r=>Array.isArray(r.comp));
    crits=ENEM_COMP.map((c,i)=>({ nome:`C${i+1} · ${c.curta}`, desc:c.nome, max:200,
      med: comps.length ? comps.reduce((a,r)=>a+(r.comp[i]||0),0)/comps.length : null, n:comps.length }));
  } else {
    const withC=rs.filter(r=>Array.isArray(r.criterios));
    crits=rb.criterios.map(c=>{
      const teto=c.max!=null?c.max:rb.escala;
      // nota de critério fora do teto = correção feita por uma versão ANTERIOR da rubrica
      // (escala diferente) — descartar em vez de estourar a barra.
      const vals=withC.map(r=>{ const k=r.criterios.find(x=>x.id===c.id); return k&&Number.isFinite(+k.nota)?+k.nota:null; })
        .filter(v=>v!=null && v<=teto);
      return { nome:c.curta, desc:c.desc, max:teto,
        med: vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : null, n:vals.length };
    });
  }
  const comMed=crits.filter(c=>c.med!=null);
  const fraco=comMed.length ? comMed.reduce((a,c)=>c.med/c.max<a.med/a.max?c:a) : null;

  // anel de nota média (gradiente pôr-do-sol)
  const R=52, CIRC=2*Math.PI*R, off=CIRC*(1-Math.max(0,Math.min(1,pctMedia)));
  const anel=`<svg width="150" height="150" viewBox="0 0 130 130" role="img" aria-label="nota média">
    <defs><linearGradient id="anrGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#d97f43"/><stop offset="1" stop-color="#ffd89b"/></linearGradient></defs>
    <circle cx="65" cy="65" r="${R}" fill="none" stroke="var(--raised)" stroke-width="11"/>
    <circle cx="65" cy="65" r="${R}" fill="none" stroke="url(#anrGrad)" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 65 65)"/>
    <text x="65" y="62" text-anchor="middle" fill="var(--ink)" font-size="23" font-weight="700" font-family="var(--mono)">${fmtN(media)}</text>
    <text x="65" y="82" text-anchor="middle" fill="var(--faint)" font-size="11">/ ${rb.escala}</text></svg>`;

  const kpi=(n,l,sub,clr)=>`<div class="kpi"><div class="n" style="color:${clr||"var(--ink)"}">${n}</div><div class="l">${l}</div>${sub?`<div class="sub">${sub}</div>`:""}</div>`;

  const barras=crits.map(c=>{
    const pct=c.med!=null?Math.round(100*c.med/c.max):0;
    const isFraco=fraco && c===fraco && comMed.length>1;
    return `<div class="anr-crit${isFraco?" fraco":""}" title="${esc(c.desc)}">
      <div class="cr-top"><span>${esc(c.nome)}${isFraco?' <b style="color:var(--vermelho);font-size:11px">← ponto fraco</b>':""}</span>
        <span class="v">${c.med!=null?`${fmtN(c.med)}/${c.max} · ${pct}%`:"sem dados"}</span></div>
      <div class="trilho"><i style="width:${pct}%"></i></div></div>`;
  }).join("");

  // última corrigida da banca
  const ult=[...rs].reverse().find(r=>r.criterios) || rs[rs.length-1];
  const ultHtml=`<div class="card" style="margin-bottom:16px">
    <div class="eyebrow">Última redação corrigida · ${esc(rb.nome)}</div>
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin:6px 0 4px">
      <b style="font-size:15px">${esc(ult.tema||"(sem tema)")}</b>
      <span class="tag">${esc(ult.date)}</span>
      <span style="font-family:var(--mono);font-weight:700;font-size:18px;color:var(--sunset);margin-left:auto">${ult.nota}/${ult.max}</span></div>
    ${ult.comentarioIA?`<p style="font-size:13px;color:var(--muted);line-height:1.6;margin:4px 0 10px">${esc(ult.comentarioIA)}</p>`:""}
    ${ult.criterios?`<div class="red-comps">${ult.criterios.map(c=>`<span>${esc(c.id)} ${c.nota}</span>`).join("")}</div>`:""}
    <div class="toolbar" style="margin:10px 0 0">
      ${(ult.criterios||ult.texto)?`<button class="chip" onclick="relerCorrecao('${ult.id}')">reler correção completa</button>`:""}
      <button class="chip" onclick="reescrever('${ult.id}')">reescrever este tema</button>
    </div></div>`;

  // evolução na banca
  const W=720,H=170,padL=40,padR=16,padT=14,padB=26;
  const step=(W-padL-padR)/Math.max(rs.length,2);
  const pts=rs.map((r,i)=>({x:padL+step*(i+0.5), y:H-padB-(r.nota/r.max)*(H-padT-padB), r}));
  const grid=[0,.5,1].map(g=>{const y=H-padB-g*(H-padT-padB);
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border-soft)"/>
      <text x="${padL-6}" y="${y+3}" fill="var(--faint)" font-size="10" text-anchor="end">${fmtN(rb.escala*g)}</text>`;}).join("");
  const linha=pts.length>1?`<polyline points="${pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="var(--sunset-deep)" stroke-width="1.5"/>`:"";
  const dots=pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--sunset)"><title>${esc(p.r.date)} · ${p.r.nota}/${p.r.max}</title></circle>
    <text x="${p.x.toFixed(1)}" y="${H-8}" fill="var(--faint)" font-size="9" text-anchor="middle">${esc(p.r.date.slice(5))}</text>`).join("");
  const evoHtml=`<div class="card"><div class="eyebrow">Evolução na banca ${esc(rb.nome)}</div>
    <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:520px">${grid}${linha}${dots}</svg></div></div>`;

  box.innerHTML = selHtml
    + `<div class="grid kpis" style="margin-bottom:16px">`
      + kpi(rs.length, "redações na banca", `${nIA} corrigida${nIA===1?"":"s"} pela IA`, "var(--sunset)")
      + kpi(`${Math.round(pctMedia*100)}%`, "média (% da escala)", `${fmtN(media)}/${rb.escala}${escMista?" · reescalado*":""}`, "var(--azul)")
      + kpi(`${melhor.nota}/${melhor.max}`, "melhor nota", esc((melhor.tema||"").slice(0,40)), "var(--verde)")
      + (fraco?kpi(esc(fraco.nome.replace(/ ·.*/,"")), "ponto fraco", "menor média entre os critérios", "var(--vermelho)"):"")
    + `</div>`
    + `<div class="anr-hero">
        <div class="anr-anel">${anel}<div class="eyebrow" style="margin:0">nota final média</div>
          <div style="font-size:11.5px;color:var(--muted);text-align:center">${pctMedia>=.8?"nível de aprovação — mantenha o ritmo":pctMedia>=.6?"boa base — ataque o ponto fraco abaixo":"em construção — cada correção ensina onde subir"}</div></div>
        <div class="card"><div class="eyebrow">Nota média por ${anrBanca==="enem"?"competência":"critério"}</div>${barras}
          ${comMed.length?"":`<div class="note-hint" style="margin-top:8px">Só correções pela IA (wizard) alimentam as barras por critério — registros manuais entram na média geral.</div>`}</div>
      </div>`
    + ultHtml + evoHtml
    + (escMista?`<div class="note-hint" style="margin-top:8px">* Algumas redações desta banca foram
        registradas numa escala anterior (ex.: /10) — a média as reprojeta na escala oficial atual
        (/${rb.escala}) pela fração da nota, para poder comparar.</div>`:"");
  bindAnrSel();
}
function bindAnrSel(){
  const s=$("#anrSel");
  if(s) s.onchange=()=>{ anrBanca=s.value; renderAnaliseRed(); };
}

function ytTopico(dNome, tpNome){
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(tpNome+" "+dNome+" vestibular ENEM UFRGS")}`;
}
/* ⑤ plataforma-guia: trio de busca (Google/YouTube/Wikipédia) + busca dentro de sites de ensino */
function googleTopico(dNome, tpNome){
  return `https://www.google.com/search?q=${encodeURIComponent(tpNome+" "+dNome+" vestibular ENEM UFRGS")}`;
}
function wikiTopico(tpNome){
  return `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(tpNome)}`;
}
const hostDe = url => { try{ return new URL(url).host.replace(/^www\./,""); }catch(e){ return (url||"").replace(/^https?:\/\//,"").split("/")[0]; } };
function siteBuscaUrl(host, dNome, tpNome){   // busca do tópico já mirada dentro de um site rico (via Google site:)
  return `https://www.google.com/search?q=${encodeURIComponent(tpNome+" "+dNome+" site:"+host)}`;
}
function sitesPara(discId){
  return _SITES.filter(s => s.tags.includes("todas") || s.tags.includes(discId) || s.tags.includes("oficial"));
}
function findDiscTopic(discId, tpNome){
  const d = DISCIPLINAS.find(x=>x.id===discId); if(!d) return null;
  for(let ei=0; ei<d.eixos.length; ei++){
    const ti = d.eixos[ei].topicos.findIndex(t=>t.nome===tpNome);
    if(ti>=0) return { d, ei, ti, tp:d.eixos[ei].topicos[ti] };
  }
  return { d, tp:{ nome:tpNome, subs:[] } };
}

function chanCard(c){
  const tipo = c.tipo==="canal"?"canal · YouTube" : c.tipo==="site"?"site" : c.tipo==="cofre"?"cofre local":"recurso";
  return `<a class="rec-chan ${c.tier}" href="${esc(c.url)}" ${c.tipo==="cofre"?"":'target="_blank" rel="noopener"'}>
    <div class="ch-top"><span class="ch-nm">${esc(c.nome)}</span><span class="ch-tier">${c.tier}</span></div>
    <span class="ch-tipo">${tipo}</span>
    <div class="ch-foco">${esc(c.foco)}</div></a>`;
}

/* ⑤ Recursos = PLATAFORMA-GUIA. Cada disciplina vira um bloco-guia com progresso + um
   esquema visual da temática (Mapa: grade por eixo · Trilha: ordem por pré-requisito) +
   os canais que ensinam. Clique num tópico abre o guia completo (openRecursos). */
let recVista = "mapa";   // "mapa" | "trilha" — como a temática é exibida (global à aba)
function setRecVista(v){ recVista = (v==="trilha") ? "trilha" : "mapa"; renderRecursos(); }

function renderRecursos(){
  const sel = $("#recDisc");
  if(sel && !sel.dataset.done){
    sel.dataset.done = 1;
    const o0=el("option"); o0.value="todas"; o0.textContent="Todas as disciplinas"; sel.appendChild(o0);
    DISCIPLINAS.forEach(d=>{ const o=el("option"); o.value=d.id; o.textContent=`${d.icon} ${d.nome}`; sel.appendChild(o); });
    sel.onchange = renderRecursos;
  }
  const which = sel ? sel.value : "todas";
  const discs = which==="todas" ? DISCIPLINAS : DISCIPLINAS.filter(d=>d.id===which);
  const nCanais = discs.reduce((a,d)=>a+canaisDe(d.id).length, 0);
  const nQ = discs.reduce((a,d)=>a+discQCount(d.id), 0);
  $("#recCount").textContent = `${nCanais} canais · ${_SITES.length} sites de ensino · ${nQ} quest${nQ===1?"ão":"ões"} marcada${nQ===1?"":"s"} (* = incidência observada)`;

  const body = $("#recBody"); body.innerHTML="";
  // barra de visão (mapa × trilha), global à aba
  const bar = el("div","rec-vista");
  bar.innerHTML = `<span class="rv-lb">ver a temática como</span>
    <button class="rv-btn${recVista==="mapa"?" on":""}" data-v="mapa" title="grade de tópicos por eixo, colorida pelo seu domínio">🗺 Mapa</button>
    <button class="rv-btn${recVista==="trilha"?" on":""}" data-v="trilha" title="ordem sugerida por pré-requisito (relacoes-data.js)">🧭 Trilha</button>`;
  bar.querySelectorAll(".rv-btn").forEach(b=>b.onclick=()=>setRecVista(b.dataset.v));
  body.appendChild(bar);

  discs.forEach(d=> body.appendChild(recGuiaDisc(d)));

  // sites de ensino gerais (uma vez, no rodapé)
  const sc = $("#recSites");
  if(sc && !sc.dataset.done){
    sc.dataset.done = 1;
    _SITES.forEach(s=>{
      sc.insertAdjacentHTML("beforeend",
        `<a class="rec-site" href="${esc(s.url)}" target="_blank" rel="noopener">
          <span class="st-nm">${esc(s.nome)}</span><span class="st-foco">${esc(s.foco)}</span></a>`);
    });
  }
}

// Um bloco-guia por disciplina: cabeçalho c/ progresso, o esquema visual (mapa|trilha) e os canais.
function recGuiaDisc(d){
  const block = el("div","rec-guia");
  const prog = discProgress(d);
  const tot = d.eixos.reduce((a,e)=>a+e.topicos.length,0);
  let dom=0; d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{ if(topicStatus(topicId(d.id,ei,ti))===2) dom++; }));
  const w = (typeof CURSOS!=="undefined" && CURSOS[S.curso]) ? (CURSOS[S.curso].pesos[d.prova]||1) : 1;
  const esquema = recVista==="trilha" ? recTrilhaHTML(d) : recMapaHTML(d);
  const chans = canaisDe(d.id).map(chanCard).join("") ||
    `<div class="empty" style="padding:12px;font-size:12.5px">Sem canais curados — use “onde aprender” em cada tópico.</div>`;
  block.innerHTML = `
    <div class="rec-guia-h">
      <span class="ic">${d.icon}</span>
      <span class="nm">${esc(d.nome)}</span>
      <span class="wt" title="peso no curso-alvo">×${w}</span>
      <span class="rg-prog"><i style="width:${Math.round(prog*100)}%"></i></span>
      <span class="rg-pct">${dom}/${tot}</span>
    </div>
    <div class="rec-esquema">${esquema}</div>
    <div class="rec-guia-canais"><div class="rg-sub">Quem ensina</div><div class="rec-chans">${chans}</div></div>`;
  block.querySelectorAll(".rec-tile[data-tid]").forEach(t=>{
    t.onclick = ()=>{ const i=TID2INFO[t.dataset.tid]; if(i) openRecursos(i.discId, i.tp); };
  });
  return block;
}

// tile de tópico, colorido pelo domínio, ★ na alta incidência — compartilhado por mapa e trilha.
function recTile(d, ei, ti){
  const tp = d.eixos[ei].topicos[ti];
  const tid = topicId(d.id, ei, ti);
  const st = topicStatus(tid);
  const info = incidenciaInfo(d.id, tp.nome);
  const obs = info.source==="observada";
  const alta = info.level==="alta";
  const qc = (typeof BQ_TID!=="undefined") ? BQ_TID[tid] : null;
  const cls = st===2?"t2":st===1?"t1":"t0";
  const tt = `${tp.nome} — ${st===2?"dominado":st===1?"em progresso":"não iniciado"} · incidência ${INC_LABEL[info.level]}${obs?" (observada)":""}${qc?` · ${qc.n} questões`:""}`;
  return `<button class="rec-tile ${cls}${alta?" alta":""}" data-tid="${tid}" title="${esc(tt)}"><span class="rt-dot"></span><span class="rt-tx">${esc(tp.nome)}</span>${alta?`<span class="rt-inc">★</span>`:""}${qc?`<span class="rt-q">${qc.n}q</span>`:""}</button>`;
}

// MAPA — grade de tópicos por eixo.
function recMapaHTML(d){
  return d.eixos.map((ex,ei)=>
    `<div class="rec-eixo"><div class="rec-eixo-nm">${esc(ex.nome)}</div>
      <div class="rec-tiles">${ex.topicos.map((tp,ti)=>recTile(d,ei,ti)).join("")}</div></div>`).join("")
    + recLegenda();
}
function recLegenda(){
  return `<div class="rec-legenda">
    <span><span class="lg t2"></span>dominado</span>
    <span><span class="lg t1"></span>em progresso</span>
    <span><span class="lg t0"></span>não iniciado</span>
    <span>★ alta incidência</span></div>`;
}

// TRILHA — ordem sugerida por pré-requisito: camadas topológicas dentro da disciplina.
function recTrilhaHTML(d){
  const pos = {}, tids = [];
  d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{ const t=topicId(d.id,ei,ti); pos[t]={ei,ti}; tids.push(t); }));
  const setLocal = new Set(tids);
  const reqDe = tid => (((typeof relDe==="function"?relDe(tid):null)||{}).req || []).filter(r=>setLocal.has(r));
  if(!tids.some(t=>reqDe(t).length)){
    return `<div class="rec-trilha-vazia">Sem pré-requisitos mapeados para esta disciplina — mostrando o <b>Mapa</b>.</div>`
      + recMapaHTML(d);
  }
  // profundidade = maior cadeia de pré-requisitos (memoizada, com proteção a ciclo)
  const depth={}, vis=new Set();
  const prof = tid => {
    if(depth[tid]!=null) return depth[tid];
    if(vis.has(tid)) return 0;
    vis.add(tid);
    const rs=reqDe(tid);
    const v = rs.length ? 1+Math.max(...rs.map(prof)) : 0;
    vis.delete(tid);
    return depth[tid]=v;
  };
  const camadas={}; tids.forEach(t=>{ (camadas[prof(t)] ||= []).push(t); });
  const niveis = Object.keys(camadas).map(Number).sort((a,b)=>a-b);
  const rotulo = i => i===0 ? "Comece por" : (i===niveis.length-1 ? "Reta final" : `Etapa ${i+1}`);
  return `<div class="rec-trilha">` + niveis.map((n,i)=>
    `<div class="rec-etapa">
      <div class="re-lb">${rotulo(i)}${i<niveis.length-1?' <span class="re-arw">↓</span>':""}</div>
      <div class="rec-tiles">${camadas[n].map(t=>recTile(d,pos[t].ei,pos[t].ti)).join("")}</div>
    </div>`).join("") + `</div>` + recLegenda();
}

/* diálogo: onde aprender ESTE tópico — encaminha direto aos links certos */
function openRecursos(discId, tpNome){
  const ft = findDiscTopic(discId, tpNome); if(!ft) return;
  const { d, tp } = ft;
  const info = incidenciaInfo(discId, tpNome);
  const obs = info.source==="observada";
  const incTitle = obs ? `observada em ${info.count}/${discQCount(discId)} questões marcadas` : "estimada (curadoria)";
  $("#dnRecTitle").innerHTML = `${d.icon} ${esc(tpNome)} <span class="inc ${info.level}${obs?" obs":""}" style="margin-left:6px" title="${esc(incTitle)}">${INC_LABEL[info.level]}${obs?"*":""}</span>`;
  const b = $("#dnRecBody"); b.innerHTML="";

  // 1) trio de busca já mirado no tópico
  let html = `<div class="rd-sec">Buscar este assunto</div>
    <div class="rd-trio">
      <a class="rd-chip" href="${googleTopico(d.nome, tpNome)}" target="_blank" rel="noopener">🔎 Google</a>
      <a class="rd-chip" href="${ytTopico(d.nome, tpNome)}" target="_blank" rel="noopener">▶ YouTube</a>
      <a class="rd-chip" href="${wikiTopico(tpNome)}" target="_blank" rel="noopener">📖 Wikipédia</a>
    </div>
    <div class="rd-foco" style="margin:2px 0 2px">buscas já montadas para "${esc(tpNome)}"</div>`;

  // sites de ensino ricos, com a busca já mirada dentro de cada
  const sitesEns = sitesPara(discId).filter(s => !s.tags.includes("oficial"));
  if(sitesEns.length){
    html += `<div class="rd-sec">Sites de ensino (busca no tópico)</div><div class="rd-trio">`
      + sitesEns.map(s=>`<a class="rd-chip" href="${siteBuscaUrl(hostDe(s.url), d.nome, tpNome)}" target="_blank" rel="noopener" title="${esc(s.foco)}">🏫 ${esc(s.nome)}</a>`).join("")
      + `</div>`;
  }

  // incidência: origem do dado + atalho para alimentar a contagem real
  const tidRec = NOME2TID[discId+"::"+tpNome];
  const qcRec  = tidRec ? BQ_TID[tidRec] : null;
  const acRec = tidRec ? acertoPorTid()[tidRec] : null;
  html += `<div class="rd-sec">Incidência nas provas</div>`;
  if(qcRec) html += `<a href="javascript:void(0)" id="rdVerBanco">📚 Resolver as ${qcRec.n} questões oficiais deste tópico
      <div class="rd-foco">${qcRec.UFRGS} da UFRGS · ${qcRec.ENEM} do ENEM — abre o banco já filtrado por este tópico${
        acRec?`. <b>Você acertou ${acRec.ok} das ${acRec.resp}</b> que já respondeu.`:""}</div></a>`;
  html += `<a href="javascript:void(0)" id="rdAddQ">＋ Cadastrar questão deste tópico
      <div class="rd-foco">${obs
        ? `Observada: ${info.count} de ${discQCount(discId)} questões marcadas em ${esc(d.nome)}. Cada questão nova refina esta leitura.`
        : `Ainda usando a estimativa curada (<b>${INC_LABEL[info.level]}</b>). Marque questões das provas antigas para o painel medir a incidência real.`}</div></a>`;

  // encaminhamento: pré-requisitos e conexões (a "trilha" no nível do tópico)
  if(tidRec && typeof relTemAlgo==="function" && relTemAlgo(tidRec)){
    html += `<div class="rd-sec">Encaminhamento</div>
    <a href="javascript:void(0)" id="rdRel">🧭 Ver pré-requisitos e conexões deste tópico
      <div class="rd-foco">o que estudar antes e com o que este assunto se conecta</div></a>`;
  }

  // 2) canais da disciplina (avaliados)
  const chans = canaisDe(discId);
  if(chans.length){
    html += `<div class="rd-sec">Quem propaga este assunto (${esc(d.nome)})</div>`;
    chans.forEach(c=>{
      html += `<a href="${esc(c.url)}" ${c.tipo==="cofre"?"":'target="_blank" rel="noopener"'}>
        ${esc(c.nome)} <span style="color:var(--faint);font-size:11px">· ${c.tier}</span>
        <div class="rd-foco">${esc(c.foco)}</div></a>`;
    });
  }

  // 3) sua nota — cofre Obsidian (Alex) OU leitura no painel (web, sem Obsidian)
  const temBase = tidRec && typeof NOTAS_BASE!=="undefined" && !!NOTAS_BASE[tidRec];
  if(!semCofre()){
    html += `<div class="rd-sec">No seu cofre Obsidian</div>
    <a href="${obsUrl(d, tp)}">🗂 Abrir a nota "${esc(tpNome)}"
      <div class="rd-foco">resumo, fórmulas, pegadinhas e relacionados — linkado no grafo</div></a>`;
  } else if(temBase){
    html += `<div class="rd-sec">Nota de estudo</div>
    <a href="javascript:void(0)" id="rdVerNota">📖 Ler a nota "${esc(tpNome)}" no painel
      <div class="rd-foco">resumo, fórmulas e pegadinhas — e você pode anotar aqui mesmo</div></a>`;
  }

  b.innerHTML = html;
  const add = $("#rdAddQ");
  if(add) add.onclick = ()=>{ $("#dlgRec").close(); openQ({ disc:discId, topico:tpNome }); };
  const vb = $("#rdVerBanco");
  if(vb) vb.onclick = ()=>{ $("#dlgRec").close(); bqDoTopico(tidRec); };
  const vn = $("#rdVerNota");
  if(vn) vn.onclick = ()=>{ $("#dlgRec").close(); openNote(tidRec, `${d.nome} — ${tpNome}`, obsUrl(d,tp)); };
  const rr = $("#rdRel");
  if(rr) rr.onclick = ()=>{ $("#dlgRec").close(); if(typeof openRelacoes==="function") openRelacoes(tidRec); };
  $("#dlgRec").showModal();
}

