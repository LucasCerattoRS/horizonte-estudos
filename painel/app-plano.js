// app-plano.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. SM-2, Cronograma, Métricas + charts.
/* ============================================================
   SM-2 (repetição espaçada)
   Qualidade: 0=Errei 1=Difícil 2=Bom 3=Fácil  (mapeado p/ SM-2 q=2..5)
   ============================================================ */
function reviewCard(id, quality){
  const rec=tRec(id);
  const srs = rec.srs || (rec.srs={ease:2.5,interval:0,due:Date.now(),reps:0});
  const q = [2,3,4,5][quality]; // SM-2 quality
  if(q<3){ // só "Errei" (q=2) reinicia o intervalo; "Difícil" vira q=3 → cai no else e paga no ease
    srs.reps=0; srs.interval=1;
  }else{
    srs.reps++;
    if(srs.reps===1) srs.interval=1;
    else if(srs.reps===2) srs.interval=6;
    else srs.interval=Math.round(srs.interval*srs.ease);
  }
  srs.ease = Math.max(1.3, srs.ease + (0.1 - (5-q)*(0.08+(5-q)*0.02)));
  srs.due = Date.now() + srs.interval*DAY;
  // acertar "Bom/Fácil" numa revisão sinaliza domínio
  if(quality>=2 && srs.reps>=3) rec.status=2;
  else if(rec.status===0) rec.status=1;
  save();
  renderRevisao(); renderPainel();
}
function dueCards(){
  const now=Date.now();
  return allTopics()
    .filter(x=>{const r=S.topics[x.id]; return r&&r.srs&&r.srs.due<=now;})
    .sort((a,b)=>S.topics[a.id].srs.due - S.topics[b.id].srs.due);
}
function scheduledCards(){
  const now=Date.now();
  return allTopics()
    .filter(x=>{const r=S.topics[x.id]; return r&&r.srs&&r.srs.due>now;})
    .sort((a,b)=>S.topics[a.id].srs.due - S.topics[b.id].srs.due)
    .slice(0,8);
}

/* ============================================================
   CRONOGRAMA / REVISÃO — render
   ============================================================ */

/* FASE MACRO (16 meses) — o SM-2 é o micro (o que revisar hoje); isto é o
   macro (em que trecho da trajetória você está). Derivado de Date.now() +
   fases-data.js; NÃO lê nem grava o estado do usuário (S/localStorage). */
function faseAtual(ts=Date.now()){
  if(typeof FASES==="undefined" || !FASES.length) return null;
  const t = ts instanceof Date ? ts.getTime() : ts;
  for(const f of FASES){ if(t >= f.inicio.getTime() && t < f.fim.getTime()) return f; }
  return t < FASES[0].inicio.getTime() ? FASES[0] : FASES[FASES.length-1];
}
function renderFaseMacro(){
  const box=$("#faseMacro"); if(!box) return;
  const atual = faseAtual();
  if(!atual){ box.innerHTML=""; return; }               // fases-data.js ausente → some, sem quebrar a aba
  const now=Date.now();
  const inicioHoje=new Date(now); inicioHoje.setHours(0,0,0,0);  // atado a `now`: marco de HOJE ainda conta (não some à meia-noite do dia da prova)
  const ini=FASES[0].inicio.getTime();
  const alvo=(typeof DATA_ALVO!=="undefined"?DATA_ALVO:FASES[FASES.length-1].fim).getTime();
  const frac=Math.max(0,Math.min(1,(now-ini)/(alvo-ini)));
  const diasAlvo=Math.max(0,daysBetween(now,alvo));           // sem contagem negativa depois do alvo
  const passou=now>=alvo;
  const est=k=>typeof DATAS_ESTIMADAS!=="undefined" && DATAS_ESTIMADAS.has(k);  // data ainda é estimativa?
  const alvoEst=typeof ALVO_KEY!=="undefined" && est(ALVO_KEY);
  const NOMES={enem2026:"ENEM 2026",ufrgs2027:"UFRGS 2027",enem2027:"ENEM 2027",ufrgs2028:"UFRGS 2028"};
  // próximo marco cronológico (a próxima prova a partir de HOJE, inclusive o dia da prova)
  const prox=Object.entries(typeof DATAS_PROVA!=="undefined"?DATAS_PROVA:{})
    .map(([k,d])=>({k,t:d.getTime()})).filter(p=>p.t>=inicioHoje.getTime()).sort((a,b)=>a.t-b.t)[0];
  const temEst = alvoEst || (prox && est(prox.k));            // alguma data mostrada é estimativa?

  const trilha=FASES.map(f=>{
    const on=f.id===atual.id;
    return `<div class="fase-seg${on?" on":""}" title="${esc(f.resumo)}">
      <span class="fase-ic">${f.icon}</span>
      <span class="fase-nm">${esc(f.nome)}</span>
      <span class="fase-jn">${esc(f.janela)}</span>
    </div>`;
  }).join('<span class="fase-arw" aria-hidden="true">›</span>');
  const prio=(atual.prioridades||[]).map(p=>`<li>${esc(p)}</li>`).join("");

  box.innerHTML=`<div class="card fase-macro" style="margin-bottom:16px">
    <div class="eyebrow">Onde você está no preparo · plano de 16 meses</div>
    <div class="fase-trilha">${trilha}</div>
    <div class="fase-barra"><i style="width:${(frac*100).toFixed(1)}%"></i></div>
    <div class="fase-meta">
      ${passou
        ? `<span>🎯 ciclo de provas concluído · UFRGS 2028</span>`
        : `<span><b>${alvoEst?"≈":""}${diasAlvo}</b> dias até o alvo · UFRGS 2028</span>`}
      ${prox?`<span>próximo marco: <b>${esc(NOMES[prox.k]||prox.k)}</b> em ${est(prox.k)?"≈":""}${Math.max(0,daysBetween(now,prox.t))} dias</span>`:""}
    </div>
    ${temEst?`<div class="fase-nota">≈ datas de 2026–2028 ainda são estimativas (calendário oficial não publicado) — ajusto quando o INEP/COPERSE divulgarem</div>`:""}
    <div class="fase-agora">
      <div class="fase-agora-h">${atual.icon} Agora — ${esc(atual.nome)}</div>
      <div class="fase-agora-r">${esc(atual.resumo)}</div>
      <ul class="fase-prio">${prio}</ul>
    </div>
  </div>`;
}

function renderRevisao(){
  renderFaseMacro();
  // due list
  const due=dueCards();
  $("#dueCount").textContent=due.length;
  const dl=$("#dueList"); dl.innerHTML="";
  if(!due.length){ dl.appendChild(el("div","empty","Nada para revisar agora. 🎯<br>Comece um tópico no Mapa do Edital para alimentar a fila.")); }
  due.slice(0,25).forEach(x=>{
    const qc=BQ_TID[x.id];
    const row=el("div","due-item");
    row.innerHTML=`
      <span class="ic">${x.disc.icon}</span>
      <div class="info"><div class="t">${esc(x.topic.nome)}</div>
        <div class="m">${esc(x.disc.nome)}${qc?` · <button class="qlink" title="resolver as questões oficiais deste tópico — em vez de chutar se lembra">🎯 ${qc.n} questões oficiais</button>`:""}</div></div>
      <div class="srs-btns">
        <button class="b0">Errei</button><button class="b1">Difícil</button>
        <button class="b2">Bom</button><button class="b3">Fácil</button>
      </div>`;
    const bs=row.querySelectorAll(".srs-btns button");
    bs.forEach((b,i)=>b.onclick=()=>reviewCard(x.id,i));
    const ql=row.querySelector(".qlink");
    if(ql) ql.onclick=()=>bqDoTopico(x.id);
    dl.appendChild(row);
  });
  // scheduled
  const sl=$("#schedList"); sl.innerHTML="";
  const sched=scheduledCards();
  if(!sched.length) sl.appendChild(el("div","empty","Sem revisões futuras agendadas."));
  sched.forEach(x=>{
    const r=S.topics[x.id].srs;
    const d=daysBetween(Date.now(),r.due);
    const row=el("div","due-item");
    row.innerHTML=`<span class="ic">${x.disc.icon}</span>
      <div class="info"><div class="t">${esc(x.topic.nome)}</div>
      <div class="m">${esc(x.disc.nome)} · intervalo ${r.interval}d · facilidade ${r.ease.toFixed(2)}</div></div>
      <span class="mono" style="font-size:12px;color:var(--azul)">${d<=0?"hoje":"em "+d+"d"}</span>`;
    sl.appendChild(row);
  });
  renderWeek();
}
function renderWeek(){
  const w=$("#weekBars"); if(!w) return; w.innerHTML="";
  const days=[]; const now=new Date();
  for(let i=6;i>=0;i--){ const d=new Date(now-i*DAY); days.push(d.toISOString().slice(0,10)); }
  const totals={}; S.sessions.forEach(s=>{ totals[s.date]=(totals[s.date]||0)+s.min; });
  const max=Math.max(60,...days.map(d=>totals[d]||0));
  const names=["D","S","T","Q","Q","S","S"];
  let weekTotal=0;
  days.forEach(dk=>{
    const v=totals[dk]||0; weekTotal+=v;
    const dObj=new Date(dk+"T12:00");
    const c=el("div","d");
    c.innerHTML=`<div class="bar"><i style="height:${v/max*100}%"></i></div>
      <div class="lb">${names[dObj.getDay()]}</div><div class="vv">${v||""}</div>`;
    w.appendChild(c);
  });
  $("#weekTotal").textContent=`${Math.floor(weekTotal/60)}h${weekTotal%60}min nos últimos 7 dias · ${weekTotal} min`;
}
function logSession(){
  const disc=$("#logDisc").value;
  const min=parseInt($("#logMin").value,10);
  if(!min||min<1) return;
  S.sessions.push({date:todayKey(), min, disc});
  save(); renderRevisao(); renderPainel();
}

/* ============================================================
   MÉTRICAS + CHARTS
   ============================================================ */
function svgNS(t,attrs){ const e=document.createElementNS("http://www.w3.org/2000/svg",t);
  for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }
function renderMetricas(){
  // KPIs
  const ts=allTopics();
  const dom=ts.filter(x=>topicStatus(x.id)===2).length;
  const prog=ts.filter(x=>topicStatus(x.id)===1).length;
  const q=S.questions;
  const attempts=q.flatMap(x=>x.attempts||[]);
  const simOk=S.simulados.reduce((a,s)=>a+(+s.score||0),0), simTot=S.simulados.reduce((a,s)=>a+(+s.total||0),0);
  // as questões respondidas no BANCO também contam — é onde o Alex de fato responde hoje
  // (S.questions é o registro manual, quase sempre vazio; sem isto o KPI dizia "—" com 50
  // questões respondidas no banco).
  const bResp=Object.values(S.bancoResp||{});
  const nOk=attempts.filter(a=>a.correct).length+simOk+bResp.filter(r=>r.c).length;
  const nTot=attempts.length+simTot+bResp.length;
  const acc=nTot? Math.round(nOk/nTot*100):null;
  const totalMin=S.sessions.reduce((a,s)=>a+s.min,0);
  const kpis=[
    {n:Math.round(weightedProgress()*100)+"%",l:"domínio ponderado",sub:`curso: ${CURSOS[S.curso].nome}`,clr:"var(--sunset)"},
    {n:dom,l:"tópicos dominados",sub:`+${prog} em progresso · ${ts.length} total`,clr:"var(--verde)"},
    {n:(totalMin/60).toFixed(1)+"h",l:"tempo total estudado",sub:`${S.sessions.length} sessões`,clr:"var(--azul)"},
    {n:acc==null?"—":acc+"%",l:"acerto em questões",sub:`${nTot} respostas · ${bResp.length} do banco · ${S.simulados.length} prova${S.simulados.length===1?"":"s"} oficia${S.simulados.length===1?"l":"is"}`,clr:"var(--ink)"},
    {n:studyStreak(),l:"dias seguidos",sub:"sequência de estudo",clr:"var(--sunset)"},
    {n:daysBetween(Date.now(),PROVA_TESTE.getTime()),l:"dias p/ prova-teste",sub:"UFRGS 28/nov/2026",clr:"var(--azul)"},
  ];
  const kc=$("#kpis"); kc.innerHTML="";
  kpis.forEach(k=>{ const c=el("div","kpi");
    c.innerHTML=`<div class="n" style="color:${k.clr}">${k.n}</div><div class="l">${k.l}</div><div class="sub">${k.sub}</div>`;
    kc.appendChild(c); });
  // onboarding: perfil novo (zero atividade) vê um guia em vez de só zeros
  const ob=$("#metOnboard");
  if(ob){
    const vazio = totalMin===0 && attempts.length===0 && S.simulados.length===0 && dom===0 && prog===0;
    ob.innerHTML = vazio ? `<div class="card" style="border:1px dashed var(--sunset);background:var(--raised);margin-bottom:16px">
      <div style="font-family:var(--serif);font-size:18px;margin-bottom:4px">🌅 Bem-vindo(a) ao seu horizonte</div>
      <div style="font-size:13.5px;color:var(--muted);line-height:1.6">Seus números começam zerados — cada estudo os move. Comece por: <b>Mapa do Edital</b> (marque o que já domina), uma <b>prova oficial</b> em Questões (o painel corrige e mede seu acerto real) ou uma <b>redação</b> pela banca. As métricas abaixo ganham vida a partir daí.</div>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn primary" onclick="go('edital')">Abrir Mapa do Edital</button>
        <button class="btn ghost" onclick="go('banco')">Fazer questões</button>
        <button class="btn ghost" onclick="go('redacao')">Escrever redação</button>
      </div></div>` : "";
  }
  chartDisc(); chartTime();
}
function chartDisc(){
  const svg=$("#chartDisc"); svg.innerHTML="";
  const W=720,H=300,padL=118,padR=20,padT=10,padB=24;
  const rows=DISCIPLINAS.map(d=>({d,p:discProgress(d),w:CURSOS[S.curso].pesos[d.prova]||1}));
  const bw=(H-padT-padB)/rows.length;
  const maxW=W-padL-padR;
  // grid 25/50/75/100
  [0,.25,.5,.75,1].forEach(g=>{
    const x=padL+g*maxW;
    svg.appendChild(svgNS("line",{x1:x,y1:padT,x2:x,y2:H-padB,stroke:"var(--border-soft)","stroke-width":1}));
    svg.appendChild(svgNS("text",{x,y:H-8,fill:"var(--faint)","font-size":10,"text-anchor":"middle"})).textContent=Math.round(g*100)+"%";
  });
  rows.forEach((r,i)=>{
    const y=padT+i*bw+bw*0.18, h=bw*0.64;
    const clr=r.p>=.75?"var(--verde)":r.p>=.35?"var(--amarelo)":"var(--azul)";
    // trilho
    svg.appendChild(svgNS("rect",{x:padL,y,width:maxW,height:h,rx:5,fill:"var(--raised)"}));
    const bar=svgNS("rect",{x:padL,y,width:Math.max(2,r.p*maxW),height:h,rx:5,fill:clr});
    svg.appendChild(bar);
    // label disciplina + peso
    const lb=svgNS("text",{x:padL-10,y:y+h/2+4,fill:"var(--ink)","font-size":12,"text-anchor":"end"});
    lb.textContent=`${r.d.icon} ${r.d.nome}`;
    svg.appendChild(lb);
    svg.appendChild(svgNS("text",{x:padL+maxW,y:y+h/2+4,fill:"var(--muted)","font-size":11,"text-anchor":"end","font-family":"var(--mono)"})).textContent=Math.round(r.p*100)+"%";
  });
}
function chartTime(){
  const svg=$("#chartTime"); svg.innerHTML="";
  const W=720,H=220,padL=34,padR=14,padT=12,padB=28;
  const days=[]; const now=new Date();
  for(let i=13;i>=0;i--) days.push(new Date(now-i*DAY).toISOString().slice(0,10));
  const totals={}; S.sessions.forEach(s=>totals[s.date]=(totals[s.date]||0)+s.min);
  const max=Math.max(60,...days.map(d=>totals[d]||0));
  const bw=(W-padL-padR)/days.length;
  [0,.5,1].forEach(g=>{ const y=padT+(1-g)*(H-padT-padB);
    svg.appendChild(svgNS("line",{x1:padL,y1:y,x2:W-padR,y2:y,stroke:"var(--border-soft)"}));
    svg.appendChild(svgNS("text",{x:4,y:y+3,fill:"var(--faint)","font-size":9})).textContent=Math.round(g*max);
  });
  days.forEach((dk,i)=>{
    const v=totals[dk]||0; const h=(v/max)*(H-padT-padB);
    const x=padL+i*bw+bw*0.15, w=bw*0.7, y=H-padB-h;
    const grad = v>0;
    svg.appendChild(svgNS("rect",{x,y,width:w,height:Math.max(0,h),rx:3,fill:grad?"var(--azul)":"transparent"}));
    if(i%2===0){ const d=new Date(dk+"T12:00");
      svg.appendChild(svgNS("text",{x:x+w/2,y:H-10,fill:"var(--faint)","font-size":9,"text-anchor":"middle"}))
        .textContent=`${d.getDate()}/${d.getMonth()+1}`; }
  });
}
function studyStreak(){
  const set=new Set(S.sessions.map(s=>s.date));
  let streak=0; let d=new Date();
  // se hoje não estudou, começa de ontem (não quebra por ainda ser cedo)
  if(!set.has(d.toISOString().slice(0,10))) d=new Date(d-DAY);
  while(set.has(d.toISOString().slice(0,10))){ streak++; d=new Date(d-DAY); }
  return streak;
}

