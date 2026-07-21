const { open, sleep } = require("./cdp.js");
const path = require("path");
(async () => {
  const out = {};
  const p = await open({ mobile: true, wait: 2600 });
  await p.goto("http://127.0.0.1:8899/painel/index.html");

  // 1. manifest servido e válido
  out.manifest = await p.eval(`
    const l = document.querySelector('link[rel=manifest]');
    const r = await fetch(l.href); const m = await r.json();
    const nomes = m.icons.map(i => i.sizes + "/" + i.purpose);
    const ok = !!(m.name && m.short_name && m.start_url && m.display === "standalone" &&
      m.icons.some(i => i.sizes === "192x192") && m.icons.some(i => i.sizes === "512x512"));
    return { http: r.status, ok, display: m.display, icones: nomes, start: m.start_url };`);

  // 2. ícones existem mesmo
  out.icones = await p.eval(`
    const fs = ["icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
    const rs = await Promise.all(fs.map(f => fetch(f).then(r => f + ":" + r.status)));
    return rs;`);

  // 3. SW registra e ativa
  await sleep(1500);
  out.sw = await p.eval(`
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) return { registrado: false };
    if (!r.active) await new Promise(res => { const i = setInterval(() => { if (r.active) { clearInterval(i); res(); } }, 200); });
    const c = await caches.keys();
    return { registrado: true, escopo: r.scope, estado: r.active.state, caches: c };`);

  // 4. recarrega e mede o que veio do SW (cache)
  await p.eval(`location.reload(); return 1;`); await sleep(3000);
  out.segundaCarga = await p.eval(`
    const rs = performance.getEntriesByType("resource");
    const doSW = rs.filter(r => r.deliveryType === "cache" || r.transferSize === 0 || r.responseStatus === 200 && r.workerStart > 0);
    const banco = rs.find(r => r.name.includes("banco-questoes"));
    const c = await caches.open("horizonte-v1");
    const keys = (await c.keys()).map(r => r.url.split("/").pop());
    return { recursosViaSW: rs.filter(r => r.workerStart > 0).length, totalRecursos: rs.length,
      bancoViaSW: !!(banco && banco.workerStart > 0), bancoMs: banco ? Math.round(banco.duration) : null,
      noCache: keys.length, exemplos: keys.slice(0, 8) };`);

  // 5. OFFLINE de verdade: derruba a rede e recarrega
  out.offline = await p.eval(`
    const r = await navigator.serviceWorker.getRegistration();
    return !!r;`);
  await p.setOffline(true);
  await p.eval(`location.reload(); return 1;`); await sleep(3500);
  out.offlineApp = await p.eval(`
    return { titulo: document.title,
      temNav: document.querySelectorAll(".nav button").length,
      temBanco: typeof BQ !== "undefined" ? BQ.length : 0,
      abaAbre: (go("banco"), document.querySelector("#tab-banco").classList.contains("on")),
      online: navigator.onLine };`);
  await p.setOffline(false);
  out.errosOffline = p.errors.filter(e => !/404|Failed to load resource/.test(e));
  p.close();

  // 6. file:// continua intacto (SEM service worker, sem erro)
  const f = await open({ wait: 2600 });
  await f.goto("file://" + path.resolve("painel/index.html"));
  out.fileProtocol = await f.eval(`
    return { abas: document.querySelectorAll(".nav button").length,
      swSuportado: "serviceWorker" in navigator,
      swRegistrado: await (async () => { try { return !!(await navigator.serviceWorker.getRegistration()); }
        catch (e) { return "lanca:" + e.name; } })(),
      questoes: typeof BQ !== "undefined" ? BQ.length : 0,
      botaoInstalar: !!document.getElementById("btnInstalar") };`);
  out.errosFile = f.errors.filter(e => !/404|Failed to load|perfil-seed|manifest/i.test(e));
  f.close();

  console.log(JSON.stringify(out, null, 1));
})();
