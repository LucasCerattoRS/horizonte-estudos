// app-painel.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Simulador de argumento, Painel (home), Área de foco.
/* ============================================================
   SIMULADOR DE ARGUMENTO
   ============================================================ */
let simEP = {};
function renderSim(){
  const pesos=CURSOS[S.curso].pesos;
  const rows=$("#simRows"); rows.innerHTML="";
  PROVAS.forEach(pv=>{
    if(simEP[pv]==null) simEP[pv]=500;
    const row=el("div","sim-row");
    row.innerHTML=`
      <span class="pn">${PROVA_NOME[pv]}</span>
      <input type="range" min="300" max="800" value="${simEP[pv]}" data-pv="${pv}">
      <span class="ep" id="ep-${pv}">${simEP[pv]}</span>
      <span class="pw">×${pesos[pv]}</span>`;
    row.querySelector("input").oninput=e=>{ simEP[pv]=+e.target.value; $("#ep-"+pv).textContent=simEP[pv]; computeSim(); };
    rows.appendChild(row);
  });
  $("#simCurso").textContent=`Pesos de ${CURSOS[S.curso].nome} (soma 15)`;
  computeSim();
}
function computeSim(){
  const pesos=CURSOS[S.curso].pesos;
  let num=0,den=0,arit=0,minEP=Infinity,wsum=0;
  PROVAS.forEach(pv=>{ const ep=simEP[pv]||500, w=pesos[pv]||1;
    num+=w; den+=w/ep; arit+=ep*w; wsum+=w; minEP=Math.min(minEP,ep); });
  const mh=num/den;             // média harmônica ponderada
  const ma=arit/wsum;           // aritmética ponderada
  $("#simBig").textContent=mh.toFixed(1);
  $("#simArit").textContent=ma.toFixed(1);
  $("#simMin").textContent=minEP.toFixed(0);
  // avisa se há prova de peso alto com EP baixo
  const bleed=PROVAS.some(pv=>(pesos[pv]>=2)&&(simEP[pv]<480));
  $("#simWarn").classList.toggle("on",bleed);
}
function simPreset(v){ PROVAS.forEach(pv=>simEP[pv]=v); renderSim(); }
function simFromDom(){
  // estima EP a partir do domínio: 500 + (domínio_prova - 0.5)*220
  const byProva={};
  DISCIPLINAS.forEach(d=>(byProva[d.prova] ||= []).push(discProgress(d)));
  PROVAS.forEach(pv=>{
    const arr=byProva[pv]||[0.3]; const avg=arr.reduce((a,b)=>a+b,0)/arr.length;
    simEP[pv]=Math.round(Math.max(320,Math.min(780, 460 + avg*300)));
  });
  renderSim();
}

/* ============================================================
   PAINEL (home)
   ============================================================ */
function renderPainel(){
  const wp=weightedProgress(), op=overallProgress();
  $("#hsDom").textContent=Math.round(wp*100)+"%";
  $("#hsDue").textContent=dueCards().length;
  $("#hsStreak").textContent=studyStreak();
  $("#hsDias").textContent=daysBetween(Date.now(),PROVA_TESTE.getTime());
  // it.10: chip da fase macro no Hero (liga ao Cronograma de 16 meses; some se fases-data ausente)
  const fa=faseAtual(), chip=$("#heroFase");
  if(chip){ if(fa){ chip.innerHTML=`<span class="fc-ic">${fa.icon}</span><b>${esc(fa.nome)}</b> · ${esc(fa.janela)}`; chip.style.display=""; } else chip.style.display="none"; }
  drawHorizonte(op);
  renderTrilha();
  renderHomeDiscs();
  renderFoco();
}
/* ============================================================
   TRILHA DE ARRANQUE — o "norte visível" (FASE 5 · 2026-07-19)
   Ponto de partida cativante e no ritmo do usuário: a semana atual (foco
   exatas, começando por Português+Redação+Mat+Física), o próximo passo
   concreto e uma progressão que abre p/ humanas. Ao terminar, passa o bastão
   ao "Foco da semana". Dados curados em TRILHA (fases-data.js). Estado:
   S.trilha.semana (1..N; >N = concluída). Ritmado por quem avança, não pelo relógio.
   ============================================================ */
function trilhaSubj(code){
  if(code==="redacao") return { nome:"Redação", icon:"✍️", ir:()=>go("redacao") };
  // Prova "LP" tem DUAS disciplinas (Língua Portuguesa "port" + Redação "red"). A trilha
  // usa o pseudo-código "redacao" p/ a aba de escrita, então o código de prova deve cair na
  // disciplina de CONTEÚDO — exclui "red" e não depende da ordem do array.
  const cands=(typeof DISCIPLINAS!=="undefined") ? DISCIPLINAS.filter(x=>x.prova===code) : [];
  const d = cands.find(x=>x.id!=="red") || cands[0];
  if(d) return { nome:d.nome, icon:d.icon, ir:()=>{ go("edital");
    setTimeout(()=>{ const c=$(`#editalDiscs .disc[data-disc="${d.id}"]`); c?.classList.add("open"); c?.scrollIntoView({block:"center"}); },80); } };
  return { nome:code, icon:"•", ir:()=>go("edital") };
}
function trilhaAvancar(){ const N=TRILHA.semanas.length; S.trilha={semana:Math.min(N+1,(S.trilha?.semana||1)+1)}; save(); renderTrilha(); }
function trilhaReiniciar(){ S.trilha={semana:1}; save(); renderTrilha(); }
function renderTrilha(){
  const box=$("#trilhaArranque"); if(!box) return;
  if(typeof TRILHA==="undefined" || !TRILHA.semanas || !TRILHA.semanas.length){ box.innerHTML=""; box.className=""; return; }
  const N=TRILHA.semanas.length;
  if(!S.trilha || !S.trilha.semana) S.trilha={semana:1};
  const n=Math.max(1, S.trilha.semana|0);
  box.className="card"; box.style.cssText="margin-bottom:16px;border-left:3px solid var(--sunset)";
  if(n>N){                                      // concluída → entrega o bastão ao Foco da semana
    box.innerHTML=`<div class="eyebrow">Trilha de arranque · concluída 🌅</div>
      <div style="font-size:16px;font-weight:700;margin:6px 0 4px">Você engatou. Agora o <span style="color:var(--sunset)">Foco da semana</span> assume o leme.</div>
      <p style="color:var(--muted);font-size:13px;line-height:1.55;margin:0 0 12px">Ele prioriza sozinho: peso do curso × incidência real × a sua lacuna. Não precisa mais escolher por onde começar — é só seguir.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" data-a="foco">Ver o Foco da semana ↓</button>
        <button class="btn ghost" data-a="reiniciar">↻ Refazer a trilha</button>
      </div>`;
    box.querySelector('[data-a="foco"]').onclick=()=>document.getElementById('foco')?.scrollIntoView({behavior:'smooth',block:'center'});
    box.querySelector('[data-a="reiniciar"]').onclick=trilhaReiniciar;
    return;
  }
  const wk=TRILHA.semanas[n-1];
  const subs=wk.nucleo.map(trilhaSubj);
  const chips=subs.map((s,i)=>`<button data-i="${i}" style="display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid ${i===0?'var(--sunset)':'var(--line,rgba(128,128,128,.28))'};background:var(--raised);color:var(--ink);font:inherit;font-size:13px;cursor:pointer;font-weight:${i===0?'700':'500'}"><span>${s.icon}</span>${esc(s.nome)}</button>`).join("");
  const dots=TRILHA.semanas.map((_,i)=>`<i style="width:${i===n-1?'18px':'7px'};height:7px;border-radius:999px;background:${i<=n-1?'var(--sunset)':'var(--line,rgba(128,128,128,.3))'};display:inline-block;opacity:${i<=n-1?1:.5}"></i>`).join("");
  const primeiro=subs[0];
  box.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="eyebrow">Sua trilha de arranque · foco exatas</div>
      <div style="display:flex;align-items:center;gap:5px" title="Semana ${n} de ${N}">${dots}<span style="color:var(--muted);font-size:12px;margin-left:5px">Semana ${n}/${N}</span></div>
    </div>
    <div style="font-size:17px;font-weight:700;margin:8px 0 4px">${esc(wk.titulo)}</div>
    <p style="color:var(--muted);font-size:13px;line-height:1.55;margin:0 0 12px">${esc(wk.nota)}${n===1&&TRILHA.intro?`<br><span style="opacity:.85">${esc(TRILHA.intro)}</span>`:""}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${chips}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn primary" data-a="passo">${primeiro.icon} Próximo passo: ${esc(primeiro.nome)} →</button>
      <button class="btn ghost" data-a="avancar">✓ Concluí esta semana</button>
      ${n>1?`<button class="btn ghost" data-a="reiniciar" title="voltar à Semana 1" style="opacity:.7">↻</button>`:""}
    </div>`;
  box.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>subs[+b.dataset.i].ir());
  box.querySelector('[data-a="passo"]').onclick=()=>primeiro.ir();
  box.querySelector('[data-a="avancar"]').onclick=trilhaAvancar;
  const rb=box.querySelector('[data-a="reiniciar"]'); if(rb) rb.onclick=trilhaReiniciar;
}
/* anel de progresso (donut) — eco do "nota média" do Glau; azul Guaíba = progresso.
   Cor via CSS (.ring .rt/.rp/text), não por atributo (var() não resolve em atributo). */
function ringSVG(p){
  const r=18, C=2*Math.PI*r, off=(C*(1-Math.max(0,Math.min(1,p||0)))).toFixed(1);
  return `<svg class="ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
    <circle class="rt" cx="22" cy="22" r="${r}" fill="none" stroke-width="4"/>
    <circle class="rp" cx="22" cy="22" r="${r}" fill="none" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 22 22)"/>
    <text x="22" y="22" text-anchor="middle" dominant-baseline="central" font-size="11">${Math.round((p||0)*100)}</text>
  </svg>`;
}
/* R1: cards compactos por disciplina — anel de domínio, x/y tópicos, clique abre o edital */
function renderHomeDiscs(){
  const box=$("#painelDiscs"); if(!box) return; box.innerHTML="";
  const irEdital=id=>{ go("edital");
    setTimeout(()=>{ const c=$(`#editalDiscs .disc[data-disc="${id}"]`); c?.classList.add("open"); c?.scrollIntoView({block:"center"}); },80); };
  DISCIPLINAS.forEach(d=>{
    let tot=0,done=0,half=0;
    d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
      tot++; const s=topicStatus(topicId(d.id,ei,ti));
      if(s===2)done++; else if(s===1)half++;
    }));
    const prog=discProgress(d), w=CURSOS[S.curso].pesos[d.prova]||1;
    const c=el("button","hd");
    c.innerHTML=`${ringSVG(prog)}
      <div class="hd-tx">
        <header>${d.icon} ${esc(d.nome)}<span class="peso" title="peso no curso-alvo">×${w}</span></header>
        <div class="meta">${done}/${tot} dominados${half?` · ${half} em progresso`:""}</div>
      </div>`;
    c.onclick=()=>irEdital(d.id);
    box.appendChild(c);
  });
}
/* R1: foco da semana por TÓPICO — peso do curso × incidência real (UFRGS) × lacuna
   de domínio, com o porquê visível. Sem frequência classificada, cai para o
   ranking antigo por disciplina. */
/* ============================================================
   ÁREA DE FOCO — prioriza um bloco de disciplinas no "Foco da semana".
   Por perfil: o Alex quer EXATAS (déficit dele); a Bia confirma na 1ª vez.
   ============================================================ */
const FOCOS = {
  exatas:     { nome:"Exatas",      icon:"📐", provas:["MAT","FIS","QUI"] },
  biologicas: { nome:"Biológicas",  icon:"🧬", provas:["BIO","QUI"] },
  humanas:    { nome:"Humanas",     icon:"🌎", provas:["HIS","GEO"] },
  linguagens: { nome:"Linguagens",  icon:"📖", provas:["LP","LIT","LEM"] },
};
function focoInferido(curso){                       // maior peso agregado por área (empate → exatas)
  const pesos=(CURSOS[curso]||{}).pesos||{};
  let best="exatas", bestW=-1;
  for(const [k,f] of Object.entries(FOCOS)){
    const w=f.provas.reduce((a,pv)=>a+(pesos[pv]||0),0);
    if(w>bestW){ bestW=w; best=k; }
  }
  return best;
}
function focoProvas(){ return (FOCOS[S.foco]||FOCOS.exatas).provas; }
function ensureFoco(){
  if(S.foco && FOCOS[S.foco]) return;
  const ehSeed = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && IDX.active==="seed");
  S.foco = ehSeed ? focoInferido(S.curso) : "exatas";   // Alex → exatas; seed → infere e confirma
  S.focoConfirmado = false;
  save();
}
function setFoco(a){
  if(!FOCOS[a]) return;
  S.foco=a; S.focoConfirmado=true; save();
  if($("#tab-painel")?.classList.contains("on")) renderPainel(); else renderFoco();
}
function confirmarFoco(){ S.focoConfirmado=true; save(); renderFoco(); }
function focoBanner(){
  if(S.focoConfirmado) return null;
  const f=FOCOS[S.foco]||FOCOS.exatas;
  const opts=Object.entries(FOCOS).map(([k,v])=>`<option value="${k}"${k===S.foco?" selected":""}>${v.icon} ${v.nome}</option>`).join("");
  const b=el("div","foco-banner card");
  b.style.cssText="border:1px dashed var(--sunset);background:var(--raised);margin-bottom:10px";
  b.innerHTML=`<div style="font-size:13.5px;line-height:1.55">
      <b>${f.icon} Sua área de foco: ${esc(f.nome)}.</b> O <b>Foco da semana</b> vai priorizar essas matérias.
      Quer manter ou trocar? Você pode mudar quando quiser.</div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <button class="btn primary" data-a="ok">✓ Manter ${esc(f.nome)}</button>
      <span style="color:var(--muted);font-size:12.5px">ou trocar:</span>
      <select data-a="sel">${opts}</select>
    </div>`;
  b.querySelector('[data-a="ok"]').onclick=confirmarFoco;
  b.querySelector('[data-a="sel"]').onchange=e=>setFoco(e.target.value);
  return b;
}
function focoRedacaoNudge(){
  const n=S.redacoes.length;
  const row=el("div","foco-card");
  row.innerHTML=`<div class="fc-t">📝 Redação — treine uma pela banca</div>
    <div class="why">peso <b>×3</b> na maioria dos cursos${n?` · você já registrou <b>${n}</b>`:" · você ainda não treinou nenhuma"} · escreva pela rubrica oficial da banca e lance a nota</div>
    <div class="fc-acts"><button class="btn ghost" data-a="red">✍ Escrever agora</button></div>`;
  row.querySelector('[data-a="red"]').onclick=()=>go("redacao");
  return row;
}

function renderFoco(){
  const foco=$("#foco"); if(!foco) return; ensureFoco(); foco.innerHTML="";
  const bn=focoBanner(); if(bn) foco.appendChild(bn);
  const _fpv=focoProvas();
  const pesos=CURSOS[S.curso].pesos;
  const irEdital=id=>{ go("edital");
    setTimeout(()=>{ const c=$(`#editalDiscs .disc[data-disc="${id}"]`); c?.classList.add("open"); c?.scrollIntoView({block:"center"}); },80); };
  const fx=(_FREQ && _FREQ.porExame) ? (_FREQ.porExame.UFRGS||_FREQ.porExame.TODOS) : null;
  const ACERTO=acertoPorTid();
  const itens=[];
  if(fx){
    DISCIPLINAS.forEach(d=>{
      const fd=fx.porDisc[d.id]; if(!fd||!fd.total) return;
      const w=pesos[d.prova]||1;
      d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
        const id=topicId(d.id,ei,ti), st=topicStatus(id);
        const a=ACERTO[id];
        const acc = (a && a.resp>=MIN_RESP) ? a.ok/a.resp : null;   // só decide com amostra
        const errando = acc!==null && acc<0.6;
        // dominado sai do foco — SALVO se as questões oficiais disserem o contrário
        if(st===2 && !errando) return;
        const stScore = (st===2) ? 1 : st;                          // "dominado mas errando" disputa como em progresso
        const f=fd.topicos[tp.nome], share=f?f.n/fd.total:0;
        const due=!!(S.topics[id]?.srs && S.topics[id].srs.due<=Date.now());
        const fatorAcerto = acc===null ? 1 : 0.5+1.5*(1-acc);       // erra muito → sobe; acerta tudo → desce
        const naFoco = _fpv.includes(d.prova);                       // sua área de foco pesa mais
        const score=(w*(0.4+share*6)*(1-stScore*0.4)+(due?0.6:0))*fatorAcerto*(naFoco?2.2:1);
        itens.push({d,tp,id,st,w,share,due,score,a,acc,errando,naFoco});
      }));
    });
    itens.sort((a,b)=>b.score-a.score);
  }
  if(itens.length){
    /* Duas coisas diferentes, e misturá-las escondia a que importa:
       - RANKING: peso × incidência × lacuna × (seu acerto) — a aposta de maior retorno.
       - ALERTA: você marcou "dominado" e as questões oficiais te desmentem. Isso não
         disputa ranking (a incidência de um tópico qualquer sempre ganharia): entra na
         frente, porque é o único ponto onde o painel sabe algo que você não sabe. */
    const alerta = itens.filter(x=>x.st===2 && x.errando).sort((a,b)=>a.acc-b.acc);
    const resto  = itens.filter(x=>!(x.st===2 && x.errando));
    // no máx. 2 tópicos por disciplina → a semana fica variada (ex.: Mat + outra de exatas), não 4× a mesma
    const perDisc={}, escolhidos=[];
    for(const x of [...alerta, ...resto]){
      if(escolhidos.length>=4) break;
      const c=perDisc[x.d.id]||0; if(c>=2) continue;
      perDisc[x.d.id]=c+1; escolhidos.push(x);
    }
    escolhidos.forEach(x=>{
      const pct=Math.round(x.share*100);
      const qc=BQ_TID[x.id];
      const row=el("div","foco-card"+(x.st===2&&x.errando?" alerta":"")+(x.naFoco?" naFoco":""));
      row.innerHTML=`<div class="fc-t">${x.d.icon} ${esc(x.d.nome)} — ${esc(x.tp.nome)}${x.naFoco?` <span class="tag" style="color:var(--sunset);border-color:var(--sunset-deep);white-space:nowrap">sua área de foco</span>`:""}</div>
        <div class="why">peso <b>×${x.w}</b> no seu curso${pct?` · cai em <b>${pct}%</b> das questões UFRGS de ${esc(x.d.nome)}`:""} · ${x.st===2?"dominado":x.st===1?"em progresso":"não iniciado"}${x.due?` · <b style="color:var(--vermelho)">revisão vence hoje</b>`:""}${
          x.a?` · você acertou <b>${x.a.ok}/${x.a.resp}</b> das questões oficiais`:""}${
          x.errando&&x.st===2?` · <b style="color:var(--vermelho)">marcou como dominado, mas está errando</b>`:""}</div>
        <div class="fc-acts">
          <button class="btn ghost" data-a="estudar">Estudar agora</button>
          ${qc?`<button class="btn ghost" data-a="questoes">🎯 ${qc.n} questões</button>`:""}
        </div>`;
      row.querySelector('[data-a="estudar"]').onclick=()=>irAoEdital(x.id);
      const bq=row.querySelector('[data-a="questoes"]');
      if(bq) bq.onclick=()=>bqDoTopico(x.id,"UFRGS");
      foco.appendChild(row);
    });
    foco.appendChild(focoRedacaoNudge());
    return;
  }
  // fallback sem frequencia-data: ranking por disciplina (comportamento antigo) — foco pesa mais
  DISCIPLINAS.map(d=>({d,p:discProgress(d),w:pesos[d.prova]||1,naFoco:_fpv.includes(d.prova)}))
    .map(x=>({...x, score:(1-x.p)*x.w*(x.naFoco?2.2:1)}))
    .sort((a,b)=>b.score-a.score).slice(0,4)
    .forEach(x=>{
      const row=el("div","foco-card"+(x.naFoco?" naFoco":""));
      row.innerHTML=`<div class="fc-t">${x.d.icon} ${esc(x.d.nome)}${x.naFoco?` <span class="tag" style="color:var(--sunset);border-color:var(--sunset-deep);white-space:nowrap">sua área de foco</span>`:""}</div>
        <div class="why">peso <b>×${x.w}</b> · ${Math.round(x.p*100)}% dominado</div>
        <button class="btn ghost" style="font-size:12px;padding:5px 12px">Estudar</button>`;
      row.querySelector("button").onclick=()=>irEdital(x.d.id);
      foco.appendChild(row);
    });
  foco.appendChild(focoRedacaoNudge());
}
/* Assinatura: horizonte do Guaíba que enche conforme o domínio */
function drawHorizonte(p){
  const svg=$("#horizonte"); if(!svg) return; svg.innerHTML="";
  const W=400,H=240;
  const defs=svgNS("defs");
  defs.innerHTML=`
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#12203a"/><stop offset="0.55" stop-color="#25344f"/>
      <stop offset="0.75" stop-color="#7a5a56"/><stop offset="1" stop-color="#f2a154"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9974a" stop-opacity="0.9"/><stop offset="1" stop-color="#1a2c44"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd89b"/><stop offset="0.6" stop-color="#f2a154"/><stop offset="1" stop-color="#f2a154" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);
  // céu
  svg.appendChild(svgNS("rect",{x:0,y:0,width:W,height:H,fill:"url(#sky)"}));
  // linha do horizonte sobe conforme o domínio (0 → base, 1 → alto)
  const horizonY = H*0.9 - p*(H*0.55);
  // sol: altura acompanha o progresso
  const sunY = horizonY - 6 - p*30;
  const sunR = 26 + p*14;
  svg.appendChild(svgNS("circle",{cx:W*0.5,cy:sunY,r:sunR,fill:"url(#sun)"}));
  svg.appendChild(svgNS("circle",{cx:W*0.5,cy:sunY,r:sunR*0.5,fill:"#ffe0a8"}));
  // água (reflexo)
  svg.appendChild(svgNS("rect",{x:0,y:horizonY,width:W,height:H-horizonY,fill:"url(#water)"}));
  // reflexo do sol
  svg.appendChild(svgNS("rect",{x:W*0.5-3,y:horizonY,width:6,height:H-horizonY,fill:"#ffd89b","opacity":0.4}));
  // marca de percentual: fica num overlay HTML (#heroPct), fora do SVG, pois o
  // preserveAspectRatio "slice" recorta o topo do SVG no celular e cortava o texto.
  const pct=$("#heroPct"); if(pct) pct.textContent=Math.round(p*100)+"% do horizonte";
}

