/* Testa a agregação multi-avaliador FUVEST contra a regra oficial do Guia do Vestibular.
   Carrega as FUNÇÕES REAIS do app.js (não uma cópia) num contexto sem DOM. */
const fs = require("fs");
const vm = require("vm");

const rub = fs.readFileSync("painel/rubricas-redacao-data.js", "utf8");
const app = fs.readFileSync("painel/app.js", "utf8");

// só os blocos puros de agregação (o resto do app.js precisa de DOM)
const trechos = ["_r1", "_fmtNota", "_notaCrit", "_duasProximas", "_notaFinalDe",
  "_discrepanteEspelhado", "_agregarEspelhado", "promptCorrecao"];
let src = "";
for (const nome of trechos) {
  const re = new RegExp(`(?:^|\\n)(?:const ${nome} ?=[^\\n]*\\n|function ${nome}\\([\\s\\S]*?\\n\\})`, "m");
  const m = app.match(re);
  if (!m) throw new Error("não achei " + nome + " no app.js");
  src += m[0] + "\n";
}
const ctx = { esc: s => s, console };
vm.createContext(ctx);
vm.runInContext(rub + "\nconst _RUBRICAS = RUBRICAS;\n" + src
  + "\nObject.assign(globalThis, {RUBRICAS, _r1, _notaFinalDe, _discrepanteEspelhado, _agregarEspelhado, promptCorrecao});", ctx);

const rb = ctx.RUBRICAS.fuvest;
const aval = (t, c, g, txt = "x") => ({
  criterios: [{ id: "tema", nota: t, comentario: txt }, { id: "coer", nota: c, comentario: txt },
              { id: "gram", nota: g, comentario: txt }],
  nota_final: 0, comentario_geral: "geral",
});

const casos = [];
const T = (nome, cond, obtido) => casos.push({ nome, ok: !!cond, obtido });

// 1. rubrica bate com a fonte
T("escala 50 / mín 10", rb.escala === 50 && rb.notaMin === 10, `${rb.notaMin}–${rb.escala}`);
T("pesos 4,3,3", JSON.stringify(rb.criterios.map(c => c.peso)) === "[4,3,3]", rb.criterios.map(c => c.peso));
T("aspectos 1 a 5", rb.criterios.every(c => c.min === 1 && c.max === 5), "min/max");

// 2. nota ponderada: 5,5,5 → 50 ; 1,1,1 → 10 ; 4,3,3 → 16+9+9 = 34
const nf = cr => ctx._notaFinalDe(rb, cr);
T("5·4 + 5·3 + 5·3 = 50", nf(aval(5,5,5).criterios) === 50, nf(aval(5,5,5).criterios));
T("1·4 + 1·3 + 1·3 = 10", nf(aval(1,1,1).criterios) === 10, nf(aval(1,1,1).criterios));
T("4,3,3 → 34", nf(aval(4,3,3).criterios) === 34, nf(aval(4,3,3).criterios));
T("piso 10 (notas 0)", nf(aval(0,0,0).criterios) === 10, nf(aval(0,0,0).criterios));

// 3. discrepância: 1 ponto NÃO chama o 3º; mais de 1 ponto chama
T("dif de 1 ponto = dentro da tolerância",
  ctx._discrepanteEspelhado(rb, aval(4,4,4), aval(5,3,4)) === false, "sem 3º");
T("dif de 2 pontos = discrepante",
  ctx._discrepanteEspelhado(rb, aval(4,4,4), aval(2,4,4)) === true, "chama 3º");

// 4. 2 avaliadores divergindo 1 → média (4 e 5 → 4,5)
let r = ctx._agregarEspelhado(rb, [aval(4,4,4), aval(5,4,4)]);
T("média dos 2 no aspecto divergente (4,5)",
  r.criterios[0].nota === 4.5 && r.nota_final === ctx._r1(4.5*4 + 4*3 + 4*3), `${r.criterios[0].nota} → ${r.nota_final}`);

// 5. 3º avaliador PREVALECE (regra do Guia), não é média do par mais próximo
r = ctx._agregarEspelhado(rb, [aval(2,3,3), aval(5,3,3), aval(4,3,3)]);
T("3º prevalece: notas 2/5/4 → 4 (não 4,5 do par mais próximo)",
  r.criterios[0].nota === 4 && r.nota_final === 34, `${r.criterios[0].nota} → ${r.nota_final}`);
T("badge marca o 3º avaliador", r._aval.terceiro === true && r._aval.n === 3, r._aval);

// 6. ENEM continua com a regra dele (par mais próximo), não contaminado
const en = ctx.RUBRICAS.enem;
const av5 = (...v) => ({ criterios: en.criterios.map((c,i)=>({id:c.id, nota:v[i], comentario:"x"})),
  nota_final:0, comentario_geral:"" });
const re = ctx._agregarEspelhado(en, [av5(200,200,200,200,200), av5(80,200,200,200,200), av5(160,200,200,200,200)]);
T("ENEM ainda usa média do par mais próximo (200/80/160 → 180)",
  re.criterios[0].nota === 180, re.criterios[0].nota);
T("ENEM soma competências (sem peso)", re.nota_final === 180+200*4, re.nota_final);

// 7. o prompt manda pontuar INTEIRO de 1 a 5 e explica a soma ponderada
const p = ctx.promptCorrecao(rb, "tema x", "texto".repeat(60), null);
T("prompt: faixa 1 a 5 inteira", /1 a 5 \(número INTEIRO\), peso 4/.test(p), (p.match(/id="tema"[^\n]*/) || [])[0]);
T("prompt: soma ponderada 10 a 50", /SOMA de cada nota multiplicada pelo seu peso \(varia de 10 a 50\)/.test(p), true);
T("prompt: regras de nota zero", /tema diverso do solicitado/.test(p), true);

const falhas = casos.filter(c => !c.ok);
casos.forEach(c => console.log(`${c.ok ? "ok  " : "FALHA"} ${c.nome} → ${JSON.stringify(c.obtido)}`));
console.log(`\n${casos.length - falhas.length}/${casos.length} passaram`);
process.exit(falhas.length ? 1 : 0);
