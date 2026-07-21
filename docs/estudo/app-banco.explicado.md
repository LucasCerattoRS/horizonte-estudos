# 🎯 `app-banco.js` explicado — Questões, banco oficial e provas

> **Arquivo real:** `painel/app-banco.js` (572 linhas — a fatia mais longa)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`app-edital`](app-edital.explicado.md), [`dados`](dados.explicado.md)

A aba mais densa do painel, com **três subsistemas**:
1. **Banco manual** — questões que você cadastra (`S.questions`).
2. **Banco navegável** — as **3.831 questões oficiais** UFRGS+ENEM (`BANCO_QUESTOES`),
   com correção pelo gabarito e links de resolução.
3. **Provas oficiais** — a grade de respostas de uma prova inteira, corrigida contra
   `GABARITOS_UFRGS`/`GABARITOS_ENEM`.

Aqui entram em cena os grandes blobs do [`dados.explicado.md`](dados.explicado.md), e
aparece o conceito **estatístico mais profundo** do projeto: o **encolhimento
bayesiano** (`riscoDe`). Também é um festival de técnicas de DOM e performance. Vamos por
subsistema.

---

## §1 — Banco manual (`S.questions`)

### 1a. Diálogo de cadastro e o parsing das tags

```js
function saveQ(){
  const en=$("#dqEn").value.trim(); if(!en) return;
  S.questions.push({ id:"q"+Date.now(), disc:$("#dqDisc").value, topico:$("#dqTopico").value||"", en,
    ans:$("#dqAns").value.trim(),
    tags:$("#dqTags").value.split(",").map(s=>s.trim()).filter(Boolean),
    attempts:[], created:Date.now() });
  save(); $("#dlgQ").close(); renderBanco();
}
```

**`id:"q"+Date.now()`** — id único barato: o *timestamp* em ms. Duas questões criadas no
mesmo milissegundo colidiriam (improvável para cadastro manual), mas é o padrão simples de
"id sem servidor". `created:Date.now()` guarda a data para ordenar depois.

**`split(",").map(trim).filter(Boolean)` — o idioma de parsear lista digitada.** Um campo
de texto `"álgebra, , grafos "` vira `["álgebra","grafos"]`:
- `split(",")` → `["álgebra"," "," grafos "]`
- `.map(s=>s.trim())` → `["álgebra","","grafos"]`
- `.filter(Boolean)` → remove os vazios. **`Boolean` como função de filtro** deixa passar
  só o que é *truthy* — string vazia (`""`) é *falsy*, então some. É o jeito idiomático de
  "limpar" uma lista de vazios/nulos. Guarde esse `.filter(Boolean)`.

### 1b. Registrar tentativa (`||=`) e ordenar por "pior primeiro"

```js
function attemptQ(id,correct){
  const q=S.questions.find(x=>x.id===id); if(!q)return;
  (q.attempts ||= []).push({date:todayKey(),correct}); save(); renderBanco();
}
```

`(q.attempts ||= []).push(...)` — o **pega-ou-cria** do `||=`: garante que `attempts`
existe (caso questões antigas não tivessem o campo) e empurra no mesmo gesto. Migração
defensiva de estado embutida no uso.

```js
if(sort==="worst") qs.sort((a,b)=>(qAccuracy(a)??101)-(qAccuracy(b)??101));
```

**`?? 101` — o truque para jogar os "sem dado" para o fim.** `qAccuracy` devolve `null`
para questões nunca tentadas. Ordenando por "pior acerto primeiro", onde colocar as sem
tentativa? O `?? 101` (nullish coalescing) as trata como **101%** — acima de qualquer
acerto real (0–100) — então vão para o **fim** da lista de piores. É um **valor sentinela**
escolhido de propósito fora da faixa válida.

> **Nota — `??` × `||`:** `a ?? b` só cai em `b` se `a` for `null`/`undefined`; `a || b`
> cai também em `0`, `""`, `false`. Aqui **precisa** ser `??`: um acerto legítimo de `0%`
> não pode virar 101! Confundir os dois é um bug clássico. (Compare com o `|| 500` do
> `app-painel`, onde 0 não era um valor válido e `||` servia.)

```js
const dmap=Object.fromEntries(DISCIPLINAS.map(d=>[d.id,d]));
```

**`Object.fromEntries` + `map` para pares** constrói um índice `id → disciplina` de uma
vez, para o laço buscar `dmap[q.disc]` em O(1) em vez de `DISCIPLINAS.find(...)` a cada
questão. É a **lookup table** de novo — o inverso de `Object.entries`.

`delQ` usa `confirm("Excluir?")` — o diálogo nativo de confirmação, síncrono, para ação
destrutiva. Simples e eficaz sem UI própria.

---

## §2 — O "index farm": pré-computar tudo no carregamento

O banco oficial tem 3.831 questões. Procurar linearmente nelas a cada clique seria lento.
A solução: no **load**, o arquivo constrói **vários índices** com IIFEs.

```js
const BQ = (typeof BANCO_QUESTOES !== "undefined") ? BANCO_QUESTOES : [];
const BQ_IDX = (()=>{ const m={};
  BQ.forEach(q=>{ m[`${q.exame}|${q.ano}|${q.disciplina}|${q.numero}`]=q; }); return m; })();
const BQ_TID = (()=>{ const m={};
  BQ.forEach(q=>{ if(!q.id_topico) return;
    const c = m[q.id_topico] || (m[q.id_topico]={n:0, UFRGS:0, ENEM:0});
    c.n++; if(c[q.exame]!=null) c[q.exame]++; });
  return m; })();
const NOME2TID = (()=>{ const m={}; Object.entries(TID2INFO).forEach(([tid,i])=>{ m[i.discId+"::"+i.tp]=tid; }); return m; })();
const BQ_BY_ID = (()=>{ const m={}; BQ.forEach(q=>{ m[q.id]=q; }); return m; })();
```

**Conceito — indexar por cada "pergunta" que você fará.** Cada índice responde uma
pergunta diferente em O(1):
- `BQ_IDX` → *"a questão nº X do exame/ano/disciplina Y"* (chave composta como string).
- `BQ_TID` → *"quantas questões caem no tópico T, e de qual exame"* (contagem agregada).
- `NOME2TID` → *"o tid do tópico com este nome nesta disciplina"* (índice reverso).
- `BQ_BY_ID` → *"a questão com este id"*.

Todos construídos **uma vez** por IIFE (o padrão de `TID2INFO` do `app-edital`, agora em
escala). O custo é uma passada em 3.831 itens no boot; o retorno é busca instantânea o
resto da sessão. **Chave composta como string** (`"ENEM|2023|CN|45"`) é um truque comum
para indexar por várias colunas de uma vez — concatenar os campos com um separador que não
aparece nos dados (`|`).

**A nota sobre o elo questão↔edital vale ler no código** (linhas 92-101): o `id_topico`
que o pipeline gravou é **o mesmo tid** do Mapa do Edital, e a integridade foi
**verificada** — 3.346 casamentos com gabarito idêntico em 100%. É a prova de que a
barreira de dados (validação estrita no gerador) funcionou.

---

## §3 — `riscoDe`: o encolhimento bayesiano (o conceito mais profundo do app)

```js
/* Risco = chance estimada de você errar o tópico. Com poucas respostas a taxa crua
   mente (2/2 não prova domínio de um tópico com 40 questões na prova), então ela é
   encolhida para um prior "não sei" — quanto menor a amostra, mais perto do prior. */
const RISCO_PRIOR = .55, RISCO_PESO = 3;
function riscoDe(a){
  const resp = a ? a.resp : 0, erros = a ? a.resp - a.ok : 0;
  return (erros + RISCO_PRIOR*RISCO_PESO) / (resp + RISCO_PESO);
}
```

**O problema:** você respondeu 2 questões de um tópico e acertou as 2. Sua taxa de erro
"crua" é 0%. Isso prova que você domina o tópico? **Não** — 2 questões não dizem quase
nada sobre um tópico que tem 40 na prova. A taxa crua **mente com amostra pequena**.

**A solução — encolher para um *prior*.** Em vez de `erros/resp`, o código calcula:

$$risco = \frac{erros + \text{prior} \times \text{peso}}{resp + \text{peso}}$$

Com `prior=.55` e `peso=3`, é como se você **começasse com 3 respostas fantasmas** de
risco 55% (o "não sei" neutro, levemente pessimista). Então:
- **0 respostas:** `(0 + .55·3)/(0 + 3) = .55` → o prior puro. Sem dado, risco médio.
- **2 acertos (0 erros):** `(0 + 1.65)/(2 + 3) = .33` → desceu, mas **não a 0** — 2
  acertos não te "provam" ainda.
- **20 acertos (0 erros):** `(0 + 1.65)/(20 + 3) = .07` → agora sim, perto de zero: a
  amostra grande **afoga** o prior.

**Conceito — pseudo-contagens / suavização (Laplace / Beta-binomial).** Isto é
estatística bayesiana na prática: o `peso` são **pseudo-observações** que puxam a
estimativa para o prior quando você tem pouco dado, e cuja influência **desaparece** à
medida que dados reais chegam. É o mesmo mecanismo por trás de "notas médias" confiáveis
na Amazon/IMDb (um produto com uma única avaliação 5★ não deve ranquear acima de um com
mil avaliações 4.8★). **Quanto menor a amostra, mais perto do prior; quanto maior, mais
perto da taxa real.**

Por que isso importa no app: `riscoDe` alimenta a **prioridade** do que estudar
(`app-analise`, `app-painel` via `prio = n × riscoDe(a)`). Sem o encolhimento, acertar 1
questão zeraria a prioridade de um tópico importante — um conselho de estudo perigosamente
errado. É a mesma família de cuidado do `MIN_RESP` (limiar de confiança), mas mais
elegante: em vez de um corte binário ("ignore abaixo de 3"), o prior faz uma **transição
suave** da ignorância ao conhecimento.

> Se você entender só um conceito deste arquivo, que seja este. É transferível para
> qualquer sistema que precise de médias/taxas confiáveis a partir de amostras desiguais.

---

## §4 — Navegação entre abas e truques de DOM

### 4a. `irAoEdital` — e o truque do "flash" reiniciável

```js
function irAoEdital(tid){
  …
  setTimeout(()=>{
    row.scrollIntoView({block:"center", behavior:"smooth"});
    row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
    setTimeout(()=>row.classList.remove("flash"), 2400);
  }, 80);
}
```

Leva da aba Questões ao Mapa do Edital, abre a disciplina, rola até o tópico e o
**pisca**. A linha misteriosa:

```js
row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
```

**Conceito — forçar *reflow* para reiniciar uma animação CSS.** Se você só remove e
re-adiciona a classe `.flash` no mesmo instante, o navegador **agrupa** as duas mudanças e
a animação **não reinicia** (ele nunca "viu" a classe sumir). Ler `row.offsetWidth`
**força o navegador a recalcular o layout naquele ponto** (*reflow* síncrono),
"materializando" o estado sem a classe. Aí, ao re-adicionar, a animação dispara do zero. O
`void` só descarta o valor lido (deixa claro "estou lendo pelo efeito colateral, não pelo
número"). É um truque conhecido e um tanto obscuro — vale reconhecer quando o vir.

### 4b. Estado de filtro entre abas (`bqEsp`)

`bqEsp` (variável de módulo) guarda um filtro que **chegou de outra aba**: `{tid}` (um
tópico) ou `{id}` (uma questão específica). `bqDoTopico`/`bqIrQuestao` o setam e chamam
`go("banco")`; `bqEspRender` desenha o "chip" de filtro ativo com um ✕ para limpar. É como
uma tela passa contexto para outra sem framework: **uma variável compartilhada + um
re-render**.

### 4c. Filtros: o idioma "vazio = casa tudo"

```js
return BQ.filter(q=>
  (!tid||q.id_topico===tid) &&
  (!ex||q.exame===ex) && (!dc||q.disciplina===dc) && (!an||q.ano===an) &&
  (!fig||q.tem_figura) &&
  (!busca || (q.enunciado||"").toLowerCase().includes(busca) || …)
);
```

**Cada filtro é `(!valor || bate)`.** Se o filtro está vazio (`!valor` é `true`), o termo
passa **todos**; se preenchido, exige o casamento. Encadeados com `&&`, montam um "E" de
condições onde **filtro vazio = sem restrição**. É o idioma limpo de filtragem
multi-critério — muito melhor que um monte de `if`s montando a lista. A busca textual usa
`toLowerCase().includes()` (case-insensitive) em vários campos com `||`.

**`[...new Set(BQ.map(q=>q.exame))].sort()`** (em `fillBqFilters`) extrai os **valores
únicos** de um campo: `map` pega todos, `new Set` deduplica, `[...]` volta a array para
`.sort()`. É o idioma de "quais valores distintos existem nesta coluna" — para popular um
`<select>`.

### 4d. Re-render cirúrgico (performance)

```js
function bqResponder(id, letra){
  …
  const card=$(`#bqList .bq[data-id="${id}"]`);
  if(card){ const tmp=el("div"); tmp.innerHTML=bqCard(q); const novo=tmp.firstElementChild;
    novo.querySelectorAll(".alt").forEach(b=>b.onclick=()=>bqResponder(id,b.dataset.l));
    card.replaceWith(novo); }
  …
}
```

**Conceito — re-renderizar só o que mudou.** Ao responder uma questão, redesenhar a lista
inteira (que pode ter 12+ cards) **perderia a rolagem** e piscaria a tela. Em vez disso, o
código **reconstrói só aquele card** (monta o HTML num `<div>` temporário, pega o
elemento, religa os eventos) e faz `card.replaceWith(novo)` — troca **um** nó no DOM. É a
otimização manual que os frameworks fazem por baixo (reconciliação). Compare com
`renderEdital`, que reconstrói tudo: aqui o custo de perder a rolagem justifica a cirurgia.

---

## §5 — "Perguntar ao Gemini" (sem chave de API) e o `toast`

```js
function bqGemini(id){
  …
  const prompt = `Me ajude com esta questão de ${q.exame} ${q.ano} …\n\n` + … + gabTxt + …;
  const abrir=()=>window.open("https://gemini.google.com/app","_blank","noopener");
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).then(()=>{
      abrir(); toast("Pergunta copiada — é só colar (Ctrl+V) no Gemini.");
    }).catch(()=>bqGeminiFallback(prompt));
  } else bqGeminiFallback(prompt);
}
```

**Importante para entender a decisão de produto:** o projeto **removeu a API do Gemini**
(sem chave de LLM). Mas manteve **este** botão — porque ele **não usa API**: monta um texto
de pergunta (enunciado + alternativas + gabarito), **copia para a área de transferência** e
**abre o site gratuito** `gemini.google.com`. Você cola e conversa lá. Zero custo, zero
chave. É a diferença entre *integrar um LLM* (removido) e *encaminhar para um site*
(mantido).

**A Clipboard API é assíncrona (Promises).** `navigator.clipboard.writeText(prompt)`
devolve uma **Promise**: `.then(...)` roda no sucesso (abre + avisa), `.catch(...)` no
fracasso (cai no fallback). E há a **detecção de recurso** `if(navigator.clipboard && …)`
— porque em `file://` a Clipboard API pode não existir/ser bloqueada; aí
`bqGeminiFallback` mostra o texto num diálogo para copiar à mão. **Degradação graciosa** de
novo, agora sobre uma API do navegador.

```js
function toast(msg){
  let t=$("#toast");
  if(!t){ t=el("div"); t.id="toast"; document.body.appendChild(t); t.style.cssText="…"; }
  t.textContent=msg; t.style.opacity="1";
  clearTimeout(_toastT); _toastT=setTimeout(()=>{ t.style.opacity="0"; }, 3200);
}
```

O `toast` (aviso flutuante) **cria o elemento na 1ª vez** e o reusa depois (`if(!t)`).
**`clearTimeout(_toastT)` antes de `setTimeout`** é um **debounce**: se dois toasts
aparecem rápido, o timer antigo é cancelado para não esconder o novo cedo demais. Cancelar
o timer anterior antes de agendar outro é o padrão para "reiniciar a contagem".

---

## §6 — Provas oficiais: corrigir uma prova inteira pelo gabarito

### 6a. A estrutura da prova (e a fusão da língua no ENEM)

```js
function pvProvaAtual(){
  …
  if(inst==="enem"){
    const base=…; const q={...base.q};   // spread: cópia rasa, p/ não mutar o dado original
    if(base.le){
      leCod=(…==="esp")?"esp":"ing";
      const le=base[leCod]; Object.assign(q,le); leNums=Object.keys(le).map(Number);
    }
    return { …, q, …, le:!!base.le, leCod, leNums, tri:true, … };
  }
  …
}
```

O ENEM tem 5 questões de **língua estrangeira** (inglês **ou** espanhol) no início de
Linguagens. `const q={...base.q}` faz uma **cópia rasa** do gabarito (spread) para poder
mesclar sem estragar o dado original; `Object.assign(q, le)` **funde** as 5 questões do
idioma escolhido. `!!base.le` converte para booleano. `tri:true` marca que a nota real do
ENEM é por **TRI** (Teoria de Resposta ao Item), não acerto bruto — daí o aviso na tela de
que o placar é só referência. Modelar essas particularidades de cada banca numa estrutura
comum é o que deixa `renderProva` genérico.

### 6b. A guarda de integridade em `pvBancoQ`

```js
/* GUARDA: só devolve se o gabarito do banco for o mesmo da grade — assim um
   eventual desalinhamento de numeração nunca vira enunciado errado na tela. */
function pvBancoQ(p, num){
  …
  const q = BQ_IDX[`${exame}|${$("#pvAno").value}|${disc}|${num}`];
  return (q && q.gabarito===p.q[num]) ? q : null;
}
```

**Conceito — "confie, mas verifique" na junção de dados.** A grade da prova (só letras) é
casada com o banco (enunciados) por `exame|ano|disciplina|nº`. Mas e se a numeração
estiver desalinhada entre as duas fontes? O código só devolve a questão do banco **se o
gabarito dela bater com o da grade**. Se não bate, é sinal de desalinhamento → devolve
`null` (mostra sem enunciado) em vez de exibir o **enunciado errado**. É uma **verificação
de consistência na fronteira da junção** — a mesma disciplina da barreira de dados,
aplicada em tempo de execução. Preferir "mostro menos" a "mostro errado".

### 6c. Dois modos de correção: imediato × no fim

```js
b.onclick=()=>{
  if(pvCorrigida) return;
  if(modo==="imediato"){ if(pvResp[num]) return; pvMarcarImediato(p, num, L, row); }
  else { pvResp[num]=L; row.querySelectorAll(".pv-opt").forEach(x=>x.classList.toggle("sel",x.textContent===L)); }
};
```

- **Imediato:** ao marcar, corrige na hora (`pvMarcarImediato` pinta a linha, mostra a
  resolução se errou, atualiza o placar corrente, e **auto-finaliza** quando todas foram
  respondidas).
- **No fim:** só registra a marcação (`pvResp[num]=L`) e destaca a escolhida;
  `corrigirProva` corrige tudo de uma vez (checando **pendentes** antes, com `alert`).

Ambos convergem em `pvFinalizar`, que calcula o score, **empurra para `S.simulados`** e
mostra o resultado colorido por faixa. **Nota — questão anulada conta como acerto:**
`pvResp[n]===p.q[n]` com `p.q[n]===null`? Na verdade a checagem é `p.q[n]===null ||
pvResp[n]===p.q[n]` — anulada (`null`) sempre soma ponto. Regra oficial dos vestibulares,
codificada num `||`.

### 6d. `renderPvHist` — agregação por disciplina

```js
const agg={};
S.simulados.forEach(s=>{ (agg[s.nome] ||= {ok:0,tot:0}); agg[s.nome].ok+=s.score; agg[s.nome].tot+=s.total; });
const chips=Object.entries(agg).map(([n,a])=>`<span class="tag">${esc(n)} ${Math.round(a.ok/a.tot*100)}%</span>`).join(" ");
```

Agrupa todas as provas feitas **por nome de disciplina** (`||=` inicializando o
acumulador) somando acertos/total, e mostra a % agregada por matéria. É o **group-by +
reduce manual** que você já viu em vários lugares — o padrão mais recorrente do app para
transformar uma lista de eventos num resumo por categoria.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| id por timestamp | §1a | `"q"+Date.now()` = id único sem servidor |
| `split/map(trim)/filter(Boolean)` | §1a | parsear lista digitada e limpar vazios |
| `?? valor` sentinela | §1b | jogar "sem dado" para o fim; `??` ≠ `\|\|` (0 é válido) |
| `Object.fromEntries` (lookup) | §1b | montar índice `id→objeto` em O(1) |
| Index farm (vários IIFEs) | §2 | um índice por pergunta que você fará; construídos no boot |
| Chave composta como string | §2 | `"ENEM\|2023\|CN\|45"` indexa por várias colunas |
| **Encolhimento bayesiano** | §3 | pseudo-contagens puxam a taxa ao prior com amostra pequena |
| Prior + peso (suavização) | §3 | transição suave da ignorância ao conhecimento (≠ corte binário) |
| Reflow para reiniciar animação | §4a | `void el.offsetWidth` entre remove/add da classe |
| Estado de filtro entre abas | §4b | variável de módulo + re-render passa contexto |
| Filtro "vazio = casa tudo" | §4c | `(!valor \|\| bate)` encadeado com `&&` |
| `[...new Set(map)]` | §4c | valores únicos de uma "coluna" |
| Re-render cirúrgico (`replaceWith`) | §4d | trocar 1 nó preserva rolagem; o que frameworks fazem |
| Encaminhar ≠ integrar (Gemini) | §5 | copia+abre o site grátis; sem chave de API |
| Clipboard API (Promise) + fallback | §5 | `.then/.catch` + detecção de recurso p/ `file://` |
| Debounce com `clearTimeout` | §5 | cancelar o timer antes de reagendar |
| Cópia rasa por spread (`{...q}`) | §6a | mesclar sem mutar o dado original |
| Confie mas verifique (join) | §6b | só casar se o gabarito bater; senão `null` |
| Modo imediato × em lote | §6c | corrigir a cada marca ou tudo no fim; convergem no finalizar |
| Anulada = acerto (`\|\|`) | §6c | regra do vestibular num operador |
| Group-by + reduce manual | §6d | resumir eventos por categoria (o padrão mais recorrente) |

---

**Próximo no roteiro:** [`app-redacao.explicado.md`](app-redacao.explicado.md) — a aba
**Redação**: um *wizard* de proposta em passos, o editor de rascunho com autosave, as
**rubricas oficiais** por banca e o lançamento de nota manual. A última das 6 abas antes
do boot (`app.js`).
