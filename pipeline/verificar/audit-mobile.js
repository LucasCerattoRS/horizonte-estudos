const { open } = require("./cdp.js");
(async () => {
  const p = await open({ mobile: true, wait: 2600 });
  await p.goto("http://127.0.0.1:8899/painel/index.html");
  // estado realista: sessões, revisões vencidas, questões, simulado
  await p.eval(`
    const hoje = new Date(); const d = n => new Date(Date.now()-n*864e5).toISOString().slice(0,10);
    S.sessions = [0,1,2,4,7].map(n => ({date:d(n), disc:"mat", topico:"Funções", min:45+n*5, tipo:"teoria"}));
    S.topics = { "mat.0.0": {status:2, srs:{ef:2.3, itv:1, due:d(3), reps:2}},
                 "his.1.5": {status:1, srs:{ef:2.1, itv:2, due:d(1), reps:1}},
                 "fis.0.1": {status:1, srs:{ef:2.5, itv:3, due:d(5), reps:3}} };
    S.questions = [{date:d(1), disc:"mat", topico:"Funções", total:20, acertos:14}];
    S.simulados = [{date:d(2), exame:"UFRGS", ano:"2023", disc:"mat", total:15, acertos:9}];
    const bq = {}; BQ.filter(q=>q.exame==="UFRGS").slice(0,10).forEach((q,i)=>bq[q.id]={l:"A",c:i%3!==0});
    S.bancoResp = bq; save(); return 1;`);

  const abas = ["metricas", "revisao", "painel", "simulador", "leituras", "recursos", "edital", "banco", "redacao", "analise"];
  const achados = [];
  for (const t of abas) {
    const r = await p.eval(`
      go("${t}");
      const sec = document.querySelector("#tab-${t}");
      const doc = document.documentElement;
      const probs = [];
      // 1. overflow horizontal da página
      if (doc.scrollWidth > doc.clientWidth) probs.push({tipo:"overflow-pagina", px: doc.scrollWidth - doc.clientWidth});
      // 2. elemento que vaza da largura da tela
      sec.querySelectorAll("*").forEach(e => {
        const b = e.getBoundingClientRect();
        if (b.width > 0 && b.right > doc.clientWidth + 1.5 && !e.closest(".chart-wrap,[style*='overflow']"))
          probs.push({tipo:"vaza-tela", el: e.tagName+"."+(e.className||"").toString().slice(0,28), right: Math.round(b.right)});
      });
      // 3. controles invisíveis no toque (opacity 0 sem :hover) ou pequenos demais
      sec.querySelectorAll("button,a,select,input,[onclick]").forEach(e => {
        const st = getComputedStyle(e), b = e.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return;              // realmente oculto (display:none)
        if (+st.opacity < 0.15) probs.push({tipo:"invisivel-no-toque", el: e.tagName+"."+(e.className||"").toString().slice(0,28), txt: (e.textContent||"").trim().slice(0,18)});
        else if (b.height < 32 && b.height > 0) {
          // Um checkbox/radio dentro de <label> não é o alvo: tocar no rótulo já alterna.
          // Se o label cumpre os 32px, o controle só precisa dos 24px da WCAG 2.5.8.
          const lb = e.closest("label");
          const coberto = /checkbox|radio/.test(e.type||"") && lb &&
                          lb.getBoundingClientRect().height >= 32 && b.height >= 24;
          if (!coberto) probs.push({tipo:"alvo-pequeno", el: e.tagName+"."+(e.className||"").toString().slice(0,24), txt:(e.textContent||"").trim().slice(0,14), h: Math.round(b.height)});
        }
      });
      // 4. campo de texto < 16px: o Safari do iPhone dá zoom ao focar
      sec.querySelectorAll("input,select,textarea").forEach(e => {
        if (/checkbox|radio|range|hidden/.test(e.type||"")) return;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        if (fs < 16) probs.push({tipo:"campo-zoom-ios", el: e.tagName+"#"+(e.id||"")+"."+(e.className||"").toString().slice(0,20), fs});
      });
      // dedup por tipo+el
      const seen = new Set(); const uniq = [];
      probs.forEach(x => { const k = x.tipo+"|"+(x.el||""); if (!seen.has(k)) { seen.add(k); uniq.push(x); } });
      return uniq;`);
    if (r.length) achados.push({ aba: t, probs: r });
  }
  console.log("viewport:", await p.eval("return document.documentElement.clientWidth"));
  console.log(JSON.stringify(achados, null, 1));
  console.log("erros JS:", p.errors.filter(e => !/404/.test(e)));
  await p.eval(`go("metricas")`); await p.shot("/tmp/m-metricas.png");
  await p.eval(`go("revisao")`);  await p.shot("/tmp/m-crono.png");
  p.close();
})();
