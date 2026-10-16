/* Estado salvo corrompido no localStorage não pode derrubar o boot (antes: TypeError e tela em
   branco). Sobe o próprio servidor, grava cada variante ruim, recarrega e exige: nenhum erro de
   JS e o painel renderizado. Uso: node pipeline/verificar/test-estado-corrompido.js */
const http = require("http"), fs = require("fs"), path = require("path");
const { open } = require("./cdp.js");
const ROOT = path.resolve(__dirname, "../..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".webmanifest":"application/manifest+json", ".png":"image/png" };
const srv = http.createServer((req, r) => {
  const fp = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(fp, (e, buf) => {
    if (e) { r.writeHead(404); return r.end("no"); }
    r.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control":"no-store" }); r.end(buf);
  });
});
const IDX = "painelUFRGS_index", PERFIL = "painelUFRGS_v1__alex";
const CASOS = {
  "índice {}": [IDX, "{}"], "índice null": [IDX, "null"], "índice sem perfis": [IDX, '{"active":"x","profiles":[]}'],
  "perfil ativo inexistente": [IDX, '{"active":"x","profiles":[{"id":"alex","nome":"A"}]}'],
  "sessions null": [PERFIL, '{"sessions":null}'], "topics string": [PERFIL, '{"topics":"x"}'],
  "curso inválido": [PERFIL, '{"curso":"zzz"}'], "sessões lixo": [PERFIL, '{"sessions":[null,{"min":"abc"},{"date":5,"min":-3}]}'],
  "estado null": [PERFIL, "null"], "estado array": [PERFIL, "[1,2]"], "JSON quebrado": [PERFIL, "{oops"],
};
(async () => {
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${srv.address().port}/painel/index.html`;
  const p = await open({ wait: 1500 });
  const falhas = [];
  try {
    await p.goto(url);
    for (const [nome, [k, v]] of Object.entries(CASOS)) {
      await p.eval(`localStorage.clear(); localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)}); return 1`);
      p.errors.length = 0;
      await p.goto(url);
      const kpis = await p.eval(`return document.querySelectorAll("#profileSel option").length`);
      if (p.errors.length) falhas.push(`${nome}: erro de JS — ${String(p.errors[0]).split("\n")[0]}`);
      else if (!kpis) falhas.push(`${nome}: painel não renderizou`);
    }
    // minutos digitados: texto/exponencial/absurdo não gravam sessão
    await p.eval(`localStorage.clear(); return 1`); await p.goto(url);
    const gravadas = await p.eval(`
      const antes = S.sessions.length, ent = $("#logMin");
      for (const v of ["1e3", "99999", "0", ""]) { ent.value = v; logSession(); }
      return S.sessions.length - antes;`);
    if (gravadas) falhas.push(`logSession gravou ${gravadas} sessão(ões) com minutos inválidos`);

    // 16/10: min salvo como texto ("30") tem de virar número (antes: totals[d] + "30" concatenava)
    await p.eval(`localStorage.clear(); localStorage.setItem(${JSON.stringify(PERFIL)}, JSON.stringify({ sessions: [
      { date: todayKey(), min: "30" }, { date: todayKey(), min: 15 }, { date: todayKey(), min: null }] })); return 1`);
    p.errors.length = 0; await p.goto(url);
    const mins = await p.eval(`return S.sessions.map(s => s.min)`);
    const semana = await p.eval(`renderWeek(); return $("#weekTotal").textContent`);
    if (!/· 45 min$/.test(semana)) falhas.push(`total da semana com min texto: "${semana}" (esperava 45 min)`);
    if (JSON.stringify(mins) !== "[30,15]") falhas.push(`min texto/null no localStorage: esperava [30,15], veio ${JSON.stringify(mins)}`);
    if (p.errors.length) falhas.push(`min texto: erro de JS — ${String(p.errors[0]).split("\n")[0]}`);

    // 16/10: Sync.pull com estado remoto ruim passa pela mesma sanitização e a tela continua de pé
    await p.eval(`localStorage.clear(); return 1`); await p.goto(url);
    p.errors.length = 0;
    const pos = await p.eval(`
      localStorage.setItem("painelUFRGS_token", "tok-teste");
      const sec = d => ({ data: d, updated_at: Date.now() + 1e6 });
      window.fetch = async () => new Response(JSON.stringify({ profile: { id: "t", nome: "T" }, sections: {
        sessions: sec([{ date: todayKey(), min: "30" }, null, { date: todayKey(), min: null }]),
        topics: sec("lixo"), questions: sec(null), bancoResp: sec([1]), curso: sec("zzz") } }), { status: 200 });
      await Sync.pull();
      for (const t of ["painel", "metricas", "analise", "revisao", "edital", "banco", "simulador"]) { try { go(t); } catch (e) { return "go(" + t + "): " + e.message; } }
      return JSON.stringify([S.sessions.map(s => s.min), typeof S.topics, Array.isArray(S.questions), S.curso]);`);
    if (pos !== JSON.stringify([[30], "object", true, "geral"])) falhas.push(`Sync.pull com remoto ruim: ${pos}`);
    if (p.errors.length) falhas.push(`Sync.pull com remoto ruim: erro de JS — ${String(p.errors[0]).split("\n")[0]}`);
  } finally { p.close(); srv.close(); }
  if (falhas.length) { console.log("❌ FALHOU\n - " + falhas.join("\n - ")); process.exit(1); }
  console.log(`✅ estado corrompido: ${Object.keys(CASOS).length} variantes abrem sem erro; minutos inválidos não gravam; min texto vira número; Sync.pull remoto ruim sanitizado`);
  process.exit(0);
})();
