const { open } = require("./cdp.js");
(async () => {
  for (const mob of [false, true]) {
    const p = await open({ mobile: mob, wait: 2400 });
    await p.goto("http://127.0.0.1:8899/painel/index.html");
    const r = await p.eval(`
      const abas = [...document.querySelectorAll(".nav button")].map(b => b.dataset.tab);
      const out = [];
      for (const t of abas) {
        go(t);
        const sec = document.querySelector("#tab-"+t);
        out.push({ aba: t, visivel: sec.classList.contains("on"),
          texto: sec.textContent.trim().length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth });
      }
      // wizard de redação na FUVEST (escala nova)
      go("redacao"); WIZ.banca="fuvest"; WIZ.passo=1; renderRedacao();
      const rbTxt = (document.querySelector("#tab-redacao").textContent.match(/escala \\d+/g)||[]);
      return { abas: out, escalas: [...new Set(rbTxt)],
        vw: document.documentElement.clientWidth };`);
    const ruins = r.abas.filter(a => !a.visivel || a.texto < 50 || a.overflow > 0);
    console.log(mob ? "MOBILE" : "DESKTOP", "vw=" + r.vw,
      "| abas:", r.abas.length, "| problemas:", JSON.stringify(ruins),
      "| escalas na Redação:", r.escalas.join(", "),
      "| erros JS:", p.errors.filter(e => !/404/.test(e)).length);
    p.close();
  }
})();
