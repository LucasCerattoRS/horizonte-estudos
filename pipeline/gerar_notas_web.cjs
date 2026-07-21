#!/usr/bin/env node
/* ============================================================
   gerar_notas_web.cjs — leva o CONTEÚDO das notas do cofre para o painel WEB.
   Lê cofre-obsidian/<Disciplina>/<Tópico>.md (fonte de verdade do conteúdo,
   escrito uma vez pelo pipeline antigo) e extrai Resumo · Fórmulas · Pegadinhas
   · subtópicos, gerando painel/notas-data.js (global NOTAS_BASE, chave = topicId).
   Assim quem NÃO tem Obsidian (ex.: a Bia, pelo link web) lê o conteúdo no painel.
   Idempotente e read-only sobre o cofre. Regerar: node pipeline/gerar_notas_web.cjs
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { DISCIPLINAS } = require(path.join(__dirname, "..", "painel", "edital-data.js"));

const ROOT = path.join(__dirname, "..", "cofre-obsidian");
const san = s => s.replace(/[*"\\/<>:|?#^\[\]]/g, "–"); // = san do gerar_cofre / sanO do app.js
const topicId = (discId, ei, ti) => `${discId}.${ei}.${ti}`;

/* Extrai o texto de uma seção "## <Cabeçalho>" até o próximo "## " / recursos / hr final. */
function corta(md, header) {
  const linhas = md.split(/\r?\n/);
  let dentro = false, buf = [];
  for (const ln of linhas) {
    if (ln.startsWith("## ")) { dentro = ln.startsWith(header); continue; }
    if (dentro) {
      if (ln.startsWith("<!-- RECURSOS") || ln.startsWith("> Provas antigas")) break;
      buf.push(ln);
    }
  }
  return buf.join("\n").replace(/^\n+|\n+$/g, "").trim();
}

/* Subtópicos: itens "> - [ ] ..." do bloco "Programa oficial", antes do 1º "## ". */
function subtopicos(md) {
  const out = [];
  for (const ln of md.split(/\r?\n/)) {
    if (ln.startsWith("## ")) break;
    const m = ln.match(/^>\s*-\s*\[[ xX]\]\s*(.+)$/);
    if (m) { const t = m[1].trim(); if (t && !/^\(ver programa\)$/i.test(t)) out.push(t); }
  }
  return out;
}

const NOTAS = {};
let comConteudo = 0, semArquivo = 0, vazias = 0;

for (const d of DISCIPLINAS) {
  if (!d.eixos) continue;                       // pula ENEM_EXTRA (Artes/Redação ENEM sem eixos)
  d.eixos.forEach((ex, ei) => {
    ex.topicos.forEach((tp, ti) => {
      const id = topicId(d.id, ei, ti);
      const f = path.join(ROOT, san(d.nome), san(tp.nome) + ".md");
      if (!fs.existsSync(f)) { semArquivo++; return; }
      const md = fs.readFileSync(f, "utf8");
      const nota = {
        subs: subtopicos(md),
        resumo: corta(md, "## Resumo"),
        formulas: corta(md, "## Fórmulas"),
        pegadinhas: corta(md, "## Pegadinhas"),
      };
      // só entra se tiver ALGO de conteúdo real (senão a caixa fica vazia à toa)
      if (!nota.resumo && !nota.formulas && !nota.pegadinhas) { vazias++; return; }
      // remove campos vazios para o arquivo ficar enxuto
      Object.keys(nota).forEach(k => {
        if (!nota[k] || (Array.isArray(nota[k]) && !nota[k].length)) delete nota[k];
      });
      NOTAS[id] = nota;
      comConteudo++;
    });
  });
}

const linhas = Object.keys(NOTAS).map(id => `  ${JSON.stringify(id)}: ${JSON.stringify(NOTAS[id])}`);
const saida =
`/* ============================================================
   notas-data.js — GERADO por pipeline/gerar_notas_web.cjs. NÃO editar à mão.
   Conteúdo-base de estudo por tópico (Resumo/Fórmulas/Pegadinhas/subtópicos),
   extraído do cofre Obsidian para o LEITOR DE NOTAS do painel web — para quem
   não tem Obsidian (ex.: pelo link do navegador). As anotações da pessoa NÃO
   ficam aqui (vão no localStorage do perfil). Regerar: node pipeline/gerar_notas_web.cjs
   ============================================================ */
const NOTAS_BASE = {
${linhas.join(",\n")}
};
if (typeof module !== "undefined") module.exports = { NOTAS_BASE };
`;

fs.writeFileSync(path.join(__dirname, "..", "painel", "notas-data.js"), saida);
console.log(`notas-data.js gerado: ${comConteudo} tópicos com conteúdo · ${vazias} sem texto (puladas) · ${semArquivo} sem .md`);
