#!/usr/bin/env node
/* ============================================================
   gerar_cofre.cjs — gera o cofre Obsidian a partir do edital
   Fonte: painel/edital-data.js (mesma sanitização do app.js,
   para os links obsidian:// do painel baterem com os arquivos).
   Idempotente: nunca sobrescreve nota de tópico já existente
   (preserva anotações do Alex); MOCs e índice são regenerados.
   Uso: node pipeline/gerar_cofre.cjs
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { DISCIPLINAS } = require(path.join(__dirname, "..", "painel", "edital-data.js"));

const ROOT = path.join(__dirname, "..", "cofre-obsidian");
const san = s => s.replace(/[*"\\/<>:|?#^\[\]]/g, "–"); // = sanO do app.js

const slug = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let criadas = 0, mantidas = 0;

function writeNote(rel, content, overwrite = false) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!overwrite && fs.existsSync(f)) { mantidas++; return; }
  fs.writeFileSync(f, content);
  criadas++;
}

/* ---------- notas de tópico ---------- */
for (const d of DISCIPLINAS) {
  const dDir = san(d.nome);
  const mocLinks = [];
  d.eixos.forEach(ex => {
    mocLinks.push(`\n### ${ex.nome}\n`);
    ex.topicos.forEach(tp => {
      const fname = san(tp.nome);
      mocLinks.push(`- [[${dDir}/${fname}|${tp.nome}]]`);
      const subs = (tp.subs || []).filter(Boolean);
      writeNote(`${dDir}/${fname}.md`,
`---
disciplina: ${d.nome}
eixo: ${ex.nome}
prova: ${d.prova}
tags: [ufrgs, ${slug(d.nome)}]
---

# ${tp.nome}

> [!info] Programa oficial — subtópicos
${subs.length ? subs.map(s => `> - [ ] ${s}`).join("\n") : "> - [ ] (ver programa)"}

## Resumo

## Fórmulas · esquemas · datas

## Pegadinhas & erros meus

## Questões relacionadas
> Provas antigas em \`pesquisa/provas-antigas/ufrgs/\` (2022–2026).
`);
    });
  });

  /* MOC da disciplina (regenerado sempre) */
  writeNote(`${dDir}/00 Mapa — ${dDir}.md`,
`---
tags: [moc, ${slug(d.nome)}]
---

# ${d.icon} ${d.nome} — mapa

${d.nota ? `> [!tip] ${d.nota}\n` : ""}${mocLinks.join("\n")}

---
Voltar: [[00 Índice]]
`, true);
}

/* ---------- índice raiz (regenerado sempre) ---------- */
writeNote(`00 Índice.md`,
`---
tags: [moc]
---

# 🎓 Cofre horizonte-estudos — Índice

Conteúdo de estudo pareado com o **painel web** (\`painel/index.html\`).
No painel, o botão 🗂 de cada tópico abre a nota correspondente aqui.

## Disciplinas
${DISCIPLINAS.map(d => `- ${d.icon} [[${san(d.nome)}/00 Mapa — ${san(d.nome)}|${d.nome}]]`).join("\n")}

## Literatura — leituras obrigatórias
- [[Literatura/Leituras Obrigatórias UFRGS 2027|Leituras 2027 (análise condensada)]]

## Referências externas (fora do cofre)
- Dossiê mestre: \`pesquisa/DOSSIE-PREPARACAO.md\`
- Provas antigas: \`pesquisa/provas-antigas/\`
- Redações nota 1000: \`pesquisa/redacoes-notamil/\` (INDICE.md)
`, true);

/* ---------- leituras obrigatórias (cópia, só se não existir) ---------- */
const leiturasSrc = path.join(__dirname, "..", "pesquisa", "UFRGS2027_leituras-analise.md");
if (fs.existsSync(leiturasSrc)) {
  writeNote(`Literatura/Leituras Obrigatórias UFRGS 2027.md`, fs.readFileSync(leiturasSrc, "utf8"));
}

console.log(`Cofre gerado em ${ROOT}`);
console.log(`  notas novas: ${criadas} · preservadas (já existiam): ${mantidas}`);
