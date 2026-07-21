/* O cenário REAL do celular: o Alex instala o app, abre UMA vez com internet
   (é o que a tela offline promete: "Abra o app uma vez com internet para ele
   funcionar offline") e depois entra no ônibus sem sinal.

   O probe-pwa.js antigo não testava isso: ele recarregava a página ANTES de
   cortar a rede — e é justamente a 2ª carga que enche o cache (regra 4, SWR).
   Aqui o servidor MORRE depois da 1ª visita. Matar, não emular: a emulação de
   rede do CDP já nos enganou uma vez. E a verdade de solo é do Node, não da
   página — um fetch de dentro da página atravessa o SW e responde do cache.

   Uso:  CHROME=".../msedge.exe" node pipeline/verificar/probe-offline-1visita.js */
const { open, sleep } = require("./cdp.js");
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "../..");
// porta ALEATÓRIA de propósito: um `python -m http.server 8899` zumbi de outra sessão
// ficou servindo o painel por baixo deste teste e fez o app "passar" offline (14/07).
const PORTA = 9300 + Math.floor(Math.random() * 400);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
  ".css": "text/css", ".pdf": "application/pdf" };

/* Servidor igual ao Cloudflare Pages no que importa aqui: ETag + must-revalidate,
   e responde 304 ao If-None-Match. Sem isso eu mediria o aquecimento como se ele
   rebaixasse os 4,5 MB do banco de novo — mentira que esconderia o custo real. */
function servir() {
  const socks = new Set();
  const conta = { req: 0, bytes: 0, n304: 0 };
  const srv = http.createServer((req, res) => {
    const f = path.join(RAIZ, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(f, (err, b) => {
      conta.req++;
      if (err) { res.writeHead(404); return res.end("nao encontrado"); }
      const etag = '"' + b.length + '"';
      const cab = { "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
        "Cache-Control": "public, max-age=0, must-revalidate", "ETag": etag };
      if (req.headers["if-none-match"] === etag) { conta.n304++; res.writeHead(304, cab); return res.end(); }
      conta.bytes += b.length;
      res.writeHead(200, cab);
      res.end(b);
    });
  });
  srv.on("connection", s => { socks.add(s); s.on("close", () => socks.delete(s)); });
  srv.listen(PORTA, "127.0.0.1");
  return { conta, zera: () => { conta.req = 0; conta.bytes = 0; conta.n304 = 0; },
    matar: () => new Promise(r => { socks.forEach(s => s.destroy()); srv.close(r); }) };
}

const DADOS = ["notas-data.js", "relacoes-data.js", "gabaritos-data.js", "gabaritos-enem-data.js",
  "frequencia-data.js", "redacao-data.js", "redacoes-notamil-data.js", "rubricas-redacao-data.js",
  "propostas-ufrgs-data.js", "textos-modelo-data.js", "recursos-data.js", "leituras-data.js",
  "banco-questoes-data.js", "sync.js"];
const kb = n => Math.round(n / 1024) + " KB";
const pronto = async p => { for (let i = 0; i < 60; i++) { await sleep(1000);
  try { if (await p.eval(`return document.readyState === "complete";`)) return true; } catch {} } return false; };

(async () => {
  const out = {};
  const srv = servir();
  const p = await open({ wait: 3000 });

  // ---- 1ª (e única) visita com rede
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PORTA}/painel/index.html`);
  await pronto(p);
  out.visita1 = { ms: Date.now() - t0, baixou: kb(srv.conta.bytes), requisicoes: srv.conta.req };
  out.sw = await p.eval(`
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) return { registrado: false };
    for (let i = 0; i < 40 && !r.active; i++) await new Promise(s => setTimeout(s, 200));
    return { registrado: true, estado: r.active && r.active.state, controlando: !!navigator.serviceWorker.controller };`);

  // ---- o aquecimento (o conserto): quanto custa e quanto demora
  srv.zera();
  const tq = Date.now();
  let faltando = DADOS;
  for (let i = 0; i < 45 && faltando.length; i++) {
    await sleep(1000);
    faltando = await p.eval(`
      const nome = (await caches.keys())[0]; if (!nome) return ${JSON.stringify(DADOS)};
      const c = await caches.open(nome);
      const tem = new Set((await c.keys()).map(r => r.url.split("/").pop()));
      return ${JSON.stringify(DADOS)}.filter(d => !tem.has(d));`);
  }
  out.aquecimento = { ms: Date.now() - tq, faltando,
    baixou: kb(srv.conta.bytes), requisicoes: srv.conta.req, respostas304: srv.conta.n304 };
  out.cacheFinal = await p.eval(`
    const nome = (await caches.keys())[0];
    const c = await caches.open(nome);
    return { cache: nome, n: (await c.keys()).length };`);

  // ---- o ônibus: servidor MORTO (verdade de solo pelo Node, não pela página)
  await srv.matar();
  out.servidorMorto = await new Promise(r => {
    const req = http.get(`http://127.0.0.1:${PORTA}/painel/edital-data.js`,
      res => { res.resume(); r("VIVO: HTTP " + res.statusCode); });
    req.on("error", e => r("morto (" + e.code + ")"));
  });
  if (!out.servidorMorto.startsWith("morto")) {
    console.log(JSON.stringify({ ERRO: "o servidor NÃO morreu — teste inválido", ...out }, null, 1));
    p.close(); process.exit(1);
  }

  p.errors.length = 0;
  const t2 = Date.now();
  await p.eval(`location.reload(); return 1;`);
  const completou = await pronto(p);
  out.bootOffline = { ms: completou ? Date.now() - t2 : "NUNCA TERMINOU (>60s)" };

  // ---- o app ABRE offline? e FUNCIONA offline? (as 10 abas, com conteúdo real)
  out.appOffline = await p.eval(`
    const g = n => { try { return eval("typeof " + n + " !== 'undefined'") ? eval(n) : null; } catch (e) { return null; } };
    const banco = g("BANCO_QUESTOES"), notas = g("NOTAS_BASE"), leit = g("LEITURAS"), gab = g("GABARITOS_UFRGS");
    const abas = [...document.querySelectorAll(".nav button")].map(b => b.dataset.tab);
    const ruins = [];
    for (const t of abas) {
      try { go(t); } catch (e) { ruins.push(t + ": " + e.message); continue; }
      const sec = document.querySelector("#tab-" + t);
      if (!sec.classList.contains("on") || sec.textContent.trim().length < 50) ruins.push(t + ": vazia");
    }
    return {
      questoes: Array.isArray(banco) ? banco.length : "AUSENTE",
      notas: notas ? Object.keys(notas).length : "AUSENTE",
      leituras: leit ? leit.length : "AUSENTE",
      gabaritos: gab ? Object.keys(gab).length : "AUSENTE",
      abas: abas.length, abasComProblema: ruins,
    };`);
  out.errosNoBootOffline = p.errors.filter(e => !/perfil-seed|redacoes-corpus/.test(e)).slice(0, 5);
  out.perfOffline = await p.eval(`
    const n = performance.getEntriesByType("navigation")[0];
    const rs = performance.getEntriesByType("resource")
      .map(r => ({ arq: r.name.split("/").pop(), ms: Math.round(r.duration) }))
      .sort((a, b) => b.ms - a.ms);
    return { domInteractive: Math.round(n.domInteractive), domComplete: Math.round(n.domComplete),
      piores: rs.slice(0, 6) };`);

  await p.shot(path.join(process.env.TEMP || "/tmp", "offline-1visita.png"));
  p.close();
  console.log(JSON.stringify(out, null, 1));
})();
