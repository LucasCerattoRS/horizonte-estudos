# 📅 `app-plano.js` explicado — Cronograma, SM-2 e gráficos

> **Arquivo real:** `painel/app-plano.js` (271 linhas)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`app-edital`](app-edital.explicado.md)

Aqui está o primeiro pedaço de **ciência de verdade** do app: o **SM-2**, o algoritmo
clássico de **repetição espaçada** que decide *quando* você deve rever cada tópico. É o
mesmo motor por trás do Anki. Lembra do `rec.srs = {ease:2.5, …}` que nasceu no
`cycleStatus` (em `app-edital`)? É **aqui** que ele finalmente é usado.

A fatia também traz a **fase macro** (onde você está no plano de 16 meses), as
**Métricas** (KPIs) e três **gráficos em SVG** desenhados na unha. Muita coisa gira em
torno de **datas** — então este é também o capítulo de "como lidar com tempo em JS".

---

## §1 — SM-2: o algoritmo de repetição espaçada

```js
/* Qualidade: 0=Errei 1=Difícil 2=Bom 3=Fácil  (mapeado p/ SM-2 q=2..5) */
function reviewCard(id, quality){
  const rec=tRec(id);
  const srs = rec.srs || (rec.srs={ease:2.5,interval:0,due:Date.now(),reps:0});
  const q = [2,3,4,5][quality]; // SM-2 quality
  if(q<3){ // só "Errei" (q=2) reinicia o intervalo; "Difícil" vira q=3 → cai no else e paga no ease
    srs.reps=0; srs.interval=1;
  }else{
    srs.reps++;
    if(srs.reps===1) srs.interval=1;
    else if(srs.reps===2) srs.interval=6;
    else srs.interval=Math.round(srs.interval*srs.ease);
  }
  srs.ease = Math.max(1.3, srs.ease + (0.1 - (5-q)*(0.08+(5-q)*0.02)));
  srs.due = Date.now() + srs.interval*DAY;
  if(quality>=2 && srs.reps>=3) rec.status=2;
  else if(rec.status===0) rec.status=1;
  save();
  renderRevisao(); renderPainel();
}
```

### A ideia por trás (a "ciência")

**Repetição espaçada** parte de um fato da psicologia da memória (a *curva do
esquecimento* de Ebbinghaus): você esquece rápido logo após aprender, mas **cada
revisão bem-sucedida achata a curva** — a memória dura mais. Então o intervalo ideal
entre revisões **cresce** conforme você acerta: revê hoje, depois em 1 dia, 6 dias, 15,
38… Se erra, o intervalo **reseta** (você precisa reconstruir a memória). O objetivo é
revisar **na véspera de esquecer** — nem cedo (desperdício), nem tarde (já esqueceu).

### Destrinchando o código

**`const srs = rec.srs || (rec.srs = {...})` — o idioma "pega-ou-cria".** Se `rec.srs`
já existe, usa; senão, **cria e atribui na mesma expressão**, e o resultado da
atribuição (o objeto novo) vira o valor de `srs`. É uma forma compacta de "garanta que
existe e me dê a referência". (Compare com o `||=` do `app-painel` — mesma família.)

**`const q = [2,3,4,5][quality]` — array como tabela de conversão.** Os botões da UI
dão `quality` 0–3 (Errei/Difícil/Bom/Fácil), mas o SM-2 original usa escala 0–5. Em vez
de um `switch`, o código indexa um array literal: `[2,3,4,5][0]` = 2, `[…][3]` = 5.
**Um array indexado é o `switch` mais enxuto que existe** para mapear inteiros pequenos.

**O intervalo (o coração):**
- `q<3` → **reset**: `reps=0`, `interval=1` (revê amanhã). Atenção ao mapeamento: com
  `q=[2,3,4,5][quality]`, **só "Errei"** (quality=0 → q=2) cai aqui. **"Difícil"**
  (quality=1 → q=3) **não reseta**: entra no `else`, incrementa `reps` e progride o
  intervalo — a punição dele é **no `ease`** (a fórmula abaixo dá `−0,14` para q=3),
  ou seja, os intervalos futuros crescem mais devagar. O sistema pune a dificuldade
  pela **velocidade**, não pelo **recomeço**.
- acertou (Difícil/Bom/Fácil) → `reps++` e:
  - 1ª repetição: intervalo **1 dia**;
  - 2ª: **6 dias** (valores fixos canônicos do SM-2);
  - 3ª em diante: `interval = round(interval * ease)` — **multiplica** pelo fator de
    facilidade. Com `ease=2.5`, um intervalo de 6 vira 15, depois 38… crescimento
    **geométrico**. É o "espaçamento" ficando exponencial.

**O fator de facilidade (`ease`) e sua fórmula assustadora:**
```js
srs.ease = Math.max(1.3, srs.ease + (0.1 - (5-q)*(0.08+(5-q)*0.02)));
```
É a fórmula **literal** do SM-2 para ajustar quão "fácil" um card é. A intuição:
- acertou com folga (`q=5`) → o termo entre parênteses é `+0.1` → `ease` **sobe** (os
  intervalos vão crescer mais rápido);
- acertou penando (`q=3`) → o termo fica negativo → `ease` **desce** (intervalos
  crescem devagar);
- `Math.max(1.3, …)` impõe um **piso**: o `ease` nunca cai abaixo de 1.3, senão os
  intervalos parariam de crescer (ou encolheriam) e o card ficaria preso. Esse piso é
  parte do algoritmo original, não um detalhe do projeto.

Você **não precisa decorar** a fórmula — precisa entender que ela é um **controlador**:
transforma "quão bem você foi" num ajuste suave da velocidade de espaçamento.

**`srs.due = Date.now() + srs.interval*DAY`** — a data da próxima revisão é "agora + N
dias". `DAY` (do core) é `86400000` (ms num dia). Somar milissegundos a um timestamp é
como se faz aritmética de tempo em JS.

**Inferência de status:** `if(quality>=2 && srs.reps>=3) rec.status=2` — acertar
"Bom/Fácil" já na 3ª+ repetição promove o tópico a **dominado** automaticamente. O SRS
não só agenda: ele também **atualiza seu domínio** a partir do desempenho real. Fecha o
ciclo com o `cycleStatus` do `app-edital` (lá você marca à mão; aqui o algoritmo
corrige com base em evidência).

> **Alternativa moderna:** algoritmos como **FSRS** (usado no Anki hoje) modelam a
> memória com mais parâmetros e superam o SM-2 em eficiência. O SM-2 foi escolhido aqui
> por ser **simples, testado e suficiente** — cabe em 15 linhas, sem dependências. Um
> ótimo exemplo de "o algoritmo mais simples que resolve o problema".

🕳 **Nota de auditoria (2026-07-20) — o comentário mentiu, o código não.** O comentário
original do fonte dizia `// errou/difícil → reinicia intervalo`, e a 1ª versão deste
espelho **repetiu o comentário sem conferir o comportamento**: na verdade "Difícil"
(q=3) nunca entrou no `if(q<3)`. O código sempre esteve **fiel ao SM-2 canônico** (em
que q=3 não zera as repetições); errados estavam o comentário e a doc. Moral dupla:
(1) documentação linha-a-linha tende a explicar **os comentários**, não o comportamento
— execute o código de cabeça antes de escrever; (2) comentário desatualizado é dívida
que se **propaga**.

---

## §2 — Filas de revisão: `dueCards` e `scheduledCards`

```js
function dueCards(){
  const now=Date.now();
  return allTopics()
    .filter(x=>{const r=S.topics[x.id]; return r&&r.srs&&r.srs.due<=now;})
    .sort((a,b)=>S.topics[a.id].srs.due - S.topics[b.id].srs.due);
}
function scheduledCards(){
  /* …igual, mas due>now, e .slice(0,8) */
}
```

**O quê:** `dueCards` = tópicos com revisão **vencida** (`due<=now`); `scheduledCards`
= os **futuros** (`due>now`), limitados a 8.

**Padrão filter→sort.** `.filter(...)` seleciona (com guardas `r && r.srs` para não
estourar em tópicos sem SRS), `.sort((a,b)=>dueA - dueB)` ordena por data crescente
(o mais urgente primeiro). **Nota — comparador numérico:** `sort` sem função ordena
como **string** por padrão (`"10" < "9"`!); passar `(a,b)=>a-b` força ordem numérica.
Aqui a "chave" de ordenação é a data de vencimento (um número em ms), então subtrair
dá a ordem certa.

---

## §3 — A fase macro: micro × macro

```js
/* O SM-2 é o micro (o que revisar hoje); isto é o macro (em que trecho da
   trajetória você está). … NÃO lê nem grava o estado do usuário (S/localStorage). */
function faseAtual(ts=Date.now()){
  if(typeof FASES==="undefined" || !FASES.length) return null;
  const t = ts instanceof Date ? ts.getTime() : ts;
  for(const f of FASES){ if(t >= f.inicio.getTime() && t < f.fim.getTime()) return f; }
  return t < FASES[0].inicio.getTime() ? FASES[0] : FASES[FASES.length-1];
}
```

**Conceito — dois horizontes de tempo.** O SM-2 responde "o que revisar **hoje**"
(micro, dias). A fase macro responde "em que **etapa dos 16 meses** você está" (macro,
meses) — base, aprofundamento, reta final… É uma separação de escalas: o mesmo app
raciocina no curto e no longo prazo com mecanismos distintos.

**Nota importante — puramente derivada do relógio.** `faseAtual` só olha `Date.now()` e
os dados de `FASES`; **não** toca `S`/`localStorage`. Ou seja, não há estado a salvar —
a fase é *calculada* toda vez a partir da data de hoje. Isso é mais robusto: nada para
ficar desatualizado, nenhum "campo salvo" para migrar.

**`ts instanceof Date ? ts.getTime() : ts`** — aceita tanto um `Date` quanto um número
de ms, normalizando para número. **Programação defensiva** contra "não sei em que forma
a data vem". O parâmetro tem default `ts=Date.now()` (parâmetro padrão), então chamar
`faseAtual()` sem argumento usa "agora".

**O `for...of` com dois `return`.** Acha a fase cuja janela `[inicio, fim)` contém hoje.
Se nenhuma contém (antes da 1ª ou depois da última), o `return` final **satura nos
extremos** (`FASES[0]` ou `FASES[last]`) — nunca devolve `null` por "estar fora do
calendário". Cuidar dos casos de borda é o que separa código que funciona só "no meio".

### `renderFaseMacro` — a barra de 16 meses

Vale destacar o cálculo do progresso na trajetória e do "próximo marco":

```js
const frac=Math.max(0,Math.min(1,(now-ini)/(alvo-ini)));
```
Fração do caminho percorrido = (quanto já passou) / (duração total), **clampada** em
[0,1]. É a mesma técnica de "normalizar um valor num intervalo 0–1" que você viu no
`ringSVG`.

```js
const prox=Object.entries(typeof DATAS_PROVA!=="undefined"?DATAS_PROVA:{})
  .map(([k,d])=>({k,t:d.getTime()})).filter(p=>p.t>=inicioHoje.getTime()).sort((a,b)=>a.t-b.t)[0];
```
Acha a **próxima prova a partir de hoje**: transforma o objeto de datas em pares,
converte para timestamps, **filtra** as que ainda não passaram, **ordena** e pega a
primeira (`[0]`). É um `map→filter→sort→[0]` = "o menor que satisfaz X". O
`inicioHoje` (com `setHours(0,0,0,0)`) garante que **o dia da prova ainda conta** — não
some à meia-noite (detalhe fino, comentado no código).

Os prefixos `≈` marcam **datas estimadas** (calendário oficial ainda não publicado):
transparência com o usuário sobre o que é chute versus confirmado — o mesmo espírito do
"observada × estimada" do `app-edital`.

---

## §4 — Datas em JavaScript (o subsistema que a aba toda usa)

Concentro aqui os idiomas de data que se repetem em `renderWeek`, `chartTime`,
`studyStreak`:

**Chave de dia — `d.toISOString().slice(0,10)`** → `"2026-07-20"`. Corta os 10
primeiros caracteres do ISO (`YYYY-MM-DD`), descartando a hora. É a forma canônica de
"agrupar por dia" — chaves de dia são strings comparáveis e ordenáveis
lexicograficamente.

**Aritmética — `new Date(now - i*DAY)`.** Um `Date` menos um número **coage para ms**
(o `-` converte o `Date` no seu timestamp); subtrair `i*DAY` recua `i` dias; `new Date`
volta a virar data. É como se "anda no tempo".

> **⚠️ Armadilha de fuso.** `toISOString()` devolve em **UTC**, não no fuso local. Perto
> da meia-noite, o dia UTC pode diferir do dia local — uma sessão às 22h de Brasília
> (01h UTC do dia seguinte) cairia no dia errado. Por isso, ao **exibir**, o código usa
> `new Date(dk+"T12:00")` (meio-dia, longe das bordas) para pegar `getDay()`/`getDate()`
> sem risco de "escorregar" um dia. Datas são notoriamente traiçoeiras; meio-dia é um
> truque defensivo comum.

**`studyStreak` — a sequência de dias:**
```js
function studyStreak(){
  const set=new Set(S.sessions.map(s=>s.date));
  let streak=0; let d=new Date();
  if(!set.has(d.toISOString().slice(0,10))) d=new Date(d-DAY); // hoje ainda não? começa de ontem
  while(set.has(d.toISOString().slice(0,10))){ streak++; d=new Date(d-DAY); }
  return streak;
}
```
Monta um **`Set` de datas estudadas** (busca O(1)) e **anda para trás** dia a dia
enquanto encontra estudo, contando. A sutileza humana: **se você ainda não estudou
hoje, a sequência não quebra** — começa a contagem de ontem (senão, abrir o app de
manhã zeraria seu *streak* injustamente). Pequena decisão de UX embutida num `if`.

---

## §5 — `renderRevisao`: a fila com os botões do SM-2

```js
due.slice(0,25).forEach(x=>{
  const row=el("div","due-item");
  row.innerHTML=`… <div class="srs-btns">
      <button class="b0">Errei</button><button class="b1">Difícil</button>
      <button class="b2">Bom</button><button class="b3">Fácil</button>
    </div>`;
  const bs=row.querySelectorAll(".srs-btns button");
  bs.forEach((b,i)=>b.onclick=()=>reviewCard(x.id,i));
  …
});
```

O truque elegante: os quatro botões viram, por `forEach((b,i)=>…)`, as qualidades **0,
1, 2, 3** — o **índice** `i` do botão **é** o `quality` passado a `reviewCard`. A ordem
no HTML (Errei→Fácil) casa com a escala. Menos código que quatro `onclick` separados, e
impossível desalinhar. A lista de agendados mostra `intervalo Xd · facilidade Y.YY` —
expondo o estado interno do SM-2 para o usuário curioso.

---

## §6 — Gráficos em SVG na unha (`svgNS`, `chartDisc`, `chartTime`)

Sem biblioteca de charting — tudo é `<rect>`/`<line>`/`<text>` posicionados por
cálculo.

```js
function svgNS(t,attrs){ const e=document.createElementNS("http://www.w3.org/2000/svg",t);
  for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }
```

**A fábrica de elementos SVG.** Recapitulando o que vimos no `drawHorizonte`: SVG exige
`createElementNS` com o namespace certo (`createElement` comum produz um elemento que
**não renderiza**). O helper recebe o nome da tag e um objeto de atributos, e faz o
`setAttribute` de cada um num laço `for...in`. É o "createElement do SVG" do projeto.

### O padrão de layout com padding

```js
const W=720,H=300,padL=118,padR=20,padT=10,padB=24;
const bw=(H-padT-padB)/rows.length;       // altura de cada barra
const maxW=W-padL-padR;                     // largura útil p/ as barras
```

**Conceito — sistema de coordenadas com margens (o modelo "margin convention" do
D3).** Você reserva `pad`dings em cada lado (esquerda grande para caber os rótulos das
disciplinas) e desenha na área interna. Cada barra fica em `x=padL`, largura
proporcional ao valor (`r.p*maxW`), altura `bw*0.64` com um respiro entre elas. A **grade**
(`[0,.25,.5,.75,1].forEach`) são linhas verticais nos marcos de 25%. É a mesma anatomia
de qualquer gráfico de barras profissional, só que explícita.

**`Math.max(2, r.p*maxW)`** dá **largura mínima** de 2px à barra — assim um tópico com
progresso ~0 ainda mostra um traço visível, em vez de sumir. Detalhe de UX que evita
"por que essa disciplina não aparece?".

**`chartTime`** é o irmão temporal: 14 dias no eixo X, minutos no Y. `Math.max(60,
...days.map(...))` fixa uma escala **mínima** de 60 min — sem isso, um dia com 5 min
encheria a barra até o topo, dando a falsa impressão de muito estudo. Ancorar a escala
num piso honesto é o tipo de cuidado que separa um gráfico que **informa** de um que
**engana**.

---

## §7 — `renderMetricas`: KPIs de três fontes

```js
const attempts=q.flatMap(x=>x.attempts||[]);
const simOk=S.simulados.reduce((a,s)=>a+(+s.score||0),0), simTot=S.simulados.reduce((a,s)=>a+(+s.total||0),0);
const bResp=Object.values(S.bancoResp||{});
const nOk=attempts.filter(a=>a.correct).length+simOk+bResp.filter(r=>r.c).length;
const nTot=attempts.length+simTot+bResp.length;
const acc=nTot? Math.round(nOk/nTot*100):null;
```

**O quê:** a taxa de acerto agrega **três origens** de resposta: questões manuais
(`attempts`), provas oficiais (`simulados`) e o banco (`bancoResp`). O comentário no
código conta a história: sem incluir o banco, o KPI mostrava "—" mesmo com 50 questões
respondidas lá — porque o registro manual quase sempre está vazio. **Lição:** um KPI só
é honesto se **conta o que o usuário realmente faz**.

**`flatMap`** = `map` + achatar um nível. Cada questão tem um array `attempts`;
`flatMap` junta **todas as tentativas de todas as questões** numa lista só. O `||[]`
protege questões sem tentativas.

**`+s.score||0`** — de novo a **coerção numérica** (`+`) com **fallback** (`||0`) para
campos que podem vir string, `undefined` ou `NaN`. É a mesma disciplina anti-`NaN` que a
nota de verificação do projeto martela (*"injete os campos reais: `s.score`, não
`acertos`"*). Um `NaN` num KPI contamina tudo (`NaN` + qualquer coisa = `NaN`).

**`acc = nTot ? … : null`** — se não há respostas (`nTot===0`, *falsy*), devolve `null`
(a UI mostra "—") em vez de `0/0 = NaN`. **Nunca divida sem checar o denominador.**

**O estado vazio (onboarding).** Quando **tudo** é zero (`vazio = totalMin===0 &&
attempts.length===0 && …`), a aba mostra um **guia de boas-vindas** em vez de uma parede
de zeros desanimadora. Tratar o "estado vazio" com carinho — dizer ao usuário o
primeiro passo — é um princípio de UX que o código honra explicitamente.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Repetição espaçada / SM-2 | §1 | intervalo cresce ao acertar, reseta **só ao errar** ("Difícil" paga no ease); revisar na véspera de esquecer |
| Fator de facilidade (`ease`) | §1 | controlador que ajusta a velocidade do espaçamento; piso 1.3 |
| Idioma pega-ou-cria | §1 | `x || (x = {...})` garante existência e devolve a referência |
| Array como tabela de conversão | §1 | `[2,3,4,5][q]` = o `switch` mais enxuto para inteiros |
| Aritmética de tempo (`+ N*DAY`) | §1, §4 | somar ms a um timestamp anda no tempo |
| filter→sort com comparador numérico | §2 | `sort((a,b)=>a-b)`; sem isso ordena como string |
| Micro × macro (dois horizontes) | §3 | SM-2 = hoje; fase = os 16 meses |
| Estado derivado do relógio | §3 | `faseAtual` calcula, não salva — nada a desatualizar |
| Saturar nos extremos (casos de borda) | §3 | nunca devolver `null` por "fora do calendário" |
| Chave de dia `toISOString().slice(0,10)` | §4 | agrupar por dia com string ordenável |
| Armadilha de fuso (UTC × local) | §4 | usar `T12:00` para não escorregar de dia |
| `Set` + walk-backward (streak) | §4 | contar dias seguidos; não quebrar se hoje ainda não estudou |
| Índice do botão = valor | §5 | `forEach((b,i)=>…reviewCard(id,i))` alinha UI e escala |
| `createElementNS` (SVG) | §6 | SVG não nasce de `createElement` |
| Margin convention (charts) | §6 | paddings + área interna = layout de gráfico |
| Escala com piso honesto | §6 | `Math.max(60,…)` evita gráfico que engana |
| Largura mínima visível | §6 | `Math.max(2,…)` para o valor ~0 não sumir |
| `flatMap` (map + achatar) | §7 | juntar arrays aninhados num só |
| Coerção `+x||0` anti-`NaN` | §7 | desarmar campos string/undefined antes de somar |
| Guardar o denominador | §7 | `nTot ? … : null` em vez de dividir por zero |
| Cuidar do estado vazio | §7 | onboarding no lugar de uma parede de zeros |

---

**Próximo no roteiro:** [`app-analise.explicado.md`](app-analise.explicado.md) — a
**Análise**, que cruza a **incidência da banca** (de `frequencia-data.js`) com o **seu
acerto** e desenha um **scatter plot** em `<canvas>` (não mais SVG — outra API de
dataviz). Também cobre a aba **Recursos**.
