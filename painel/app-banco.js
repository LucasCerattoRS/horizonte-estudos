// app-banco.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem. Banco de questões, banco navegável, provas oficiais.
/* ============================================================
   BANCO DE QUESTÕES
   ============================================================ */
function fillTopicoSelect(sel, discId){
  sel.innerHTML="";
  const d=DISCIPLINAS.find(x=>x.id===discId); if(!d) return;
  d.eixos.forEach(ex=>{
    const og=el("optgroup"); og.label=ex.nome;
    ex.topicos.forEach(tp=>{ const o=el("option"); o.value=tp.nome; o.textContent=tp.nome; og.appendChild(o); });
    sel.appendChild(og);
  });
}
function openQ(prefill){
  $("#dqEn").value="";$("#dqAns").value="";$("#dqTags").value="";
  fillDiscSelect($("#dqDisc"));
  const disc = (prefill&&prefill.disc) || $("#dqDisc").value;
  $("#dqDisc").value = disc;
  fillTopicoSelect($("#dqTopico"), disc);
  if(prefill&&prefill.topico) $("#dqTopico").value = prefill.topico;
  $("#dqDisc").onchange = ()=>fillTopicoSelect($("#dqTopico"), $("#dqDisc").value);
  $("#dlgQ").showModal();
}
function saveQ(){
  const en=$("#dqEn").value.trim(); if(!en) return;
  S.questions.push({ id:"q"+Date.now(), disc:$("#dqDisc").value, topico:$("#dqTopico").value||"", en,
    ans:$("#dqAns").value.trim(), tags:$("#dqTags").value.split(",").map(s=>s.trim()).filter(Boolean),
    attempts:[], created:Date.now() });
  save(); $("#dlgQ").close(); renderBanco();
  if($("#tab-recursos").classList.contains("on")) renderRecursos();
}
function qAccuracy(q){ const a=q.attempts||[]; if(!a.length)return null;
  return Math.round(a.filter(x=>x.correct).length/a.length*100); }
function attemptQ(id,correct){
  const q=S.questions.find(x=>x.id===id); if(!q)return;
  (q.attempts ||= []).push({date:todayKey(),correct}); save(); renderBanco();
}
function delQ(id){ S.questions=S.questions.filter(x=>x.id!==id); save(); renderBanco(); }
function renderBanco(){
  const list=$("#bancoList"); list.innerHTML="";
  const filt=$("#qFilter").value, sort=$("#qSort").value;
  let qs=[...S.questions];
  if(filt) qs=qs.filter(q=>q.disc===filt);
  if(sort==="worst") qs.sort((a,b)=>(qAccuracy(a)??101)-(qAccuracy(b)??101));
  else qs.sort((a,b)=>b.created-a.created);
  const allAtt=S.questions.flatMap(q=>q.attempts||[]);
  const gacc=allAtt.length?Math.round(allAtt.filter(a=>a.correct).length/allAtt.length*100):null;
  $("#qStats").textContent=`${S.questions.length} questões · ${allAtt.length} respostas · ${gacc==null?"—":gacc+"% acerto"}`;
  if(!qs.length){ list.appendChild(el("div","empty","Nenhuma questão ainda.<br>Cadastre as das provas antigas (pesquisa/provas-antigas/) para treinar por tópico.")); return; }
  const dmap=Object.fromEntries(DISCIPLINAS.map(d=>[d.id,d]));
  qs.forEach(q=>{
    const d=dmap[q.disc]||{icon:"❓",nome:q.disc};
    const acc=qAccuracy(q);
    const item=el("div","q-item");
    item.innerHTML=`
      <div class="q-meta">
        <span class="tag">${d.icon} ${esc(d.nome)}</span>
        ${q.topico?`<span class="tag" style="color:var(--azul);border-color:var(--azul-deep)">📍 ${esc(q.topico)}</span>`:""}
        ${(q.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}
        <span class="acc">${acc==null?"sem tentativa":acc+"% · "+q.attempts.length+"×"}</span>
      </div>
      <div class="q-en">${esc(q.en)}</div>
      ${q.ans?`<div class="q-ans">${esc(q.ans)}</div>`:""}
      <div class="q-actions">
        ${q.ans?`<button class="btn ghost" data-a="rev">Ver gabarito</button>`:""}
        <button class="btn ghost" style="color:var(--verde);border-color:#2f5a48" data-a="ok">Acertei</button>
        <button class="btn ghost" style="color:var(--vermelho);border-color:#5a3030" data-a="no">Errei</button>
        <button class="chip" data-a="del" style="margin-left:auto">excluir</button>
      </div>`;
    item.querySelector('[data-a="rev"]')?.addEventListener("click",()=>item.classList.toggle("rev"));
    item.querySelector('[data-a="ok"]').onclick=()=>attemptQ(q.id,true);
    item.querySelector('[data-a="no"]').onclick=()=>attemptQ(q.id,false);
    item.querySelector('[data-a="del"]').onclick=()=>{ if(confirm("Excluir esta questão?")) delQ(q.id); };
    list.appendChild(item);
  });
}

/* ============================================================
   BANCO NAVEGÁVEL — 3831 questões oficiais UFRGS+ENEM (banco-questoes-data.js)
   Sem explicação nos dados → cada questão linka p/ resolução (Google/YouTube)
   e p/ perguntar ao Gemini (abre a IA já com a questão + gabarito no prompt).
   ============================================================ */
const BQ = (typeof BANCO_QUESTOES !== "undefined") ? BANCO_QUESTOES : [];
const BQ_DISC = {
  CH:"Ciências Humanas", CN:"Ciências da Natureza", LC:"Linguagens e Códigos", MT:"Matemática",
  bio:"Biologia", esp:"Espanhol", fis:"Física", geo:"Geografia", his:"História",
  ing:"Inglês", lit:"Literatura", mat:"Matemática", port:"Português", qui:"Química",
};
const bqDiscNome = q => BQ_DISC[q.disciplina] || q.disciplina_bruta || q.disciplina || "";
let bqShow = 12;

/* ------------------------------------------------------------------
   ELO QUESTÃO ↔ EDITAL
   O `id_topico` que o pipeline gravou em cada questão ("his.1.5") é o MESMO
   tid do Mapa do Edital (disc.eixo.tópico) — 3577 das 3831 questões o trazem.
   As 254 sem tid são sociologia/filosofia/artes do ENEM: não existem no
   edital da UFRGS, então ficam sem link (e não some nada da tela).
   BQ_IDX casa a grade das Provas Oficiais com o banco por
   exame|ano|disciplina|nº — verificado: 3346 casamentos, gabarito idêntico
   em 100% deles (numeração desalinhada faria as letras discordarem).
   ------------------------------------------------------------------ */
const BQ_IDX = (()=>{ const m={};
  BQ.forEach(q=>{ m[`${q.exame}|${q.ano}|${q.disciplina}|${q.numero}`]=q; }); return m; })();
const BQ_TID = (()=>{ const m={};
  BQ.forEach(q=>{ if(!q.id_topico) return;
    const c = m[q.id_topico] || (m[q.id_topico]={n:0, UFRGS:0, ENEM:0});
    c.n++; if(c[q.exame]!=null) c[q.exame]++; });
  return m; })();
const NOME2TID = (()=>{ const m={};
  Object.entries(TID2INFO).forEach(([tid,i])=>{ m[i.discId+"::"+i.tp]=tid; }); return m; })();
const BQ_BY_ID = (()=>{ const m={}; BQ.forEach(q=>{ m[q.id]=q; }); return m; })();
const bqTopicoInfo = q => (q && q.id_topico) ? (TID2INFO[q.id_topico]||null) : null;

/* Seu acerto REAL por tópico, derivado das questões que você já respondeu no banco
   (`S.bancoResp`). É o único sinal medido de domínio que o painel tem — o status
   do Mapa (não iniciado/progresso/dominado) é autodeclarado. Percorre as SUAS
   respostas (poucas), não as 3831 questões. */
function acertoPorTid(exame){
  const out={}, r=S.bancoResp||{};
  for(const id in r){
    const q=BQ_BY_ID[id]; if(!q||!q.id_topico) continue;
    if(exame && q.exame!==exame) continue;  // Análise pede o placar do concurso escolhido
    const a = out[q.id_topico] || (out[q.id_topico]={resp:0, ok:0});
    a.resp++; if(r[id].c) a.ok++;
  }
  return out;
}
const MIN_RESP = 3;                        // abaixo disso a amostra não decide nada
const accCls = a => !a ? "" : (a.ok/a.resp >= .7 ? "a-bom" : a.ok/a.resp >= .4 ? "a-med" : "a-ruim");

/* Risco = chance estimada de você errar o tópico. Com poucas respostas a taxa crua
   mente (2/2 não prova domínio de um tópico com 40 questões na prova), então ela é
   encolhida para um prior "não sei" — quanto menor a amostra, mais perto do prior. */
const RISCO_PRIOR = .55, RISCO_PESO = 3;
function riscoDe(a){
  const resp = a ? a.resp : 0, erros = a ? a.resp - a.ok : 0;
  return (erros + RISCO_PRIOR*RISCO_PESO) / (resp + RISCO_PESO);
}

/* Mapa do Edital: abre a disciplina, rola até o tópico e o destaca. */
function irAoEdital(tid){
  const info = TID2INFO[tid]; if(!info) return;
  go("edital");
  const cont = $("#editalDiscs"); if(!cont) return;
  const card = cont.querySelector(`.disc[data-disc="${info.discId}"]`);
  if(card) card.classList.add("open");
  const tg = $("#editalToggleAll");   // o rótulo do ⊞/⊟ é calculado no render — ressincroniza
  if(tg) tg.textContent = cont.querySelector(".disc:not(.open)") ? "⊞ abrir todas" : "⊟ fechar todas";
  const row = cont.querySelector(`.topic[data-tid="${tid}"]`); if(!row) return;
  setTimeout(()=>{                    // go() rola pro topo antes — espera o layout
    row.scrollIntoView({block:"center", behavior:"smooth"});
    row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
    setTimeout(()=>row.classList.remove("flash"), 2400);
  }, 80);
}

/* Filtro que chega de OUTRA aba: {tid} = tópico do edital, {id} = uma questão. */
let bqEsp = null;
function bqDoTopico(tid, exame){
  if(!TID2INFO[tid]) return;
  bqEsp = { tid };
  go("banco");
  const ex=$("#bqExame"); if(ex) ex.value = (exame==="UFRGS"||exame==="ENEM") ? exame : "";
  bqFillDisc();
  const dc=$("#bqDisc"); if(dc) dc.value="";
  const an=$("#bqAno");  if(an) an.value="";
  const bu=$("#bqBusca");if(bu) bu.value="";
  const fg=$("#bqFig");  if(fg) fg.checked=false;
  bqFiltrar();
  setTimeout(()=>{ const l=$("#bqEspBox")||$("#bqList"); if(l) l.scrollIntoView({block:"start",behavior:"smooth"}); }, 90);
}
function bqIrQuestao(id){
  if(!BQ.some(q=>q.id===id)) return;
  bqEsp = { id };
  go("banco"); bqFiltrar();
  setTimeout(()=>{ const c=$(`#bqList .bq[data-id="${id}"]`); if(c) c.scrollIntoView({block:"center",behavior:"smooth"}); }, 90);
}
function bqLimparEsp(){ bqEsp=null; bqFiltrar(); }
function bqEspRender(){
  const c=$("#bqEspBox"); if(!c) return;
  if(!bqEsp){ c.style.display="none"; c.innerHTML=""; return; }
  let txt;
  if(bqEsp.id){ const q=BQ.find(x=>x.id===bqEsp.id);
    txt = q ? `🔎 questão nº ${q.numero} · ${esc(q.exame)} ${esc(q.ano)}` : "🔎 questão";
  } else { const i=TID2INFO[bqEsp.tid]; txt = `📍 ${esc(i?i.tp:bqEsp.tid)}`; }
  c.style.display="";
  c.innerHTML = `${txt} <button title="tirar este filtro" aria-label="tirar este filtro">✕</button>`;
  c.querySelector("button").onclick = bqLimparEsp;
}

function fillBqFilters(){
  if(!BQ.length) return;
  const ex=$("#bqExame"); ex.innerHTML='<option value="">Todos os exames</option>'+
    [...new Set(BQ.map(q=>q.exame))].sort().map(e=>`<option value="${e}">${e}</option>`).join("");
  const an=$("#bqAno"); an.innerHTML='<option value="">Todos os anos</option>'+
    [...new Set(BQ.map(q=>q.ano))].sort().reverse().map(a=>`<option value="${a}">${a}</option>`).join("");
  bqFillDisc();
}
function bqFillDisc(){
  const ex=$("#bqExame").value;
  const cods=[...new Set(BQ.filter(q=>!ex||q.exame===ex).map(q=>q.disciplina))]
    .sort((a,b)=>(BQ_DISC[a]||a).localeCompare(BQ_DISC[b]||b));
  $("#bqDisc").innerHTML='<option value="">Todas as disciplinas</option>'+
    cods.map(c=>`<option value="${c}">${esc(BQ_DISC[c]||c)}</option>`).join("");
}
function bqExameChange(){ bqFillDisc(); bqUserFiltro(); }
function bqFiltrar(){ bqShow=12; renderBancoOficial(); }
/* mexeu num filtro da barra → sai do foco numa questão só (o filtro de tópico fica, tem ✕) */
function bqUserFiltro(){ if(bqEsp && bqEsp.id) bqEsp=null; bqFiltrar(); }

function bqFiltradas(){
  if(bqEsp && bqEsp.id){ const q=BQ.find(x=>x.id===bqEsp.id); return q?[q]:[]; }  // questão em foco
  const tid = bqEsp && bqEsp.tid;
  const ex=$("#bqExame").value, dc=$("#bqDisc").value, an=$("#bqAno").value;
  const fig=$("#bqFig").checked, busca=$("#bqBusca").value.trim().toLowerCase();
  return BQ.filter(q=>
    (!tid||q.id_topico===tid) &&
    (!ex||q.exame===ex) && (!dc||q.disciplina===dc) && (!an||q.ano===an) &&
    (!fig||q.tem_figura) &&
    (!busca || (q.enunciado||"").toLowerCase().includes(busca) || (q.assunto||"").toLowerCase().includes(busca) || (q.contexto||"").toLowerCase().includes(busca))
  );
}
function renderBancoOficial(){
  const list=$("#bqList"), more=$("#bqMore"); if(!list) return;
  bqEspRender();
  if(!BQ.length){ list.innerHTML=`<div class="empty">Banco de questões não carregado.</div>`; $("#bqStats").textContent=""; more.innerHTML=""; return; }
  const qs=bqFiltradas();
  const resp=S.bancoResp||(S.bancoResp={});
  const respondidas=qs.filter(q=>resp[q.id]).length;
  const acertos=qs.filter(q=>resp[q.id]&&resp[q.id].c).length;
  $("#bqStats").textContent=`${qs.length} questões`+(respondidas?` · ${respondidas} resp. · ${Math.round(acertos/respondidas*100)}% acerto`:"");
  list.innerHTML = qs.slice(0,bqShow).map(bqCard).join("") || `<div class="empty">Nenhuma questão com esses filtros.</div>`;
  // liga as alternativas (evita inline handlers com aspas no texto)
  qs.slice(0,bqShow).forEach(q=>{
    const card=list.querySelector(`.bq[data-id="${q.id}"]`); if(!card) return;
    card.querySelectorAll(".alt").forEach(b=>b.onclick=()=>bqResponder(q.id, b.dataset.l));
  });
  more.innerHTML = qs.length>bqShow
    ? `<button class="btn ghost" onclick="bqShow+=12;renderBancoOficial()">Carregar mais (${qs.length-bqShow} restantes)</button>` : "";
}
function bqCard(q){
  const resp=(S.bancoResp||{})[q.id];
  const gab=q.gabarito, anulada=gab===null;
  const alts=(q.alternativas||[]).map(a=>{
    let cls="alt";
    if(resp){ if(a.letra===gab) cls+=" gab ok"; else if(a.letra===resp.l) cls+=" bad"; }
    return `<button class="${cls}" data-l="${a.letra}"${resp?" disabled":""}><span class="L">${a.letra}</span><span>${esc(a.texto)}</span></button>`;
  }).join("");
  let veredito="";
  if(resp) veredito = anulada
    ? `<div class="veredito acertou">Questão anulada — conta como acerto.</div>`
    : `<div class="veredito ${resp.c?"acertou":"errou"}">${resp.c?"✓ Você acertou.":`✗ Você marcou ${resp.l} · gabarito ${gab}.`}</div>`;
  const tinfo = bqTopicoInfo(q);
  return `<div class="bq" data-id="${q.id}">
    <div class="q-meta">
      <span class="tag">${esc(q.exame)} ${esc(q.ano)}</span>
      <span class="tag">${esc(bqDiscNome(q))}</span>
      ${q.numero?`<span class="tag">nº ${q.numero}</span>`:""}
      ${q.assunto?`<span class="tag">${esc(q.assunto)}</span>`:""}
      ${tinfo?`<button class="tag tlink" onclick="irAoEdital('${q.id_topico}')" title="ver este tópico no Mapa do Edital · ${esc(tinfo.disc)}">📍 ${esc(tinfo.tp)}</button>`:""}
      ${q.tem_figura?`<span class="tag fig">🖼 figura</span>`:""}
    </div>
    ${q.contexto?`<div class="ctx">${esc(q.contexto)}</div>`:""}
    ${q.descricao_figura?`<figure class="bq-fig"><figcaption>🖼 Figura da questão <span>· descrição extraída do enunciado (a imagem original está na prova)</span></figcaption><div class="bq-fig-tx">${esc(q.descricao_figura)}</div></figure>`:""}
    <div class="en">${esc(q.enunciado||"")}</div>
    <div class="alts">${alts}</div>
    ${veredito}
    <div class="bq-links">
      <a href="${bqGoogleUrl(q)}" target="_blank" rel="noopener">🔎 Resolução (Google)</a>
      <a href="${bqYoutubeUrl(q)}" target="_blank" rel="noopener">▶ Vídeo (YouTube)</a>
      <button class="gem" onclick='bqGemini(${JSON.stringify(q.id)})'>✦ Perguntar ao Gemini</button>
      <button onclick='bqEstudar(${JSON.stringify(q.id)})'>📚 ${tinfo?"Estudar este tópico":"Estudar a matéria"}</button>
    </div>
  </div>`;
}
function bqResponder(id, letra){
  const q=BQ.find(x=>x.id===id); if(!q) return;
  (S.bancoResp||(S.bancoResp={}))[id] = { l:letra, c: q.gabarito===null || letra===q.gabarito };
  save();
  // re-render só este card (mantém a rolagem)
  const card=$(`#bqList .bq[data-id="${id}"]`);
  if(card){ const tmp=el("div"); tmp.innerHTML=bqCard(q); const novo=tmp.firstElementChild;
    novo.querySelectorAll(".alt").forEach(b=>b.onclick=()=>bqResponder(id,b.dataset.l));
    card.replaceWith(novo); }
  // atualiza o placar
  const qs=bqFiltradas(), resp=S.bancoResp;
  const rr=qs.filter(x=>resp[x.id]).length, ac=qs.filter(x=>resp[x.id]&&resp[x.id].c).length;
  $("#bqStats").textContent=`${qs.length} questões`+(rr?` · ${rr} resp. · ${Math.round(ac/rr*100)}% acerto`:"");
}
function bqBuscaTxt(q){ return `${q.exame} ${q.ano} ${bqDiscNome(q)} ${q.assunto||""}`.trim(); }
function bqGoogleUrl(q){ return "https://www.google.com/search?q="+encodeURIComponent(bqBuscaTxt(q)+" resolução comentada"); }
function bqYoutubeUrl(q){ return "https://www.youtube.com/results?search_query="+encodeURIComponent(bqBuscaTxt(q)+" resolução"); }
function bqGemini(id){
  const q=BQ.find(x=>x.id===id); if(!q) return;
  const alts=(q.alternativas||[]).map(a=>`${a.letra}) ${a.texto}`).join("\n");
  const gabTxt = q.gabarito===null ? "Esta questão foi anulada." : `O gabarito oficial é a alternativa ${q.gabarito}.`;
  const prompt = `Me ajude com esta questão de ${q.exame} ${q.ano} (${bqDiscNome(q)}${q.assunto?` — ${q.assunto}`:""}).\n\n`
    + (q.contexto?`Contexto: ${q.contexto}\n\n`:"")
    + `${q.enunciado}\n\n${alts}\n\n`
    + (q.descricao_figura?`[Descrição da figura/gráfico que acompanha a questão: ${q.descricao_figura}]\n\n`:"")
    + `${gabTxt} Explique por que essa é a resposta correta, o conteúdo envolvido e por que as outras alternativas estão erradas.`;
  const abrir=()=>window.open("https://gemini.google.com/app","_blank","noopener");
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).then(()=>{
      abrir(); toast("Pergunta copiada — é só colar (Ctrl+V) no Gemini.");
    }).catch(()=>bqGeminiFallback(prompt));
  } else bqGeminiFallback(prompt);
}
function bqGeminiFallback(prompt){
  // sem clipboard (ex.: file://): mostra o texto p/ copiar manual
  $("#dlLeiTit").textContent="Perguntar ao Gemini";
  $("#dlLeiMeta").innerHTML="Copie o texto abaixo, abra o Gemini e cole:";
  $("#dlLeiCorpo").textContent=prompt;
  $("#dlgLeitura").showModal();
  window.open("https://gemini.google.com/app","_blank","noopener");
}
function bqEstudar(id){
  const q=BQ.find(x=>x.id===id); if(!q) return;
  const info=bqTopicoInfo(q);
  // com tópico do edital → abre os recursos DAQUELE tópico (vale p/ ENEM também,
  // cuja disciplina é a área CH/CN/LC/MT e não existe na aba Recursos)
  if(info){ openRecursos(info.discId, info.tp); return; }
  go("recursos");
  const sel=$("#recDisc");
  if(sel && [...sel.options].some(o=>o.value===q.disciplina)){ sel.value=q.disciplina; renderRecursos(); }
}
let _toastT=null;
function toast(msg){
  let t=$("#toast");
  if(!t){ t=el("div"); t.id="toast"; document.body.appendChild(t);
    t.style.cssText="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:300;background:var(--raised);border:1px solid var(--border);color:var(--ink);padding:11px 18px;border-radius:99px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .3s"; }
  t.textContent=msg; t.style.opacity="1";
  clearTimeout(_toastT); _toastT=setTimeout(()=>{ t.style.opacity="0"; }, 3200);
}

/* ============================================================
   PROVAS OFICIAIS — grade de respostas corrigida pelo gabarito
   ============================================================ */
const PV_DIR_UFRGS = "../pesquisa/provas-antigas/ufrgs/";
const PV_DIR_ENEM  = "../pesquisa/provas-antigas/enem/";
let pvResp = {};      // marcações da grade atual {num: letra}
let pvCorrigida = false;

function pvInstData(inst){
  if(inst==="enem") return (typeof GABARITOS_ENEM!=="undefined") ? GABARITOS_ENEM : null;
  return (typeof GABARITOS_UFRGS!=="undefined") ? GABARITOS_UFRGS : null;
}
function pvInstAtual(){ return ($("#pvInst") && $("#pvInst").value) || "ufrgs"; }
function pvProvaAtual(){
  const inst=pvInstAtual(), ano=$("#pvAno").value, pk=$("#pvProva").value;
  if(inst==="enem"){
    const base=((pvInstData("enem")||{})[ano]||{})[pk]; if(!base) return null;
    const q={...base.q};   // 6-45 (LC) / 46-90 / 91-135 / 136-180
    let leCod=null, leNums=[];
    if(base.le){                                          // funde as 5 da língua estrangeira
      leCod=($("#pvLE")&&$("#pvLE").value==="esp")?"esp":"ing";
      const le=base[leCod]; Object.assign(q,le); leNums=Object.keys(le).map(Number);
    }
    return { inst:"enem", pk, nome:base.nome, disc:base.area, q, pdf:base.pdf, pdfDir:PV_DIR_ENEM,
             caderno:base.caderno, le:!!base.le, leCod, leNums, tri:true, total:Object.keys(q).length };
  }
  const p=((pvInstData("ufrgs")||{})[ano]||{})[pk]; if(!p) return null;
  return { inst:"ufrgs", pk, nome:p.nome, disc:p.disc, q:p.q, pdf:p.pdf, pdfDir:PV_DIR_UFRGS,
           caderno:null, le:false, leCod:null, leNums:[], tri:false, total:Object.keys(p.q).length };
}
/* A questão desta linha da grade, no banco de 3831 (ou null).
   A grade só tem a letra do gabarito; o banco tem enunciado, assunto e tópico.
   Casamento por exame|ano|disciplina|nº. Duas correções de código de matéria:
   a prova de língua da UFRGS tem disc "lem" (o banco usa ing/esp = a chave da prova),
   e as 5 questões de LE do ENEM ficam sob ing/esp, não sob LC.
   GUARDA: só devolve se o gabarito do banco for o mesmo da grade — assim um
   eventual desalinhamento de numeração nunca vira enunciado errado na tela. */
function pvBancoQ(p, num){
  if(!p || !BQ.length) return null;
  const exame = p.inst==="enem" ? "ENEM" : "UFRGS";
  let disc = p.disc;
  if(exame==="UFRGS" && disc==="lem") disc = p.pk;
  else if(exame==="ENEM" && p.leNums.includes(+num)) disc = p.leCod;
  const q = BQ_IDX[`${exame}|${$("#pvAno").value}|${disc}|${num}`];
  return (q && q.gabarito===p.q[num]) ? q : null;
}
function fillProvaSelects(){
  const si=$("#pvInst"); if(!si) return;
  si.innerHTML="";
  if(typeof GABARITOS_UFRGS!=="undefined"){ const o=el("option"); o.value="ufrgs"; o.textContent="UFRGS"; si.appendChild(o); }
  if(typeof GABARITOS_ENEM!=="undefined"){ const o=el("option"); o.value="enem"; o.textContent="ENEM"; si.appendChild(o); }
  fillProvaAnos();
}
function fillProvaAnos(){
  const inst=pvInstAtual(), data=pvInstData(inst)||{};
  const sa=$("#pvAno"); sa.innerHTML="";
  Object.keys(data).sort().reverse().forEach(a=>{ const o=el("option"); o.value=a; o.textContent=inst.toUpperCase()+" "+a; sa.appendChild(o); });
  fillProvaProvas();
}
function fillProvaProvas(){
  const inst=pvInstAtual(), data=pvInstData(inst)||{}, ano=$("#pvAno").value;
  const sp=$("#pvProva"); sp.innerHTML="";
  Object.entries(data[ano]||{}).forEach(([k,p])=>{ const o=el("option"); o.value=k; o.textContent=p.nome; sp.appendChild(o); });
}
function onProvaInst(){ fillProvaAnos(); renderProva(); }
function onProvaAno(){ fillProvaProvas(); renderProva(); }
function pvModo(){ return ($("#pvModo")&&$("#pvModo").value)||"fim"; }
function renderProva(){
  const p=pvProvaAtual();
  const le=$("#pvLE"); if(le) le.style.display=(p&&p.le)?"":"none";   // seletor Inglês/Espanhol só no ENEM Linguagens
  if(!p) return;
  pvResp={}; pvCorrigida=false;
  const ano=$("#pvAno").value, pk=$("#pvProva").value, modo=pvModo();
  // link para o PDF
  const a=$("#pvPdf");
  if(p.pdf){ a.style.display=""; a.href=p.pdfDir+p.pdf; } else a.style.display="none";
  // aviso contextual (modo + caderno + ressalva de TRI no ENEM)
  const nota=$("#pvNota");
  if(nota){
    let t = modo==="imediato"
      ? "Marque cada alternativa: a correção aparece na hora, e cada questão que você errar ganha atalho de resolução abaixo. Questão anulada conta como acerto."
      : "Resolva no PDF, marque as alternativas aqui e clique em Corrigir. Questão anulada conta como acerto.";
    if(p.inst==="enem") t+=` Gabarito do caderno ${p.caderno}. O placar mostra acertos brutos — a nota real do ENEM é por TRI, então use como referência de desempenho, não como nota final.`;
    nota.textContent=t;
  }
  // histórico desta prova (mesma instituição)
  const feitas=S.simulados.filter(s=>s.ano===ano && s.prova===pk && (s.inst||"ufrgs")===p.inst);
  const melhor=feitas.length?Math.max(...feitas.map(s=>s.score)):null;
  $("#pvResumo").textContent = feitas.length?`já feita ${feitas.length}× · melhor ${melhor}/${p.total}`:"ainda não feita";
  $("#pvScore").style.display="none";
  $("#pvCorrigir").style.display = modo==="imediato" ? "none" : "";   // no imediato a correção é automática
  $("#pvCorrigir").disabled=false;
  const reso=$("#pvReso"); if(reso) reso.innerHTML="";
  const grid=$("#pvGrid"); grid.innerHTML="";
  Object.keys(p.q).map(Number).sort((x,y)=>x-y).forEach(num=>{
    const row=el("div","pv-row");
    row.dataset.num=num;
    const nn=el("span","pn",String(num).padStart(2,"0")); row.appendChild(nn);
    if(p.q[num]===null){
      row.appendChild(el("span","anulada","ANULADA · conta como acerto"));
    } else {
      "ABCDE".split("").forEach(L=>{
        const b=el("button","pv-opt",L);
        b.onclick=()=>{
          if(pvCorrigida) return;
          if(modo==="imediato"){
            if(pvResp[num]) return;                 // questão já respondida
            pvMarcarImediato(p, num, L, row);
          } else {
            pvResp[num]=L;
            row.querySelectorAll(".pv-opt").forEach(x=>x.classList.toggle("sel",x.textContent===L));
          }
        };
        row.appendChild(b);
      });
    }
    grid.appendChild(row);
  });
  renderPvHist();
}
function pvPintaLinha(row, gab, resp){
  row.querySelectorAll(".pv-opt").forEach(b=>{
    const L=b.textContent; b.classList.remove("sel");
    if(L===resp) b.classList.add(resp===gab?"ok":"bad");
    else if(L===gab) b.classList.add("gab");
    b.disabled=true;
  });
}
function pvMarcarImediato(p, num, L, row){
  pvResp[num]=L; const gab=p.q[num];
  pvPintaLinha(row, gab, L);
  if(L!==gab) pvAddReso(p, num, L);            // errou → mostra resolução da questão
  const nums=Object.keys(p.q).map(Number);
  const respN=nums.filter(n=>p.q[n]===null||pvResp[n]).length;
  const ok=nums.filter(n=>p.q[n]===null||pvResp[n]===p.q[n]).length;
  const sc=$("#pvScore"); sc.style.display=""; sc.innerHTML=`${respN}/${nums.length} respondidas · ${ok} certas`;
  if(respN===nums.length) pvFinalizar(p);       // respondeu todas → fecha o simulado
}
function corrigirProva(){
  const p=pvProvaAtual(); if(!p || pvCorrigida) return;
  const nums=Object.keys(p.q).map(Number);
  const pendentes=nums.filter(n=>p.q[n]!==null && !pvResp[n]);
  if(pendentes.length){ alert(`Faltam ${pendentes.length} questões: ${pendentes.join(", ")}`); return; }
  $$("#pvGrid .pv-row").forEach(row=>{
    const n=+row.dataset.num, gab=p.q[n]; if(gab===null) return;
    pvPintaLinha(row, gab, pvResp[n]);
    if(pvResp[n]!==gab) pvAddReso(p, n, pvResp[n]);
  });
  pvFinalizar(p);
}
function pvFinalizar(p){
  if(pvCorrigida) return;
  const nums=Object.keys(p.q).map(Number);
  let score=0; nums.forEach(n=>{ if(p.q[n]===null || pvResp[n]===p.q[n]) score++; });
  pvCorrigida=true; $("#pvCorrigir").disabled=true;
  const ano=$("#pvAno").value, pk=$("#pvProva").value;
  S.simulados.push({ id:"s"+Date.now(), date:todayKey(), inst:p.inst, ano, prova:pk,
    disc:p.disc, nome:p.nome, score, total:nums.length, resp:{...pvResp} });
  save();
  const pct=Math.round(score/nums.length*100);
  const sc=$("#pvScore"); sc.style.display="";
  sc.innerHTML=`<b style="color:${pct>=70?"var(--verde)":pct>=50?"var(--amarelo)":"var(--vermelho)"}">${score}/${nums.length}</b> · ${pct}% de acerto`;
  const feitas=S.simulados.filter(s=>s.ano===ano && s.prova===pk && (s.inst||"ufrgs")===p.inst);
  $("#pvResumo").textContent=`já feita ${feitas.length}× · melhor ${Math.max(...feitas.map(s=>s.score))}/${p.total}`;
  renderPvHist();
  mostrarBilhete(pct);
}
/* --- Resolução por questão da prova oficial (a grade não tem enunciado → busca por exame/ano/nº) --- */
function pvBusca(p,num,ano){ return `${p.inst.toUpperCase()} ${ano} ${p.nome} questão ${num}`; }
function pvGoogleUrl(p,num,ano){ return "https://www.google.com/search?q="+encodeURIComponent(pvBusca(p,num,ano)+" resolução comentada"); }
function pvYoutubeUrl(p,num,ano){ return "https://www.youtube.com/results?search_query="+encodeURIComponent(pvBusca(p,num,ano)+" resolução"); }
function pvAddReso(p, num, resp){
  const box=$("#pvReso"); if(!box) return;
  if(!box.querySelector(".pv-reso-h")){
    box.innerHTML=`<div class="eyebrow pv-reso-h" style="margin:18px 0 6px">Resolução das questões que você errou</div>`
      +`<p class="note-hint" style="margin:0 0 10px">O painel não traz a explicação escrita — abra a resolução no Google/YouTube, peça ao Gemini (vai com o enunciado e o gabarito prontos) ou veja a questão no banco. O <b>📍 tópico</b> leva ao Mapa do Edital: é o conteúdo que faltou.</p>`;
  }
  const gab=p.q[num], ano=$("#pvAno").value;
  const bq=pvBancoQ(p,num), tinfo=bqTopicoInfo(bq);
  const item=el("div","pv-reso-item");
  item.innerHTML=`<div class="pv-reso-top">
      <span class="tag">nº ${num}</span>
      ${bq&&bq.assunto?`<span class="tag">${esc(bq.assunto)}</span>`:""}
      <span class="rr">você marcou <b style="color:var(--vermelho)">${resp}</b> · gabarito <b style="color:var(--verde)">${gab}</b></span></div>
    <div class="bq-links">
      ${tinfo?`<button onclick="irAoEdital('${bq.id_topico}')" title="ver o tópico no Mapa do Edital · ${esc(tinfo.disc)}">📍 ${esc(tinfo.tp)}</button>`:""}
      <a href="${pvGoogleUrl(p,num,ano)}" target="_blank" rel="noopener">🔎 Resolução (Google)</a>
      <a href="${pvYoutubeUrl(p,num,ano)}" target="_blank" rel="noopener">▶ Vídeo (YouTube)</a>
      <button class="gem" onclick="pvGemini(${num})">✦ Perguntar ao Gemini</button>
      ${bq?`<button onclick="bqIrQuestao('${bq.id}')">📚 Ver enunciado no banco</button>`
          :`<button onclick="pvVerBanco()">📚 Ver no banco</button>`}
    </div>`;
  box.appendChild(item);
}
function pvGemini(num){
  const p=pvProvaAtual(); if(!p) return;
  const bq=pvBancoQ(p,num);
  if(bq) return bqGemini(bq.id);      // achou no banco → manda o enunciado inteiro, não só o nº
  const ano=$("#pvAno").value, gab=p.q[num];
  const prompt=`Me ajude com a questão ${num} da prova ${p.inst.toUpperCase()} ${ano} — ${p.nome}.\n\n`
    +(gab?`O gabarito oficial é a alternativa ${gab}. `:"Esta questão foi anulada. ")
    +`Explique a resolução completa, o conteúdo cobrado e por que as outras alternativas estão erradas. Não tenho o enunciado aqui — se precisar, considere a prova oficial ${p.inst.toUpperCase()} ${ano} (${p.nome}), questão ${num}.`;
  const abrir=()=>window.open("https://gemini.google.com/app","_blank","noopener");
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).then(()=>{ abrir(); toast("Pergunta copiada — é só colar (Ctrl+V) no Gemini."); }).catch(()=>bqGeminiFallback(prompt));
  } else bqGeminiFallback(prompt);
}
function pvVerBanco(){
  const p=pvProvaAtual(); if(!p) return;
  const exame=p.inst==="enem"?"ENEM":"UFRGS", ano=$("#pvAno").value;
  bqEsp=null;                       // sai de qualquer filtro de tópico/questão em foco
  go("banco");
  const ex=$("#bqExame"); if(ex){ ex.value=exame; bqFillDisc(); }
  const an=$("#bqAno"); if(an && [...an.options].some(o=>o.value===ano)) an.value=ano;
  bqFiltrar();
  setTimeout(()=>{ const l=$("#bqList"); if(l) l.scrollIntoView({block:"start"}); }, 90);
}
function delSimulado(id){ S.simulados=S.simulados.filter(s=>s.id!==id); save(); renderProva(); }
function renderPvHist(){
  const box=$("#pvHist"); box.innerHTML="";
  if(!S.simulados.length) return;
  // acerto agregado por disciplina
  const agg={};
  S.simulados.forEach(s=>{ (agg[s.nome] ||= {ok:0,tot:0}); agg[s.nome].ok+=s.score; agg[s.nome].tot+=s.total; });
  const chips=Object.entries(agg).map(([n,a])=>`<span class="tag">${esc(n)} ${Math.round(a.ok/a.tot*100)}%</span>`).join(" ");
  box.appendChild(el("div","q-meta",`<span class="chip">${S.simulados.length} prova${S.simulados.length>1?"s":""} corrigida${S.simulados.length>1?"s":""}</span> ${chips}`));
  [...S.simulados].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,12).forEach(s=>{
    const pct=Math.round(s.score/s.total*100);
    const item=el("div","pv-hist-item");
    item.innerHTML=`<span class="tag">${esc(s.date)}</span> ${(s.inst||"ufrgs").toUpperCase()} ${esc(s.ano)} · ${esc(s.nome)}
      <span class="sc" style="color:${pct>=70?"var(--verde)":pct>=50?"var(--amarelo)":"var(--vermelho)"}">${s.score}/${s.total}</span>
      <button class="chip" style="margin-left:auto">excluir</button>`;
    item.querySelector("button").onclick=()=>{ if(confirm("Excluir este resultado?")) delSimulado(s.id); };
    box.appendChild(item);
  });
}

