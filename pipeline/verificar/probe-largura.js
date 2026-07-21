/* probe-largura.js — o painel numa tela GRANDE (1920) continua centrado?

   Por que existe: em 2026-07-19 o Alex mandou um print do painel "torto". Não era o
   navegador dele nem regressão: no desktop o conteúdo tinha `margin-left` fixo (a barra
   lateral) e `margin-right:auto`, ou seja, ficava ancorado à ESQUERDA. A 1920px sobravam
   564px de vazio de um lado só. As sondas não viam porque todas rodavam a 1400px, onde a
   folga é pequena demais para saltar aos olhos — o defeito só existe em tela larga.

   Checa, em várias larguras: (1) folga esquerda ≈ folga direita; (2) sem rolagem
   horizontal; (3) a grade de disciplinas não termina com fileira pela metade.

   Uso: python3 -m http.server 8899 (na raiz) && node pipeline/verificar/probe-largura.js
*/
const { open } = require("./cdp.js");

const LARGURAS = [2560, 1920, 1600, 1440, 1280, 1100];
const TOLERANCIA = 40;      // px de assimetria aceitável entre as duas folgas

(async () => {
  const falhas = [];
  for (const w of LARGURAS) {
    const p = await open({ wait: 2400 });
    await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 1035, deviceScaleFactor: 1, mobile: false });
    await p.goto("http://127.0.0.1:8899/painel/index.html");
    await new Promise(r => setTimeout(r, 900));
    const r = await p.eval(`
      const main = document.querySelector("main.wrap");
      const m = main.getBoundingClientRect();
      const barra = document.querySelector("header.top");
      const fixa = getComputedStyle(barra).position === "fixed";
      const bw = fixa ? Math.round(barra.getBoundingClientRect().width) : 0;   // no mobile a barra é topo, não coluna
      const cards = [...document.querySelectorAll("#painelDiscs > *")];
      const xs = [...new Set(cards.map(e => Math.round(e.getBoundingClientRect().x)))];
      const alturas = [...new Set(cards.map(e => Math.round(e.getBoundingClientRect().height)))];
      return {
        vw: innerWidth,
        folgaEsq: Math.round(m.x) - bw,
        folgaDir: Math.round(innerWidth - m.x - m.width),
        colunas: xs.length, nCards: cards.length, alturasDistintas: alturas.length,
        rolagemH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };`);
    const assim = Math.abs(r.folgaEsq - r.folgaDir);
    const sobra = r.nCards % r.colunas;
    const prob = [];
    if (assim > TOLERANCIA) prob.push(`assimetria de ${assim}px (esq ${r.folgaEsq} / dir ${r.folgaDir})`);
    if (r.rolagemH) prob.push("rolagem horizontal");
    if (r.alturasDistintas > 1) prob.push(`cards com ${r.alturasDistintas} alturas diferentes`);
    // Fileira incompleta só conta como defeito de 1440px pra cima. São 10 disciplinas: apenas
    // 5 ou 2 colunas fecham exato, e abaixo disso forçar 5 espremeria o card a ~189px. A meta
    // é a tela grande, onde o buraco fica óbvio; no notebook estreito, 4+4+2 é aceitável.
    if (sobra !== 0 && w >= 1440) prob.push(`última fileira pela metade (${r.nCards} cards em ${r.colunas} colunas)`);
    console.log(`${String(w).padStart(4)}px | folga esq ${String(r.folgaEsq).padStart(4)} · dir ${String(r.folgaDir).padStart(4)}` +
      ` | ${r.colunas} colunas | ${prob.length ? "⚠ " + prob.join("; ") : "ok"}`);
    if (prob.length) falhas.push(`${w}px: ${prob.join("; ")}`);
    p.close();
  }
  console.log(falhas.length ? `\n${falhas.length} largura(s) com problema` : "\ntodas as larguras ok");
  process.exit(falhas.length ? 1 : 0);
})();
