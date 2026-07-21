# 🧭 Roteiro de estudo — em que ordem ler

Este roteiro leva você do **fundamento** ao **avançado**, seguindo tanto a ordem de
**dependência** (o que precisa existir antes) quanto a de **dificuldade**. Cada etapa
tem um objetivo de aprendizagem claro. Não pule etapas: cada uma assume a anterior.

> Dica: leia o `.explicado.md`, mas mantenha o arquivo real (`painel/…`) aberto ao lado.
> Ver o código de verdade enquanto lê a explicação fixa muito melhor.

---

## Etapa 0 — A visão de cima
**Objetivo:** ter o mapa mental antes dos detalhes.
- **[ARQUITETURA.md](ARQUITETURA.md)** — a restrição-mãe, o caminho de execução do
  `index.html` até o boot, quem lê/escreve o estado, a tabela de pastas e as **decisões
  de arquitetura** (os mini-ADRs: "por que não foi de outro jeito").

Releia o mapa sempre que um detalhe parecer arbitrário — ele responde "por que este
arquivo existe?".

## Etapa 1 — A fundação ⭐
**Objetivo:** entender o vocabulário que TODAS as outras fatias usam.
1. **`app-core.explicado.md`** — é a base: os atalhos de DOM (`$`, `el`, `esc`), o **estado**
   `S` e o `save()`/`load()`, os **perfis**, a **navegação** (`go`), a **aparência** (3 eixos)
   e o **curso**. Nada no app faz sentido sem isto. Conceitos-chave que você vai aprender aqui:
   `localStorage`, `structuredClone` vs cópia rasa, closures, arrow functions e *hoisting*,
   *event delegation*, ternário encadeado, migração de estado versionado.

## Etapa 2 — Os dados
**Objetivo:** entender a **forma** dos dados antes da lógica que os consome.
2. **`edital-data.explicado.md`** — `CURSOS` (pesos por prova) e `DISCIPLINAS` (a árvore
   disciplina → eixo → tópico). É a espinha do app: quase toda tela itera sobre isto.
3. **`dados.explicado.md`** — uma visão de conjunto dos demais `*-data.js`: quais são
   **gerados** (blobs do pipeline) e quais são **curados à mão**, e o schema de cada um.

## Etapa 3 — As abas, da mais simples à mais complexa
**Objetivo:** ver o padrão "dados + estado → função `render*` → HTML" se repetir, subindo
a dificuldade aos poucos.
4. **`app-edital.explicado.md`** — a aba mais direta: percorre `DISCIPLINAS` e desenha a
   árvore. Boa para fixar o padrão de renderização e os deep-links do Obsidian.
5. **`app-painel.explicado.md`** — a home: hero, a Trilha de Arranque, o Foco da semana e o
   simulador Argumento (média harmônica). Junta muitos helpers da Etapa 1.
6. **`app-plano.explicado.md`** — o Cronograma: aqui entra o **algoritmo SM-2** de repetição
   espaçada. Primeiro pedaço de "ciência" do app.
7. **`app-analise.explicado.md`** — a Análise: cruza incidência da banca × seu acerto, com um
   **scatter em `<canvas>`**. Dataviz na unha. Inclui a aba Recursos.
8. **`app-banco.explicado.md`** — Questões: o banco próprio + as provas oficiais + a correção
   automática por gabarito. A fatia mais longa; mais estados e filtros.
9. **`app-redacao.explicado.md`** — Redação: um *wizard* de proposta, editor de rascunho,
   rubricas oficiais e lançamento de nota manual.

## Etapa 4 — O boot
**Objetivo:** ver como tudo é **amarrado e ligado** quando a página carrega.
10. **`app.explicado.md`** — a 8ª fatia (carrega por último): `init()` liga os selects e
    renderiza a 1ª tela; `mergeCorpus()` funde as redações; a IIFE registra o PWA. Aqui você
    entende a ordem dos `<script>` na prática.

## Etapa 5 — Sincronização entre aparelhos (avançado)
**Objetivo:** sair do navegador e falar com um backend.
11. **`sync.explicado.md`** — como o `S` viaja até o celular: token, `fetch`, resolução de
    conflitos, o painel de admin.
12. **`qr.explicado.md`** — o gerador de QR do zero (modo byte, correção de erro). Um mergulho
    autocontido em codificação — ótimo estudo isolado.
13. **`functions-state.explicado.md`** — o outro lado: uma Cloudflare Pages Function com D1.

## Etapa 6 — PWA e a casca
**Objetivo:** o que faz o app ser instalável e funcionar offline; e como o visual é montado.
14. **`sw.explicado.md`** — o service worker: estratégias de cache, o ciclo de vida, offline.
15. **`index-html.explicado.md`** — a casca, **em partes**: (a) a estrutura HTML e o script de
    boot pré-paint; (b) o sistema de temas por variáveis CSS (os 3 eixos); (c) o corpo e os
    diálogos. É o maior arquivo — por isso vem quando você já entende o JS que ele carrega.

## Etapa 7 — Como os dados nascem (opcional)
**Objetivo:** ver o pipeline que gera os `*-data.js` a partir de provas oficiais.
16. **`pipeline.explicado.md`** — os geradores (Node `.cjs` + Python `.py`) e as **sondas de
    verificação headless** (a metodologia de "verificar de verdade" via CDP).

---

## Mapa de dependências (resumo visual)
```
edital-data ─┐
 (dados)     ├──► app-core ──► as 6 abas (app-edital, app-painel, …) ──► app.js (boot)
outros *-data┘     (base)                                                     │
                                                                    qr.js ─► sync.js ─► /api (D1)
                                                                              sw.js (PWA)
                                                                          index.html (casca que carrega tudo)
```
Leia da esquerda para a direita: nada à direita funciona sem o que está à esquerda.
