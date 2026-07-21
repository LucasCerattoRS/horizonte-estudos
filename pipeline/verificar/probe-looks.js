/* "Os 4 Looks parecem duplicados, só muda a cor" — a queixa do Alex (it.6).
   Este probe mede as duas coisas que a olho nu enganam:

   1. FONTE DE VERDADE: qual família o navegador REALMENTE usou pra pintar o Hero.
      getComputedStyle devolve a PILHA que você pediu ("Bahnschrift, Archivo Black, …"),
      não o que sobreviveu — se a fonte não existe na máquina, a pilha mente e você jura
      que mudou algo. CSS.getPlatformFontsForNode (CDP) devolve a fonte usada de fato.
      4 Looks têm de dar 4 famílias DIFERENTES; se 2 baterem, são duplicados.

   2. ÂMBAR RARO: o contrato (DESIGN-SYSTEM.md) diz que --sunset só pode pintar o
      número-herói, o CTA, a aba ativa e o pôr-do-sol. Aqui se conta quantos elementos
      da tela estão de âmbar — "amador" era pintar TODO rótulo repetido de laranja.

   Uso: CHROME=".../msedge.exe" node pipeline/verificar/probe-looks.js */
const { open, sleep } = require("./cdp.js");
const path = require("path");
const LOOKS = ["literaria", "linear", "atelie", "aurora"];
const SAIDA = process.env.TEMP || "/tmp";

(async () => {
  const p = await open({ wait: 3000 });
  await p.goto("file:///" + path.resolve(__dirname, "../../painel/index.html").replace(/\\/g, "/"));
  await p.send("DOM.enable"); await p.send("CSS.enable");

  const fontesDe = async sel => {
    const doc = await p.send("DOM.getDocument", { depth: -1 });
    const q = await p.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: sel });
    if (!q.result || !q.result.nodeId) return ["(sem nó)"];
    const f = await p.send("CSS.getPlatformFontsForNode", { nodeId: q.result.nodeId });
    return (f.result.fonts || []).map(x => x.familyName);
  };

  const out = { looks: {}, ambar: null };
  for (const look of LOOKS) {
    await p.eval(`document.documentElement.dataset.style = ${JSON.stringify(look)};
      if (look !== "literaria") {} ; return 1;`.replace("if (look", "if (0"));
    await sleep(400);
    out.looks[look] = {
      hero: await fontesDe(".hero h1"),
      corpo: await fontesDe(".hero p"),
      pedido: await p.eval(`return getComputedStyle(document.querySelector(".hero h1")).fontFamily.split(",")[0];`),
    };
    await p.eval(`document.querySelectorAll("*").forEach(e => e.style.animation = "none"); return 1;`);
    await p.shot(path.join(SAIDA, `look-${look}.png`));
  }

  // fontes REALMENTE distintas entre os 4?
  const heros = LOOKS.map(l => (out.looks[l].hero[0] || "?"));
  out.familiasDistintas = [...new Set(heros)].length;
  out.duplicados = LOOKS.filter((l, i) => heros.indexOf(heros[i]) !== i)
    .map(l => `${l} usa a mesma fonte de ${LOOKS[heros.indexOf(heros[LOOKS.indexOf(l)])]}`);

  // ÂMBAR: quantos elementos VISÍVEIS estão pintados com --sunset, aba por aba?
  // (a aba inicial é "painel", não "home" — errar isso escaneia nada e devolve um
  //  falso "0 âmbar", que é pior que não medir.)
  await p.eval(`document.documentElement.dataset.style = "literaria"; return 1;`);
  out.ambar = {};
  for (const aba of ["painel", "edital", "banco", "analise", "leituras"]) {
    await p.eval(`go(${JSON.stringify(aba)}); return 1;`);
    await sleep(350);
    out.ambar[aba] = await p.eval(`
      const hex = getComputedStyle(document.documentElement).getPropertyValue("--sunset").trim();
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const alvo = "rgb(" + r + ", " + g + ", " + b + ")";
      const usa = [];
      for (const e of document.querySelectorAll("body *")) {
        const cx = e.getBoundingClientRect();
        if (!cx.width || !cx.height) continue;                       // invisível: não conta
        const s = getComputedStyle(e);
        if ([s.color, s.backgroundColor, s.borderLeftColor, s.borderTopColor, s.backgroundImage]
            .some(v => v && v.includes(alvo)))
          usa.push((typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : e.tagName)
            + (e.id ? "#" + e.id : ""));
      }
      return { n: usa.length, onde: [...new Set(usa)] };`);
  }

  out.errosJS = p.errors.filter(e => !/404|perfil-seed|redacoes-corpus|manifest/i.test(e));
  console.log(JSON.stringify(out, null, 1));
  console.log("capturas em " + SAIDA + "\\look-*.png");
  p.close();
})();
