// app-edital.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Mapa do Edital, notas/Obsidian, relações, recursos.
/* ============================================================
   MAPA DO EDITAL
   ============================================================ */
function statusClass(s){ return s===2?"s2":s===1?"s1":""; }

/* Obsidian: link padrão p/ nota do tópico no cofre (gerado por pipeline/gerar_cofre.cjs) */
const OBS_VAULT = "cofre-obsidian";
const sanO = s => s.replace(/[*"\\/<>:|?#^\[\]]/g, "–");
const obsUrl = (d,tp) => `obsidian://open?vault=${encodeURIComponent(OBS_VAULT)}&file=${encodeURIComponent(sanO(d.nome)+"/"+sanO(tp.nome))}`;
/* O cofre Obsidian existe só na máquina de quem clonou o repo (o Alex).
   O painel-presente (Bia, publicado via --kit) roda no navegador SEM Obsidian:
   todo link obsidian:// é MORTO ali. PERFIL_SEED só entra no build do kit → é o sinal. */
const semCofre = () => (typeof PERFIL_SEED!=="undefined" && !!PERFIL_SEED && !!PERFIL_SEED.nome);

function renderEdital(container, compact){
  const openIds = new Set([...container.querySelectorAll(".disc.open")].map(c=>c.dataset.disc));
  const ACERTO = acertoPorTid();
  container.innerHTML="";
  DISCIPLINAS.forEach(d=>{
    const prog=discProgress(d);
    const w=CURSOS[S.curso].pesos[d.prova]||1;
    const card=el("div","disc");
    card.dataset.disc=d.id;
    const clr = prog>=.75?"var(--verde)":prog>=.35?"var(--amarelo)":"var(--azul)";
    card.innerHTML=`
      <div class="disc-h">
        <span class="ic">${d.icon}</span>
        <span class="nm">${d.nome}</span>
        <span class="wt" title="peso no curso-alvo">×${w}</span>
        <span class="pct">${Math.round(prog*100)}%</span>
        <span class="chev">▶</span>
      </div>
      <div class="disc-bar"><i style="width:${prog*100}%;background:${clr}"></i></div>
      <div class="disc-body"></div>`;
    const body=card.querySelector(".disc-body");
    if(d.nota){ body.appendChild(el("div","note-hint",`💡 ${esc(d.nota)}`)); }
    d.eixos.forEach((ex,ei)=>{
      const ew=el("div","eixo");
      ew.appendChild(el("div","eixo-nm",esc(ex.nome)));
      ex.topicos.forEach((tp,ti)=>{
        const id=topicId(d.id,ei,ti);
        const st=topicStatus(id);
        const rec=S.topics[id];
        const hasNote = rec && (rec.note||rec.link);
        const hasBase = typeof NOTAS_BASE!=="undefined" && !!NOTAS_BASE[id];  // tem conteúdo de estudo p/ ler no painel
        const qc=BQ_TID[id];   // quantas questões oficiais já caíram deste tópico
        const ac=ACERTO[id];   // ...e quantas você acertou das que respondeu
        const row=el("div","topic "+statusClass(st));
        row.dataset.tid=id;
        row.innerHTML=`
          <span class="dot ${statusClass(st)}" title="clique p/ avançar domínio"></span>
          <div class="tx">
            <div class="tn">${esc(tp.nome)}</div>
            ${tp.subs&&tp.subs[0]?`<div class="tsub">${esc(tp.subs.join(" · "))}</div>`:""}
          </div>
          ${qc?`<button class="qbadge ${accCls(ac)}" title="${qc.n} questões oficiais deste tópico (UFRGS ${qc.UFRGS} · ENEM ${qc.ENEM}) — clique para resolvê-las${ac?`. Você acertou ${ac.ok} das ${ac.resp} que respondeu.`:""}">${ac?`${ac.ok}/${ac.resp}`:`${qc.n}q`}</button>`:""}
          <button class="obs note-btn ${hasNote?"has":""}" title="${hasBase?"ler o conteúdo de estudo e fazer suas anotações":"escrever uma anotação sua"}">${hasBase?"📖 ler":"✎ nota"}</button>
          ${relTemAlgo(id)?`<button class="obs rel-btn" style="align-self:center" title="relações: pré-requisitos e conexões interdisciplinares">🔗</button>`:""}
          <button class="obs rec-btn" style="align-self:center" title="onde aprender este tópico (canais, busca, sites)">🌐</button>`;
        row.querySelector(".dot").onclick=e=>{ e.stopPropagation(); cycleStatus(id); };
        row.querySelector(".tn").onclick=()=>{ if(tp.subs&&tp.subs[0]) row.classList.toggle("exp"); };
        row.querySelector(".note-btn").onclick=e=>{ e.stopPropagation(); openNote(id, `${d.nome} — ${tp.nome}`, rec?.link||obsUrl(d,tp)); };
        row.querySelector(".rec-btn").onclick=e=>{ e.stopPropagation(); openRecursos(d.id, tp.nome); };
        { const rb=row.querySelector(".rel-btn"); if(rb) rb.onclick=e=>{ e.stopPropagation(); openRelacoes(id); }; }
        { const qb=row.querySelector(".qbadge"); if(qb) qb.onclick=e=>{ e.stopPropagation(); bqDoTopico(id); }; }
        ew.appendChild(row);
      });
      body.appendChild(ew);
    });
    card.querySelector(".disc-h").onclick=()=>card.classList.toggle("open");
    if(openIds.has(d.id)) card.classList.add("open");
    container.appendChild(card);
  });
  const ts=allTopics();
  const done=ts.filter(x=>topicStatus(x.id)===2).length;
  const prog=ts.filter(x=>topicStatus(x.id)===1).length;
  const cEl=$("#editalCount");
  if(cEl) cEl.textContent=`${done} dominados · ${prog} em progresso · ${ts.length} tópicos`;
  const tg=$("#editalToggleAll");
  if(tg){
    const sync=()=>{ tg.textContent = container.querySelector(".disc:not(.open)") ? "⊞ abrir todas" : "⊟ fechar todas"; };
    sync();
    tg.onclick=()=>{
      const abrir = !!container.querySelector(".disc:not(.open)");
      container.querySelectorAll(".disc").forEach(c=>c.classList.toggle("open",abrir));
      sync();
    };
    container.querySelectorAll(".disc-h").forEach(h=>h.addEventListener("click",sync));
  }
}

function cycleStatus(id){
  const rec=tRec(id);
  const prev=rec.status;
  rec.status=(rec.status+1)%3;
  // ao começar a estudar (0→1 ou →2), entra na fila SRS
  if(prev===0 && rec.status>0 && !rec.srs){
    rec.srs = { ease:2.5, interval:0, due:Date.now(), reps:0 };
  }
  save();
  renderEdital($("#editalDiscs"));
  renderPainel();
}

/* ============================================================
   NOTAS / OBSIDIAN
   ============================================================ */
let noteTarget=null;
function openNote(id,title,obsHref){
  noteTarget=id; const rec=tRec(id);
  $("#dnTitle").textContent=title;
  $("#dnBase").innerHTML=renderNotaBase(typeof NOTAS_BASE!=="undefined"?NOTAS_BASE[id]:null);
  $("#dnText").value=rec.note||"";
  const obs=$("#dnObs"); if(obs){ const oc=semCofre(); obs.href=oc?"#":(obsHref||"#"); obs.style.display=oc?"none":""; }  // sem Obsidian: esconde E neutraliza o link morto
  $("#dlgNote").showModal();
}
function saveNote(){
  const rec=tRec(noteTarget);
  rec.note=$("#dnText").value.trim();   // rec.link (link Obsidian antigo) é preservado, não editável aqui
  save(); $("#dlgNote").close();
  renderEdital($("#editalDiscs")); renderPainel();
}

/* markdown-lite SEGURO (escapa tudo, depois reintroduz só negrito/listas/parágrafos) */
function mdLite(s){
  let h=esc(s).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
  const linhas=h.split("\n"); let out=[], emLista=false, para=[];
  const flush=()=>{ if(para.length){ out.push(`<p>${para.join("<br>")}</p>`); para=[]; } };
  for(const ln of linhas){
    const li=ln.match(/^\s*[-•]\s+(.*)$/);
    if(li){ flush(); if(!emLista){ out.push("<ul>"); emLista=true; } out.push(`<li>${li[1]}</li>`); }
    else if(!ln.trim()){ flush(); if(emLista){ out.push("</ul>"); emLista=false; } }
    else { if(emLista){ out.push("</ul>"); emLista=false; } para.push(ln); }
  }
  flush(); if(emLista) out.push("</ul>");
  return out.join("");
}
/* Conteúdo-base (só leitura) mostrado no topo do diálogo de nota. */
function renderNotaBase(nb){
  if(!nb) return `<div class="nb-empty">Ainda não há um resumo pronto para este tópico — mas você já pode escrever suas próprias anotações aqui embaixo. 👇</div>`;
  let h="";
  if(nb.subs&&nb.subs.length)
    h+=`<div class="nb-sec"><div class="nb-h">Programa oficial</div><div class="nb-subs">${nb.subs.map(s=>`<span class="nb-sub">${esc(s)}</span>`).join("")}</div></div>`;
  if(nb.resumo)    h+=`<div class="nb-sec"><div class="nb-h">📘 Resumo</div><div class="nb-tx">${mdLite(nb.resumo)}</div></div>`;
  if(nb.formulas)  h+=`<div class="nb-sec"><div class="nb-h">🧮 Fórmulas · esquemas · datas</div><div class="nb-tx">${mdLite(nb.formulas)}</div></div>`;
  if(nb.pegadinhas)h+=`<div class="nb-sec"><div class="nb-h">⚠️ Pegadinhas & erros clássicos</div><div class="nb-tx">${mdLite(nb.pegadinhas)}</div></div>`;
  return h+`<div class="nb-div"></div>`;
}

/* ============================================================
   RELAÇÕES ENTRE TÓPICOS (relacoes-data.js — FASE 1D)
   Pré-requisitos, interdisciplinar e "prepara para" (reverso).
   ============================================================ */
const _REL = typeof RELACOES !== "undefined" ? RELACOES : { topicos:{} };
const TID2INFO = (()=>{ const m={};
  DISCIPLINAS.forEach(d=>d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    m[topicId(d.id,ei,ti)] = { disc:d.nome, icon:d.icon, discId:d.id, tp:tp.nome };
  }))); return m; })();
function relDe(tid){ return _REL.topicos[tid] || null; }
function relTemAlgo(tid){ const r=relDe(tid); return !!r && (r.req.length||r.inter.length||(r.desbloqueia&&r.desbloqueia.length)); }
function relChip(tid, motivo){
  const info=TID2INFO[tid]; if(!info) return "";
  return `<button class="chip rel-chip" data-tid="${tid}" title="${esc(motivo||'ver relações deste tópico')}"
      style="margin:0 7px 7px 0;cursor:pointer;text-align:left;line-height:1.35">
    <span style="opacity:.75">${info.icon}</span> ${esc(info.tp)}`
    + (motivo?`<span style="display:block;font-size:10.5px;color:var(--faint);margin-top:2px;max-width:280px;white-space:normal">${esc(motivo)}</span>`:"")
    + `</button>`;
}
function openRelacoes(tid){
  const info=TID2INFO[tid], r=relDe(tid); if(!info||!r) return;
  $("#dlRelTit").textContent = `${info.icon} ${info.tp}`;
  const sec=(t,corpo)=> corpo ? `<div class="eyebrow" style="margin:16px 0 8px">${t}</div><div style="display:flex;flex-wrap:wrap">${corpo}</div>` : "";
  const reqs  = r.req.map(t=>relChip(t)).join("");
  const inter = r.inter.map(it=>relChip(it.tid, it.motivo)).join("");
  const desb  = (r.desbloqueia||[]).map(t=>relChip(t)).join("");
  let html = `<div style="font-size:12.5px;color:var(--muted)">${esc(info.disc)}</div>`;
  html += sec("Estude antes · pré-requisitos", reqs);
  html += sec("Conecta com · interdisciplinar", inter);
  html += sec("Prepara para", desb);
  if(!reqs && !inter && !desb) html += `<div style="color:var(--faint);font-size:13px;margin-top:12px">Sem relações mapeadas.</div>`;
  const body=$("#dlRelBody"); body.innerHTML=html;
  body.querySelectorAll(".rel-chip").forEach(c=>c.onclick=()=>openRelacoes(c.dataset.tid));
  $("#dlgRel").showModal();
}

/* ============================================================
   RECURSOS — curadoria de canais/pessoas/sites + incidência
   Fonte: recursos-data.js (CANAIS, SITES, INCIDENCIA)
   ============================================================ */
const _CANAIS = typeof CANAIS !== "undefined" ? CANAIS : {};
const _SITES  = typeof SITES  !== "undefined" ? SITES  : [];
const _INCID  = typeof INCIDENCIA !== "undefined" ? INCIDENCIA : {};
const INC_LABEL = { alta:"alta", media:"média", baixa:"baixa" };

function canaisDe(discId){
  const cs = _CANAIS[discId] || [];
  return semCofre() ? cs.filter(c => c.tipo !== "cofre") : cs;  // sem Obsidian (Bia): oculta os atalhos do cofre
}
function incidenciaDe(discId, tpNome){ return (_INCID[discId]||{})[tpNome] || "media"; }

/* --- incidência REAL, derivada das questões marcadas por tópico --- */
function topicQCount(discId, tpNome){
  return S.questions.filter(q => q.disc===discId && q.topico===tpNome).length;
}
function discQCount(discId){
  return S.questions.filter(q => q.disc===discId && q.topico).length;
}
function nTopicosDe(discId){
  const d = DISCIPLINAS.find(x=>x.id===discId);
  return d ? d.eixos.reduce((a,e)=>a+e.topicos.length,0) : 1;
}
/* Retorna {level, count, source}. Só declara nível OBSERVADO quando a
   disciplina já tem amostra suficiente (>=6 questões marcadas); abaixo
   disso, mantém a estimativa curada. Compara a fatia do tópico com a
   expectativa uniforme (1/nTópicos): 50%+ acima = alta, bem abaixo = baixa. */
const MIN_AMOSTRA = 6;
function incidenciaInfo(discId, tpNome){
  const count = topicQCount(discId, tpNome);
  const total = discQCount(discId);
  if(total >= MIN_AMOSTRA && count > 0){
    const esperado = 1 / nTopicosDe(discId);
    const fatia = count / total;
    const level = fatia >= esperado*1.5 ? "alta" : fatia >= esperado*0.6 ? "media" : "baixa";
    return { level, count, source:"observada" };
  }
  return { level: incidenciaDe(discId, tpNome), count, source:"estimada" };
}
