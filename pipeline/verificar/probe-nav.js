/* Verifica o eixo ② data-nav (lateral/topo/inferior) — LAYOUT MOLDÁVEL.
   Servidor http embutido (localStorage/SW exigem origem http; e some com o processo,
   sem zumbi). Mede os 3 layouts em 1440 e 1920, a ortogonalidade com o tema (cor do
   ativo preservada pelo :where), a persistência no reload (boot pré-paint) e prova que
   o eixo é INERTE no celular. CHROME=".../msedge.exe" node scratchpad/probe-nav.js */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { open, sleep } = require("./cdp.js");

const ROOT = path.resolve(__dirname, "../..");        // raiz do repo (serve /painel/…)
const SAIDA = process.env.SAIDA || process.env.TEMP || "/tmp";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript",
  ".json":"application/json", ".webmanifest":"application/manifest+json",
  ".css":"text/css", ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      let u = decodeURIComponent(req.url.split("?")[0]);
      if (u.endsWith("/")) u += "index.html";
      const fp = path.join(ROOT, u);
      fs.readFile(fp, (e, buf) => {
        if (e) { r.writeHead(404); return r.end("no"); }
        r.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream",
          "Cache-Control": "no-store" });
        r.end(buf);
      });
    });
    srv.listen(0, "127.0.0.1", () => res({ srv, port: srv.address().port }));
  });
}

const ok = [], bad = [];
const check = (cond, msg) => (cond ? ok : bad).push(msg);

// snapshot do estado de layout que interessa
const MEASURE = `
  const num = v => Math.round(parseFloat(v) || 0);
  const H = document.querySelector("header.top"), N = document.getElementById("nav"),
        M = document.querySelector("main.wrap"), BN = document.getElementById("botNav"),
        NP = document.querySelector(".nav-pick"), ON = document.querySelector(".nav button.on");
  const cs = e => e ? getComputedStyle(e) : {};
  const rc = e => { const b = e.getBoundingClientRect(); return {l:Math.round(b.left),t:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom)}; };
  const onBtn = document.querySelector(".nav-pick button.on");
  return {
    navAttr: document.documentElement.dataset.nav || null,
    theme: document.documentElement.dataset.theme || "escuro",
    style: document.documentElement.dataset.style || "literaria",
    hdrPos: cs(H).position, hdrRect: rc(H),
    navPos: cs(N).position, navDir: cs(N).flexDirection, navRect: rc(N),
    mainML: num(cs(M).marginLeft), mainMR: num(cs(M).marginRight), mainPB: num(cs(M).paddingBottom),
    botNav: cs(BN).display,
    navPickDisp: cs(NP).display, navPickOn: onBtn ? onBtn.dataset.nav : null,
    activeExists: !!ON, activeBgImg: ON ? cs(ON).backgroundImage : "",
    activeBgCol: ON ? cs(ON).backgroundColor : "", activeShadow: ON ? cs(ON).boxShadow : "",
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    innerW: window.innerWidth, innerH: window.innerHeight
  };`;

(async () => {
  const { srv, port } = await serve();
  const URL = `http://127.0.0.1:${port}/painel/index.html`;
  const p = await open({ wait: 1600 });
  const out = { desktop: {}, ortho: {}, persist: {}, sweep: {}, mobile: {} };

  await p.goto(URL);
  await sleep(400);

  // ---------- 1) os 3 layouts em várias larguras (regra CLAUDE.md: 2560→1100) ----------
  for (const W of [2560, 1920, 1440, 1100]) {
    await p.send("Emulation.setDeviceMetricsOverride",
      { width: W, height: 1000, deviceScaleFactor: 1, mobile: false });
    out.desktop[W] = {};
    for (const nav of ["lateral", "topo", "inferior"]) {
      await p.eval(`setNav(${JSON.stringify(nav)}); return 1;`);
      await sleep(680);                    // withWipe troca no pico (220ms) + folga
      const m = await p.eval(MEASURE);
      out.desktop[W][nav] = m;

      check(m.navPickOn === nav, `[${W}] picker acende '${nav}' (got ${m.navPickOn})`);
      check(m.navPickDisp === "flex", `[${W}] nav-pick visível no desktop (${m.navPickDisp})`);
      check(m.botNav === "none", `[${W}] #botNav escondido no desktop em ${nav} (${m.botNav})`);
      check(m.activeExists, `[${W}] ${nav}: aba ativa existe`);
      check(m.overflowX <= 1, `[${W}] ${nav}: sem rolagem horizontal (overflow ${m.overflowX})`);

      if (nav === "lateral") {
        check(m.navAttr === null, `[${W}] lateral = sem atributo (got ${m.navAttr})`);
        check(m.hdrPos === "fixed", `[${W}] lateral: header FIXO (sidebar) (${m.hdrPos})`);
        check(m.hdrRect.l === 0 && m.hdrRect.w >= 220 && m.hdrRect.w <= 250,
          `[${W}] lateral: sidebar à esq ~236 (l=${m.hdrRect.l} w=${m.hdrRect.w})`);
        check(m.navDir === "column", `[${W}] lateral: nav vertical (${m.navDir})`);
        check(m.mainML >= 220, `[${W}] lateral: conteúdo deslocado p/ dir (ml=${m.mainML})`);
      }
      if (nav === "topo") {
        check(m.navAttr === "topo", `[${W}] topo: atributo setado`);
        check(m.hdrPos === "sticky", `[${W}] topo: header sticky no topo (${m.hdrPos})`);
        check(m.hdrRect.l === 0 && m.hdrRect.w >= W - 5, `[${W}] topo: header largura cheia (w=${m.hdrRect.w})`);
        check(m.navDir === "row", `[${W}] topo: nav horizontal (${m.navDir})`);
        check(Math.abs(m.mainML - m.mainMR) <= 2, `[${W}] topo: conteúdo centrado, sem margem de sidebar (ml=${m.mainML} mr=${m.mainMR})`);
      }
      if (nav === "inferior") {
        check(m.navAttr === "inferior", `[${W}] inferior: atributo setado`);
        check(m.navPos === "fixed", `[${W}] inferior: nav FIXA (${m.navPos})`);
        check(Math.abs(m.navRect.bottom - m.innerH) <= 2, `[${W}] inferior: nav colada embaixo (bottom=${m.navRect.bottom} vh=${m.innerH})`);
        check(m.mainPB >= 80, `[${W}] inferior: main tem padding-bottom p/ não cobrir (pb=${m.mainPB})`);
        check(Math.abs(m.mainML - m.mainMR) <= 2, `[${W}] inferior: conteúdo centrado (ml=${m.mainML} mr=${m.mainMR})`);
      }

      if (W === 1440) {   // capturas p/ o olho humano
        await p.eval(`document.querySelectorAll("*").forEach(e=>e.style.animation="none"); return 1;`);
        await p.shot(path.join(SAIDA, `nav-${nav}.png`));
      }
    }
  }

  // ---------- 2) ortogonalidade + cor do ativo (o teste do :where) ----------
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  // escuro: lateral tem trilho inset; topo cai na pílula sunset sólida
  await p.eval(`setTema("escuro"); return 1;`); await sleep(500);
  await p.eval(`setNav("lateral"); return 1;`); await sleep(680);
  let a = await p.eval(MEASURE); out.ortho.escuro_lateral = { shadow: a.activeShadow, bg: a.activeBgCol };
  check(/inset/.test(a.activeShadow), `escuro+lateral: ativo tem trilho inset (${a.activeShadow.slice(0,40)})`);
  await p.eval(`setNav("topo"); return 1;`); await sleep(680);
  a = await p.eval(MEASURE); out.ortho.escuro_topo = { shadow: a.activeShadow, bg: a.activeBgCol };
  check(!/inset/.test(a.activeShadow), `escuro+topo: ativo SEM trilho inset (pílula) (${a.activeShadow.slice(0,30)})`);
  const sunset = await p.eval(`return getComputedStyle(document.documentElement).getPropertyValue("--sunset").trim();`);
  // gradiente: a cor especial do ativo (var(--grad)) tem de sobreviver nos DOIS layouts
  await p.eval(`setTema("gradiente"); return 1;`); await sleep(500);
  await p.eval(`setNav("lateral"); return 1;`); await sleep(680);
  a = await p.eval(MEASURE); out.ortho.grad_lateral = { bgImg: a.activeBgImg, theme: a.theme, nav: a.navAttr };
  check(/gradient/.test(a.activeBgImg), `gradiente+lateral: ativo mantém o gradiente (:where não roubou) — ${a.activeBgImg.slice(0,30)}`);
  await p.eval(`setNav("topo"); return 1;`); await sleep(680);
  a = await p.eval(MEASURE); out.ortho.grad_topo = { bgImg: a.activeBgImg, theme: a.theme, nav: a.navAttr };
  check(/gradient/.test(a.activeBgImg), `gradiente+topo: ativo mantém o gradiente — ${a.activeBgImg.slice(0,30)}`);
  check(a.theme === "gradiente" && a.navAttr === "topo", `ortogonal: trocar nav NÃO mexeu no tema (theme=${a.theme} nav=${a.navAttr})`);
  // e trocar o Look preserva o nav
  await p.eval(`setEstilo("linear"); return 1;`); await sleep(680);
  a = await p.eval(MEASURE); out.ortho.pos_estilo = { style: a.style, nav: a.navAttr };
  check(a.navAttr === "topo", `ortogonal: trocar Look NÃO mexeu no nav (nav=${a.navAttr})`);

  // ---------- 3) persistência (reload → boot pré-paint reaplica) ----------
  await p.eval(`setTema("escuro"); setEstilo("literaria"); setNav("inferior"); return 1;`);
  await sleep(680);   // a troca roda no pico da animação (220ms): ler antes disso pega o valor antigo
  const ls = await p.eval(`return localStorage.getItem("painelNav");`);
  await p.goto(URL); await sleep(1200);
  const after = await p.eval(`return document.documentElement.dataset.nav || null;`);
  out.persist = { localStorage: ls, aposReload: after };
  check(ls === "inferior", `persist: painelNav gravado (${ls})`);
  check(after === "inferior", `persist: reload reaplicou data-nav (${after})`);

  // ---------- 4) sweep das 10 abas nos 3 layouts (erro JS / overflow) ----------
  const TABS = ["painel","edital","recursos","revisao","metricas","analise","banco","redacao","leituras","simulador"];
  const errBase = p.errors.length;
  for (const nav of ["lateral","topo","inferior"]) {
    await p.eval(`setNav(${JSON.stringify(nav)}); return 1;`); await sleep(680);
    const probs = [];
    for (const t of TABS) {
      const r = await p.eval(`go(${JSON.stringify(t)});
        const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const on = document.querySelector("#tab-"+${JSON.stringify(t)}+".on");
        return { ov, rendered: !!on };`);
      if (r.ov > 1) probs.push(`${t} overflow ${r.ov}`);
      if (!r.rendered) probs.push(`${t} não renderizou`);
    }
    out.sweep[nav] = probs;
    check(probs.length === 0, `sweep ${nav}: 10 abas sem overflow/quebra (${probs.join("; ") || "ok"})`);
  }

  // ---------- 5) INERTE no celular ----------
  const pm = await open({ mobile: true, wait: 1600 });
  await pm.goto(URL); await sleep(400);
  let mm = await pm.eval(MEASURE);
  check(mm.navPickDisp === "none", `mobile: nav-pick escondido (${mm.navPickDisp})`);
  check(mm.botNav !== "none", `mobile: #botNav visível (${mm.botNav})`);
  // força painelNav=topo e recarrega: tem de continuar barra inferior (topo é @media desktop)
  await pm.eval(`localStorage.setItem("painelNav","topo"); return 1;`);
  await pm.goto(URL); await sleep(1000);
  mm = await pm.eval(MEASURE);
  out.mobile = { navPickDisp: mm.navPickDisp, botNav: mm.botNav, navDisplay: await pm.eval(`return getComputedStyle(document.getElementById("nav")).display;`),
    navAttr: mm.navAttr, hdrPos: mm.hdrPos, hdrW: mm.hdrRect.w };
  check(mm.navAttr === "topo", `mobile: boot setou data-nav=topo (${mm.navAttr})`);
  check(out.mobile.navDisplay === "none", `mobile: a nav de topo continua escondida (.nav display=${out.mobile.navDisplay})`);
  check(mm.botNav !== "none", `mobile: #botNav segue sendo a nav, topo não vazou (${mm.botNav})`);
  check(mm.hdrPos !== "fixed" || mm.hdrRect.w > 260, `mobile: header NÃO virou sidebar (pos=${mm.hdrPos} w=${mm.hdrRect.w})`);
  await pm.shot(path.join(SAIDA, `nav-mobile.png`));

  const errs = p.errors.concat(pm.errors).filter(e => !/404|perfil-seed|redacoes-corpus|manifest|favicon/i.test(e));
  out.errosJS = errs;
  check(errs.length === 0, `0 erro de JS (${errs.length})`);

  console.log("\n===== data-nav probe =====");
  console.log(JSON.stringify(out, null, 1));
  console.log(`\n✅ PASS ${ok.length}`);
  console.log(`❌ FAIL ${bad.length}`);
  bad.forEach(b => console.log("   ✗ " + b));
  console.log(`\ncapturas: ${SAIDA}\\nav-*.png`);
  p.close(); pm.close(); srv.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error("ERRO NO PROBE:", e); process.exit(2); });
