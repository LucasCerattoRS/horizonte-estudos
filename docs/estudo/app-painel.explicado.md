# 🏠 `app-painel.js` explicado — a home e o simulador Argumento

> **Arquivo real:** `painel/app-painel.js` (341 linhas)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`edital-data`](edital-data.explicado.md), [`app-edital`](app-edital.explicado.md)

Esta fatia monta a **tela inicial** e traz o pedaço mais "matemático" até agora: o
**simulador de Argumento**, que estima sua nota final por **média harmônica
ponderada**. Também aqui vivem a **Trilha de Arranque**, o **Foco da semana** (um
algoritmo de priorização com vários fatores) e a assinatura visual do app — o
**horizonte do Guaíba** desenhado em SVG que "enche" conforme seu domínio.

É a aba que mais **reúne helpers** do `app-core` (`weightedProgress`, `dueCards`,
`studyStreak`, `discProgress`, `daysBetween`) numa coisa só. Vamos por blocos.

---

## §1 — O simulador de Argumento: a **média harmônica**

Este é o conceito central da aba, e vale a pena entender a fundo — é matemática que
espelha como a UFRGS realmente calcula seu argumento.

### 1a. `renderSim` — os controles

```js
let simEP = {};
function renderSim(){
  const pesos=CURSOS[S.curso].pesos;
  const rows=$("#simRows"); rows.innerHTML="";
  PROVAS.forEach(pv=>{
    if(simEP[pv]==null) simEP[pv]=500;
    const row=el("div","sim-row");
    row.innerHTML=`
      <span class="pn">${PROVA_NOME[pv]}</span>
      <input type="range" min="300" max="800" value="${simEP[pv]}" data-pv="${pv}">
      <span class="ep" id="ep-${pv}">${simEP[pv]}</span>
      <span class="pw">×${pesos[pv]}</span>`;
    row.querySelector("input").oninput=e=>{ simEP[pv]=+e.target.value; $("#ep-"+pv).textContent=simEP[pv]; computeSim(); };
    rows.appendChild(row);
  });
  ...
}
```

**O quê:** desenha um *slider* (0–800) por prova. `simEP` (estado de módulo) guarda a
"escala padronizada" simulada de cada uma; começa em 500 (`if(simEP[pv]==null)`).

**Nota — `==null` cobre `null` E `undefined`.** `x==null` é `true` para os dois (e só
para os dois). É o teste idiomático de "ainda não tem valor". Aqui: "se essa prova
ainda não foi inicializada, use 500".

**Nota — `+e.target.value` (unary plus).** O valor de um `<input>` é **sempre string**
(`"640"`). O `+` na frente **converte para número** (`640`). Sem isso, `simEP` guardaria
`"640"` e a soma viraria concatenação (`"640"+"500"="640500"`). Coerção de tipo é uma
das armadilhas silenciosas mais comuns de JS — o `+` unário é o antídoto conciso.

**`oninput`** dispara a cada movimento do slider (ao contrário de `onchange`, que só no
soltar) → o número atualiza e `computeSim()` recalcula em tempo real.

### 1b. `computeSim` — a fórmula que importa

```js
function computeSim(){
  const pesos=CURSOS[S.curso].pesos;
  let num=0,den=0,arit=0,minEP=Infinity,wsum=0;
  PROVAS.forEach(pv=>{ const ep=simEP[pv]||500, w=pesos[pv]||1;
    num+=w; den+=w/ep; arit+=ep*w; wsum+=w; minEP=Math.min(minEP,ep); });
  const mh=num/den;             // média harmônica ponderada
  const ma=arit/wsum;           // aritmética ponderada
  $("#simBig").textContent=mh.toFixed(1);
  ...
}
```

**Conceito — média harmônica ponderada (o coração do app).** A fórmula é:

$$MH = \frac{\sum w_i}{\sum \dfrac{w_i}{x_i}}$$

No código: `num` acumula `Σwᵢ` (soma dos pesos), `den` acumula `Σ(wᵢ/xᵢ)`, e o
resultado é `num/den`. Compare com a **aritmética** ponderada (`ma = Σ(xᵢwᵢ)/Σwᵢ`),
calculada em paralelo para o usuário comparar.

**Por que harmônica e não a aritmética "normal"?** Porque a harmônica **pune notas
baixas** muito mais. A aritmética deixa uma prova excelente **compensar** uma péssima;
a harmônica, não — ela é sempre ≤ aritmética, e despenca se **qualquer** termo for
pequeno (repare: se um `xᵢ→0`, o termo `wᵢ/xᵢ→∞`, `den→∞`, `MH→0`). Isso modela a
realidade do vestibular: **não adianta gabaritar Matemática e zerar Redação** — a nota
fraca te derruba. O simulador ensina essa lição na pele: mexa um slider para baixo e
veja o `simBig` cair desproporcionalmente.

**Padrão — acumuladores num único laço.** Em vez de percorrer `PROVAS` cinco vezes
(uma por métrica), o `forEach` calcula **tudo de uma vez** (`num`, `den`, `arit`,
`wsum`, `minEP`). Menos laços, mais legível. `minEP` usa `Math.min` acumulando a partir
de `Infinity` — o **valor inicial neutro** para mínimos (qualquer número real é menor
que `Infinity`). Para máximos, o neutro seria `-Infinity`.

```js
  const bleed=PROVAS.some(pv=>(pesos[pv]>=2)&&(simEP[pv]<480));
  $("#simWarn").classList.toggle("on",bleed);
```

**`.some(...)`** devolve `true` se **ao menos um** elemento satisfaz a condição — aqui,
"existe uma prova de peso alto (≥2) com nota baixa (<480)?". É o alerta de "sangria":
uma matéria importante indo mal. `.some` para "algum?", `.every` para "todos?",
`.filter().length` para "quantos?".

### 1c. `simFromDom` — estimar as notas a partir do domínio

```js
function simFromDom(){
  const byProva={};
  DISCIPLINAS.forEach(d=>(byProva[d.prova] ||= []).push(discProgress(d)));
  PROVAS.forEach(pv=>{
    const arr=byProva[pv]||[0.3]; const avg=arr.reduce((a,b)=>a+b,0)/arr.length;
    simEP[pv]=Math.round(Math.max(320,Math.min(780, 460 + avg*300)));
  });
  renderSim();
}
```

Preenche os sliders a partir do seu progresso real. Três técnicas dignas de nota:

**`||=` (logical OR assignment).** `byProva[d.prova] ||= []` significa "se
`byProva[d.prova]` for *falsy* (aqui, `undefined`), atribua `[]`". Então empurra o
progresso. É o padrão **group-by**: agrupar disciplinas por prova, acumulando num array
por chave. Sem `||=`, seria `if(!byProva[k]) byProva[k]=[]; byProva[k].push(...)`.

**`reduce` para média.** `arr.reduce((a,b)=>a+b,0)/arr.length` soma o array (o `reduce`
clássico de soma, com acumulador inicial `0`) e divide pelo tamanho = média.

**Clamp (grampo).** `Math.max(320, Math.min(780, valor))` prende o resultado entre 320
e 780. Lê-se de dentro para fora: `Math.min(780, v)` corta o teto; `Math.max(320, …)`
corta o piso. É o idioma universal de "manter dentro de um intervalo" — decore, aparece
o tempo todo (aqui, no `ringSVG`, no `drawHorizonte`).

---

## §2 — `renderPainel`: o orquestrador da home

```js
function renderPainel(){
  const wp=weightedProgress(), op=overallProgress();
  $("#hsDom").textContent=Math.round(wp*100)+"%";
  $("#hsDue").textContent=dueCards().length;
  $("#hsStreak").textContent=studyStreak();
  $("#hsDias").textContent=daysBetween(Date.now(),PROVA_TESTE.getTime());
  const fa=faseAtual(), chip=$("#heroFase");
  if(chip){ if(fa){ chip.innerHTML=`…${esc(fa.nome)}… ${esc(fa.janela)}`; chip.style.display=""; } else chip.style.display="none"; }
  drawHorizonte(op);
  renderTrilha();
  renderHomeDiscs();
  renderFoco();
}
```

**Conceito — função orquestradora.** `renderPainel` não faz o trabalho pesado; ela
**delega** para especialistas (`drawHorizonte`, `renderTrilha`, `renderHomeDiscs`,
`renderFoco`) e só preenche os números do hero. Quebrar uma tela grande em
sub-renderizadores é o que mantém cada função pequena e testável. É por isso que outras
fatias chamam `renderPainel()` sabendo que a home inteira se atualiza.

Repare que ele consome vários helpers do `app-core`: `weightedProgress` (progresso
ponderado pelos pesos do curso — o número "importante"), `overallProgress` (simples,
alimenta o desenho), `dueCards().length` (quantas revisões vencem), `studyStreak`
(sequência de dias), `daysBetween` (contagem regressiva para a prova). A home é a
**vitrine** dos cálculos que moram no core.

---

## §3 — Trilha de Arranque: o "norte visível"

A Trilha é o ponto de partida guiado (semana 1, 2, 3…) que, ao terminar, "passa o
bastão" para o Foco da semana. Os dados vêm de `TRILHA` (`fases-data.js`); o estado é
`S.trilha.semana`.

### 3a. `trilhaSubj` — e a armadilha das duas disciplinas de LP

```js
function trilhaSubj(code){
  if(code==="redacao") return { nome:"Redação", icon:"✍️", ir:()=>go("redacao") };
  const cands=(typeof DISCIPLINAS!=="undefined") ? DISCIPLINAS.filter(x=>x.prova===code) : [];
  const d = cands.find(x=>x.id!=="red") || cands[0];
  ...
}
```

**A armadilha (documentada no comentário):** a prova **"LP"** tem **duas**
disciplinas em `DISCIPLINAS` — `port` (Língua Portuguesa) e `red` (Redação). Se a
trilha pede o "conteúdo" de LP, ela quer **Português**, não Redação. `filter(prova===
code)` traz as duas; `find(x=>x.id!=="red")` **exclui a redação** e pega a de conteúdo.
O `|| cands[0]` é a rede de segurança. E note: essa lógica **não depende da ordem** do
array `DISCIPLINAS` — se alguém reordenar, continua funcionando. Isso é robustez: nunca
confie na ordem de uma lista quando você pode filtrar pela propriedade certa.

**`ir:()=>{...}`** — cada matéria carrega uma **ação** (uma função) que sabe navegar
até ela. Guardar comportamento junto do dado é o padrão de **objeto-comando**.

### 3b. Avançar a trilha: estado com teto

```js
function trilhaAvancar(){ const N=TRILHA.semanas.length; S.trilha={semana:Math.min(N+1,(S.trilha?.semana||1)+1)}; save(); renderTrilha(); }
```

`Math.min(N+1, atual+1)` incrementa a semana **sem passar de N+1** (N+1 = "concluída").
`S.trilha?.semana||1` lê a semana atual com dois cintos de segurança: `?.` para o caso
de `S.trilha` não existir, `||1` para o caso de ser 0/undefined. É o mesmo ciclo de
sempre: muta `S` → `save()` → re-render.

### 3c. `renderTrilha` — os pontinhos e o "concluída"

```js
  const dots=TRILHA.semanas.map((_,i)=>`<i style="width:${i===n-1?'18px':'7px'};…background:${i<=n-1?'var(--sunset)':'…'};…"></i>`).join("");
```

Os **dots** de progresso: `map` sobre as semanas gerando um `<i>` por semana; a atual
fica mais larga (`18px` vs `7px`) e as passadas ficam coloridas (`i<=n-1`). O `_` no
`(_,i)` é convenção para "não uso o elemento, só o índice". O `.join("")` cola os
pedaços numa string só (senão o `map` deixaria vírgulas).

```js
  if(n>N){  // concluída → entrega o bastão ao Foco da semana
    box.innerHTML=`…Você engatou. Agora o Foco da semana assume o leme.…`;
    box.querySelector('[data-a="foco"]').onclick=()=>document.getElementById('foco')?.scrollIntoView({behavior:'smooth',block:'center'});
    ...
    return;
  }
```

Quando a trilha acaba (`n>N`), a tela **muda de conteúdo** e faz *early return* — um
estado terminal com sua própria UI. `scrollIntoView({behavior:'smooth'})` rola
suavemente até o Foco. É a costura narrativa: a Trilha se aposenta e aponta para o que
vem depois.

**⚠️ O padrão `setTimeout(…, 80)`** (aparece em `trilhaSubj`, `renderHomeDiscs`,
`renderFoco`):
```js
ir:()=>{ go("edital"); setTimeout(()=>{ const c=$(`…[data-disc="${d.id}"]`); c?.classList.add("open"); c?.scrollIntoView(...); },80); }
```
Ao navegar para outra aba (`go("edital")`) e querer **abrir e rolar** até um card
específico, o card **ainda não existe** no instante do clique — `renderEdital` precisa
rodar primeiro. O `setTimeout(…, 80)` adia a ação para "depois que o navegador
desenhar". Funciona, mas é um **code smell** conhecido: depende de um tempo mágico (80
ms) em vez de um sinal real de "pronto". A alternativa robusta seria `go` retornar/
chamar um callback pós-render, ou `requestAnimationFrame`. Aqui optou-se pela solução
simples; vale saber que é frágil (em um aparelho lento, 80 ms pode não bastar).

---

## §4 — `ringSVG`: o anel de progresso (donut) na unha

```js
function ringSVG(p){
  const r=18, C=2*Math.PI*r, off=(C*(1-Math.max(0,Math.min(1,p||0)))).toFixed(1);
  return `<svg class="ring" …>
    <circle class="rt" … r="${r}" fill="none" stroke-width="4"/>
    <circle class="rp" … r="${r}" fill="none" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 22 22)"/>
    <text …>${Math.round((p||0)*100)}</text>
  </svg>`;
}
```

**Conceito — anel de progresso por `stroke-dasharray`/`stroke-dashoffset`.** Este é o
truque clássico de "donut de progresso" em SVG, e vale ouro conhecer:

1. `C = 2πr` é a **circunferência** do círculo (o perímetro completo).
2. `stroke-dasharray="C"` diz "o traço tem comprimento C, depois um espaço de C" — ou
   seja, **um traço que dá exatamente uma volta**.
3. `stroke-dashoffset` **empurra** o início do traço. Com offset `C*(1-p)`, sobra
   visível uma fração `p` da volta. `p=0` → offset C → nada aparece; `p=1` → offset 0 →
   volta inteira. É assim que "quanto do círculo está pintado" vira uma fração.
4. `transform="rotate(-90 22 22)"` gira o começo para o **topo** (senão o preenchimento
   começaria às 3 horas). O `-90` é em torno do centro `(22,22)`.
5. O `Math.max(0,Math.min(1,p||0))` é o **clamp** de novo — garante que `p` fica em
   [0,1] mesmo se vier lixo, evitando um anel maluco.

**Nota — cor via CSS, não atributo (comentário no código):** as classes `.rt`/`.rp`
recebem a cor no CSS porque `var(--azul)` **não resolve** dentro de um atributo `fill=`
inline em alguns contextos. Guardar isso evita horas de "por que meu SVG está preto?".

---

## §5 — Foco da semana: um algoritmo de priorização multi-fator

`renderFoco` é a função mais "inteligente" do arquivo: escolhe **o que estudar a
seguir** combinando vários sinais. Vale estudar a modelagem.

### 5a. O score

```js
d.eixos.forEach((ex,ei)=>ex.topicos.forEach((tp,ti)=>{
  const id=topicId(d.id,ei,ti), st=topicStatus(id);
  const a=ACERTO[id];
  const acc = (a && a.resp>=MIN_RESP) ? a.ok/a.resp : null;   // só decide com amostra
  const errando = acc!==null && acc<0.6;
  if(st===2 && !errando) return;                              // dominado sai — salvo se erra nas questões
  const stScore = (st===2) ? 1 : st;
  const f=fd.topicos[tp.nome], share=f?f.n/fd.total:0;
  const due=!!(S.topics[id]?.srs && S.topics[id].srs.due<=Date.now());
  const fatorAcerto = acc===null ? 1 : 0.5+1.5*(1-acc);       // erra muito → sobe; acerta tudo → desce
  const naFoco = _fpv.includes(d.prova);
  const score=(w*(0.4+share*6)*(1-stScore*0.4)+(due?0.6:0))*fatorAcerto*(naFoco?2.2:1);
  itens.push({d,tp,id,st,w,share,due,score,a,acc,errando,naFoco});
}));
itens.sort((a,b)=>b.score-a.score);
```

**Conceito — pontuação multiplicativa de fatores.** O `score` combina cinco sinais,
cada um empurrando para cima ou para baixo:

| Fator | Efeito | Intuição |
|---|---|---|
| `w` (peso no curso) | multiplica | matéria que vale mais no seu curso importa mais |
| `share` (incidência) | `0.4+share*6` | tópico que cai muito na prova sobe forte |
| `stScore` (domínio) | `1 - stScore*0.4` | já dominado desce; não iniciado sobe |
| `due` (revisão vencida) | `+0.6` | se a revisão espaçada venceu hoje, ganha empurrão |
| `fatorAcerto` | `0.5+1.5*(1-acc)` | errando muito → sobe; acertando tudo → desce |
| `naFoco` (sua área) | `×2.2` | a área de foco escolhida domina o ranking |

**A disciplina estatística — `MIN_RESP`.** `acc` só vira número se você respondeu um
mínimo de questões (`a.resp>=MIN_RESP`); senão é `null` e o `fatorAcerto` fica neutro
(`1`). É o mesmo **limiar de confiança** do `app-edital` (`incidenciaInfo`): não deixe
uma amostra minúscula (1 questão) dar veredito. Maturidade de quem sabe que dado pouco
mente.

### 5b. Separar ALERTA de RANKING (a melhor lição de design da aba)

```js
/* Duas coisas diferentes, e misturá-las escondia a que importa:
   - RANKING: peso × incidência × lacuna × acerto — a aposta de maior retorno.
   - ALERTA: você marcou "dominado" e as questões oficiais te desmentem. … entra na
     frente, porque é o único ponto onde o painel sabe algo que você não sabe. */
const alerta = itens.filter(x=>x.st===2 && x.errando).sort((a,b)=>a.acc-b.acc);
const resto  = itens.filter(x=>!(x.st===2 && x.errando));
```

**Conceito — não misturar duas intenções numa métrica só.** O autor percebeu que
"você se acha bom mas erra" (alerta) e "o que rende mais estudar" (ranking) são
**perguntas diferentes**. Se somasse os dois num único score, o ranking (incidência
alta de qualquer tópico) sempre soterraria o alerta. A solução: **duas listas**, o
alerta **na frente**, ordenado do pior acerto para cima. Uma lição transferível: quando
um ranking "não sente certo", muitas vezes é porque ele está fundindo objetivos que
deveriam ser tratados à parte.

### 5c. Diversidade: no máximo 2 por disciplina

```js
const perDisc={}, escolhidos=[];
for(const x of [...alerta, ...resto]){
  if(escolhidos.length>=4) break;
  const c=perDisc[x.d.id]||0; if(c>=2) continue;
  perDisc[x.d.id]=c+1; escolhidos.push(x);
}
```

Percorre a lista concatenada (`[...alerta, ...resto]` — spread junta as duas) e escolhe
até 4 itens, **no máx. 2 por disciplina** (um contador `perDisc`). Sem isso, uma semana
poderia virar "4× Matemática". `break` para ao atingir 4; `continue` pula quando a
disciplina já tem 2. É um **filtro guloso com cota** — simples e eficaz para garantir
variedade.

### 5d. Fallback sem dados de frequência

```js
if(itens.length){ …ranking rico… return; }
// fallback sem frequencia-data: ranking por disciplina (comportamento antigo)
DISCIPLINAS.map(d=>({d,p:discProgress(d),w:pesos[d.prova]||1,naFoco:_fpv.includes(d.prova)}))
  .map(x=>({...x, score:(1-x.p)*x.w*(x.naFoco?2.2:1)}))
  .sort((a,b)=>b.score-a.score).slice(0,4)
  .forEach(...);
```

Se `frequencia-data.js` não carregou, o `if(itens.length)` falha e o código **recua**
para um ranking mais simples (só lacuna × peso × foco), por disciplina em vez de por
tópico. **Degradação graciosa** de novo: menos preciso, mas funciona. Note o
encadeamento fluente `map → map → sort → slice → forEach`: cada passo transforma a
lista. O `{...x, score:…}` (spread em objeto) cria uma cópia acrescentando `score` sem
mutar o original — **imutabilidade** no pipeline.

### 5e. A área de foco: `focoInferido` e o argmax

```js
function focoInferido(curso){
  const pesos=(CURSOS[curso]||{}).pesos||{};
  let best="exatas", bestW=-1;
  for(const [k,f] of Object.entries(FOCOS)){
    const w=f.provas.reduce((a,pv)=>a+(pesos[pv]||0),0);
    if(w>bestW){ bestW=w; best=k; }
  }
  return best;
}
```

**`Object.entries(FOCOS)`** transforma o objeto `{exatas:{...},...}` num array de pares
`[chave, valor]`, iterável com `for...of` e **desestruturação** `[k,f]`. Para cada
área, soma os pesos das suas provas (`reduce`), e guarda a de maior peso — o padrão
**argmax** (achar o item que maximiza algo): um `best`/`bestW` inicial ruim
(`bestW=-1`) e um `if(w>bestW)` que vai atualizando. É como se acha o máximo "com
memória de quem foi".

---

## §6 — `drawHorizonte`: a assinatura visual em SVG

```js
function drawHorizonte(p){
  const svg=$("#horizonte"); if(!svg) return; svg.innerHTML="";
  const W=400,H=240;
  const defs=svgNS("defs");
  defs.innerHTML=`<linearGradient id="sky" …>…</linearGradient>…`;
  svg.appendChild(defs);
  svg.appendChild(svgNS("rect",{x:0,y:0,width:W,height:H,fill:"url(#sky)"}));
  const horizonY = H*0.9 - p*(H*0.55);   // linha do horizonte sobe com o domínio
  const sunY = horizonY - 6 - p*30;      // sol acompanha
  const sunR = 26 + p*14;
  svg.appendChild(svgNS("circle",{cx:W*0.5,cy:sunY,r:sunR,fill:"url(#sun)"}));
  …
}
```

**O quê:** desenha, em SVG, um pôr-do-sol sobre o Guaíba cuja **geometria é função do
progresso `p`**: quanto mais você domina, mais alto sobe a linha do horizonte
(`horizonY` diminui — em SVG, y menor = mais para cima), mais alto e maior fica o sol.
É *dataviz* como metáfora: seu avanço "ilumina o horizonte".

**`svgNS(...)`** (helper do core) cria elementos no **namespace SVG**. Detalhe crucial:
elementos SVG **não** podem ser criados com `document.createElement` comum — precisam de
`createElementNS("http://www.w3.org/2000/svg", …)`. Por isso o helper existe. Misturar
os dois é o clássico bug de "criei o `<circle>` e ele não aparece".

**Os gradientes em `<defs>`.** `linearGradient`/`radialGradient` definem transições de
cor referenciadas por `fill="url(#sky)"`. O `<defs>` guarda definições reutilizáveis
que não são desenhadas diretamente. É como se fossem "variáveis de pintura" do SVG.

**A nota sobre `#heroPct` (aprendizado real):**
```js
// a marca de % fica num overlay HTML (#heroPct), fora do SVG, pois o
// preserveAspectRatio "slice" recorta o topo do SVG no celular e cortava o texto.
```
O percentual foi tirado de dentro do SVG e posto num elemento HTML sobreposto porque o
`preserveAspectRatio="slice"` (que preenche o container recortando o excesso)
**cortava** o texto no celular. É exatamente o tipo de armadilha que a metodologia de
"verificar de verdade em tela real" (o `CLAUDE.md`) existe para pegar.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Média harmônica ponderada | §1b | `Σw / Σ(w/x)`; pune nota baixa, modela o argumento real |
| `==null` (null OU undefined) | §1a | teste idiomático de "sem valor" |
| `+valor` (coerção a número) | §1a | `<input>.value` é string; `+` converte |
| `.some`/`.every`/`.filter().length` | §1b, §5 | "algum?" / "todos?" / "quantos?" |
| Acumuladores num laço só | §1b | calcular várias métricas numa passada |
| Valor inicial neutro (`Infinity`) | §1b | ponto de partida para min/max |
| `||=` e group-by | §1c | agrupar por chave acumulando em arrays |
| `reduce` para soma/média | §1c, §5e | dobrar uma lista num valor |
| Clamp `max(min,min(max,x))` | §1c, §4, §6 | prender num intervalo |
| Função orquestradora | §2 | delega para sub-renderizadores |
| Não confiar na ordem do array | §3a | filtrar pela propriedade, não pela posição |
| Objeto-comando (`ir:()=>…`) | §3a | guardar comportamento junto do dado |
| Estado com teto (`Math.min`) | §3b | incrementar sem estourar o limite |
| `setTimeout(…,80)` pós-navegação | §3c | *smell*: espera o paint por tempo mágico |
| Anel de progresso SVG | §4 | `dasharray=C` + `dashoffset=C*(1-p)` + `rotate(-90)` |
| Score multi-fator | §5a | combinar sinais multiplicando/somando |
| Limiar de confiança (`MIN_RESP`) | §5a | não decidir com amostra pequena |
| Separar objetivos numa métrica | §5b | alerta ≠ ranking; duas listas, não uma |
| Filtro guloso com cota | §5c | no máx. 2 por disciplina → variedade |
| Pipeline imutável `map/sort/slice` | §5d | `{...x, novo}` sem mutar o original |
| `Object.entries` + argmax | §5e | achar o item que maximiza algo |
| SVG namespace (`createElementNS`) | §6 | SVG não nasce de `createElement` |
| Geometria como função do dado | §6 | o progresso vira a posição do sol |

---

**Próximo no roteiro:** [`app-plano.explicado.md`](app-plano.explicado.md) — o
**Cronograma**, onde mora o **algoritmo SM-2** de repetição espaçada (o `srs` que
nasceu lá no `cycleStatus` do `app-edital` finalmente é consumido). O primeiro pedaço
de "ciência" pura do app.
