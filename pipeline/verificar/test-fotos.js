/* Degradação sem as fotos: o site no ar tem perfil-seed.js (dedicatória + bilhetes) mas as
   imagens ficaram fora do deploy. Sobe o próprio servidor, injeta um seed SINTÉTICO apontando
   para fotos que dão 404 e confirma: nenhuma <img> quebrada visível, sem moldura vazia, texto
   intacto. Uso: node pipeline/verificar/test-fotos.js  (CHROME= se o Chromium não for achado) */
const http = require("http"), fs = require("fs"), path = require("path");
const { open } = require("./cdp.js");
const ROOT = path.resolve(__dirname, "../..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
  ".webmanifest":"application/manifest+json", ".png":"image/png" };
const SEED = `const PERFIL_SEED = { nome:"Teste", emoji:"🌱", titulo:"Painel de teste",
  dedicatoria:{ titulo:"Para Teste", mensagem:"Primeiro parágrafo.\\n\\nSegundo.", assinatura:"— eu",
    fotos:["fotos/nao-existe-1.jpg","fotos/nao-existe-2.jpg"] },
  mensagens:{ meta:["Você bateu a meta."], animo:["Dia difícil, tudo bem."],
    imagens:{ meta:["fotos/bilhete-meta.jpg"], animo:["fotos/bilhete-animo.jpg"] } } };`;

const srv = http.createServer((req, r) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/painel/perfil-seed.js") { r.writeHead(200, {"Content-Type":"text/javascript"}); return r.end(SEED); }
  const fp = path.join(ROOT, u.endsWith("/") ? u + "index.html" : u);
  fs.readFile(fp, (e, buf) => {
    if (e) { r.writeHead(404); return r.end("no"); }
    r.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control":"no-store" });
    r.end(buf);
  });
});

(async () => {
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${srv.address().port}/painel/index.html`;
  const p = await open({ wait: 2500 });
  const falhas = [];
  try {
    await p.goto(url);
    const dedic = await p.eval(`
      await new Promise(r => setTimeout(r, 800));
      const box = document.getElementById("dedic"), fw = document.getElementById("dedicFotos");
      return { aberta: !box.hidden, texto: document.getElementById("dedicMsg").textContent.length,
        imgs: fw.querySelectorAll("img").length, caixaVisivel: getComputedStyle(fw).display !== "none" };`);
    if (!dedic.aberta) falhas.push("dedicatória não abriu na 1ª visita");
    if (dedic.texto < 10) falhas.push("texto da dedicatória sumiu");
    if (dedic.imgs) falhas.push(`${dedic.imgs} <img> quebrada(s) na dedicatória`);
    if (dedic.caixaVisivel) falhas.push("moldura de fotos vazia ocupa espaço (buraco)");

    const bil = await p.eval(`
      closeDedicatoria(); localStorage.removeItem("painelUFRGS_bilhete_dia");
      mostrarBilhete(90);
      await new Promise(r => setTimeout(r, 800));
      const im = document.getElementById("dlBilheteImg");
      return { aberto: document.getElementById("dlgBilhete").open,
        texto: document.getElementById("dlBilheteBody").textContent,
        imgVisivel: getComputedStyle(im).display !== "none", src: im.getAttribute("src") };`);
    if (!bil.aberto) falhas.push("bilhete não abriu");
    if (!/meta/.test(bil.texto)) falhas.push("texto do bilhete sumiu");
    if (bil.imgVisivel) falhas.push("ícone de imagem quebrada visível no bilhete");
    if (p.errors.length) falhas.push("erros de JS: " + JSON.stringify(p.errors).slice(0, 300));
  } finally { p.close(); srv.close(); }
  if (falhas.length) { console.log("❌ FALHOU\n - " + falhas.join("\n - ")); process.exit(1); }
  console.log("✅ sem fotos: dedicatória e bilhete degradam limpo (texto ok, sem imagem quebrada, sem buraco)");
  process.exit(0);
})();
