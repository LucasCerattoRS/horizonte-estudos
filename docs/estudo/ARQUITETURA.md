# 🗺 ARQUITETURA — o mapa antes dos detalhes

> A **Etapa 0** do [ROTEIRO.md](ROTEIRO.md). Leia isto antes de qualquer `.explicado.md`:
> responde "por que este arquivo existe?" e "quem chama quem?". Ao final, a seção de
> **decisões de arquitetura** (mini-ADRs) explica *por que não foi feito de outro jeito*.

---

## 1. A restrição-mãe

Uma escolha governa tudo: o painel roda **sem build, sem npm, sem servidor — direto por
`file://`** (duplo-clique no `index.html`). Dela decorre quase toda a arquitetura:

| Consequência | Por quê |
|---|---|
| Sem ES modules (`import`/`export`) | Em `file://` a origem é "opaca" e o navegador bloqueia módulos (CORS). |
| 8 `<script>` globais **em ordem** | A ordem no `index.html` **é** o grafo de dependências. |
| Dados embutidos em `const X = {…}` dentro de `.js` | `fetch("dados.json")` também é bloqueado em `file://`. |
| Guardas por **protocolo** (`/^https?:$/`) | Em `file://`, `serviceWorker` existe no `navigator` mas **lança** ao usar. |
| Vanilla JS, zero framework | Framework exigiria build; e o app precisa abrir daqui a 5 anos igual. |

## 2. O caminho de execução (do duplo-clique à primeira tela)

```
index.html
 ├─ <head>
 │   ├─ script pré-paint (l.~1015): lê tema/estilo/nav do localStorage e
 │   │   estampa data-* no <html> ANTES do 1º paint (anti-FOUC)
 │   └─ CSS inteiro inline (tokens em --var no :root; 3 eixos de tema)
 ├─ <body>: toda a UI declarada (10 abas, <dialog>s) — vazia de dados
 └─ fim do <body>, em ORDEM:
     ├─ 17 <script src> de DADOS (fases, edital, notas, …, perfil-seed, corpus)
     │    → viram const globais (DISCIPLINAS, CURSOS, BANCO_QUESTOES…)
     ├─ 8 fatias de código:
     │    app-core → app-edital → app-analise → app-plano → app-banco
     │    → app-redacao → app-painel → app.js
     │    · app-core PRIMEIRO: define $, S, save() — o vocabulário de todos
     │    · app.js POR ÚLTIMO: executa mergeCorpus(); init(); + IIFE do PWA
     └─ qr.js → sync.js (carregam DEPOIS do app.js: o boot do sync
          roda com a tela já renderizada; se há token salvo, faz pull())
```

Detalhe fino: `init()` roda **antes** de `sync.js` existir — por isso o `save()` do core
chama `Sync.onSaved()` só com a guarda `typeof Sync!=="undefined"` (gancho opcional).

## 3. Quem lê e quem escreve o estado

- **`S`** (definido em `app-core.js`) é o único estado do usuário: progresso, sessões,
  redações, respostas. Persistido por `save()` em `localStorage` na chave
  `painelUFRGS_v1__<perfil>`.
- **Ciclo de toda interação:** muta `S` → `save()` → re-render explícito da tela afetada
  (não há reatividade automática).
- **`save()` tem um gancho:** avisa `Sync.onSaved()`, que compara as seções com um retrato
  (*shadow diff*), marca as sujas e agenda um push com debounce → `/api/state`
  (Cloudflare Pages Function + D1), onde vale *last-write-wins por seção*.
- Os `*-data.js` são **só-leitura** em runtime: nascem no `pipeline/` (ou são curados à
  mão) e entram commitados no Git.

## 4. Mapa de pastas e arquivos

| Onde | O quê | Espelho |
|---|---|---|
| `painel/index.html` | Casca: HTML + CSS (3 eixos) + boot pré-paint | [index-html](index-html.explicado.md) |
| `painel/app-core.js` | Fundação: `$`, `S`, `save/load`, perfis, navegação, aparência | [app-core](app-core.explicado.md) |
| `painel/app-{edital,painel,plano,analise,banco,redacao}.js` | Uma aba (ou grupo) por fatia | [app-edital](app-edital.explicado.md) etc. |
| `painel/app.js` | O boot: `mergeCorpus()`, `init()`, registro do PWA | [app.js](app.explicado.md) |
| `painel/qr.js` · `sync.js` | Gerador de QR · sincronização entre aparelhos | [qr](qr.explicado.md), [sync](sync.explicado.md) |
| `painel/sw.js` | Service worker (cache/offline; só no site, não em `file://`) | [sw](sw.explicado.md) |
| `painel/*-data.js` | Dados: gerados pelo pipeline **ou** curados à mão (a 1ª linha diz qual) | [dados](dados.explicado.md), [edital-data](edital-data.explicado.md) |
| `functions/api/state.js` | O backend: endpoint serverless (Cloudflare + D1) | [functions-state](functions-state.explicado.md) |
| `pipeline/` | Geradores (`.cjs`/`.py`) + sondas de verificação headless (CDP) | [pipeline](pipeline.explicado.md) |
| `cofre-obsidian/` | 1 nota por tópico do edital — **gerado** por `gerar_cofre.cjs` | — |
| `pesquisa/` | Provas antigas, dossiê, análises — material estático de referência | — |

## 5. Diagrama de dependências

```
edital-data ─┐
 (dados)     ├──► app-core ──► as 6 abas (app-edital, app-painel, …) ──► app.js (boot)
outros *-data┘     (base)                                                     │
                                                                    qr.js ─► sync.js ─► /api (D1)
                                                                              sw.js (PWA)
                                                                          index.html (casca que carrega tudo)
```
Nada à direita funciona sem o que está à esquerda.

## 6. Decisões de arquitetura (mini-ADRs)

Formato: **contexto → decisão → trade-off aceito**. É o "por que não foi de outro jeito".

**ADR-0 · Sem framework, sem build (a restrição-mãe).**
Contexto: app pessoal, vitalício, 100% offline, editado em 2 máquinas/OS.
Decisão: vanilla JS por `file://`; a "biblioteca" é o navegador.
Trade-off: sem componentes reutilizáveis nem reatividade — cada render é chamado à mão;
em troca, zero dependência que apodrece, zero passo de build, abre em qualquer máquina
para sempre.

**ADR-1 · `localStorage`, não IndexedDB.**
Contexto: o estado (`S`) serializado tem poucos KB; leituras/escritas são raras (por clique).
Decisão: `localStorage` + `JSON.stringify` — API síncrona de 2 métodos.
Trade-off: síncrono (bloquearia com dados grandes) e limite de ~5 MB; IndexedDB é
assíncrono e escala, mas custa uma API de transações/cursores inteira. Para KB por
clique, a simplicidade ganha de lavada. Se um dia o estado crescer (ex.: anexos), a
fronteira de troca é o par `load()`/`save()` — um lugar só.

**ADR-2 · SVG no Painel/Cronograma, canvas na Análise.**
Contexto: duas necessidades de dataviz diferentes.
Decisão: SVG onde há **poucos elementos interativos** (anel de progresso, barras — cada
forma é nó no DOM, `onclick` de graça); canvas no **scatter** da Análise (muitos pontos,
1 nó só, hit-test manual por `Math.hypot`).
Trade-off: SVG pesa com milhares de nós; canvas exige calcular interação à mão e cuidar
de `devicePixelRatio`. Cada tela usou a ferramenta do seu regime.

**ADR-3 · SM-2, não FSRS.**
Contexto: repetição espaçada para ~131 tópicos, revisados por um usuário.
Decisão: SM-2 clássico — 15 linhas, zero dependências, comportamento explicável.
Trade-off: FSRS (Anki moderno) agenda melhor, mas exige biblioteca/parâmetros treinados —
contra a restrição-mãe. A diferença prática nessa escala não paga a complexidade.

**ADR-4 · IDs de tópico posicionais (`disc.ei.ti`), não fixos.**
Contexto: cada tópico precisa de uma chave para o progresso (`S.topics`).
Decisão: derivar o id da **posição** no `edital-data.js` (`topicId("mat",2,4)` → `"mat.2.4"`),
sem digitar/manter 131 ids à mão.
Trade-off: **reordenar** eixos/tópicos remapearia o progresso de todo mundo — por isso a
regra "ordem estável: só acrescente ao fim". Ids fixos seriam imunes, ao custo de
manutenção manual e risco de duplicata. Aceitou-se a regra de disciplina no dado.

**ADR-5 · Merge raso no `load()` (`Object.assign` sobre os padrões).**
Contexto: o schema do estado evolui; perfis salvos são de versões antigas.
Decisão: `Object.assign(structuredClone(DEFAULT_STATE), salvo)` — campo novo de 1º nível
ganha o default automaticamente (migração *forward-compatible* sem código).
Trade-off: o merge **não desce** em objetos aninhados (um campo novo dentro de
`trilha:{}` não apareceria em perfis antigos). Aceito porque o estado é raso; se um
aninhado evoluir, escreve-se migração explícita (como a do `migCursoGeral`).

**ADR-6 · Sync por last-write-wins por seção, sem fila.**
Contexto: 2+ aparelhos editando o mesmo perfil, conexão intermitente.
Decisão: particionar `S` em seções, cada uma com timestamp monotônico
(`Math.max(Date.now(), last+1)`); cliente **e** servidor aplicam a mesma regra "o ts
maior vence, por seção" + união por id nas listas. Reenviar é inofensivo → não precisa
de fila persistente de envio.
Trade-off: edições **na mesma seção** em 2 aparelhos offline → a mais nova vence e a
outra se perde (granularidade de seção, não de campo). Um CRDT de verdade preservaria
ambas, com muito mais complexidade — para 1 usuário e 2 aparelhos, LWW basta.

---

*Agora sim: volte ao [ROTEIRO.md](ROTEIRO.md) e comece a Etapa 1 (`app-core`).*
