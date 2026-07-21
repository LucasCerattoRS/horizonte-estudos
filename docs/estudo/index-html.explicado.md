# 🧱 `index.html` explicado — a casca (em partes)

> **Arquivo real:** `painel/index.html` (1589 linhas — o maior) · **Etapa no roteiro:** 6
> **Pré-requisitos:** idealmente **todas** as fatias de JS (este arquivo as carrega)

Este é o **maior** arquivo e o **último** a estudar de propósito: ele é a **casca** que
segura tudo — o HTML da página, o **CSS inteiro** (todos os estilos e os 3 eixos de tema) e a
ordem dos `<script>`. Como você já entende o JS que ele carrega, agora vê **onde** cada peça
mora. Vou dividir em três partes, como o roteiro pede:

- **Parte A** — a estrutura HTML e o **boot pré-*paint*** (o script que evita o "flash").
- **Parte B** — o **sistema de temas** por variáveis CSS (os 3 eixos `data-theme` × `data-style`
  × `data-nav`).
- **Parte C** — o **corpo** (header, abas, diálogos) e a ordem dos `<script>`.

> Este arquivo é o **"HTML" do contrato de design** (`pesquisa/analise/DESIGN-SYSTEM.md`). Se
> for mexer no visual, aquele documento é a referência — aqui é a implementação.

---

# Parte A — Estrutura e o boot pré-paint

## A.1 — O `<head>`: metadados e PWA

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Horizonte Estudos — UFRGS · ENEM</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0c0f16">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" href="icons/icon-192.png" type="image/png">
```

- **`<html lang="pt-BR">`** — declara o idioma (ajuda leitores de tela, tradução, hifenização).
- **`viewport … viewport-fit=cover`** — o `viewport-fit=cover` faz o conteúdo ir **até as
  bordas** em telas com entalhe (o *notch* do iPhone), essencial para um PWA parecer app.
- **`<link rel="manifest">`** — aponta o `manifest.webmanifest` (nome, ícones, cor do app
  instalável). Em `file://` é **ignorado**; no site, é o que permite "instalar".
- **`theme-color`** — a cor da barra do navegador/sistema. Repare que o boot (A.2) a
  **atualiza** conforme o tema salvo.
- **As metas `apple-*`** — o iOS não lê o manifest; precisa dessas metas específicas para o
  "Adicionar à Tela de Início" funcionar como app em tela cheia. **Conceito — compatibilidade
  por plataforma:** Android/Chrome usa o manifest; a Apple exige metas próprias; o código serve
  aos dois.

**Todos os caminhos são relativos** (`href="manifest.webmanifest"`, não `/manifest…`). O
comentário explica: o **mesmo arquivo** precisa servir em `file://` **e** em `/painel/` no
site. Caminho absoluto (`/`) quebraria no `file://`. **Conceito — caminhos relativos para
portabilidade:** nunca ancore no `/` se o arquivo pode rodar de subpastas diferentes.

## A.2 — O boot pré-paint: evitando o "flash de tema errado" (FOUC)

```html
</style>
<script>/* aplica tema+estilo salvos ANTES do 1º paint (sem flash) */
try{
  var _t=localStorage.getItem('painelTema');
  if(_t&&_t!=='escuro')document.documentElement.dataset.theme=_t;
  var _tc={escuro:'#0c0f16',guaiba:'#070f1e',claro:'#eef1f8',gradiente:'#0a0e24'}[_t||'escuro'];
  if(_tc){var _m=document.querySelector('meta[name="theme-color"]');if(_m)_m.setAttribute('content',_tc);}
  var _s=localStorage.getItem('painelEstilo');if(_s&&_s!=='literaria')document.documentElement.dataset.style=_s;
  var _n=localStorage.getItem('painelNav');if(_n&&_n!=='lateral')document.documentElement.dataset.nav=_n;
}catch(e){}</script>
</head>
```

**Este pequeno script é um dos mais importantes do projeto.** Ele lê o tema/estilo/layout
salvos e os aplica **em `<html>` antes do primeiro *paint***.

**Conceito — FOUC / flash of unstyled (ou wrong-themed) content.** Se o tema fosse aplicado só
lá no `app.js` (que carrega **por último**, depois do `<body>` já ter sido desenhado), o
usuário de tema claro veria a página **piscar escura** por um instante antes de corrigir — um
"flash" feio. A solução universal: um **script síncrono e minúsculo no `<head>`** que roda
**antes** do navegador pintar qualquer coisa, e já ajusta os atributos que o CSS usa. Como o
CSS `:root[data-theme="claro"]{…}` já está carregado (o `<style>` vem antes), a página nasce
**já** no tema certo. Frameworks de tema (next-themes etc.) fazem exatamente isto por baixo.

**A convenção "default = sem atributo".** Repare: só seta `dataset.theme` **se** o valor
salvo **não** é o padrão (`_t !== 'escuro'`). O tema escuro, o Look literário e a nav lateral
são os **padrões** e **não** recebem atributo nenhum — o `<html>` fica limpo. Isso mantém o
DOM enxuto e o caminho comum (padrão) sem trabalho. É a mesma convenção que o `app-core`
(`applyTema`/`setNav`) segue do lado JS: **o padrão é a ausência**.

**`document.documentElement`** é o `<html>`. Setar `dataset.theme = "claro"` cria o atributo
`data-theme="claro"` — o gancho que o CSS da Parte B usa. **Atualizar a `theme-color`** faz até
a **barra do navegador** combinar com o tema (um mapa valor→cor). E o **`try/catch`** protege
contra `localStorage` lançar (em `file://` ou modo privado o acesso pode falhar) — se der erro,
fica no padrão, sem quebrar.

**Por que inline e não num arquivo?** Um `<script src>` externo atrasaria (nova requisição); o
tema tem de ser aplicado **imediatamente**. Script inline crítico no `<head>` é a exceção
justificada à regra de "separe JS do HTML".

---

# Parte B — O sistema de temas (os 3 eixos)

## B.1 — Variáveis CSS como *design tokens*

```css
:root{
  --bg:#0c0f16; --surface:#141926; --raised:#1b2233; --overlay:#2c3448;
  --ink:#e2e6f0; --muted:#93a1bd; --faint:#63708c;
  --azul:#4ea8de;   /* Guaíba — progresso/acento */
  --sunset:#f2a154; /* pôr do sol — assinatura */
  …
  --font-title:var(--serif); --font-body:var(--sans); --lh-body:1.58;
  --radius:16px; --text-hero:clamp(1.9rem,3.4vw,2.7rem); …
}
```

**Conceito — CSS custom properties (variáveis) como *tokens* de design.** Em vez de espalhar
cores e medidas por todo o CSS, tudo vive em **variáveis** no `:root` (o `<html>`). Cada
componente usa `var(--azul)`, `var(--radius)`, etc. **Trocar o tema = trocar as variáveis** num
lugar só, e o painel inteiro muda "de graça" (todo componente herda). É o mesmo princípio de
"fonte única da verdade" do `edital-data.js`, aplicado ao visual.

Repare que os **valores computados** dessas variáveis foram o que o `<canvas>` do `app-analise`
teve de **reler** (`getComputedStyle`), porque canvas não entende `var()`. Aqui está a origem
daquelas cores.

**Fontes só de sistema** (`--serif`, `--sans`, `--rounded`, `--display`): cada uma é uma
**pilha** Windows→Apple→Linux→genérica. O comentário explica: *webfont está proibida* — um
`@font-face` de CDN quebraria o `file://` e o offline. Então cada Look escolhe uma família que
**existe em todo sistema**, degradando (nunca quebrando) entre máquinas.

## B.2 — Três eixos ortogonais

O painel tem **três** dimensões de aparência independentes, cada uma um atributo em `<html>`:

| Eixo | Atributo | Valores (padrão em **negrito**) | O que muda |
|---|---|---|---|
| **Cor** | `data-theme` | **escuro**, guaiba, claro, gradiente | só **cores** (as variáveis + poucos fundos) |
| **Forma** (Look) | `data-style` | **literaria**, linear, atelie, aurora | só **forma** (fontes, raios, densidade, motion) |
| **Layout** | `data-nav` | **lateral**, topo, inferior | só **onde** fica a navegação (desktop) |

```css
:root[data-theme="claro"]{ --bg:#eef1f8; --ink:#1a2231; --sunset:#d9772f; … }
:root[data-style="linear"]{ --font-title:var(--sans); --radius:6px; --lh-body:1.45; --motion:.13s; }
:root[data-style="aurora"]{ --font-title:var(--display); --fw-title:800; --radius:18px; --motion:.42s; }
```

**Conceito — eixos ortogonais que se compõem.** Cada eixo reescreve **só o seu tipo** de
variável: `data-theme` mexe em **cor**, `data-style` em **forma**, `data-nav` em **layout**.
Como são independentes, eles **combinam**: 4 temas × 4 Looks × 3 layouts = **48 aparências** a
partir de **três** conjuntos pequenos de regras — não 48 temas escritos à mão. **Ortogonalidade
é o que evita a explosão combinatória.** É por isso que o `DESIGN-SYSTEM.md` insiste na
disciplina "cor só no tema, forma só no Look": se um Look mexesse em cor, os eixos deixariam de
compor e você teria de escrever regras para cada par.

**A convenção "default = sem atributo"** (de novo): o `:root{}` base **é** o tema escuro + Look
literário. Os outros valores são *overrides* `:root[data-x="y"]`. O padrão não precisa de
atributo — ele é o estado natural do `:root`.

## B.3 — O truque do `:where()` (especificidade zero)

```css
:root:where([data-nav="lateral"],:not([data-nav])) .nav button.on{
  background:var(--raised); color:var(--ink); box-shadow:inset 2.5px 0 0 var(--sunset)
}
```

Este é o ponto mais sutil do CSS. A aba **ativa** na barra lateral ganha um estilo — **mas** os
temas `gradiente`/`claro` querem sobrescrever a **cor** dessa aba ativa
(`:root[data-theme="gradiente"] .nav button.on{background:var(--grad)}`).

**O problema de especificidade.** Se a regra do layout fosse `:root[data-nav="lateral"] .nav
button.on` (especificidade alta por causa do `[data-nav]`), ela **venceria** a regra do tema
(que tem só `[data-theme]`), e o tema **não** conseguiria mudar a cor. **A solução — `:where()`
tem especificidade ZERO.** Envolver o seletor de layout em `:where(...)` faz a regra
"aplicar-se" sem "pesar" na disputa de especificidade — então a regra de **cor** do tema (fora
do `:where`) **sempre vence** a cor, enquanto a estrutura do layout ainda se aplica.

**Conceito — `:where()` para gating sem especificidade.** É a ferramenta moderna para dizer
"aplique isto **só** nesta condição, mas **não** brigue por prioridade". Permite separar
**responsabilidades** (layout aplica forma; tema aplica cor) sem que uma atropele a outra. Um
truque de CSS avançado que resolve exatamente a colisão que o eixo `data-nav` criava — foi a
peça-chave para o layout moldável não quebrar as cores dos temas.

## B.4 — O layout moldável (`data-nav`), só desktop

```css
@media(min-width:901px){
  :root[data-nav="topo"] .nav{flex-direction:row;align-items:center;margin-left:auto;…}
  :root[data-nav="topo"] .nav .ni{display:none}   /* no topo, sem ícone — só rótulo */
  :root[data-nav="inferior"] .nav{ …barra fixa embaixo… }
}
```

O 3º eixo só existe **no desktop** (`@media(min-width:901px)`): no celular a navegação é
**sempre** a barra inferior (`#botNav`), independente do `data-nav` — por isso o seletor
`.nav-pick` fica `display:none` por padrão e só aparece a ≥901px. **Conceito — uma preferência
que só faz sentido em um contexto.** Escolher "onde fica a nav" é decisão de desktop; no mobile
o padrão de UX já é a barra inferior. O código **não oferece** a escolha onde ela não se
aplica. E `data-nav` é preferência **por aparelho** (`localStorage 'painelNav'`, **não**
sincroniza) — faz sentido: seu monitor e seu celular podem querer layouts diferentes.

---

# Parte C — O corpo e os diálogos

## C.1 — O esqueleto

```html
<body>
<header class="top">
  … <nav class="nav" id="nav"> … </nav>
    <div class="style-pick" role="group" aria-label="Estilo de design"> … </div>
    <div class="theme-pick" role="group" aria-label="Tema do painel"> … </div>
    <div class="nav-pick"   role="group" aria-label="Posição da navegação (desktop)"> … </div>
</header>
<main class="wrap"> … as abas … </main>
<dialog id="dlgQ"> … </dialog>
… mais 11 diálogos …
<div id="dedic" hidden> … a dedicatória do kit … </div>
<script src="fases-data.js"></script>
…
```

A página é: **`header.top`** (marca + navegação + os 3 seletores) → **`main.wrap`** (onde as
abas são renderizadas) → **os `<dialog>`** → a dedicatória → os `<script>`.

**Os seletores são *segmented controls* acessíveis.** Cada `.theme-pick`/`.style-pick`/
`.nav-pick` é um grupo de botõezinhos (a variante ativa tem `.on`). O **`role="group"` +
`aria-label`** dizem ao leitor de tela "isto é um grupo de escolha de tema" — **acessibilidade**
embutida. O `.nav-pick` nasce `display:none` (só o desktop o revela), casando com a regra de
B.4. Os cliques nesses botões são ligados no `app-core` (`setTema`/`setEstilo`/`setNav`).

## C.2 — As abas

O `<nav class="nav">` tem um botão por aba; `main.wrap` tem um painel por aba (`#tab-painel`,
`#tab-edital`, …). A função **`go(nome)`** (do `app-core`) alterna a classe `.on` — mostra o
painel escolhido, esconde os outros, e re-renderiza se preciso. **Conceito — abas por
mostrar/esconder + uma classe.** Não há roteador nem múltiplas páginas: **uma** página com
vários painéis, e CSS (`.tab{display:none} .tab.on{display:block}`) decide qual aparece. Simples
e instantâneo (nada recarrega).

## C.3 — Os diálogos nativos

```html
<dialog id="dlgQ"> … </dialog>        <dialog id="dlgCorrige"> … </dialog>
<dialog id="dlgNote"> … </dialog>     <dialog id="dlgRel"> … </dialog>   … (12 no total)
```

Cada modal do app é um **`<dialog>` nativo** já no HTML, aberto por `.showModal()` (você viu
isso em quase toda aba: `openNote`, `openQ`, `openCorrige`, `openRelacoes`…). **Conceito —
declarar os modais no HTML, controlá-los no JS.** Em vez de o JS **criar** cada modal do zero,
eles existem estáticos no HTML (com seus campos) e o JS só os **preenche e abre**. Isso mantém a
marcação legível e o CSS previsível. (O `sync.js`, por ser um subsistema autocontido, faz o
oposto — cria seus diálogos por JS; ver [`sync §7`](sync.explicado.md). As duas abordagens
convivem, cada uma onde faz sentido.)

## C.4 — A ordem dos `<script>`: o invariante, enfim visível

```html
<!-- dados primeiro -->
<script src="fases-data.js"></script> … <script src="banco-questoes-data.js"></script>
<!-- kit opcional (podem não existir neste site) -->
<script src="perfil-seed.js"></script> <script src="redacoes-corpus.js"></script>
<!-- as 8 fatias de app.js, EM ORDEM -->
<script src="app-core.js"></script>    <!-- 1º: define $, S, save -->
<script src="app-edital.js"></script> … <script src="app-painel.js"></script>
<script src="app.js"></script>          <!-- por último: o boot (mergeCorpus; init) -->
<script src="qr.js"></script>
<script src="sync.js"></script>          <!-- depois de app.js: usa S/save -->
```

Aqui, finalmente, está o **invariante de ordem** que perpassou todo o roteiro, por inteiro:

1. **Dados primeiro** — os `*-data.js` definem as globais (`DISCIPLINAS`, `BANCO_QUESTOES`…) que
   o código vai consumir.
2. **Kit opcional** — `perfil-seed.js`/`redacoes-corpus.js` (podem faltar; o código guarda com
   `typeof … !== "undefined"`).
3. **As 8 fatias** na ordem exata: `app-core` **primeiro** (define `$`, `S`, `save`), as abas no
   meio, **`app.js` por último** (é o boot: `mergeCorpus(); init();`).
4. **`qr.js`** e **`sync.js`** por fim (o sync usa `S`/`save` e o boot já rodou).

**Conceito — dependência resolvida por ordem de carregamento.** Sem ES modules (`file://`
proíbe `import`), **a ordem dos `<script>` É o grafo de dependências**. Cada arquivo assume que
tudo à sua esquerda já rodou. Trocar a ordem = `ReferenceError`. Por isso o `CLAUDE.md` avisa:
ao criar um `app-*.js` novo, adicione-o **na posição certa** aqui **e** no `SHELL` do `sw.js`.
Este bloco final é a "lista de montagem" do app inteiro — e agora você reconhece cada peça.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Metas PWA + `viewport-fit=cover` | A.1 | manifest (Android) + metas `apple-*` (iOS); conteúdo até a borda |
| Caminhos relativos | A.1 | o mesmo arquivo serve `file://` e `/painel/` |
| Boot pré-paint (anti-FOUC) | A.2 | script síncrono no `<head>` aplica o tema antes de pintar |
| Default = ausência de atributo | A.2,B.2 | o padrão não recebe `data-*`; DOM limpo, caminho rápido |
| `try/catch` no `localStorage` | A.2 | acesso pode lançar em `file://`/privado → cai no padrão |
| Variáveis CSS como tokens | B.1 | trocar o tema = trocar as variáveis num lugar só |
| Fontes só de sistema | B.1 | webfont quebraria offline/`file://`; pilha por SO |
| Três eixos ortogonais | B.2 | cor × forma × layout compõem: 48 aparências de 3 regrinhas |
| `:where()` especificidade zero | B.3 | aplicar sem brigar por prioridade (tema vence a cor, layout aplica a forma) |
| Preferência contextual (só desktop) | B.4 | não oferecer a escolha onde ela não se aplica; por-aparelho, não sincroniza |
| Segmented control acessível | C.1 | `role="group"` + `aria-label` para leitor de tela |
| Abas por mostrar/esconder | C.2 | uma página, vários painéis, uma classe `.on` |
| `<dialog>` declarado, JS preenche | C.3 | modais estáticos no HTML; o JS abre e preenche |
| Ordem de `<script>` = dependências | C.4 | sem ESM, a ordem É o grafo; core 1º, app.js por último |

---

**Próximo no roteiro:** [`pipeline.explicado.md`](pipeline.explicado.md) — **Etapa 7
(opcional)**: como os `*-data.js` **nascem** das provas oficiais — os geradores (`.cjs`/`.py`)
e as **sondas de verificação headless** (a metodologia de "verificar de verdade" via CDP que
apareceu em quase todos os comentários que você leu).
