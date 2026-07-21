# 📊 `app-analise.js` explicado — Análise, o scatter em canvas e Recursos

> **Arquivo real:** `painel/app-analise.js` (532 linhas)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`app-edital`](app-edital.explicado.md), [`app-plano`](app-plano.explicado.md)

Esta é a aba mais **analítica** do painel: cruza **o que mais cai na banca**
(incidência real, de `frequencia-data.js`) com **o seu acerto** (das questões que você
respondeu), para responder à pergunta que importa — *"o que estudar rende mais ponto?"*.

Traz duas novidades técnicas grandes:
1. Um **scatter plot em `<canvas>`** — a primeira dataviz do projeto que **não** é SVG.
   Você vai aprender a diferença fundamental entre as duas APIs de desenho da web.
2. A sub-aba **Redações**, que resolve um problema real e sutil de dados: **comparar
   notas dadas em escalas diferentes** (a rubrica mudou ao longo do tempo).

Também mora aqui a aba **Recursos** ("onde aprender cada assunto").

---

## §0 — Guarda de dados e a ordem dos exames

```js
const _FREQ = typeof FREQUENCIA !== "undefined" ? FREQUENCIA : null;
const AN_EXAMES = [
  { id:"UFRGS", nome:"UFRGS" },
  { id:"ENEM",  nome:"ENEM" },
  { id:"TODOS", nome:"Os dois (agregado)" },
];
```

`_FREQ` é o mesmo padrão de **guarda com fallback** que você já viu: se
`frequencia-data.js` não carregou, vira `null` e a aba mostra um estado vazio em vez de
quebrar. `AN_EXAMES` fixa a **ordem** dos concursos — e o comentário no código explica a
decisão: UFRGS primeiro (o alvo), ENEM depois, **agregado por último**, porque *"somar os
dois esconde a diferença"*. Ordenar deliberadamente é comunicar prioridade (mesma ideia
do `ENEM_EXTRA` separado, lá em `edital-data`).

---

## §1 — `renderAnalise`: a tabela de incidência × acerto

### 1a. Estado vazio que ensina o próximo passo

```js
if(!_FREQ || !_FREQ.classificadas){
  sel.style.display = "none"; …
  lista.innerHTML = `<div class="card">…
    <code>python3 pipeline/classificar_questoes.py</code>…
    Depois recarregue esta página.</div>`;
  return;
}
```

Quando não há dados classificados, a aba não fica só vazia — ela **diz exatamente qual
comando rodar** para gerar os dados. É a filosofia de "estado vazio útil" (que você viu
no onboarding das Métricas), aplicada ao dono do repo: o vazio é uma **instrução**.

### 1b. Seletores derivados dos dados

```js
const porExame = _FREQ.porExame || { TODOS: { porDisc:_FREQ.porDisc, … } };
const exames = AN_EXAMES.filter(e => porExame[e.id]);
const exAtual = selEx.value && porExame[selEx.value] ? selEx.value : exames[0].id;
selEx.innerHTML = exames.map(e=>`<option value="${e.id}"${e.id===exAtual?" selected":""}>${esc(e.nome)}</option>`).join("");
selEx.onchange = renderAnalise;
```

**Padrão — opções derivadas do dado + estado preservado.** `AN_EXAMES.filter(e =>
porExame[e.id])` só oferece os concursos que **realmente têm dados**. `exAtual`
preserva a escolha atual do usuário **se ainda for válida** (`selEx.value &&
porExame[...]`), senão cai no primeiro. E `onchange = renderAnalise` faz o seletor
**re-renderizar a aba inteira** — a função é sua própria *callback*. Simples: mexeu no
filtro, redesenha tudo com o novo filtro. (Sem framework, "reatividade" é isto: chamar o
render de novo.)

```js
const discs = Object.keys(fx.porDisc)
  .map(id => ({ id, nome: (DISCIPLINAS.find(d=>d.id===id)||{nome:id}).nome }))
  .sort((a,b)=>a.nome.localeCompare(b.nome));
```

**`Object.keys` + `map` + `sort(localeCompare)`.** Pega os ids das disciplinas com
dados, enriquece com o nome (buscando em `DISCIPLINAS`, com fallback `{nome:id}` se não
achar), e ordena **alfabeticamente respeitando acentos**. **Nota — `localeCompare`:** um
`sort()` cru compara por código Unicode, e "Á" (192) viria depois de "Z" (90);
`a.localeCompare(b)` usa as regras do idioma e ordena "Análise, História, Química" como
um humano espera. Sempre que ordenar texto para exibir, use `localeCompare`.

### 1c. Montando a lista com incidência, acerto e prioridade

```js
d.eixos.forEach((e,ei) => e.topicos.forEach((tp,ti) => {
  const f = fd.topicos[tp.nome], tid = topicId(atual, ei, ti), a = ACERTO[tid] || null;
  const n = f ? f.n : 0;
  tops.push({ nome: tp.nome, eixo: e.nome, n, tid, a, prio: n * riscoDe(a) });
}));
const max = Math.max(1, ...tops.map(t=>t.n));
const esperado = fd.total / Math.max(1, tops.length);
```

Para cada tópico monta um objeto com: `n` (quantas questões caíram — incidência), `a`
(seu acerto), e **`prio = n * riscoDe(a)`** — a fórmula de priorização desta aba.

**Conceito — prioridade = incidência × risco.** A incidência sozinha só diz *o que cai*.
Multiplicar pelo **risco** (`riscoDe(a)`, um helper do core que é alto quando você erra
e baixo quando acerta) captura *"cai muito **E** você erra"* — que é onde estudar rende
mais ponto. Um tópico que cai muito mas você já domina tem `prio` baixa; um que cai muito
e você erra, `prio` alta. **A multiplicação combina dois sinais num só ranking.**

**`Math.max(1, ...tops.map(t=>t.n))`** — o máximo de incidência, com **piso 1** para
nunca dividir por zero ao normalizar as barras (`t.n/max`). O `...` (spread) espalha o
array como argumentos de `Math.max`. **`esperado`** = a incidência **se tudo caísse por
igual** (`total/nº tópicos`) — o mesmo *baseline uniforme* do `app-edital`, usado adiante
para classificar alta/média/baixa.

```js
const meu = tops.reduce((s,t)=>({ resp:s.resp+(t.a?t.a.resp:0), ok:s.ok+(t.a?t.a.ok:0) }), {resp:0, ok:0});
```

**`reduce` acumulando um objeto.** Soma respostas e acertos de todos os tópicos num
único `{resp, ok}`. O acumulador aqui **não é um número, é um objeto** — `reduce` serve
para dobrar uma lista em *qualquer* forma, não só soma escalar. O `t.a?…:0` protege
tópicos sem acerto registrado.

### 1d. Os 3 alvos e a ordenação com desempate

```js
const alvos = tops.filter(t=>t.n>0).sort((x,y)=>y.prio-x.prio).slice(0,3);
const alvoIds = new Set(alvos.map(t=>t.tid));

tops.sort(ordem==="prio"
  ? (a,b)=> b.prio-a.prio || b.n-a.n || a.nome.localeCompare(b.nome)
  : (a,b)=> b.n-a.n || a.nome.localeCompare(b.nome));
```

Os **3 alvos** = maior prioridade, guardados num `Set` de ids para marcá-los (🎯) em
qualquer ordenação da tabela.

**Nota de sintaxe — comparador com desempate encadeado (`||`).** `b.prio-a.prio ||
b.n-a.n || a.nome.localeCompare(b.nome)` lê-se: *"ordene por prioridade; em empate (a
subtração dá 0, que é falsy), desempate por incidência; se ainda empatar, por nome"*. O
`||` funciona porque `0` é *falsy* e "cai" para o próximo critério. É o idioma limpo de
**ordenação por múltiplas chaves** — cada `||` é um critério de desempate.

O usuário escolhe a ordem (por prioridade "prio" ou por o-que-mais-cai "cai") num
seletor; a mesma função serve às duas com um ternário no comparador.

### 1e. Classificação e "estimada divergente"

```js
const nivel = t.n >= esperado*1.5 ? "alta" : t.n <= esperado*0.6 ? "baixa" : "media";
const est = incidenciaDe(atual, t.nome);
const diverge = est !== nivel;
```

Cada tópico é classificado comparando sua incidência real com o `esperado` (≥150% =
alta, ≤60% = baixa). Então compara com a **estimativa curada à mão** (`incidenciaDe`, do
`recursos-data.js`): se divergem, marca "estimada era X" na tela. **Conceito — dado
observado auditando a curadoria.** Quando a realidade contradiz o palpite humano, o
painel **mostra os dois** em vez de esconder — é honestidade de dados, e uma pista de que
a curadoria precisa de revisão.

---

## §2 — O scatter em `<canvas>`: incidência × acerto

Este é o coração técnico da aba. Cada ponto é um tópico: **X = quantas questões caem**
(incidência), **Y = seu acerto (%)**. O quadrante "cai muito × você erra" (baixo à
direita) é pintado de vermelho — a zona de maior retorno.

### 2a. Canvas × SVG: por que trocar de API aqui?

Você viu SVG em `app-painel`/`app-plano`. Aqui é `<canvas>`. A diferença é conceitual:

| | **SVG** (retido) | **Canvas** (imediato) |
|---|---|---|
| Modelo | cada forma é um **nó no DOM** | você **pinta pixels**; nada persiste |
| Interação | `onclick` por elemento (o DOM sabe onde clicou) | **você** calcula o que foi clicado (hit-test manual) |
| Escala | poucos elementos | **muitos** pontos sem pesar o DOM |
| Tema (CSS vars) | funciona direto | precisa **reler** as cores e repintar |

**Por que canvas para o scatter?** Porque um scatter pode ter dezenas/centenas de
pontos. Em SVG isso seria dezenas de nós no DOM (mais pesado); em canvas é um laço de
`arc()`. O preço: canvas **não tem eventos por ponto** — se você quer tooltip/clique,
tem de descobrir "qual ponto está sob o mouse" **na mão** (o `Math.hypot` mais adiante).
É o clássico *trade-off* imediato × retido em computação gráfica.

### 2b. Nitidez em telas retina: `devicePixelRatio`

```js
const cssW = Math.max(280, wrap.clientWidth), cssH = 260;
const dpr = window.devicePixelRatio || 1;
cv.width = Math.round(cssW*dpr); cv.height = Math.round(cssH*dpr);
cv.style.width = cssW+"px"; cv.style.height = cssH+"px";
const g = cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,cssW,cssH);
```

**Conceito — o buffer do canvas × o tamanho na tela são coisas diferentes.** `cv.width`
(atributo) é o número de **pixels do buffer**; `cv.style.width` (CSS) é o **tamanho
visual**. Numa tela retina (`dpr=2`), um canvas de 280 px visuais precisa de um buffer de
560 px para ficar nítido — senão o navegador estica 280→560 e borra. A receita:
- buffer = `cssW * dpr` (pixels reais);
- estilo = `cssW px` (tamanho visual);
- `setTransform(dpr,0,0,dpr,0,0)` escala o sistema de coordenadas por `dpr`, para você
  **desenhar em coordenadas CSS** e o canvas cuidar da multiplicação. Assim o resto do
  código usa 280, não 560.

Sem esse trio, todo canvas fica embaçado em celular/Mac. É o *boilerplate* obrigatório de
canvas moderno — decore o padrão.

### 2c. Ler cores do CSS para dentro do canvas

```js
const cs = getComputedStyle(document.documentElement), C = n=>cs.getPropertyValue(n).trim();
const faint=C('--faint'), verde=C('--verde'), amarelo=C('--amarelo'), vermelho=C('--vermelho');
```

**A pegadinha do canvas com temas:** o canvas pinta valores de cor **literais** — ele
**não** entende `var(--verde)`. Como as cores do app vivem em variáveis CSS (e mudam com
o tema), o código **lê os valores computados** via `getComputedStyle` e usa as strings
resultantes (`"#3aa..."`). Consequência importante (no comentário do código): a cor só
acompanha o tema **no próximo render** — trocar o tema exige repintar o canvas. É por
isso que o `resize`/re-render existe. SVG não teria esse problema (usa `var()` direto);
é parte do custo de escolher canvas.

### 2d. Mapear dado → pixel, e a "zona de perigo"

```js
const maxN = Math.max(...pts.map(p=>p.n)), niceMax = Math.max(5, Math.ceil(maxN/5)*5);
const xOf = n => padL + (n/niceMax)*PW, yOf = acc => padT + (1-acc)*PH;
g.save(); g.globalAlpha=.09; g.fillStyle=vermelho;
g.fillRect(xOf(niceMax*0.4), yOf(0.5), xOf(niceMax)-xOf(niceMax*0.4), yOf(0)-yOf(0.5)); g.restore();
```

**`niceMax` — arredondar o eixo para um número "bonito".** `Math.ceil(maxN/5)*5`
arredonda o máximo para cima até o múltiplo de 5 mais próximo (17 → 20), com piso 5.
Eixos que terminam em 20 em vez de 17 são mais legíveis — é o que bibliotecas chamam de
"nice numbers".

**`xOf`/`yOf` — funções de escala (data→pixel).** Encapsulam a conversão "valor do
dado" → "coordenada na tela". Repare que **Y é invertido**: `(1-acc)` porque em canvas/SVG
o Y cresce **para baixo**, mas acerto alto deve ficar **em cima**. Toda dataviz tem esse
par de funções; nomeá-las deixa o resto do código legível (`xOf(p.n)` diz "onde na tela
fica essa incidência").

**A zona de perigo** é um retângulo vermelho translúcido (`globalAlpha=.09`) cobrindo
"incidência ≥40% do máximo × acerto <50%". `g.save()`/`g.restore()` **isolam** a mudança
de `globalAlpha`/`fillStyle`: salvam o estado do contexto antes e restauram depois, para
não vazar a transparência para o resto do desenho. **Sempre** envolva mudanças de estado
temporárias do canvas em `save`/`restore` — é o equivalente a "não deixar sujeira".

### 2e. Desenhar os pontos (e a ordem importa)

```js
_anMapDrawn = [];
pts.slice().sort((a,b)=>a.n-b.n).forEach(p=>{
  const x=xOf(p.n), y=yOf(p.acc);
  g.beginPath(); g.arc(x, y, 5, 0, Math.PI*2);
  g.fillStyle = p.acc>=.7 ? verde : p.acc>=.4 ? amarelo : vermelho; g.fill();
  g.lineWidth=1.5; g.strokeStyle=surf; g.stroke();
  _anMapDrawn.push({ x, y, ...p });
});
```

**`arc(x,y,5,0,Math.PI*2)`** desenha um círculo (raio 5, do ângulo 0 a 2π = volta
completa). `beginPath()` antes de cada ponto **zera o caminho** — sem ele, os arcos se
ligariam num rastro. `fill()` pinta o interior, `stroke()` a borda (com a cor da
superfície, criando um "vão" entre pontos que se tocam).

**`.slice().sort((a,b)=>a.n-b.n)`** — desenha do menor para o maior para que os **pontos
grandes fiquem por cima**. O `.slice()` copia o array antes de ordenar, para **não mutar**
`pts` (que é reutilizado). Sutil, mas importante: `sort` altera o array original;
`slice()` primeiro é a defesa.

**`_anMapDrawn.push({x, y, ...p})`** — aqui está o truque que compensa o canvas não ter
DOM: cada ponto desenhado é **memorizado** com sua posição de tela `(x,y)` mais os dados.
Esse cache é o que permite o hit-test depois.

### 2f. Hit-test manual: achar o ponto sob o mouse

```js
function _anMapHit(cv, ev){
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  let best=null, bd=1e9;
  for(const p of _anMapDrawn){ const d=Math.hypot(p.x-mx, p.y-my); if(d<bd){ bd=d; best=p; } }
  return bd<15 ? best : null;
}
```

**Conceito — hit-testing (o que o canvas não faz por você).** Como não há elementos, o
código traduz a posição do mouse para coordenadas do canvas (`clientX - rect.left`) e
**procura o ponto mais próximo** com `Math.hypot(dx, dy)` (a distância euclidiana,
√(dx²+dy²)). É um **argmin** (menor distância) — a mesma estrutura `best`/`bd` do argmax
que você viu, só que minimizando. Só conta como "acerto" se estiver a menos de 15 px
(`bd<15`), senão devolve `null` (mouse no vazio). Isto é literalmente o que o navegador
faz de graça no DOM/SVG, reimplementado à mão — o preço do canvas, e uma ótima aula de
como interação gráfica funciona por baixo.

```js
if(!_anMapBound){ _anMapBound = true; bindAnMap(cv); }
```

**Guarda de "ligar uma vez só".** Os listeners de mouse são presos **uma única vez**
(`_anMapBound`), não a cada render — senão empilhariam handlers duplicados a cada
redesenho (um vazamento clássico). O redesenho só atualiza `_anMapDrawn`; os eventos, já
ligados, leem sempre a versão nova.

O `resize` re-renderiza o mapa **só se** a aba Análise está visível e não está na sub-aba
Redações — evitando trabalho inútil quando o canvas nem está na tela.

---

## §3 — Sub-aba Redações: o problema de comparar escalas diferentes

Esta seção resolve um problema de dados que aparece em **qualquer** sistema que evolui:
os dados históricos foram gravados numa **escala que depois mudou**.

### 3a. Classificar a banca de cada redação

```js
const anrBancaDe = r => (r.banca && _RUBRICAS[r.banca]) ? r.banca
  : _RUBRICAS[r.tipo] ? r.tipo
  : (!r.tipo || r.tipo==="livre") ? "glau"
  : null;
```

Um **ternário encadeado como árvore de decisão**: usa `r.banca` se for uma rubrica
conhecida; senão tenta `r.tipo`; senão, redação "livre" cai na rubrica genérica "glau";
senão `null` (banca sem rubrica no painel — só aparece no histórico). Classificar dados
heterogêneos numa categoria canônica é uma tarefa comum; a cadeia de fallbacks a resolve
de forma legível.

### 3b. A banca padrão = a mais corrigida (moda via `reduce`)

```js
anrBanca = bancas.reduce((a,b)=>(cont[b]||0)>(cont[a]||0)?b:a, bancas[0]);
```

Escolhe automaticamente a banca com **mais correções** (a *moda*) como aba inicial —
`reduce` comparando contagens, guardando a de maior `cont`. É o **argmax** de novo, na
forma funcional (`reduce` em vez de laço com `best`). Mostrar primeiro o que o usuário
mais usa é bom senso de UX.

### 3c. O reescalonamento — a lição central

```js
/* A escala da rubrica pode MUDAR (a UFRGS virou 0–20 e a FUVEST 10–50 quando foram
   conferidas na fonte), e as redações antigas ficaram gravadas na escala de então (r.max).
   Comparar r.nota cru contra rb.escala daria 45% para um 9/10. Por isso tudo aqui passa
   pela fração r.nota/r.max, reprojetada na escala atual. */
const _naEscala = r => (r.max && r.max!==rb.escala) ? r.nota*rb.escala/r.max : r.nota;
const media = rs.reduce((a,r)=>a+_naEscala(r),0)/rs.length;
```

**O problema:** uma redação antiga foi salva como `9/10`. A rubrica dessa banca depois
mudou para escala `0–20`. Se você comparar o `9` cru contra a escala `20`, o app diria
"45%" — **errado**: o aluno tirou 90%, não 45%.

**A solução — normalizar pela fração.** Cada nota guarda **a sua própria escala da época**
(`r.max`). Para comparar, `_naEscala` converte tudo para a **escala atual** via a fração:
`nota × escalaAtual / maxDaÉpoca`. O `9/10` vira `9 × 20/10 = 18/20` (90%). Só então a
média faz sentido.

**Conceito — a fração é invariante; o valor absoluto não é.** Este é um princípio de
dados fundamental: quando a unidade/escala pode mudar, **guarde o suficiente para
renormalizar** (aqui, `r.max` junto de `r.nota`) e **compare sempre em proporção**, nunca
em valor cru. É o mesmo raciocínio de converter moedas por uma data-base, ou de comparar
provas com números de questões diferentes. Ignorar isso é uma das fontes mais comuns de
bug em relatórios ("por que a média despencou em 2023?" — porque a escala mudou e ninguém
renormalizou).

### 3d. Descartar valores fora do teto (dado de uma versão antiga)

```js
const vals = withC.map(r=>{ const k=r.criterios.find(x=>x.id===c.id); return k&&Number.isFinite(+k.nota)?+k.nota:null; })
  .filter(v=>v!=null && v<=teto);
```

Ao calcular a média **por critério**, o código descarta notas **acima do teto atual** do
critério — porque uma nota assim veio de uma **versão anterior da rubrica** (escala
diferente) e, somada, "estouraria a barra". `Number.isFinite(+k.nota)` garante que é
número de verdade (não `NaN`, `Infinity` ou string vazia). **Conceito — filtrar dado
inconsistente em vez de deixá-lo contaminar.** Melhor descartar 3 valores obsoletos e
mostrar uma média honesta dos válidos do que exibir um gráfico quebrado. É a barreira de
dados aplicada a dados **internos** que envelheceram.

### 3e. Ponto fraco e melhor nota (argmin / argmax)

```js
const fraco = comMed.length ? comMed.reduce((a,c)=>c.med/c.max<a.med/a.max?c:a) : null;
const melhor = rs.reduce((a,r)=>(r.nota/r.max)>(a.nota/a.max)?r:a);
```

`fraco` = o critério de **menor** proporção média (argmin); `melhor` = a redação de
**maior** proporção (argmax). Note que ambos comparam **frações** (`med/max`,
`nota/max`), não valores crus — pela mesma razão do §3c. Repare também que este `reduce`
**não tem valor inicial**: então o primeiro elemento vira o acumulador inicial e a
iteração começa do segundo — atalho válido quando a lista nunca é vazia (garantido pelo
`comMed.length ?` e pelo fato de `rs` já ter sido checado).

### 3f. O anel e a evolução (SVG de novo)

O anel de nota média usa **o mesmo truque de `stroke-dasharray`/`dashoffset`** do
`ringSVG` (veja `app-painel §4`) — vale confirmar que você reconhece o padrão: `off =
CIRC*(1-pct)`, `rotate(-90)`, cores por gradiente. A **evolução** é uma `<polyline>` cujos
pontos vêm de `rs.map((r,i)=>({x, y:…(r.nota/r.max)…}))` — de novo a **fração**, nunca a
nota crua, para a linha não pular quando a escala mudou. `fmtN` formata por escala
(inteiro se escala ≥100, uma casa decimal se menor) — respeitando a granularidade de cada
banca.

---

## §4 — Recursos: "onde aprender cada assunto"

### 4a. Popular o seletor uma vez só

```js
if(sel && !sel.dataset.done){
  sel.dataset.done = 1;
  const o0=el("option"); … sel.appendChild(o0);
  DISCIPLINAS.forEach(d=>{ … sel.appendChild(o); });
  sel.onchange = renderRecursos;
}
```

**`dataset.done` como flag de "já inicializei".** Diferente da tabela de Análise (que
recria tudo), o `<select>` de disciplinas é preenchido **uma vez** e marcado com
`data-done="1"` no próprio DOM. Nas próximas chamadas, o `if` pula. **Conceito — separar
setup único de re-render.** Nem tudo precisa ser recriado a cada render; opções fixas de
um seletor são setup de uma vez. Guardar a flag **no DOM** (não numa variável JS) tem uma
vantagem: sobrevive naturalmente enquanto o elemento existir.

### 4b. `openRecursos`: o diálogo "onde aprender este tópico"

Monta um modal com: uma **busca já mirada** no YouTube
(`ytTopico` usa `encodeURIComponent` para montar a query — mesmo escape de URL do
`obsUrl`), a **incidência** com atalho para resolver/cadastrar questões, os **canais
curados** da disciplina, e a **sua nota** — que aqui aparece de forma **adaptada ao
contexto**:

```js
if(!semCofre()){
  html += `…🗂 Abrir a nota "…" (obsUrl)…`;      // Alex: link Obsidian
} else if(temBase){
  html += `…📖 Ler a nota "…" no painel…`;         // Bia (sem Obsidian): leitor web
}
```

Recapitula a **degradação graciosa** do `app-edital`: com cofre, oferece o deep-link
Obsidian; sem cofre (painel-presente), oferece o leitor de notas embutido. Mesmo tópico,
duas experiências, decididas por `semCofre()`.

E note `canaisDe(discId)` (do `app-edital`): já **filtra os atalhos do cofre** quando é o
painel sem Obsidian. As peças das abas conversam entre si — outra prova de que dominar
`app-core` + `app-edital` destrava tudo.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Estado vazio que instrui | §1a | o vazio mostra o comando para gerar o dado |
| Opções derivadas + estado preservado | §1b | só ofereça o que tem dado; mantenha a escolha válida |
| `localeCompare` para texto | §1b | ordenar respeitando acentos e idioma |
| Prioridade = incidência × risco | §1c | multiplicar sinais num só ranking ("cai muito E erra") |
| `reduce` acumulando objeto | §1c | dobrar uma lista em `{resp,ok}`, não só num número |
| Baseline uniforme | §1c | comparar o real com "e se fosse tudo igual?" |
| Desempate encadeado (`||`) | §1d | `a-b || c-d || nome` = ordenação multi-chave |
| Dado observado auditando curadoria | §1e | mostrar quando a realidade contradiz o palpite |
| Canvas × SVG (imediato × retido) | §2a | pixels sem DOM; interação você calcula |
| `devicePixelRatio` + `setTransform` | §2b | buffer × tamanho visual; nitidez em retina |
| Ler CSS vars no canvas | §2c | canvas não entende `var()`; releia e repinte |
| Funções de escala `xOf/yOf` | §2d | data→pixel; Y invertido (`1-acc`) |
| `niceMax` (nice numbers) | §2d | arredondar o eixo para número legível |
| `save`/`restore` do contexto | §2d | isolar mudança temporária de estado do canvas |
| Ordem de desenho + `.slice()` antes de `sort` | §2e | grandes por cima; não mutar o array reusado |
| Hit-test por `Math.hypot` (argmin) | §2f | achar o ponto sob o mouse — o DOM faria de graça |
| Ligar listeners uma vez | §2f | flag `_bound` evita handlers duplicados |
| Classificação por cadeia de fallback | §3a | ternário encadeado como árvore de decisão |
| Moda via `reduce` (argmax) | §3b | escolher a categoria mais usada |
| Reescalonamento pela fração | §3c | **a proporção é invariante; o valor cru não** |
| Descartar dado obsoleto | §3d | filtrar valores fora do teto atual em vez de contaminar |
| `reduce` sem valor inicial | §3e | 1º elemento vira o acumulador (lista nunca vazia) |
| Flag de setup único (`dataset.done`) | §4a | separar inicialização de re-render; estado no DOM |
| Degradação graciosa (contexto) | §4b | mesma nota, Obsidian ou leitor web, por `semCofre()` |

---

**Próximo no roteiro:** [`app-banco.explicado.md`](app-banco.explicado.md) — a aba
**Questões**: o banco próprio, as **provas oficiais** UFRGS/ENEM e a **correção
automática por gabarito**. É a fatia mais longa (mais estados e filtros), e onde
`GABARITOS_UFRGS`/`GABARITOS_ENEM`/`BANCO_QUESTOES` (do `dados.explicado.md`) finalmente
entram em ação.
