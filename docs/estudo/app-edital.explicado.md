# 🗺️ `app-edital.js` explicado — a primeira aba

> **Arquivo real:** `painel/app-edital.js` (228 linhas)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`edital-data`](edital-data.explicado.md)

Esta é a aba **Mapa do Edital** — e o melhor ponto de partida entre as telas, porque
faz a coisa mais fundamental do app: **pega os dados (`DISCIPLINAS`) e desenha HTML**.
É o padrão que **todas** as outras abas repetem. Se você entender o fluxo aqui —
*"percorrer a árvore → montar strings de HTML → ligar eventos"* — as próximas abas são
variações do mesmo tema.

Além do mapa, o arquivo cuida de mais três coisas coladas a ele: as **notas**
(diálogo Obsidian + anotação), as **relações entre tópicos** e os **recursos** (onde
aprender). Vamos por partes.

---

## §0 — O cabeçalho e o padrão "fatia global"

```js
// app-edital.js — fatia de app.js (split 2026-07-16). Sem ES modules (file://): <script> global, carregado em ordem.
```

Recapitulando o que você viu em `app-core`: este arquivo **não** exporta nem importa
nada. Ele define funções (`renderEdital`, `openNote`, …) que viram **globais**, e usa
livremente coisas definidas em outras fatias (`el`, `esc`, `S`, `topicId`,
`DISCIPLINAS`). Tudo se enxerga porque os `<script>` compartilham o mesmo escopo
global, carregados **em ordem** — e `app-edital.js` vem depois de `app-core.js`, então
`$`, `S` e companhia já existem quando este código roda.

---

## §1 — `statusClass`: estado → classe CSS (ternário encadeado)

```js
function statusClass(s){ return s===2?"s2":s===1?"s1":""; }
```

**O quê:** converte o número do status de um tópico (`0` não-estudado, `1` em
progresso, `2` dominado) na classe CSS correspondente (`""`, `"s1"`, `"s2"`).

**Nota de sintaxe — ternário encadeado:** `a ? b : c ? d : e` lê-se de cima para
baixo: *"se `s===2` → `"s2"`; senão, se `s===1` → `"s1"`; senão → `""`"*. É um
`if/else if/else` espremido numa expressão. Funciona porque cada `?:` é uma expressão
que devolve valor, então dá para encaixar um no `else` do outro.

**Conceito — separar dado de aparência.** O JS decide **qual classe**; o **CSS**
decide como `s1`/`s2` ficam (cor da bolinha, etc.). O JavaScript nunca escreve cor
aqui — só o *nome* do estado. Assim, mudar a aparência de "dominado" é editar CSS, sem
tocar nesta função. É o princípio de **separação de responsabilidades**.

> **Alternativa:** um objeto-mapa `{0:"",1:"s1",2:"s2"}[s]`. Para 3 casos, o ternário é
> mais direto; para muitos casos, o mapa vence (evita uma escada de `?:` ilegível).

---

## §2 — Deep-links do Obsidian (e por que o link às vezes é "morto")

```js
const OBS_VAULT = "cofre-obsidian";
const sanO = s => s.replace(/[*"\\/<>:|?#^\[\]]/g, "–");
const obsUrl = (d,tp) => `obsidian://open?vault=${encodeURIComponent(OBS_VAULT)}&file=${encodeURIComponent(sanO(d.nome)+"/"+sanO(tp.nome))}`;
```

**O quê:** monta um link `obsidian://open?vault=…&file=…` que abre a nota daquele
tópico no app Obsidian.

**`sanO` — sanitização por regex.** `.replace(/[…]/g, "–")` troca **qualquer**
caractere da lista por um traço. O `/…/g` é uma **expressão regular** com a flag `g`
(*global* = troca todas as ocorrências, não só a primeira). Dentro dos colchetes
`[…]` está uma **classe de caracteres** — "qualquer um destes": `* " \ / < > : | ? #
^ [ ]`. São justamente os caracteres proibidos em nomes de arquivo (no Windows/Obsidian).

> **Nota de sintaxe — o escape `\\` e `\[`:** dentro da regex, `\\` é uma barra
> invertida **literal**, e `\[` / `\]` são colchetes literais (sem escapar, `[` abriria
> outra classe). Regex é uma minilinguagem cheia desses caracteres especiais.

**⚠️ Armadilha crítica (está no `CLAUDE.md`):** esta função `sanO` **precisa produzir
exatamente o mesmo nome** que o gerador do cofre (`pipeline/gerar_cofre.cjs`) usou ao
criar os arquivos `.md`. Se as duas listas de caracteres divergirem — o gerador troca
`:` por `-` e aqui troca por `–` (traço diferente!) —, o link aponta para um arquivo
que não existe e o botão 🗂 quebra silenciosamente. **Duas funções de sanitização em
arquivos diferentes que precisam concordar é um acoplamento perigoso**; a defesa aqui
é a disciplina (o comentário avisa) porque não há build para checar.

**`encodeURIComponent`** — escapa espaços, acentos e `/` para a forma `%XX` segura em
URL. `"História"` vira `Hist%C3%B3ria`. Sem isso, um espaço no nome quebraria a URL.

**Conceito — custom URI scheme.** `obsidian://` não é web — é um **protocolo
registrado pelo app Obsidian** no sistema operacional. Clicar num link desses faz o SO
abrir o Obsidian, como `mailto:` abre o e-mail. É a ponte entre o painel (navegador) e
o cofre (app nativo).

```js
const semCofre = () => (typeof PERFIL_SEED!=="undefined" && !!PERFIL_SEED && !!PERFIL_SEED.nome);
```

**O quê:** devolve `true` quando o painel está rodando **sem** o cofre Obsidian — o
caso do "painel-presente" publicado para a Bia, que abre no navegador de alguém que
**não tem** Obsidian instalado. Ali, todo link `obsidian://` é **morto** (não abre
nada).

**Como detecta isso?** Pela existência de `PERFIL_SEED` — uma variável que **só** entra
no build do kit (`--kit`). Se ela existe e tem `.nome`, é o painel-presente → sem cofre.

**Nota — `typeof PERFIL_SEED!=="undefined"` antes de usar:** o mesmo teste de
existência seguro do `edital-data §6`. Como `PERFIL_SEED` pode nunca ter sido
declarada, referi-la direto lançaria `ReferenceError`; `typeof` responde
`"undefined"` sem estourar. O `!!` converte para booleano puro.

**Conceito — feature/context detection + degradação graciosa.** O mesmo código roda em
dois contextos (com e sem cofre) e **se adapta**: mais adiante (`openNote`) o link
morto é escondido `obs.style.display="none"` em vez de mostrado quebrado. Detectar o
ambiente e degradar com elegância é um padrão que você reverá no PWA (`file://` × http)
e nos guards `_REL`/`_CANAIS` mais abaixo.

---

## §3 — `renderEdital`: o coração da aba

É a função mais longa; vamos fatiar. Ela **reconstrói** o HTML da lista de disciplinas
toda vez que algo muda.

### 3a. Preservar o que o usuário abriu

```js
function renderEdital(container, compact){
  const openIds = new Set([...container.querySelectorAll(".disc.open")].map(c=>c.dataset.disc));
  const ACERTO = acertoPorTid();
  container.innerHTML="";
```

**O problema:** a função vai apagar tudo (`container.innerHTML=""`) e redesenhar. Mas
se o usuário tinha o card "Física" **aberto**, ele não pode fechar sozinho no
re-render. Solução: **antes** de apagar, anota quais cards estavam abertos.

**Como:** `container.querySelectorAll(".disc.open")` pega os cards com a classe `open`;
`[...]` (spread) transforma a NodeList num array de verdade; `.map(c=>c.dataset.disc)`
extrai o `id` de cada; `new Set(...)` guarda num **conjunto** (busca rápida depois com
`.has`). No fim da função, `if(openIds.has(d.id)) card.classList.add("open")` restaura.

**Conceito — render idempotente que preserva estado de UI.** Redesenhar do zero é
simples de raciocinar (o HTML é sempre função do estado atual), mas **perde estado
efêmero da interface** (o que está aberto, scroll, foco). O truque profissional é
**capturar esse estado antes e reaplicar depois**. Frameworks (React) fazem isso por
baixo com "reconciliação"; aqui é feito à mão, e é uma ótima lição de o que os
frameworks resolvem para você.

**Nota — `new Set` vs array:** `Set` dá `.has(x)` em tempo praticamente constante; um
`array.includes(x)` varre a lista toda. Para poucas disciplinas a diferença é ínfima,
mas `Set` **comunica a intenção** ("isto é um conjunto de pertencimento", não uma
lista ordenada).

### 3b. Um card por disciplina

```js
  DISCIPLINAS.forEach(d=>{
    const prog=discProgress(d);
    const w=CURSOS[S.curso].pesos[d.prova]||1;
    const card=el("div","disc");
    card.dataset.disc=d.id;
    const clr = prog>=.75?"var(--verde)":prog>=.35?"var(--amarelo)":"var(--azul)";
```

Aqui a árvore de `edital-data.js` começa a virar tela. Para cada disciplina:
- `discProgress(d)` (do `app-core`) → fração 0–1 de quanto você domina dela.
- `CURSOS[S.curso].pesos[d.prova]||1` → o **peso** daquela prova no seu curso-alvo.
  Repare a **chave estrangeira** em ação: `d.prova` (ex. `"MAT"`) indexa os pesos. O
  `||1` é uma **rede de segurança**: se o peso for `undefined` (a armadilha do
  `edital-data §2`!), usa 1 em vez de mostrar `×undefined`.
- `clr` → cor da barra por faixa de progresso (outro ternário encadeado), usando as
  **variáveis CSS** de tema (`var(--verde)`), não cores fixas — então respeita o tema
  ativo.

```js
    card.innerHTML=`
      <div class="disc-h">
        <span class="ic">${d.icon}</span>
        <span class="nm">${d.nome}</span>
        <span class="wt" title="peso no curso-alvo">×${w}</span>
        <span class="pct">${Math.round(prog*100)}%</span>
        <span class="chev">▶</span>
      </div>
      <div class="disc-bar"><i style="width:${prog*100}%;background:${clr}"></i></div>
      <div class="disc-body"></div>`;
```

**Conceito — template literal como motor de template.** A crase (`` ` ``) permite
strings de várias linhas com `${expressão}` interpolada dentro. É o "HTML como string"
do JS puro: monta-se a marcação num texto e joga no `.innerHTML`. Sem framework, esta é
a forma nativa de gerar HTML dinâmico. A largura da barra sai direto de um cálculo:
`width:${prog*100}%`.

### 3c. Descendo a árvore: eixos → tópicos

```js
    d.eixos.forEach((ex,ei)=>{
      const ew=el("div","eixo");
      ew.appendChild(el("div","eixo-nm",esc(ex.nome)));
      ex.topicos.forEach((tp,ti)=>{
        const id=topicId(d.id,ei,ti);
        const st=topicStatus(id);
        const rec=S.topics[id];
```

Este **laço aninhado** é exatamente a árvore que você estudou em `edital-data`:
`DISCIPLINAS → eixos → topicos`. Os índices `ei` (eixo) e `ti` (tópico) que o
`forEach` fornece como 2º argumento são a matéria-prima do **`topicId(d.id, ei, ti)`** —
a "unidade de status" (ex. `"fis.0.2"`). É essa string que amarra este tópico ao seu
progresso em `S.topics[id]`, às questões, às relações. **A posição na árvore vira a
identidade do tópico.**

> **Armadilha embutida:** como o `id` é derivado da **posição** (`fis.0.2` = 3º tópico
> do 1º eixo de Física), **reordenar** os tópicos em `edital-data.js` muda os ids — e o
> progresso salvo no `localStorage` "escorrega" para o tópico errado. É o preço de um id
> posicional (barato de gerar) em vez de um id explícito por tópico (estável, mas você
> teria de inventar e nunca repetir).

```js
        const hasNote = rec && (rec.note||rec.link);
        const hasBase = typeof NOTAS_BASE!=="undefined" && !!NOTAS_BASE[id];
        const qc=BQ_TID[id];   // quantas questões oficiais já caíram deste tópico
        const ac=ACERTO[id];   // ...e quantas você acertou das que respondeu
```

Quatro **flags derivadas** que decidem quais botões/badges o tópico mostra: tem
anotação sua? tem resumo pronto para ler? tem questões oficiais? qual seu acerto nelas?
Cada uma alimenta um fragmento condicional no HTML logo abaixo.

### 3d. Fragmentos condicionais e escape

```js
        row.innerHTML=`
          <span class="dot ${statusClass(st)}" title="clique p/ avançar domínio"></span>
          <div class="tx">
            <div class="tn">${esc(tp.nome)}</div>
            ${tp.subs&&tp.subs[0]?`<div class="tsub">${esc(tp.subs.join(" · "))}</div>`:""}
          </div>
          ${qc?`<button class="qbadge ${accCls(ac)}" title="…">${ac?`${ac.ok}/${ac.resp}`:`${qc.n}q`}</button>`:""}
          ...
```

**Nota de sintaxe — fragmento condicional `${cond ? `…html…` : ""}`.** É como se faz
"renderização condicional" sem framework: se a condição é verdadeira, interpola um
pedaço de HTML; senão, interpola string vazia. Repare que os `subs` só viram uma linha
`.tsub` se existirem (`tp.subs && tp.subs[0]`) — casando com a garantia do helper `t`
(sempre há um array `subs`, às vezes vazio).

**`esc(...)` em TODO texto de dado.** `esc(tp.nome)`, `esc(tp.subs.join(" · "))`.
Isto é **escape de HTML** — transformar `<`, `&`, etc. em entidades (`&lt;`, `&amp;`).
Por quê? Porque `innerHTML` **interpreta** o que recebe como HTML. Se um nome de tópico
contivesse `<script>`, sem `esc` ele **executaria**. Como quase todo texto aqui é dado
curado por você, o risco é baixo — mas o hábito de **escapar toda interpolação de dado
em `innerHTML`** é a defesa nº 1 contra XSS, e o código a segue religiosamente.

### 3e. Ligando os eventos (e o `stopPropagation`)

```js
        row.querySelector(".dot").onclick=e=>{ e.stopPropagation(); cycleStatus(id); };
        row.querySelector(".tn").onclick=()=>{ if(tp.subs&&tp.subs[0]) row.classList.toggle("exp"); };
        row.querySelector(".note-btn").onclick=e=>{ e.stopPropagation(); openNote(id, `${d.nome} — ${tp.nome}`, rec?.link||obsUrl(d,tp)); };
```

Depois de injetar o HTML, o código **religa os eventos** buscando cada elemento e
atribuindo `.onclick`.

**⚠️ Por que `e.stopPropagation()`?** Os elementos estão **aninhados**: a bolinha
`.dot` está dentro da `.row`, que (em outras telas) reage a clique. Sem
`stopPropagation`, clicar na bolinha dispararia **também** o clique do pai
(*event bubbling* — o evento "sobe" pela árvore do DOM). `stopPropagation()` corta essa
subida: *"eu tratei aqui, não avise os ancestrais"*. Esquecer isso causa o clássico bug
de "cliquei no botão e a linha inteira também reagiu".

**`rec?.link` — optional chaining.** O `?.` devolve `undefined` (em vez de estourar) se
`rec` for `null`. Aqui: *"o link salvo, se houver rec; senão, monte o link Obsidian
padrão"* (`rec?.link || obsUrl(d,tp)`).

> **Alternativa — event delegation.** Em vez de N `onclick` (um por linha), poderia
> haver **um** listener no container que descobre no clique qual `.dot`/`.btn` foi
> alvo (via `e.target.closest(...)`). É o que `app-core` faz para a navegação
> (`BOT_GRUPOS`). Vantagem: sobrevive ao re-render (não precisa religar), e é mais leve
> com muitos itens. Aqui optou-se por `onclick` direto porque a função **já reconstrói
> tudo** e religar é natural no mesmo laço. Trade-off consciente: simplicidade local ×
> não ter de religar.

### 3f. Contadores e o "abrir/fechar todas"

```js
  const ts=allTopics();
  const done=ts.filter(x=>topicStatus(x.id)===2).length;
  const prog=ts.filter(x=>topicStatus(x.id)===1).length;
  const cEl=$("#editalCount");
  if(cEl) cEl.textContent=`${done} dominados · ${prog} em progresso · ${ts.length} tópicos`;
```

Depois de desenhar, conta o todo: `allTopics()` (do `app-core`) devolve todos os
tópicos; dois `.filter(...).length` contam quantos estão em cada estado. **Padrão
filter+length** = "quantos satisfazem X". O `if(cEl)` é uma **guarda defensiva**: se o
elemento não existir no HTML, não estoura.

```js
    tg.onclick=()=>{
      const abrir = !!container.querySelector(".disc:not(.open)");
      container.querySelectorAll(".disc").forEach(c=>c.classList.toggle("open",abrir));
      sync();
    };
```

O botão "abrir/fechar todas" decide a ação pelo estado atual: **se existe ao menos um
card fechado** (`.disc:not(.open)`), a intenção é **abrir todos**; senão, fechar. O
segundo argumento de `classList.toggle(classe, forçar)` **força** o estado em vez de
alternar — todos ficam iguais. Detalhe elegante: um único botão que "sabe" se deve
abrir ou fechar.

---

## §4 — `cycleStatus`: a máquina de estados do domínio

```js
function cycleStatus(id){
  const rec=tRec(id);
  const prev=rec.status;
  rec.status=(rec.status+1)%3;
  // ao começar a estudar (0→1 ou →2), entra na fila SRS
  if(prev===0 && rec.status>0 && !rec.srs){
    rec.srs = { ease:2.5, interval:0, due:Date.now(), reps:0 };
  }
  save();
  renderEdital($("#editalDiscs"));
  renderPainel();
}
```

**O quê:** clicar na bolinha avança o domínio do tópico: 0 → 1 → 2 → 0 → …

**Nota de sintaxe — o ciclo com módulo `%`:** `(status+1)%3` é o truque clássico de
**ciclar dentro de um intervalo**. `0+1=1`, `1+1=2`, `2+1=3` → `3%3=0`. O resto da
divisão por 3 sempre cai em `{0,1,2}` e "dá a volta" sozinho. Guarde este padrão — serve
para qualquer rotação (páginas, abas, cores).

**A regra do SRS:** quando o tópico sai de "não-estudado" (`prev===0`) para qualquer
coisa estudada, e ainda não tem agenda de revisão (`!rec.srs`), ele **entra na fila de
repetição espaçada** com os valores iniciais do algoritmo SM-2 (`ease:2.5` é o fator de
facilidade padrão do SM-2; `due:Date.now()` = revisar já). Você vai ver esse `srs`
sendo consumido em `app-plano.js` (o Cronograma). Aqui é só o **nascimento** do card na
fila.

**O fim: `save()` + re-render.** Toda mutação de estado termina com `save()`
(persiste no `localStorage`) e **redesenha** as telas afetadas (`renderEdital` e
`renderPainel`, porque o progresso aparece nas duas). Este é o **ciclo de vida padrão do
app**: *muta `S` → `save()` → re-renderiza*. Não há reatividade automática; o re-render
é explícito. Simples e previsível — o preço é lembrar de chamá-lo (esquecer = tela
desatualizada mostrando dado velho).

---

## §5 — Notas: o diálogo de duas camadas

```js
let noteTarget=null;
function openNote(id,title,obsHref){
  noteTarget=id; const rec=tRec(id);
  $("#dnTitle").textContent=title;
  $("#dnBase").innerHTML=renderNotaBase(typeof NOTAS_BASE!=="undefined"?NOTAS_BASE[id]:null);
  $("#dnText").value=rec.note||"";
  const obs=$("#dnObs"); if(obs){ const oc=semCofre(); obs.href=oc?"#":(obsHref||"#"); obs.style.display=oc?"none":""; }
  $("#dlgNote").showModal();
}
```

**`<dialog>` + `showModal()`:** `#dlgNote` é um elemento `<dialog>` **nativo** do HTML.
`.showModal()` abre-o como modal de verdade — trava o foco, escurece o fundo, fecha no
`Esc` — **sem biblioteca**. É um recurso moderno do HTML que o projeto explora para não
depender de um framework de modais.

**`noteTarget` — estado de módulo.** A função guarda numa variável de topo **qual
tópico** está aberto, para `saveNote()` saber onde gravar depois. É estado que vive
"entre" abrir e salvar. Simples, mas é preciso lembrar que é **global compartilhado**:
abrir duas notas ao mesmo tempo (impossível aqui, pois é modal) confundiria o alvo.

**As duas camadas de nota** (conceito importante do projeto):
1. `#dnBase` — o **conteúdo-base** (resumo/fórmulas/pegadinhas), **só leitura**, vindo
   de `NOTAS_BASE` (o `notas-data.js` gerado). É o material de estudo para quem não tem
   Obsidian.
2. `#dnText` — a **sua anotação**, editável, salva no `localStorage` (`rec.note`).

Separar as duas é deliberado: o conteúdo-base é comum a todos e regenerável; a sua
anotação é pessoal e vive só no seu aparelho. `saveNote` só grava a segunda:

```js
function saveNote(){
  const rec=tRec(noteTarget);
  rec.note=$("#dnText").value.trim();
  save(); $("#dlgNote").close();
  renderEdital($("#editalDiscs")); renderPainel();
}
```

Mesmo ciclo de sempre: muta → `save()` → re-render. E `.close()` fecha o `<dialog>`.

---

## §6 — `mdLite`: markdown mínimo **e seguro**

```js
/* markdown-lite SEGURO (escapa tudo, depois reintroduz só negrito/listas/parágrafos) */
function mdLite(s){
  let h=esc(s).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
  const linhas=h.split("\n"); let out=[], emLista=false, para=[];
  const flush=()=>{ if(para.length){ out.push(`<p>${para.join("<br>")}</p>`); para=[]; } };
  for(const ln of linhas){
    const li=ln.match(/^\s*[-•]\s+(.*)$/);
    if(li){ flush(); if(!emLista){ out.push("<ul>"); emLista=true; } out.push(`<li>${li[1]}</li>`); }
    else if(!ln.trim()){ flush(); if(emLista){ out.push("</ul>"); emLista=false; } }
    else { if(emLista){ out.push("</ul>"); emLista=false; } para.push(ln); }
  }
  flush(); if(emLista) out.push("</ul>");
  return out.join("");
}
```

**O quê:** converte um markdown minúsculo (`**negrito**`, listas com `-`/`•`,
parágrafos) em HTML. Usado para renderizar o conteúdo-base das notas.

**A ordem é a segurança — leia o comentário.** Primeiro `esc(s)` **escapa tudo** (todo
HTML do dado vira texto inerte). **Só depois** ele reintroduz um conjunto **fechado** de
tags que ele mesmo controla (`<b>`, `<ul>`, `<li>`, `<p>`, `<br>`). Isso garante que
**nenhum HTML do dado sobrevive** — só as tags que esta função escreveu. É o padrão
**allowlist** (lista do que é permitido) em vez de blocklist (tentar barrar o que é
perigoso, jogo que sempre se perde).

**Conceito — sanitização por reconstrução.** Em vez de "limpar" HTML perigoso (difícil,
cheio de casos: `<img onerror=…>`, `javascript:`, etc.), o código **destrói tudo** e
**reconstrói** apenas o seguro. É o mesmo espírito da barreira de dados do
[`dados.explicado.md §5`](dados.explicado.md): não confie no conteúdo, desarme-o na
fronteira. `[^*]+` na regex de negrito significa "um ou mais caracteres que **não** são
`*`" — evita que `**a** e **b**` case errado como um bloco só.

**A máquina de estados de linhas.** O laço mantém três variáveis de estado (`out`
acumulado, `emLista` = "estou dentro de um `<ul>`?", `para` = linhas do parágrafo
atual) e para cada linha decide: é item de lista? linha em branco (fecha parágrafo)? ou
texto de parágrafo? O `flush()` "descarrega" o parágrafo acumulado como um `<p>`. É um
**parser de estado** em miniatura — a mesma ideia de qualquer parser, só que enxuta.

---

## §7 — `renderNotaBase`: montagem condicional de seções

```js
function renderNotaBase(nb){
  if(!nb) return `<div class="nb-empty">Ainda não há um resumo pronto…</div>`;
  let h="";
  if(nb.subs&&nb.subs.length) h+=`<div class="nb-sec">…</div>`;
  if(nb.resumo)    h+=`<div class="nb-sec">…📘 Resumo…${mdLite(nb.resumo)}…</div>`;
  if(nb.formulas)  h+=`…🧮 Fórmulas…${mdLite(nb.formulas)}…`;
  if(nb.pegadinhas)h+=`…⚠️ Pegadinhas…${mdLite(nb.pegadinhas)}…`;
  return h+`<div class="nb-div"></div>`;
}
```

**Padrão "acumular string por partes".** Começa `h=""` e vai **concatenando** só as
seções que têm conteúdo (`if(nb.resumo)`). Se o tópico não tem fórmulas, a seção some —
nenhum título órfão. O `if(!nb) return …` no topo é uma **guard clause** (saída
antecipada): trata o caso vazio primeiro e evita aninhar o resto num `else`.

---

## §8 — Relações entre tópicos

```js
const _REL = typeof RELACOES !== "undefined" ? RELACOES : { topicos:{} };
const TID2INFO = (()=>{ const m={};
  DISCIPLINAS.forEach(d=>d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    m[topicId(d.id,ei,ti)] = { disc:d.nome, icon:d.icon, discId:d.id, tp:tp.nome };
  }))); return m; })();
```

**`_REL` — guard com fallback.** Se `relacoes-data.js` não carregou, usa um objeto
vazio `{topicos:{}}` em vez de quebrar. Padrão que se repete (`_CANAIS`, `_SITES`): **o
app degrada, não explode**, quando um dado opcional falta.

**`TID2INFO` — um índice construído por IIFE.** Aquela árvore tripla de `forEach`
percorre **todo** o edital uma vez e monta um **mapa plano** `topicId → {disc, icon,
tp}`. Depois, dado qualquer `tid`, você acha os dados dele em O(1) com
`TID2INFO[tid]` — sem revarrer a árvore.

**Conceito — lookup table pré-computada (memoização estrutural).** Em vez de procurar
"quem é o tópico fis.0.2?" percorrendo `DISCIPLINAS` toda vez, paga-se **uma** varredura
no carregamento e guarda-se o resultado. Troca CPU repetida por memória — clássico
*space-time trade-off*.

**Nota de sintaxe — IIFE `(()=>{ … return m; })()`.** *Immediately Invoked Function
Expression*: uma função **definida e chamada na hora**. Serve para rodar um trecho de
setup (montar `m`) e atribuir só o **resultado** a `TID2INFO`, sem vazar a variável
temporária `m` para o escopo global. É o jeito de ter "um bloco de código que devolve um
valor" numa `const`.

```js
function openRelacoes(tid){
  ...
  body.querySelectorAll(".rel-chip").forEach(c=>c.onclick=()=>openRelacoes(c.dataset.tid));
  $("#dlgRel").showModal();
}
```

**Diálogo recursivo/navegável.** Cada "chip" de tópico relacionado, ao ser clicado,
**chama `openRelacoes` de novo** com o tid daquele chip — reaproveitando o mesmo
diálogo para navegar de relação em relação (pré-requisito → pré-requisito do
pré-requisito…). É uma mini-navegação dentro de um modal, feita com uma função que se
re-invoca. Elegante e barato.

---

## §9 — Recursos e a incidência "observada × estimada"

```js
function canaisDe(discId){
  const cs = _CANAIS[discId] || [];
  return semCofre() ? cs.filter(c => c.tipo !== "cofre") : cs;
}
```

`canaisDe` devolve os canais de uma disciplina, mas **filtra os atalhos do cofre** se
for o painel-presente (`semCofre()`) — a Bia não tem Obsidian, então esses atalhos não
fariam sentido. Mesma lógica de degradação do §2.

A joia do trecho é a heurística de incidência:

```js
const MIN_AMOSTRA = 6;
function incidenciaInfo(discId, tpNome){
  const count = topicQCount(discId, tpNome);
  const total = discQCount(discId);
  if(total >= MIN_AMOSTRA && count > 0){
    const esperado = 1 / nTopicosDe(discId);
    const fatia = count / total;
    const level = fatia >= esperado*1.5 ? "alta" : fatia >= esperado*0.6 ? "media" : "baixa";
    return { level, count, source:"observada" };
  }
  return { level: incidenciaDe(discId, tpNome), count, source:"estimada" };
}
```

**O quê:** estima quão "quente" é um tópico (quanto cai na prova) — mas de **duas
fontes**, com uma regra para escolher.

**A ideia estatística:** se você já marcou **poucas** questões daquela disciplina
(`total < 6`), não há amostra confiável → usa a **estimativa curada** à mão
(`incidenciaDe`, do `recursos-data.js`), marcada `source:"estimada"`. Quando há amostra
suficiente, calcula a incidência **observada**: compara a **fatia real** do tópico
(`count/total`) com o que seria **esperado se tudo caísse por igual** (`1/nTópicos`).
Cair 50% acima do uniforme → "alta"; bem abaixo → "baixa".

**Conceito — limiar de confiança (confidence threshold).** Uma medida derivada de dados
só é confiável com amostra mínima; abaixo disso, é honesto **recuar para um valor
padrão** e **rotular a origem** (`observada` vs `estimada`) para a UI poder ser
transparente com o usuário. É um cuidado estatístico maduro: *"não finja precisão que
os dados não têm"*. Compare com o baseline uniforme (`1/nTópicos`) — comparar o
observado contra "e se fosse tudo igual?" é uma técnica geral para detectar
concentração.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Ternário encadeado | §1, §3b | `if/else if` como expressão |
| Separar dado de aparência | §1 | JS escolhe a classe; CSS decide a cor |
| Sanitização por regex | §2 | classe de caracteres `[…]` + flag `g` |
| Acoplamento por convenção | §2 | `sanO` **precisa** bater com o gerador do cofre |
| `encodeURIComponent` + URI scheme | §2 | escapar p/ URL; `obsidian://` é protocolo do SO |
| Context detection + degradação graciosa | §2, §8, §9 | mesmo código, dois contextos; degrada em vez de quebrar |
| Render idempotente preservando UI | §3a | capturar o que está aberto antes de recriar |
| Template literal como template | §3b, §3d | HTML como string com `${…}` |
| Fragmento condicional | §3d | `${cond?`…`:""}` = render condicional sem framework |
| Escape em `innerHTML` (anti-XSS) | §3d, §6 | `esc()` em toda interpolação de dado |
| `stopPropagation` / bubbling | §3e | cortar a subida do evento pelo DOM |
| Optional chaining `?.` | §3e | acessar propriedade sem estourar em `null` |
| Ciclo com módulo `%` | §4 | `(x+1)%n` roda dentro do intervalo |
| Ciclo de vida: muta→save→render | §4, §5 | re-render explícito, sem reatividade mágica |
| `<dialog>` + `showModal()` | §5 | modal nativo, sem biblioteca |
| Sanitização por reconstrução (allowlist) | §6 | escapa tudo, reintroduz só o seguro |
| Parser de estado | §6 | variáveis de estado + laço = mini-parser |
| Guard clause | §7 | saída antecipada trata o caso vazio |
| Lookup table pré-computada (IIFE) | §8 | uma varredura no load → O(1) depois |
| Diálogo recursivo | §8 | a função se re-invoca para navegar |
| Limiar de confiança | §9 | recuar ao padrão sem amostra; rotular a origem |

---

**Próximo no roteiro:** [`app-painel.explicado.md`](app-painel.explicado.md) — a
**home** (hero "Horizonte", a Trilha de Arranque, o Foco da semana) e o **simulador
Argumento** (a média harmônica que usa os `CURSOS.pesos` que você já conhece). Junta
muitos helpers do `app-core` numa tela só.
