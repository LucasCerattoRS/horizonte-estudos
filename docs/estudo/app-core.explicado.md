# `app-core.js` explicado — a fundação

> **Arquivo real:** [`painel/app-core.js`](../../painel/app-core.js) · 293 linhas.
> **Papel:** a primeira fatia a carregar. Define o vocabulário que **todas** as outras fatias
> usam: atalhos de DOM, o estado `S`, os perfis, a navegação, a aparência e o curso.
> **Pré-requisito de leitura:** nenhum — é aqui que se começa.

Este arquivo nasceu de um `app.js` gigante (2 835 linhas) que foi **fatiado** em 8 `<script>`
em 2026-07-16. Por que fatiar? Um arquivo de 2 800 linhas é difícil de navegar e o navegador
não ganha nada em tê-lo inteiro. Por que **não** usar `import`/`export` (módulos ES)? Porque o
painel roda em `file://`, onde a origem é "opaca" e módulos ES quebram. A solução: vários
`<script>` globais, carregados **em ordem**, que enxergam as variáveis uns dos outros (todos
compartilham o mesmo escopo global). `app-core.js` carrega **primeiro** porque define o que os
outros consomem; `app.js` carrega **por último** porque é o *boot* (dá a partida).

## Índice
- [§0 — Cabeçalho e constantes](#0--cabeçalho-e-constantes)
- [§1 — ID de tópico](#1--id-de-tópico)
- [§2 — Perfis](#2--perfis)
- [§3 — Estado (`S`, `load`, `save`)](#3--estado-s-load-save)
- [§4 — Utilitários de DOM e texto](#4--utilitários-de-dom-e-texto)
- [§5 — Cálculo de progresso](#5--cálculo-de-progresso)
- [§6 — Navegação](#6--navegação)
- [§7 — Aparência (os 3 eixos)](#7--aparência-os-3-eixos)
- [§8 — Curso](#8--curso)
- [Resumo dos conceitos deste arquivo](#resumo-dos-conceitos-deste-arquivo)

---

## §0 — Cabeçalho e constantes

```js
"use strict";
const LS_PREFIX = "painelUFRGS_v1";           // estado por perfil: `${LS_PREFIX}__${id}`
const LS_LEGACY = "painelUFRGS_v1";           // chave antiga (perfil único) — migrada 1x
const LS_INDEX  = "painelUFRGS_index";        // índice de perfis + perfil ativo
const DAY = 86400000;
```

**O quê / como / porquê.** Declara as chaves usadas no `localStorage` e uma constante de tempo.

- **`"use strict"`** liga o *modo estrito* do JavaScript: erros que normalmente passam calados
  viram exceções (atribuir a variável não declarada, escrever em propriedade só-leitura, etc.).
  É uma rede de segurança.
  - 🕳 **Armadilha (não óbvia):** o modo estrito é **por `<script>`**, não global. Como o
    `app.js` foi fatiado em 8 arquivos, este `"use strict"` vale **só para `app-core.js`**. As
    outras 7 fatias rodam em modo "solto" a menos que tenham o seu próprio. Antes do fatiamento,
    um único `"use strict"` no topo cobria tudo.

- **`DAY = 86400000`** é o número de milissegundos em um dia (`24*60*60*1000`). Dar um **nome**
  a um número mágico é uma prática de legibilidade: `daysBetween` fica `(b-a)/DAY` em vez de
  `(b-a)/86400000`.

- 🕳 **`LS_PREFIX` e `LS_LEGACY` têm o mesmo valor** (`"painelUFRGS_v1"`). Não é bug: são dois
  **conceitos** distintos que por acaso coincidem na string. `LS_LEGACY` é a chave **antiga**, de
  quando havia um só perfil (o estado morava direto nela). `LS_PREFIX` é a **base** das chaves
  novas, uma por perfil: `painelUFRGS_v1__alex`, `painelUFRGS_v1__seed`, etc. A migração (§2)
  copia o valor da chave legada para a chave do primeiro perfil.

**Conceito por trás — `localStorage`:** um armazém chave→valor que o navegador guarda **por
origem** (por site/arquivo) e que **sobrevive a recarregar e fechar o navegador**. Só guarda
**strings** (por isso usamos `JSON.stringify`/`JSON.parse` para objetos), é **síncrono** (a
leitura/escrita bloqueia o thread — ok para pouca coisa) e tem uma cota (~5 MB). É o "banco de
dados" local do painel.

```js
const PROVA_TESTE = (typeof DATAS_PROVA!=="undefined" && DATAS_PROVA.ufrgs2027) || new Date("2026-11-28T00:00:00");
```

**O quê.** A data da "prova-teste" (o alvo do ciclo curto). Tenta usar a fonte oficial
(`DATAS_PROVA`, definida em `fases-data.js`); se ela não existir, usa uma data fixa de reserva.

- **Sintaxe — `typeof X !== "undefined"`:** por que não escrever só `DATAS_PROVA && ...`? Porque
  se `DATAS_PROVA` **nunca foi declarada** (o `<script>` não carregou), lê-la diretamente lança
  `ReferenceError` e derruba o app. `typeof` é o **único** jeito seguro de perguntar "essa
  variável existe?" sem explodir — `typeof numaVariavelInexistente` devolve `"undefined"` em vez
  de erro.
- **Sintaxe — `A && B || C`:** aproveita o *short-circuit*. `&&` devolve `B` se `A` for
  verdadeiro (senão devolve `A`); `||` devolve o primeiro operando verdadeiro. Resultado: "se
  `DATAS_PROVA` existe, use `DATAS_PROVA.ufrgs2027`; senão, a data fixa". Em JS, `&&` e `||` não
  devolvem `true/false` — devolvem **um dos operandos**, o que permite usá-los como expressão.
- **Conceito — detecção de ausência / *graceful degradation*:** o app foi feito para funcionar
  **mesmo sem** alguns arquivos (o `fases-data.js`, o kit `perfil-seed.js`…). Em vez de assumir
  que tudo carregou, ele checa e tem um plano B. Você verá esse padrão o tempo todo.

---

## §1 — ID de tópico

```js
function topicId(discId, ei, ti){ return `${discId}.${ei}.${ti}`; }
```

**O quê.** Monta um identificador de tópico a partir de três coordenadas: o id da **disciplina**,
o índice do **eixo** (`ei`) e o índice do **tópico** (`ti`). Ex.: `"mat.2.4"` = disciplina
`mat`, 3º eixo, 5º tópico (índices começam em 0).

- **Sintaxe — *template literal*:** as crases `` ` `` permitem interpolar com `${…}`. Equivale a
  `discId + "." + ei + "." + ti`, porém mais legível.
- **Conceito — chave derivada/determinística:** o app **não guarda** IDs de tópico em lugar
  nenhum; ele os **recalcula** a partir da posição do tópico dentro de `DISCIPLINAS`. Mesma
  entrada → mesma saída, sempre.
- 🕳 **Armadilha importante:** como o ID depende da **posição** (`ei`, `ti`), se você
  **reordenar** os eixos ou tópicos em `edital-data.js`, os IDs mudam — e o progresso salvo
  (`S.topics["mat.2.4"] = {status:2}`) passaria a apontar para **outro** tópico. É por isso que
  os arquivos de dados são tratados como "ordem estável": dá para **acrescentar** ao fim, mas
  reordenar remapeia o progresso de todo mundo. Uma alternativa seria dar um `id` fixo a cada
  tópico no próprio dado (imune a reordenação), ao custo de ter de digitá-los e mantê-los.

---

## §2 — Perfis

O painel suporta **vários perfis** no mesmo navegador (ex.: Alex e a namorada, cada um com seu
progresso). Um **índice** (`IDX`) guarda a lista de perfis e qual está ativo; o **estado** de
cada perfil mora numa chave própria.

```js
const profKey = id => `${LS_PREFIX}__${id}`;
```

**O quê.** Dado um id de perfil, devolve a chave de `localStorage` onde o estado dele mora.
Ex.: `profKey("alex")` → `"painelUFRGS_v1__alex"`.

- **Sintaxe — *arrow function* de uma expressão:** `id => …` é uma função anônima curta. Sem
  chaves, o valor da expressão é **retornado implicitamente**. Equivale a
  `function(id){ return … }`.

```js
function loadIndex(){
  try{ const raw = localStorage.getItem(LS_INDEX); if(raw) return JSON.parse(raw); }catch(e){}
  const legacy = localStorage.getItem(LS_LEGACY);
  // 1ª execução com perfil-seed.js (kit presenteável): cria o perfil da pessoa, sem "Alex"
  const seed = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED && PERFIL_SEED.nome && !legacy) ? PERFIL_SEED : null;
  if(seed){
    const idx = { active:"seed", profiles:[{ id:"seed", nome:String(seed.nome).trim(), emoji:seed.emoji||"🌱" }] };
    if(!localStorage.getItem(profKey("seed")) && seed.curso && CURSOS[seed.curso])
      localStorage.setItem(profKey("seed"), JSON.stringify({ version:1, curso:seed.curso }));
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
    return idx;
  }
  // 1ª execução normal: cria perfil "Alex" e migra o estado legado (perfil único), se houver
  const idx = { active:"alex", profiles:[{ id:"alex", nome:"Alex", emoji:"🌅" }] };
  if(legacy && !localStorage.getItem(profKey("alex"))){
    localStorage.setItem(profKey("alex"), legacy);
    localStorage.removeItem(LS_LEGACY);
  }
  localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  return idx;
}
let IDX = loadIndex();
```

**O quê / como.** Carrega (ou **cria pela primeira vez**) o índice de perfis. A lógica tem três
caminhos:
1. **Já existe índice** salvo → lê e retorna (`JSON.parse`).
2. **Não existe, mas há um "seed"** (`perfil-seed.js` do kit presenteável) → cria um perfil com o
   nome da pessoa presenteada (nunca "Alex") e já grava o curso dela.
3. **Não existe e não há seed** (caso normal) → cria o perfil "Alex" e, se houver estado do
   tempo em que havia **um perfil só** (`legacy`), **migra** esse estado para a chave do Alex.

- **Sintaxe — `try { … } catch(e) {}`:** protege o `JSON.parse`. Se o valor salvo estiver
  corrompido (ou o `localStorage` indisponível), em vez de derrubar o app, o `catch` **vazio**
  engole o erro e a função **segue** para os caminhos 2/3 (recriar do zero).
  - 🕳 **Armadilha / *smell*:** um `catch` vazio "esconde" problemas. Aqui é **proposital**
    (dado ilegível ⇒ recomeçar é o comportamento certo), mas como hábito geral é perigoso —
    você pode estar escondendo um bug de verdade. O mínimo saudável seria `console.warn(e)`.
- **Sintaxe — operador ternário `cond ? A : B`:** a linha do `seed` é um `if/else` em forma de
  expressão. Lê-se: "se (`PERFIL_SEED` existe **e** tem nome **e** ainda não há estado legado),
  então `PERFIL_SEED`, senão `null`".
- **Sintaxe — `seed.emoji || "🌱"`:** *valor padrão*. Se `seed.emoji` for "falsy" (ausente/vazio),
  usa `"🌱"`. (Cuidado: `||` também troca `0`/`""` — ver a nota sobre `??` no §3.)
- **Conceito — migração única (idempotente):** o caminho 3 move o estado antigo **uma vez** e
  **apaga** a chave legada (`removeItem`). Assim, da próxima vez, o `legacy` não existe mais e o
  bloco não repete. Migrar dados ao evoluir o formato, sem perder o que o usuário já tinha, é um
  problema recorrente em apps que guardam estado local.
- **Sintaxe — `let IDX = loadIndex();`:** `IDX` é **estado de módulo** (uma variável global,
  mutável, viva enquanto a página existe). Usa-se `let` (e não `const`) porque `switchProfile` e
  outros a **reatribuem**.

```js
function saveIndex(){ localStorage.setItem(LS_INDEX, JSON.stringify(IDX)); }
function activeProfile(){ return IDX.profiles.find(p=>p.id===IDX.active) || IDX.profiles[0]; }
```

- **`activeProfile`** procura na lista o perfil cujo `id` casa com `IDX.active`. O
  **`|| IDX.profiles[0]`** é uma **rede de segurança**: se `active` apontar para um id que não
  existe mais (estado inconsistente), cai no primeiro perfil em vez de devolver `undefined` e
  quebrar quem chamou.
- **Sintaxe — `Array.prototype.find`:** devolve o **primeiro** elemento que satisfaz o teste, ou
  `undefined`. Recebe uma função (o "predicado") `p => p.id === IDX.active`.

```js
function switchProfile(id){ if(id===IDX.active) return; save(); IDX.active=id; saveIndex(); location.reload(); }
```

**O quê.** Troca o perfil ativo: **salva** o atual, muda `IDX.active`, persiste o índice e
**recarrega a página**.

- **Conceito — *guard clause*:** `if(id===IDX.active) return;` sai cedo quando não há o que
  fazer (já é o perfil ativo). Retornar cedo evita aninhar o resto num `if` e deixa o "caminho
  feliz" reto.
- **Conceito — recarregar como "re-render de tudo":** em vez de reconstruir cada aba na mão para
  o novo perfil, o código simplesmente faz `location.reload()`. **Trade-off:** é a solução mais
  **simples e robusta** (a página inteira renasce lendo o novo estado), mas pisca a tela e perde
  a suavidade de um SPA. Para um app pessoal, a simplicidade vence.

```js
function addProfile(nome){
  nome = (nome||"").trim(); if(!nome) return;
  const id = "p"+Date.now().toString(36);
  IDX.profiles.push({ id, nome, emoji:"🌱" });
  save(); IDX.active=id; saveIndex();
  localStorage.setItem(profKey(id), JSON.stringify(structuredClone(DEFAULT_STATE)));
  location.reload();
}
```

- **Sintaxe — `"p"+Date.now().toString(36)`:** gera um id único. `Date.now()` é o timestamp em
  ms; `.toString(36)` o escreve na base 36 (dígitos `0-9a-z`), ficando curto (ex.: `"p3k9f2a"`).
  É um id "bom o suficiente" para uso local (dois perfis criados no mesmo milissegundo colidiriam
  — improvável para um humano clicando).
- **Sintaxe — `{ id, nome, … }` (*shorthand*):** `{ id }` é açúcar para `{ id: id }`.
- **`structuredClone(DEFAULT_STATE)`** cria uma **cópia profunda** do estado padrão para o novo
  perfil (ver o §3 para por que a cópia importa).

```js
function renameProfile(id, nome){ const p=IDX.profiles.find(x=>x.id===id); if(p && nome.trim()){ p.nome=nome.trim(); saveIndex(); } }
function deleteProfile(id){
  if(IDX.profiles.length<=1) return;
  localStorage.removeItem(profKey(id));
  IDX.profiles = IDX.profiles.filter(p=>p.id!==id);
  if(IDX.active===id) IDX.active = IDX.profiles[0].id;
  saveIndex(); location.reload();
}
```

- **`deleteProfile`** ilustra três cuidados: (1) **guard** — nunca apaga o último perfil; (2)
  remove **tanto** o estado (`removeItem`) **quanto** a entrada no índice (`filter`); (3) se o
  perfil apagado era o ativo, **reelege** o primeiro da lista antes de recarregar.
- **Sintaxe — `Array.prototype.filter`:** devolve um **novo** array com os itens que passam no
  teste. Aqui, "todos menos o de id `id`". Não muta o original — por isso a **reatribuição**
  `IDX.profiles = …`.

---

## §3 — Estado (`S`, `load`, `save`)

```js
const DEFAULT_STATE = { version:1, curso:"geral", migCursoGeral:true, foco:null, focoConfirmado:false, topics:{}, sessions:[], questions:[], simulados:[], redacoes:[], rascunhos:{}, chat:[], bancoResp:{}, trilha:{semana:1}, created:Date.now() };
let S = load();
```

**O quê.** `DEFAULT_STATE` é o **formato** (o *schema*) do estado de um perfil — o "molde" com
todos os campos e seus valores iniciais. `S` é o **estado vivo** do perfil ativo: o objeto que o
app inteiro lê e modifica.

Campos, em uma frase cada:
- `version` — versão do schema (para migrações futuras).
- `curso` / `migCursoGeral` — o curso-alvo e a marca da migração (ver `load`).
- `foco` / `focoConfirmado` — a área de foco escolhida e se o usuário a confirmou.
- `topics` — **mapa** `{ "disc.ei.ti": {status, note, link, srs} }` com o progresso por tópico.
- `sessions`, `questions`, `simulados`, `redacoes` — **listas** de eventos/registros.
- `rascunhos`, `bancoResp` — mapas (rascunho de redação por proposta; respostas do banco).
- `trilha` — o estado da Trilha de Arranque (`{semana}`).
- `created` — timestamp de criação.

- **Conceito — estado central único (*single source of truth*):** em vez de espalhar dados por
  variáveis soltas, tudo que define "onde o usuário está" mora em **um** objeto `S`. Ler é
  `S.algo`; mudar é `S.algo = x; save()`. É o mesmo princípio por trás de Redux/Vuex, só que sem
  biblioteca.

```js
function load(){
  try{
    const raw = localStorage.getItem(profKey(IDX.active));
    if(!raw) return structuredClone(DEFAULT_STATE);
    const p = JSON.parse(raw);
    const herdouCic = p.curso === "cic" && !("migCursoGeral" in p);
    const s = Object.assign(structuredClone(DEFAULT_STATE), p);
    if(herdouCic) s.curso = "geral";
    return s;
  }catch(e){ console.warn("load falhou",e); return structuredClone(DEFAULT_STATE); }
}
```

**O quê / como.** Lê o estado salvo do perfil ativo e o devolve pronto para uso. Se não houver
nada salvo (ou der erro), devolve uma cópia do padrão.

Duas ideias importantes acontecem aqui:

- **Conceito — *merge sobre os padrões* (evolução de schema):**
  `Object.assign(structuredClone(DEFAULT_STATE), p)` começa de uma cópia **completa** do padrão e
  **sobrescreve** com o que foi salvo (`p`). Efeito mágico: se você **adicionar um campo novo** ao
  `DEFAULT_STATE` numa versão futura, os perfis **antigos** (salvos sem esse campo) passam a
  tê-lo automaticamente, com o valor padrão. Sem esse merge, o campo novo viria `undefined` para
  quem já usava o app e quebraria o código que o espera.
  - **Sintaxe — `Object.assign(alvo, fonte)`:** copia as propriedades de `fonte` para `alvo` e
    devolve `alvo`. O primeiro argumento é **mutado** (por isso passamos uma cópia nova, não o
    `DEFAULT_STATE` original).
  - 🕳 **Armadilha — merge é *raso* (shallow):** `Object.assign` copia só o **primeiro nível**. Se
    `p.trilha` existir, ele **substitui inteiro** o `trilha:{semana:1}` do padrão — não funde
    campo a campo lá dentro. Para o estado atual isso é ok, mas se um objeto aninhado ganhasse um
    campo novo, ele **não** apareceria em perfis antigos (o merge raso não desce). Merge profundo
    exigiria uma função recursiva.

- **Conceito — migração versionada por marca:** as linhas do `herdouCic` corrigem uma decisão
  antiga (o curso padrão já foi `"cic"`). A lógica: "se o perfil está em `cic` **e** não tem a
  marca `migCursoGeral`, ele herdou o padrão velho → vira `geral` uma vez". Como a marca **nasce**
  no `DEFAULT_STATE`, todo perfil novo já a tem; e se o usuário **escolher** CiC de propósito
  depois, isso fica salvo **junto** com a marca e é respeitado para sempre. É um jeito elegante de
  distinguir "herdou um default" de "escolheu de propósito".
  - **Sintaxe — `"x" in obj`:** o operador `in` pergunta se a **chave** existe no objeto (mesmo
    que o valor seja `undefined`/`false`). Diferente de `obj.x !== undefined`, que não distingue
    "não tem a chave" de "tem a chave valendo `undefined`".

```js
function save(){ localStorage.setItem(profKey(IDX.active), JSON.stringify(S)); if(typeof Sync!=="undefined" && Sync.onSaved) Sync.onSaved(); }
```

**O quê.** Persiste `S` no `localStorage` do perfil ativo e, **se** a camada de sincronização
existir, avisa-a que houve gravação.

- **Conceito — *hook* / observador (desacoplamento):** o `app-core` **não sabe** o que é o
  `Sync`. Ele só chama `Sync.onSaved()` **se** existir. Quem implementa a sincronização
  (`sync.js`, que carrega **depois**) "se pendura" nesse gancho. Assim a fundação não depende da
  sincronização — a dependência é invertida. É o mesmo princípio de *injeção de dependência*: o
  núcleo oferece o ponto de extensão; outro módulo o preenche.
- 🕳 **Gotcha de ordem:** como `sync.js` carrega **depois** de `app-core.js`, durante o boot
  inicial `Sync` pode ainda não existir — daí a guarda `typeof Sync!=="undefined"`.

```js
function tRec(id){
  if(!S.topics[id]) S.topics[id] = { status:0, note:"", link:"", srs:null };
  return S.topics[id];
}
function topicStatus(id){ return S.topics[id]?.status || 0; }
```

- **`tRec` — inicialização preguiçosa (*lazy*):** o mapa `S.topics` começa **vazio**. Só se cria
  o registro de um tópico **quando alguém o toca** pela primeira vez. Economiza espaço (não
  guarda 131 registros zerados) e devolve o objeto para o chamador **mutar no lugar**
  (`tRec(id).status = 2`).
- **`topicStatus` — leitura segura:**
  - **Sintaxe — *optional chaining* `?.`:** `S.topics[id]?.status` devolve `undefined` (em vez de
    lançar erro) se `S.topics[id]` não existir. Sem o `?.`, acessar `.status` de `undefined`
    quebraria.
  - **`|| 0`** transforma o `undefined` em `0` (o status "não iniciado"). Aqui é seguro porque o
    valor válido "zero" **é** o padrão desejado. (Se `0` fosse um valor válido *diferente* do
    padrão, o certo seria `?? 0` — o *nullish coalescing*, que só troca `null`/`undefined`, não
    `0`/`""`/`false`.)

---

## §4 — Utilitários de DOM e texto

```js
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const esc = s => (s==null?"":String(s)).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const todayKey = () => new Date().toISOString().slice(0,10);
const daysBetween = (a,b)=>Math.round((b-a)/DAY);
```

Estes seis atalhos aparecem em **todo** o resto do código. Vale conhecê-los de cor.

- **`$` e `$$`** — apelidos para `querySelector` (o **primeiro** elemento que casa o seletor CSS)
  e `querySelectorAll` (**todos**). O `$$` embrulha o resultado em `[...]`.
  - **Sintaxe — *spread* `[...algo]`:** `querySelectorAll` devolve uma `NodeList`, que **não** é
    um array de verdade (tem `forEach`, mas não `map`, `filter`, `reduce`…). O `[...]` a
    **converte** num array real, liberando todos os métodos. É o *spread operator* transformando
    um iterável em array.
  - 💡 **Alternativa:** `Array.from(document.querySelectorAll(s))` faz o mesmo. `[...]` é mais
    curto; `Array.from` aceita um segundo argumento (função de mapeamento) que o spread não tem.

- **`el(t, c, h)`** — cria um elemento com tag `t`, classe opcional `c` e HTML interno opcional
  `h`. É uma "fábrica" que encurta o trio `createElement` + `className` + `innerHTML`.
  - **Sintaxe — `if(h!=null)`:** usa `!=` **solto** de propósito. `h != null` é `false` **apenas**
    quando `h` é `null` **ou** `undefined` (uma peculiaridade útil do `==`/`!=`). Assim, passar
    `h=""` (string vazia) **entra** no `if` e zera o `innerHTML`; passar nada (`undefined`)
    **pula**, deixando o elemento como veio.
  - 🕳 **Armadilha — XSS:** `innerHTML = h` **interpreta** `h` como HTML. Se `h` contiver texto do
    usuário sem escapar, um `<script>` embutido poderia executar. Por isso o `esc` existe e é
    usado antes de interpolar dados de usuário em templates (você vê isso no `botGrupo`, §6).

- **`esc(s)`** — escapa os caracteres perigosos de HTML (`&`, `<`, `>`, `"`), trocando-os pelas
  *entidades* (`&amp;`, `&lt;`…).
  - **Sintaxe — `replace(regex, fn)`:** quando o 2º argumento é uma **função**, ela é chamada para
    cada casamento `m`, e o retorno substitui o trecho. Aqui, `m=>({…}[m])` usa um objeto como
    "tabela de tradução": indexa o mapa pelo caractere achado.
  - **Sintaxe — `(s==null?"":String(s))`:** normaliza a entrada antes de escapar — `null`/
    `undefined` viram `""`; qualquer outra coisa vira string. Evita `null.replace(...)`.
  - **Conceito — prevenção de XSS por *escaping*:** transformar dados em texto inerte antes de
    injetá-los no HTML é a defesa nº 1 contra *Cross-Site Scripting*.
  - 🕳 **Gotcha:** **não** escapa a aspa simples `'`. É seguro para atributos entre aspas **duplas**
    (`class="…"`) e para conteúdo de texto, mas quebraria num atributo entre aspas simples. O
    código sempre usa aspas duplas, então está coberto — mas é bom saber o limite.

- **`todayKey()`** — a data de hoje como `"AAAA-MM-DD"`.
  - **Sintaxe — `.toISOString().slice(0,10)`:** `toISOString()` dá `"2026-07-20T13:45:00.000Z"`;
    `slice(0,10)` pega só a parte da data.
  - 🕳 **Armadilha — fuso:** `toISOString()` está em **UTC**. Perto da meia-noite no horário
    local, o "hoje" em UTC pode ser o dia seguinte (ou anterior). Para um app de estudo isso quase
    nunca importa, mas é uma fonte clássica de bugs de "por que a data mudou 1 dia?".

- **`daysBetween(a,b)`** — quantos dias inteiros de `a` a `b`. Subtrair duas `Date` dá a diferença
  em **milissegundos**; dividir por `DAY` e arredondar dá dias. O `Math.round` absorve as
  pequenas variações (ex.: dias de horário de verão não têm exatamente 86 400 000 ms).

---

## §5 — Cálculo de progresso

```js
function allTopics(){
  const out=[];
  DISCIPLINAS.forEach(d=>d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    out.push({ id:topicId(d.id,ei,ti), disc:d, eixo:ex, topic:tp });
  })));
  return out;
}
```

**O quê.** "Achata" a árvore `disciplina → eixo → tópico` numa **lista plana** de objetos
`{id, disc, eixo, topic}`, com o `id` já calculado. Muitas telas preferem iterar essa lista
plana a navegar a árvore aninhada.

- **Conceito — *flatten* (achatar) uma estrutura em árvore:** três `forEach` aninhados percorrem
  os três níveis; o `ei`/`ti` (o **índice** que o `forEach` fornece como 2º argumento) alimenta o
  `topicId`. O acumulador `out` coleta tudo.
- 💡 **Alternativa:** dava para fazer com `DISCIPLINAS.flatMap(...)` encadeado — mais "funcional",
  porém menos legível para quem está aprendendo. O `forEach` + `push` é explícito.

```js
function discProgress(d){
  let sum=0,tot=0;
  d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
    tot++; const s=topicStatus(topicId(d.id,ei,ti));
    sum += s===2?1 : s===1?0.5 : 0;
  }));
  return tot? sum/tot : 0;
}
```

**O quê.** O progresso (0 a 1) de **uma** disciplina: conta os tópicos e soma um "peso" por
status — `2` (dominado) vale `1`, `1` (visto) vale `0,5`, `0` (nada) vale `0`. Retorna a média.

- **Sintaxe — ternário encadeado:** `s===2 ? 1 : s===1 ? 0.5 : 0` lê-se de cima para baixo: "é 2?
  então 1. Senão, é 1? então 0,5. Senão, 0". É um `if/else if/else` compacto.
- **Sintaxe — `tot ? sum/tot : 0`:** *guarda contra divisão por zero*. Se a disciplina não tiver
  tópicos (`tot===0`), devolve `0` em vez de `NaN` (que `0/0` produziria e contaminaria a UI).
- **Conceito — normalização:** transformar contagens heterogêneas numa fração 0–1 comparável
  entre disciplinas.

```js
function overallProgress(){
  const ts=allTopics(); if(!ts.length) return 0;
  let s=0; ts.forEach(x=>{const st=topicStatus(x.id); s+= st===2?1:st===1?0.5:0;});
  return s/ts.length;
}
```

O mesmo cálculo, mas sobre **todos** os tópicos (usa a lista plana do `allTopics`). É o "domínio
geral" bruto — cada tópico pesa igual.

```js
function weightedProgress(){
  const pesos = CURSOS[S.curso].pesos;
  let num=0, den=0;
  const byProva={};
  DISCIPLINAS.forEach(d=>{
    (byProva[d.prova] ||= []).push(discProgress(d));
  });
  for(const pv of PROVAS){
    const arr=byProva[pv]||[0]; const avg=arr.reduce((a,b)=>a+b,0)/arr.length;
    const w=pesos[pv]||1; num+=avg*w; den+=w;
  }
  return den? num/den : 0;
}
```

**O quê.** O domínio **ponderado pelo curso**. Nem toda prova pesa igual: um curso de exatas dá
mais peso a Matemática. Esta função calcula uma **média ponderada** do progresso, agrupando
disciplinas por prova e usando os pesos do curso escolhido.

Passo a passo:
1. `pesos = CURSOS[S.curso].pesos` — pega o vetor de pesos do curso ativo.
2. **Agrupa** as disciplinas por prova em `byProva` (`{ enem:[0.3, 0.5], ufrgs:[…] }`).
   - **Sintaxe — `||=` (*logical OR assignment*, ES2021):** `(byProva[d.prova] ||= []).push(x)`
     significa "se `byProva[d.prova]` ainda não existe, crie um array vazio ali; então empurre
     `x`". Encurta o clássico `if(!byProva[k]) byProva[k]=[]; byProva[k].push(x)`. É uma forma
     enxuta de **agrupar** (o padrão *group-by*).
3. Para cada prova, tira a **média** do progresso das suas disciplinas e a multiplica pelo peso;
   acumula em `num` (numerador) e `den` (soma dos pesos).
   - **Sintaxe / Conceito — `reduce`:** `arr.reduce((a,b)=>a+b, 0)` percorre o array carregando um
     **acumulador** `a` (que começa em `0`) e o combina com cada elemento `b`. Aqui, soma tudo. O
     `reduce` é a operação "dobrar uma lista num único valor" — soma, produto, máximo, ou até
     construir um objeto. Entender `reduce` destrava metade da programação funcional.
4. `num/den` é a média ponderada final.

- **Conceito — média ponderada:** `Σ(valor·peso) / Σ(peso)`. Se todos os pesos fossem 1, viraria
  a média simples. Os `|| [0]` e `|| 1` são defesas contra prova sem disciplina ou sem peso.

---

## §6 — Navegação

```js
function go(tab){
  $$(".nav button").forEach(b=>b.classList.toggle("on", b.dataset.tab===tab));
  $$(".tab").forEach(t=>t.classList.toggle("on", t.id==="tab-"+tab));
  window.scrollTo({top:0,behavior:"instant"});
  if(tab==="metricas") renderMetricas();
  if(tab==="edital") renderEdital($("#editalDiscs"));
  if(tab==="analise") renderAnalise();
  /* … um if por aba … */
  if(tab==="painel") renderPainel();
  location.hash = tab;
  botSync(tab);
}
$("#nav").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) go(b.dataset.tab); });
```

**O quê.** `go(tab)` é o **roteador** do app: troca qual aba está visível e chama a função de
desenho da aba escolhida.

- **Conceito — roteamento client-side sem framework:** todas as abas existem no HTML ao mesmo
  tempo; só uma tem a classe `on` (visível). "Navegar" é trocar essa classe. É o que um
  React-Router faz por baixo, na unha.
- **Sintaxe — `classList.toggle("on", condição)`:** o **2º argumento** força o estado: adiciona
  `on` se a condição for verdadeira, remove se falsa. Aqui, "ligue o botão cujo `data-tab` é a
  aba atual; desligue os outros" — tudo num `forEach` só.
- **Sintaxe — `dataset`:** `b.dataset.tab` lê o atributo HTML `data-tab="…"`. Os `data-*` são o
  canal oficial para pendurar dados em elementos.
- **Conceito — renderização preguiçosa:** repare que só a aba **navegada** é redesenhada (o `if`
  correspondente). Não se gasta tempo redesenhando abas invisíveis. E redesenhar **toda vez** que
  se entra na aba (em vez de uma vez só) é proposital: a aba Edital, por exemplo, mostra o "acerto
  por tópico", que muda conforme você responde questões — então ela precisa recalcular ao abrir.
  - 💡 **Alternativa:** a cadeia de `if(tab===…)` poderia ser uma **tabela de despacho**
    `const R = { metricas: renderMetricas, edital: () => renderEdital($("#editalDiscs")), … }` e
    então `R[tab]?.()`. Mais elegante e sem repetição; a versão com `if` é só mais literal.
- **`location.hash = tab`** grava a aba na URL (`…/index.html#banco`), o que permite **deep-link**
  (abrir direto numa aba) e faz o botão "voltar" do navegador ter algum sentido.

- **A última linha é um conceito por si só — *event delegation* (delegação de evento):** em vez de
  pôr um `onclick` em **cada** botão da nav, põe-se **um** listener no contêiner `#nav`. Quando
  qualquer clique borbulha até lá, `e.target.closest("button")` descobre **qual** botão foi
  clicado (subindo do alvo real até o botão ancestral mais próximo). Vantagens: um listener em vez
  de N; e funciona até para botões **adicionados depois**. `e.target.closest(sel)` sobe a árvore a
  partir do elemento clicado até achar um que case o seletor (ou `null`).

```js
const BOT_GRUPOS = { estudar: {…}, medir: {…} };
const BOT_TAB2GRP = (()=>{ const m={};
  Object.entries(BOT_GRUPOS).forEach(([k,g]) => g.itens.forEach(i => { m[i.tab]=k; }));
  return m; })();
```

**O quê.** No celular, as 10 abas viram uma barra de 5 (três diretas + dois **grupos** que abrem
uma "folha"). `BOT_GRUPOS` descreve os grupos; `BOT_TAB2GRP` é o **mapa inverso** `aba → grupo`
(ex.: `{ edital:"estudar", metricas:"medir", … }`), usado para acender o item certo.

- **Sintaxe — IIFE (*Immediately Invoked Function Expression*):** `(()=>{ … return m; })()` é uma
  função **definida e chamada na hora**. Serve para **calcular** `BOT_TAB2GRP` com um laço e
  variável temporária (`m`) **sem** vazar esse `m` para o escopo global. O que "sai" é só o
  `return`.
  - 💡 **Alternativa:** `Object.fromEntries(...)` também construiria o mapa; a IIFE é escolhida
    aqui por clareza com o duplo laço (grupos → itens).
- **Sintaxe — desestruturação em parâmetro `([k,g]) => …`:** `Object.entries(obj)` devolve pares
  `[chave, valor]`; a desestruturação nomeia direto `k` (chave) e `g` (valor) em vez de usar
  `par[0]`/`par[1]`.
- **Conceito — índice/mapa derivado (pré-computado):** em vez de, a cada navegação, varrer os
  grupos procurando a que aba pertence, calcula-se o mapa inverso **uma vez** no carregamento.
  Troca trabalho repetido por memória — um clássico de otimização.

```js
function botSync(tab){
  $$("#botNav button").forEach(b=>{
    const ativo = b.dataset.go ? b.dataset.go===tab : b.dataset.grp===BOT_TAB2GRP[tab];
    b.classList.toggle("on", !!ativo);
  });
}
```

Acende o item da barra inferior correspondente à aba atual — seja um item **direto**
(`data-go="painel"`) ou o **grupo** ao qual a aba pertence (`data-grp="estudar"`).

- **Sintaxe — `!!ativo`:** força um valor qualquer a **booleano** (dupla negação). Garante que o
  2º argumento de `toggle` seja `true`/`false`, e não `undefined` (que teria comportamento de
  "alternar", não de "forçar").

```js
function botGrupo(k){
  const g = BOT_GRUPOS[k]; if(!g) return;
  const atual = ($(".tab.on")||{id:""}).id.replace("tab-","");
  $("#sheetTit").textContent = g.nome;
  const box = $("#sheetItens"); box.innerHTML = "";
  g.itens.forEach(i=>{
    const b = el("button", "sheet-it" + (i.tab===atual ? " on" : ""),
      `<span class="ic">${i.ic}</span><span class="tx">
         <span class="tt">${esc(i.t)}</span><span class="dd">${esc(i.d)}</span></span>`);
    b.onclick = ()=>{ $("#dlgGrupo").close(); go(i.tab); };
    box.appendChild(b);
  });
  $("#dlgGrupo").showModal();
}
```

**O quê.** Abre a "folha" (um `<dialog>`) com os itens do grupo `k`, montando cada botão na hora.

- **Sintaxe — `($(".tab.on")||{id:""}).id`:** se **existe** uma aba ativa, pega seu `id`; se não
  (nada ativo ainda), usa o objeto-reserva `{id:""}` para que `.id` não estoure. É a técnica do
  "objeto vazio de reserva" para evitar `Cannot read property 'id' of null`.
- **Conceito — construção de HTML por *template literal* + escaping:** o conteúdo do botão é uma
  string com `${esc(i.t)}` — os textos passam por `esc` antes de entrar via `innerHTML` (feito
  pelo `el`). É a disciplina de "escape na fronteira": dado de fora vira texto inerte ao virar
  HTML.
- **Conceito — *closure* dentro de laço (e por que não há o bug clássico):** cada botão recebe
  `b.onclick = () => { …; go(i.tab); }`. Essa função "lembra" do `i` da sua iteração (isso é uma
  *closure*: a função captura variáveis do escopo onde nasceu). Como `forEach` cria um **`i` novo
  a cada volta**, cada `onclick` captura o **seu** `i` — diferente do velho bug do `for(var i…)`,
  em que todos os handlers compartilhavam o **mesmo** `i` e no fim apontavam para o último valor.
- **Conceito — o elemento `<dialog>`:** `showModal()` abre um diálogo modal nativo (com fundo
  escurecido e captura de foco); `close()` fecha. É HTML puro, sem biblioteca de modal.

```js
$("#botNav").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.go) go(b.dataset.go);
  else if(b.dataset.grp) botGrupo(b.dataset.grp);
});
$("#dlgGrupo").addEventListener("click", e=>{ if(e.target.id==="dlgGrupo") $("#dlgGrupo").close(); });
```

- Mesma **delegação** de antes na barra inferior: um clique → ou navega direto (`data-go`) ou
  abre o grupo (`data-grp`).
- **Fechar tocando fora:** um `<dialog>` **não** fecha sozinho ao clicar no fundo. O truque:
  quando o clique tem `e.target.id === "dlgGrupo"`, ele bateu no **próprio** elemento dialog (a
  área do backdrop, não os filhos internos) → então fecha. Cliques nos itens internos têm outro
  `target` e não disparam o fechamento.

---

## §7 — Aparência (os 3 eixos)

O visual é o produto de **três escolhas independentes (ortogonais)**, cada uma um atributo no
`<html>`: **cor** (`data-theme`), **forma** (`data-style`, os "Looks") e **layout** (`data-nav`,
onde fica a navegação — só no desktop). O CSS reage a esses atributos; o JS aqui só **liga** os
seletores e **persiste** a escolha. (O contrato completo está em `pesquisa/analise/DESIGN-SYSTEM.md`.)

```js
const TEMA_COR  = { escuro:"#0c0f16", guaiba:"#070f1e", claro:"#eef1f8", gradiente:"#0a0e24" };
const LOOK_TEMA = { literaria:"escuro", linear:"guaiba", atelie:"claro", aurora:"gradiente" };
function temaAtual(){ return document.documentElement.dataset.theme || "escuro"; }
function estiloAtual(){ return document.documentElement.dataset.style || "literaria"; }
function navAtual(){ return document.documentElement.dataset.nav || "lateral"; }
```

- **`document.documentElement`** é o `<html>`. `.dataset.theme` lê/escreve o atributo
  `data-theme`.
- **Convenção "padrão = sem atributo":** o valor padrão de cada eixo (`escuro`/`literaria`/
  `lateral`) é representado pela **ausência** do atributo — por isso o `|| "escuro"` etc. Isso
  mantém o HTML limpo no caso comum e deixa o CSS do padrão morar no `:root` base.
- `TEMA_COR` mapeia cada tema à cor da **barra de status** do navegador/PWA; `LOOK_TEMA` diz qual
  tema **nativo** cada Look traz (ver `setEstilo`).

```js
function aparenciaSync(){
  const t = temaAtual(), s = estiloAtual(), n = navAtual();
  $$(".theme-pick button").forEach(b => b.classList.toggle("on", b.dataset.theme===t));
  $$(".style-pick button").forEach(b => b.classList.toggle("on", b.dataset.style===s));
  $$(".nav-pick button").forEach(b => b.classList.toggle("on", b.dataset.nav===n));
}
```

**Sincroniza a UI com o estado:** lê os três valores atuais e acende, em cada seletor
(`theme/style/nav-pick`), o botão correspondente. É o mesmo padrão do `go`/`botSync`: "reflita o
estado atual nos controles".

```js
let _wipeT = [];
function withWipe(apply){
  const fx = document.getElementById("fxWipe");
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!fx || rm){ apply(); return; }
  _wipeT.forEach(clearTimeout); _wipeT = [];
  fx.classList.add("on");
  _wipeT.push(setTimeout(apply, 220));                          // troca no pico
  _wipeT.push(setTimeout(() => fx.classList.remove("on"), 430));
}
```

**O quê.** Executa a função `apply` (que efetivamente troca o tema/Look/layout) **no meio de uma
transição "pôr-do-sol"** — uma cortina que cobre a tela por ~450 ms, escondendo o "pulo" do
reflow. `apply` roda aos 220 ms (o pico da cortina, quando a tela está tapada).

- **Conceito — receber uma função como argumento (*higher-order function*):** `withWipe` não sabe
  o que muda; ele recebe **o que fazer** (`apply`) e decide **quando** fazer (aos 220 ms). Separa
  a *animação* da *ação*.
- **Conceito — acessibilidade (`prefers-reduced-motion`):** quem configurou o sistema para
  "reduzir animações" (`rm`) recebe a troca **na hora**, sem cortina. Respeitar essa preferência
  é básico de acessibilidade.
- **Conceito — cancelar timers pendentes (anti-*flicker*):** se você clicar rápido em vários
  temas, cada clique agenda `setTimeout`s. Guardá-los em `_wipeT` e limpá-los
  (`forEach(clearTimeout)`) no início evita que uma troca antiga "estoure" no meio da nova. É
  primo do *debounce*.
- 🕳 **Gotcha de teste:** como `apply` roda **aos 220 ms**, se você trocar o tema e medir o layout
  **imediatamente**, ainda vê o **antigo**. (A sonda `probe-nav.js` teve de esperar ~680 ms por
  causa disso.)

```js
function applyTema(t){
  if(t==="escuro") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try{ localStorage.setItem("painelTema", t); }catch(e){}
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute("content", TEMA_COR[t] || TEMA_COR.escuro);
}
function setTema(t){ withWipe(() => { applyTema(t); aparenciaSync(); }); }
```

- **`applyTema`** aplica o tema **sem** animação (o "fazer" cru): escreve o atributo (ou o
  **apaga** se for o padrão `escuro`), **persiste** em `localStorage` e atualiza a cor da barra do
  navegador via a `<meta name="theme-color">`.
- **`setTema`** é a versão "com cortina": embrulha `applyTema` + `aparenciaSync` no `withWipe`.
  Note a separação **applyX (cru) vs setX (com transição)** — útil porque o *boot* no `<head>`
  quer aplicar **sem** animação, e o clique quer **com**.
- **Sintaxe — `try{ localStorage.setItem(…) }catch(e){}`:** gravar no `localStorage` pode
  **lançar** (janela anônima com cota zero, storage desabilitado). O `try/catch` impede que isso
  quebre a troca de tema — no pior caso, a preferência só não persiste.

```js
function setEstilo(s){
  withWipe(() => {
    if(s==="literaria") delete document.documentElement.dataset.style;
    else document.documentElement.dataset.style = s;
    try{ localStorage.setItem("painelEstilo", s); }catch(e){}
    const nt = LOOK_TEMA[s];            // cada Look chega com seu tema nativo
    if(nt) applyTema(nt);
    aparenciaSync();
  });
}
```

Igual ao `setTema`, com um detalhe de produto: ao escolher um **Look**, o app **também** aplica o
**tema nativo** daquele Look (`LOOK_TEMA[s]`). Por quê? Porque a elevação/sombra de cada Look foi
calibrada para um fundo específico (Ateliê p/ claro, Aurora p/ escuro). Depois, o usuário ainda
pode recolorir livremente. **Os eixos continuam ortogonais no CSS** — esse acoplamento existe
**só no clique**, como um "preset de partida".

```js
function applyNav(n){
  if(n==="lateral") delete document.documentElement.dataset.nav;
  else document.documentElement.dataset.nav = n;
  try{ localStorage.setItem("painelNav", n); }catch(e){}
}
function setNav(n){ withWipe(() => { applyNav(n); aparenciaSync(); }); }
```

O terceiro eixo (layout da navegação). Espelha exatamente o par `applyTema`/`setTema`, mas
**nunca** mexe em cor nem em tema nativo — layout é gosto de **aparelho**, não de aparência. Foi
adicionado em 2026-07-20 (ver `docs`/PLANO); a simetria com os outros dois eixos é proposital,
para o código ficar previsível.

```js
$$(".theme-pick button").forEach(b => b.addEventListener("click", () => setTema(b.dataset.theme)));
$$(".style-pick button").forEach(b => b.addEventListener("click", () => setEstilo(b.dataset.style)));
$$(".nav-pick button").forEach(b => b.addEventListener("click", () => setNav(b.dataset.nav)));
aparenciaSync();
```

Liga cada botão dos três seletores à sua função e, por fim, chama `aparenciaSync()` **uma vez** no
carregamento para acender os botões conforme o que o *boot* no `<head>` já aplicou.

- 🕳 **Por que a preferência de aparência NÃO entra no `S`?** Porque é **gosto do aparelho**, não
  do perfil: você pode querer o tema claro no notebook e escuro no celular. Por isso mora em
  chaves próprias (`painelTema`/`painelEstilo`/`painelNav`) e **não** sincroniza entre aparelhos —
  diferente do `S`, que é o seu progresso e viaja.

---

## §8 — Curso

```js
function fillCursoSelect(){
  const sel=$("#cursoSel"); sel.innerHTML="";
  Object.entries(CURSOS).forEach(([k,v])=>{
    const o=el("option"); o.value=k; o.textContent=v.nome; sel.appendChild(o);
  });
  sel.value=S.curso;
  sel.onchange=()=>{ S.curso=sel.value; save(); renderPainel(); renderSim(); renderMetricas(); };
}
```

**O quê.** Preenche o `<select>` de curso-alvo a partir de `CURSOS`, marca o curso salvo e liga o
`onchange` para atualizar o estado e redesenhar as telas afetadas.

- **Conceito — *select controlado* pelo estado:** as `<option>` são geradas do dado (`CURSOS`), e
  `sel.value = S.curso` faz o controle **refletir** o estado. No `onchange`, o fluxo é sempre o
  mesmo do app inteiro: **muda `S` → `save()` → re-renderiza** o que depende disso (Painel,
  simulador Argumento e Métricas — todos usam o peso do curso).
- **Sintaxe — `Object.entries(CURSOS)`:** transforma o objeto `{ geral:{…}, cic:{…} }` em uma
  lista de pares `[["geral",{…}], ["cic",{…}]]`, iterável com `forEach` e desestruturável em
  `[k,v]` (chave, valor).
- **Por que `sel.onchange = …` e não `addEventListener`?** `onchange` (propriedade) só admite
  **um** handler e é simples de reatribuir. `addEventListener` acumula vários. Como aqui só há um,
  a propriedade basta — mas repare que **misturar** os dois estilos no mesmo projeto é comum e
  pode confundir (uma pequena inconsistência de estilo).

---

## Resumo dos conceitos deste arquivo
Ao terminar `app-core.js`, você já viu (e vai reencontrar em toda fatia):

| Conceito | Onde apareceu |
|---|---|
| `localStorage` (persistência string, síncrona, por origem) | §0, §2, §3, §7 |
| Detecção de ausência com `typeof x !== "undefined"` | §0 (`PROVA_TESTE`), §3 (`Sync`) |
| Chave derivada/determinística (e o risco de reordenar dados) | §1 (`topicId`) |
| Migração de estado versionado (idempotente, por marca) | §2 (`loadIndex`), §3 (`load`) |
| `structuredClone` (cópia profunda) vs `Object.assign` (cópia rasa) | §2, §3 |
| Merge sobre os padrões (evolução de schema) | §3 (`load`) |
| Estado central único (`S`) + `save()` | §3 |
| *Hook*/observador e inversão de dependência (`Sync.onSaved`) | §3 |
| Inicialização preguiçosa (`tRec`) | §3 |
| *Optional chaining* `?.` e `?? / ||` para padrões | §3, §5 |
| Atalhos de DOM; `NodeList` vs `Array` (spread `[...]`) | §4 |
| Prevenção de XSS por *escaping* | §4 (`esc`), §6 (`botGrupo`) |
| Ternário encadeado e guarda de divisão por zero | §5 |
| `reduce` e média ponderada (padrão *group-by* com `||=`) | §5 |
| Roteamento client-side + renderização preguiçosa | §6 (`go`) |
| *Event delegation* + `closest()` | §6 |
| IIFE e mapa derivado pré-computado | §6 (`BOT_TAB2GRP`) |
| *Closure* em laço (e por que `forEach` evita o bug do `var`) | §6 (`botGrupo`) |
| Elemento `<dialog>` (`showModal`/`close`, fechar no backdrop) | §6 |
| *Higher-order function*, `prefers-reduced-motion`, limpar timers | §7 (`withWipe`) |
| Atributos `data-*` dirigindo o CSS (design multi-eixo) | §6, §7 |
| Convenção "padrão = sem atributo" | §7 |

**Próximo no roteiro:** [`edital-data.explicado.md`](edital-data.explicado.md) — o **schema** dos
dados que este arquivo consome o tempo todo (`DISCIPLINAS`, `CURSOS`).
