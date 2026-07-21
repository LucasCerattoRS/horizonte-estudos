#!/usr/bin/env node
/* ============================================================
   injetar_recursos.cjs — linka o cofre Obsidian ao mundo
   Em cada nota de tópico existente, insere/atualiza um bloco
   delimitado (idempotente) com:
     · 🌐 Onde aprender  → incidência + busca no YouTube + canais curados
     · 🔗 Relacionados   → wikilinks aos tópicos do mesmo eixo (grafo)
   NÃO toca no conteúdo escrito à mão / pelo Gemini: só reescreve
   o que está entre os marcadores RECURSOS:START/END.
   Uso: node pipeline/injetar_recursos.cjs
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { DISCIPLINAS } = require(path.join(__dirname, "..", "painel", "edital-data.js"));
const { CANAIS, SITES, INCIDENCIA } = require(path.join(__dirname, "..", "painel", "recursos-data.js"));

const ROOT = path.join(__dirname, "..", "cofre-obsidian");
const san = s => s.replace(/[*"\\/<>:|?#^\[\]]/g, "–"); // = sanO do app.js
const START = "<!-- RECURSOS:START (gerado por pipeline/injetar_recursos.cjs — não editar à mão) -->";
const END = "<!-- RECURSOS:END -->";
const INC_LABEL = { alta: "ALTA", media: "MÉDIA", baixa: "BAIXA" };
const INC_CALLOUT = { alta: "danger", media: "info", baixa: "note" };

const ytTopico = (dNome, tpNome) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(tpNome + " " + dNome + " vestibular ENEM UFRGS")}`;

let atualizadas = 0, criadas = 0, faltando = 0;

function blocoRecursos(d, ei, tp) {
  const discId = d.id;
  const inc = (INCIDENCIA[discId] || {})[tp.nome] || "media";
  const chans = CANAIS[discId] || [];
  const eixo = d.eixos[ei];

  const linhasCanais = chans.length
    ? chans.map(c => `- [${c.nome}](${c.url}) — _${c.tier}_ · ${c.foco}`).join("\n")
    : "- (sem canal curado — use a busca acima)";

  // relacionados: irmãos do mesmo eixo (menos ele mesmo)
  const irmaos = eixo.topicos.filter(t => t.nome !== tp.nome);
  const linhasRel = irmaos.length
    ? irmaos.map(t => `- [[${san(d.nome)}/${san(t.nome)}|${t.nome}]]`).join("\n")
    : "- (único tópico do eixo)";

  return `${START}

## 🌐 Onde aprender

> [!${INC_CALLOUT[inc]}] Incidência estimada nas provas: **${INC_LABEL[inc]}**
> Leitura de curadoria (não é contagem automática). #incidencia/${inc}

- [▶ Buscar "${tp.nome}" no YouTube](${ytTopico(d.nome, tp.nome)})

**Quem propaga este assunto (${d.nome}):**
${linhasCanais}

## 🔗 Relacionados (mesmo eixo · ${eixo.nome})
${linhasRel}

${END}`;
}

for (const d of DISCIPLINAS) {
  d.eixos.forEach((ex, ei) => {
    ex.topicos.forEach(tp => {
      const rel = `${san(d.nome)}/${san(tp.nome)}.md`;
      const f = path.join(ROOT, rel);
      if (!fs.existsSync(f)) { faltando++; return; }
      let txt = fs.readFileSync(f, "utf8");
      const bloco = blocoRecursos(d, ei, tp);
      const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (re.test(txt)) {
        txt = txt.replace(re, bloco);
        atualizadas++;
      } else {
        txt = txt.replace(/\s*$/, "") + "\n\n---\n" + bloco + "\n";
        criadas++;
      }
      fs.writeFileSync(f, txt);
    });
  });
}

console.log(`Recursos injetados no cofre em ${ROOT}`);
console.log(`  blocos novos: ${criadas} · atualizados: ${atualizadas} · notas ausentes (puladas): ${faltando}`);
