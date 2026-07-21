/* sync.js — cliente de sincronização do backend V2 (offline-first).
   ⚠️ FLAG OFF por padrão: sem token em localStorage, NADA acontece — o painel é o de hoje.
   Carregado DEPOIS de app.js (compartilha o escopo global: S, save, IDX ...).
   Ver PLANO-V2.md (passos 0.5–0.7).

   Como funciona (V2.0):
   - Login = colar 1× o token pessoal (☁ no cabeçalho, ou Sync.login("<token>")). Guarda em localStorage.
   - Boot: se há token, faz pull → merge por SEÇÃO (mais nova vence) → save → re-render, e então push.
   - Cada save() (qualquer mutação) chama Sync.onSaved(): comparo cada seção com um retrato (shadow);
     as que mudaram ganham updated_at = agora e um push é agendado (debounce). Assim NÃO preciso
     instrumentar cada mutador — o diff central cobre tudo e mantém timestamp POR SEÇÃO (0.6).
   - push manda o estado inteiro (todas as seções com seu ts). O servidor só grava seção cujo
     ts é MAIOR que o dele. Reenviar é inofensivo e convergente → dispensa fila persistente:
     o próprio ts em localStorage lembra o que falta subir e reenvia no próximo boot/save.
   - Base da API: "/api" quando servido por http(s); no kit file:// setar localStorage.painelUFRGS_api
     = "https://<site>/api" (ou Sync.api = ...).
*/
(function () {
  "use strict";
  const TOKEN_KEY = "painelUFRGS_token";
  const TS_KEY    = "painelUFRGS_ts";     // { secao: updated_at(ms) } local
  const API_KEY   = "painelUFRGS_api";    // override da base p/ o kit file://
  const SECOES = ["topics","sessions","questions","simulados","redacoes","rascunhos","chat","bancoResp","curso"];
  const DEBOUNCE = 1500;

  let shadow = {};        // { secao: JSON } — retrato do último estado conhecido (baseline do diff)
  let pushTimer = null;
  let onlineHooked = false;
  let lastTs = 0;         // relógio lógico monotônico: nenhum push repete/inverte um updated_at
  let lastMetaStr = null; // V2.1: última meta (perfil-presente) aplicada, p/ evitar re-render à toa

  const httpBase = (location.protocol === "http:" || location.protocol === "https:") ? "/api" : null;

  // base da API resolvida AO VIVO (não travada no boot): explícito Sync.api > localStorage > "/api" no site.
  function apiBase() {
    if (Sync.api) return Sync.api;
    try { const v = localStorage.getItem(API_KEY); if (v) return v; } catch (e) {}
    return httpBase;
  }

  const Sync = {
    api: null,                            // override manual (kit file://). No site fica null → usa httpBase "/api".
    profile: null,                        // preenchido no pull ({id,nome,role})
    get token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } },
    apiBase,                              // exposto p/ push.js (mesma resolução: Sync.api > localStorage > "/api")
    ativo() { return !!Sync.token && !!apiBase(); },
    login(t) {
      t = (t || "").trim();
      if (!t) return Promise.resolve(false);
      localStorage.setItem(TOKEN_KEY, t);
      try { localStorage.removeItem(TS_KEY); } catch (e) {}   // token novo = sincroniza tudo do zero
      return Sync.pull();
    },
    logout() {
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TS_KEY); } catch (e) {}
      Sync.profile = null; render();
    },
  };
  window.Sync = Sync;

  /* ---------- helpers de estado ---------- */
  function tsMap() { try { return JSON.parse(localStorage.getItem(TS_KEY)) || {}; } catch (e) { return {}; } }
  function setTs(m) { try { localStorage.setItem(TS_KEY, JSON.stringify(m)); } catch (e) {} }
  function snap() { if (typeof S === "undefined") return; SECOES.forEach(s => { shadow[s] = JSON.stringify(S[s]); }); }
  // updated_at estritamente crescente por aparelho: resolve empates de ms e corridas login-push↔mutação.
  function nextTs() { lastTs = Math.max(Date.now(), lastTs + 1); return lastTs; }

  // Merge de uma seção remota sobre a local.
  //  - arrays cujos itens têm id → união por id (não perde progresso do outro aparelho);
  //  - o resto (topics/bancoResp/rascunhos map, curso string) → substitui (last-write-wins por seção).
  function mergeSecao(secao, remoto) {
    if (typeof S === "undefined" || remoto === undefined) return;
    const local = S[secao];
    if (Array.isArray(remoto) && Array.isArray(local) && remoto.length && remoto.every(x => x && x.id)) {
      const byId = new Map(local.filter(x => x && x.id).map(x => [x.id, x]));
      remoto.forEach(x => byId.set(x.id, x));       // conflito no mesmo id: vence o remoto
      S[secao] = [...byId.values()];
    } else {
      S[secao] = remoto;
    }
  }

  // V2.1: aplica o perfil-presente vindo do D1 (dedicatória, mensagens/pools) SOBRE o PERFIL_SEED do arquivo.
  // Só age no site que TEM seed (o da Bia). No painel do Alex, PERFIL_SEED é undefined → no-op.
  // Assim o Alex edita as mensagens dela remotamente (V2.2) e o site dela reflete no próximo sync;
  // o perfil-seed.js embarcado vira só o fallback offline.
  function applyMeta(meta) {
    if (!meta || typeof meta !== "object") return;
    if (typeof PERFIL_SEED === "undefined") return;
    const s = JSON.stringify(meta);
    if (s === lastMetaStr) return;
    lastMetaStr = s;
    try {
      Object.assign(PERFIL_SEED, meta);                 // muta o const em lugar (dedicatória/mensagens/nome…)
      if (typeof renderPainel === "function") renderPainel();   // atualiza a saudação do hero; a dedicatória lê no clique
    } catch (e) {}
  }

  /* ---------- rede ---------- */
  Sync.pull = async function () {
    if (!Sync.ativo()) { render(); return false; }
    status("sync");
    try {
      const r = await fetch(apiBase() + "/state", { headers: { Authorization: "Bearer " + Sync.token } });
      if (!r.ok) { Sync.lastErro = r.status === 401 ? "auth" : "rede"; status(r.status === 401 ? "bad" : "off"); return false; }
      Sync.lastErro = null;
      const j = await r.json();
      Sync.profile = j.profile || null;
      applyMeta(Sync.profile && Sync.profile.meta);  // V2.1: perfil-presente da Bia vem do D1
      applyRemote(j.sections);
      status("ok");
      Sync.push();                                   // sobe o que for local-mais-novo
      return true;
    } catch (e) { Sync.lastErro = "rede"; status("off"); hookOnline(); return false; }
  };

  // Aplica seções vindas do servidor (pull OU resposta do PUT). Só troca seção cujo ts remoto é maior.
  function applyRemote(sections) {
    if (!sections) return;
    const ts = tsMap(); let mudou = false;
    Sync._applying = true;
    for (const [secao, sv] of Object.entries(sections)) {
      if (!SECOES.includes(secao) || !sv) continue;
      const rts = Number(sv.updated_at) || 0;
      if (rts > lastTs) lastTs = rts;               // acompanha o relógio do outro aparelho (evita clock-skew perder update)
      if (!(secao in ts) || rts > ts[secao]) { mergeSecao(secao, sv.data); ts[secao] = rts; mudou = true; }
    }
    setTs(ts);
    if (mudou && typeof save === "function") save();   // persiste; onSaved é no-op (guard _applying)
    Sync._applying = false;
    snap();                                             // baseline = estado já mesclado
    if (mudou) reRender();
  }

  Sync.push = async function () {
    if (!Sync.ativo() || typeof S === "undefined") return;
    const ts = tsMap(), sections = {};
    SECOES.forEach(secao => {
      if (S[secao] === undefined) return;
      if (ts[secao] === undefined) ts[secao] = nextTs();   // fixa um ts estável p/ a seção (1ª subida)
      sections[secao] = { data: S[secao], updated_at: ts[secao] };
    });
    setTs(ts);                                             // persiste: próximos pushes de seção intocada = no-op no servidor
    status("up");
    try {
      const r = await fetch(apiBase() + "/state", {
        method: "PUT",
        headers: { Authorization: "Bearer " + Sync.token, "Content-Type": "application/json" },
        body: JSON.stringify({ sections, device: (navigator.userAgent || "").slice(0, 60) }),
      });
      if (!r.ok) { status(r.status === 401 ? "bad" : "err"); return; }
      const j = await r.json();                          // estado mesclado do servidor
      if (j && j.profile) { Sync.profile = j.profile; applyMeta(j.profile.meta); }
      applyRemote(j && j.sections);                      // converge com o que outro aparelho já subiu
      status("ok");
    } catch (e) { status("off"); hookOnline(); }
  };

  // chamado por save() (app.js) em TODA mutação: diff por seção → marca as mudadas → agenda push.
  Sync.onSaved = function () {
    if (!Sync.ativo() || Sync._applying || typeof S === "undefined") return;
    const ts = tsMap(), t = nextTs(); let changed = false;
    SECOES.forEach(secao => {
      const cur = JSON.stringify(S[secao]);
      if (cur !== shadow[secao]) { shadow[secao] = cur; ts[secao] = t; changed = true; }
    });
    if (changed) { setTs(ts); status("dirty"); clearTimeout(pushTimer); pushTimer = setTimeout(() => Sync.push(), DEBOUNCE); }
  };
  // compat com o scaffold antigo (0.6): marca uma seção e agenda push
  Sync.touch = function (secao) { const ts = tsMap(); ts[secao] = nextTs(); setTs(ts); clearTimeout(pushTimer); pushTimer = setTimeout(() => Sync.push(), DEBOUNCE); };

  function hookOnline() {
    if (onlineHooked) return; onlineHooked = true;
    window.addEventListener("online", () => { if (Sync.ativo()) Sync.pull(); });
  }

  function reRender() {
    try {
      if (typeof renderPainel === "function") renderPainel();
      if (typeof renderProva === "function") renderProva();
      if (typeof renderBanco === "function") renderBanco();
      const ativo = document.querySelector(".tab.on");
      if (ativo && typeof go === "function") go(ativo.id.replace("tab-", ""));
    } catch (e) {}
  }

  /* ---------- UI (auto-injetada no cabeçalho; zero edição no index.html) ---------- */
  const EST = {
    out:   { txt: "☁", cor: "var(--muted)",   tit: "Sincronizar entre aparelhos — entrar" },
    sync:  { txt: "↻", cor: "var(--amarelo)",  tit: "Sincronizando…" },
    up:    { txt: "↑", cor: "var(--amarelo)",  tit: "Enviando…" },
    ok:    { txt: "☁", cor: "#39d98a",         tit: "Sincronizado" },
    dirty: { txt: "↑", cor: "var(--amarelo)",  tit: "Alterações locais a enviar…" },
    off:   { txt: "⚠", cor: "#e0a458",         tit: "Offline — suas alterações sobem quando voltar a conexão" },
    err:   { txt: "⚠", cor: "#e0a458",         tit: "Erro ao sincronizar (tentará de novo)" },
    bad:   { txt: "⚠", cor: "#ff6b6b",         tit: "Token inválido — entre de novo" },
  };
  let btn = null;
  function status(estado) {
    const e = EST[estado] || (Sync.token ? EST.ok : EST.out);
    if (!btn) return;
    btn.textContent = e.txt;
    btn.style.color = e.cor;
    btn.title = Sync.token && Sync.profile ? (e.tit + " · " + Sync.profile.nome) : e.tit;
  }
  function render() {
    status(Sync.token ? (Sync.profile ? "ok" : "sync") : "out");
    if (typeof Push !== "undefined") Push.render(); // push.js: o botão só aparece com sync ativo
  }

  function injectUI() {
    const host = document.querySelector(".profile-pick") || document.querySelector(".brand");
    if (!host || document.getElementById("syncBtn")) return;
    btn = document.createElement("button");
    btn.id = "syncBtn"; btn.className = "pbtn"; btn.type = "button";
    btn.style.cssText = "font-size:15px;line-height:1";
    btn.addEventListener("click", openDlg);
    host.appendChild(btn);
    render();
  }

  let dlg = null;
  function buildDlg() {
    dlg = document.createElement("dialog");
    dlg.id = "syncDlg";
    dlg.style.cssText = "border:none;border-radius:14px;max-width:440px;width:92vw;padding:0;color:var(--fg,#eee);background:var(--card,#1b2130)";
    dlg.innerHTML = `
      <form method="dialog" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">
        <div style="font-size:18px;font-weight:700">☁ Sincronizar aparelhos</div>
        <div id="syncBody" style="font-size:13.5px;line-height:1.5;color:var(--muted,#9aa)"></div>
        <div id="syncForm" style="display:flex;flex-direction:column;gap:8px"></div>
        <div id="syncMsg" style="font-size:12.5px;min-height:16px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button value="cancel" class="btn ghost" type="submit">Fechar</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
  }
  function openDlg() {
    if (!dlg) buildDlg();
    const body = dlg.querySelector("#syncBody");
    const form = dlg.querySelector("#syncForm");
    const msg  = dlg.querySelector("#syncMsg");
    msg.textContent = ""; form.innerHTML = "";
    if (Sync.token && Sync.profile) {
      body.innerHTML = `Conectado como <b>${escapeHtml(Sync.profile.nome)}</b>` +
        (Sync.profile.role === "admin" ? " (admin)" : "") +
        `.<br>Seu progresso deste perfil sobe e desce automaticamente. Para ver o mesmo progresso no celular, ` +
        `use o <b>QR</b> abaixo — não precisa digitar nada.`;
      const bs = document.createElement("button");
      bs.className = "btn"; bs.type = "button"; bs.textContent = "Sincronizar agora";
      bs.onclick = () => { Sync.pull().then(() => { msg.style.color = "#39d98a"; msg.textContent = "✓ sincronizado"; }); };
      form.append(bs);

      // Entrar no celular sem digitar o token: QR com a URL de login (#token=…).
      if (Sync.loginUrl() && typeof QR !== "undefined") {
        const bq = document.createElement("button");
        bq.className = "btn"; bq.type = "button"; bq.textContent = "📱 Entrar no celular (QR)";
        bq.onclick = () => mostrarQR(form, bq, msg);
        form.append(bq);
      }
      if (Sync.profile.role === "admin") {           // V2.2: só o Alex (admin) vê o editor de perfis
        const ba = document.createElement("button");
        ba.id = "syncAdminOpen"; ba.className = "btn"; ba.type = "button"; ba.textContent = "⚙ Editar perfis (admin)";
        ba.onclick = () => { try { dlg.close(); } catch (e) {} openAdmin(); };
        form.append(ba);
      }
      const bo = document.createElement("button");
      bo.className = "btn ghost"; bo.type = "button"; bo.textContent = "Sair (desconectar)";
      bo.onclick = () => { Sync.logout(); openDlg(); };
      form.append(bo);
    } else {
      body.innerHTML = `Cole o <b>seu token pessoal</b> para sincronizar o progresso entre PC e celular.` +
        `<br><span style="opacity:.8">Sem token, o painel funciona normalmente offline — como hoje. Nada sai do aparelho.</span>`;
      const inp = document.createElement("input");
      inp.type = "text"; inp.placeholder = "cole o token aqui"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.style.cssText = "width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--linha,#333);background:var(--bg,#11151f);color:inherit;font-family:monospace;font-size:13px";
      const b = document.createElement("button");
      b.className = "btn"; b.type = "button"; b.textContent = "Entrar";
      const doLogin = () => {
        const t = inp.value.trim();
        if (!t) { msg.style.color = "#ff6b6b"; msg.textContent = "cole um token."; return; }
        msg.style.color = "var(--muted)"; msg.textContent = "verificando…";
        Sync.login(t).then(ok => {
          if (ok) { msg.style.color = "#39d98a"; msg.textContent = "✓ conectado — sincronizando"; setTimeout(() => { try { dlg.close(); } catch (e) {} openDlg(); }, 700); }
          else { msg.style.color = "#ff6b6b"; msg.textContent = "token inválido ou sem conexão."; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} render(); }
        });
      };
      b.onclick = doLogin;
      inp.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); doLogin(); } });
      form.append(inp, b);
    }
    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
    const first = form.querySelector("input,button"); if (first) setTimeout(() => first.focus(), 30);
  }
  function escapeHtml(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }

  /* QR do login. O canvas é desenhado sempre em preto no branco — tema escuro não vale
     aqui, leitor de câmera precisa de contraste alto e da zona quieta em volta. */
  function mostrarQR(form, botao, msg) {
    if (form.querySelector("#syncQRBox")) return;
    const url = Sync.loginUrl();
    const box = document.createElement("div");
    box.id = "syncQRBox";
    box.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:4px";
    const cv = document.createElement("canvas");
    cv.style.cssText = "width:min(232px,62vw);height:auto;image-rendering:pixelated;border-radius:10px";
    box.appendChild(cv);
    const dica = document.createElement("div");
    dica.style.cssText = "font-size:12px;color:var(--muted,#9aa);text-align:center;line-height:1.45";
    dica.innerHTML = "Abra a <b>câmera do celular</b> e aponte. O painel abre já conectado.<br>" +
      "<span style='opacity:.75'>Vale como uma senha: quem abrir esse link entra no seu perfil.</span>";
    box.appendChild(dica);
    try { QR.draw(cv, url, 6, 4); } catch (e) { msg.style.color = "#ff6b6b"; msg.textContent = "não consegui gerar o QR."; return; }
    botao.replaceWith(box);
  }

  /* ---------- editor admin (V2.2): Alex edita a dedicatória/mensagens/curso de OUTRO perfil ---------- */
  const SEP = "\n===\n";                    // separador entre bilhetes multi-linha nos textareas
  let adlg = null, adminMeta = null, adminTarget = null;
  const F_IN = "width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--linha,#333);background:var(--bg,#11151f);color:var(--fg,#eee);font-size:13px";
  function fieldTA(label, id, val, rows) {
    const w = document.createElement("label"); w.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted,#9aa)";
    w.textContent = label;
    const t = document.createElement("textarea"); t.id = id; t.rows = rows || 4; t.value = val || "";
    t.style.cssText = F_IN + ";font-family:inherit;resize:vertical;line-height:1.45";
    w.appendChild(t); return w;
  }
  function fieldIn(label, id, val) {
    const w = document.createElement("label"); w.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted,#9aa)";
    w.textContent = label;
    const t = document.createElement("input"); t.id = id; t.type = "text"; t.value = val || ""; t.style.cssText = F_IN;
    w.appendChild(t); return w;
  }
  function buildAdmin() {
    adlg = document.createElement("dialog");
    adlg.id = "syncAdminDlg";
    adlg.style.cssText = "border:none;border-radius:14px;max-width:640px;width:94vw;padding:0;color:var(--fg,#eee);background:var(--card,#1b2130)";
    adlg.innerHTML = `
      <div style="padding:20px 22px;display:flex;flex-direction:column;gap:12px;max-height:88vh;overflow:auto">
        <div style="font-size:18px;font-weight:700">⚙ Editar perfis (admin)</div>
        <div style="font-size:12.5px;color:var(--muted,#9aa)">Edita a dedicatória e as mensagens da pessoa — o painel dela reflete no próximo sync. O <b>progresso de estudo</b> dela não é alterado aqui.</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:13px">Perfil:</span>
          <select id="adminSel" style="flex:1;${F_IN}"></select>
          <button id="adminReload" class="btn ghost" type="button" style="padding:6px 10px">↻</button>
        </div>
        <div id="adminProg" style="font-size:12px;color:var(--muted,#9aa)"></div>
        <div id="adminFields" style="display:flex;flex-direction:column;gap:10px"></div>
        <div id="adminMsg" style="font-size:12.5px;min-height:16px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="adminSave" class="btn" type="button">Salvar</button>
          <button id="adminClose" class="btn ghost" type="button">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(adlg);
    adlg.querySelector("#adminClose").onclick = () => { try { adlg.close(); } catch (e) {} };
    adlg.querySelector("#adminReload").onclick = () => loadAdminList();
    adlg.querySelector("#adminSel").onchange = () => loadAdminTarget(adlg.querySelector("#adminSel").value);
    adlg.querySelector("#adminSave").onclick = saveAdmin;
  }
  async function loadAdminList() {
    const sel = adlg.querySelector("#adminSel"), msg = adlg.querySelector("#adminMsg");
    msg.style.color = "var(--muted)"; msg.textContent = "carregando…";
    try {
      const r = await fetch(apiBase() + "/admin", { headers: { Authorization: "Bearer " + Sync.token } });
      if (!r.ok) { msg.style.color = "#ff6b6b"; msg.textContent = r.status === 403 ? "seu token não é admin." : "erro ao listar perfis."; return; }
      const j = await r.json(); sel.innerHTML = "";
      (j.profiles || []).forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.nome + (p.role === "admin" ? " (admin)" : "") + (p.hasMeta ? " · perfil" : ""); sel.appendChild(o); });
      msg.textContent = "";
      const first = (j.profiles || []).find(p => p.role !== "admin") || (j.profiles || [])[0];
      if (first) { sel.value = first.id; loadAdminTarget(first.id); }
    } catch (e) { msg.style.color = "#ff6b6b"; msg.textContent = "offline."; }
  }
  async function loadAdminTarget(id) {
    adminTarget = id;
    const fields = adlg.querySelector("#adminFields"), prog = adlg.querySelector("#adminProg"), msg = adlg.querySelector("#adminMsg");
    fields.innerHTML = ""; prog.textContent = "carregando " + id + "…"; msg.textContent = "";
    try {
      const r = await fetch(apiBase() + "/admin?target=" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + Sync.token } });
      if (!r.ok) { prog.textContent = ""; msg.style.color = "#ff6b6b"; msg.textContent = "erro ao carregar."; return; }
      const j = await r.json();
      adminMeta = j.profile.meta || {};
      const sec = j.sections || {};
      const topics = sec.topics && sec.topics.data ? Object.keys(sec.topics.data).length : 0;
      const sim = sec.simulados && Array.isArray(sec.simulados.data) ? sec.simulados.data.length : 0;
      const last = Object.values(sec).reduce((m, s) => Math.max(m, (s && s.updated_at) || 0), 0);
      prog.textContent = "Progresso dela: " + topics + " tópicos mexidos · " + sim + " simulados · " +
        (last ? ("último " + new Date(last).toLocaleDateString("pt-BR")) : "sem atividade ainda");
      renderAdminFields();
    } catch (e) { prog.textContent = ""; msg.style.color = "#ff6b6b"; msg.textContent = "offline."; }
  }
  function renderAdminFields() {
    const fields = adlg.querySelector("#adminFields"); fields.innerHTML = "";
    const m = adminMeta || {}, ded = m.dedicatoria || {}, ms = m.mensagens || {};
    if (!m.dedicatoria && !m.mensagens) { fields.innerHTML = `<div style="font-size:12.5px;color:var(--muted)">Este perfil não tem dedicatória/mensagens (sem kit). Nada a editar.</div>`; return; }
    fields.appendChild(fieldTA("Carta (dedicatória)", "f_carta", ded.mensagem, 6));
    fields.appendChild(fieldIn("Assinatura", "f_ass", ded.assinatura));
    fields.appendChild(fieldIn("Curso-alvo (id, ex.: biomed)", "f_curso", m.curso));
    fields.appendChild(fieldTA("Saudações do hero — 1 por linha", "f_saud", (ms.saudacoes || []).join("\n"), 5));
    fields.appendChild(fieldTA("Bilhetes de META (≥70%) — separe cada um por uma linha só com ===", "f_meta", (ms.meta || []).join(SEP), 7));
    fields.appendChild(fieldTA("Bilhetes de ÂNIMO (≤40%) — separe por ===", "f_animo", (ms.animo || []).join(SEP), 7));
  }
  async function saveAdmin() {
    const msg = adlg.querySelector("#adminMsg");
    if (!adminMeta || !adminTarget) return;
    const g = id => { const e = adlg.querySelector("#" + id); return e ? e.value : ""; };
    if (!adlg.querySelector("#f_carta")) { msg.style.color = "#ff6b6b"; msg.textContent = "nada a salvar neste perfil."; return; }
    const meta = JSON.parse(JSON.stringify(adminMeta));   // preserva fotos/imagens/nome/emoji/titulo
    meta.dedicatoria = meta.dedicatoria || {};
    meta.dedicatoria.mensagem = g("f_carta");
    meta.dedicatoria.assinatura = g("f_ass");
    meta.mensagens = meta.mensagens || {};
    meta.mensagens.saudacoes = g("f_saud").split("\n").map(s => s.trim()).filter(Boolean);
    meta.mensagens.meta = g("f_meta").split(/\n===\n/).map(s => s.trim()).filter(Boolean);
    meta.mensagens.animo = g("f_animo").split(/\n===\n/).map(s => s.trim()).filter(Boolean);
    const curso = g("f_curso").trim(); if (curso) meta.curso = curso;
    msg.style.color = "var(--muted)"; msg.textContent = "salvando…";
    try {
      const r = await fetch(apiBase() + "/admin?target=" + encodeURIComponent(adminTarget), {
        method: "PUT", headers: { Authorization: "Bearer " + Sync.token, "Content-Type": "application/json" },
        body: JSON.stringify({ meta, curso: curso || undefined }),
      });
      if (!r.ok) { msg.style.color = "#ff6b6b"; msg.textContent = "erro ao salvar (" + r.status + ")."; return; }
      adminMeta = meta;
      msg.style.color = "#39d98a"; msg.textContent = "✓ salvo — o painel dela reflete no próximo sync/abertura dela.";
    } catch (e) { msg.style.color = "#ff6b6b"; msg.textContent = "offline."; }
  }
  function openAdmin() {
    if (!adlg) buildAdmin();
    try { adlg.showModal(); } catch (e) { adlg.setAttribute("open", ""); }
    loadAdminList();
  }

  /* ---------- login por link/QR ----------
     Digitar 48 caracteres hexadecimais no celular é inviável na prática — então o token
     também entra pela URL (#token=…). Some do endereço no mesmo instante em que é lido
     (replaceState), pra não ficar no histórico nem vazar num compartilhamento de link. */
  function tokenDaURL() {
    const h = location.hash || "";
    const m = h.match(/[#&]token=([A-Za-z0-9._-]+)/);
    if (!m) return null;
    const t = m[1];
    const limpo = h.replace(/[#&]token=[A-Za-z0-9._-]+/, "");
    try { history.replaceState(null, "", location.pathname + location.search + (limpo === "#" ? "" : limpo)); }
    catch (e) { location.hash = limpo; }
    return t;
  }

  // URL que o QR carrega. Só faz sentido no site (http/https); em file:// não há link a dar.
  Sync.loginUrl = function () {
    if (!Sync.token || !/^https?:$/.test(location.protocol)) return null;
    return location.origin + location.pathname + "#token=" + Sync.token;
  };

  /* ---------- boot ---------- */
  function boot() {
    injectUI();
    snap();                              // baseline = estado atual (evita push espúrio do que já existe)
    const t = tokenDaURL();
    if (t && t !== Sync.token) {         // veio de um QR/link: entra e avisa
      Sync.login(t).then(ok => {
        if (ok) { toast("✓ conectado — seu progresso vai sincronizar sozinho"); return; }
        // Sem rede NÃO é token inválido: o celular pode ter aberto o link no elevador.
        // Só descarto o token num 401 de verdade; offline eu guardo e tento de novo.
        if (Sync.lastErro === "auth") { Sync.logout(); toast("⚠ esse link de login não vale mais"); }
        else { status("off"); hookOnline(); toast("sem conexão agora — sincroniza quando voltar"); }
      });
      return;
    }
    if (Sync.ativo()) { try { Sync.pull(); } catch (e) {} }
  }

  function toast(msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:22px;z-index:99;" +
      "background:var(--raised,#1b2130);color:var(--ink,#eee);border:1px solid var(--border,#333);" +
      "border-radius:99px;padding:10px 18px;font-size:13.5px;box-shadow:0 6px 24px #0007";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
