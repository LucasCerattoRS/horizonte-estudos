# 🔬 LABORATÓRIO — exercícios práticos (fazer, não só explicar)

> O [EXERCICIOS.md](EXERCICIOS.md) testa **compreensão** ("explique por quê"); aqui você
> **executa código de cabeça, caça bug e estende o app**. É onde o aprendizado transfere.
> Todos os trechos são **reais**, do painel — com o arquivo e a linha de origem.
>
> ⚠️ **Regra:** os exercícios de extensão **não** alteram o repositório — trabalhe numa
> **cópia local** do arquivo (ou reverta com `git checkout -- painel/<arquivo>` ao final).
> Gabarito em cada *"▸ resposta"*: escreva a sua antes de abrir.

---

## Parte A — Preveja o resultado (execute de cabeça)

**A.1 — Closure no laço** (real: `painel/app-plano.js`, render da fila de revisão)
```js
const bs=row.querySelectorAll(".srs-btns button");   // 4 botões: Errei/Difícil/Bom/Fácil
bs.forEach((b,i)=>b.onclick=()=>reviewCard(x.id,i));
```
Clico no 3º botão ("Bom"). Que `quality` chega em `reviewCard`? Por que **cada** botão
"lembra" o seu próprio `i`? E se o laço fosse `for(var i=0;i<bs.length;i++){bs[i].onclick=()=>reviewCard(x.id,i);}` —
o que mudaria?

<details><summary>▸ resposta</summary>

Chega `quality=2` (índices começam em 0). Cada arrow `()=>reviewCard(x.id,i)` é uma
**closure**: captura o `i` do escopo em que nasceu — e o callback do `forEach` cria **um
escopo novo por iteração**, então cada botão prende um `i` diferente. Com `var` num `for`,
há **um único** `i` compartilhado (escopo de função, não de bloco): ao clicar, o laço já
acabou e `i === bs.length` → **todos** os botões chamariam `reviewCard(x.id, 4)` —
`[2,3,4,5][4]` é `undefined` e o SRS quebraria. `let` no `for` (escopo por iteração)
também resolveria. → [CONCEITOS](CONCEITOS.md) §1 (closures), [app-plano](app-plano.explicado.md) §1.
</details>

**A.2 — `??` na ordenação** (real: `painel/app-banco.js:44`)
```js
if(sort==="worst") qs.sort((a,b)=>(qAccuracy(a)??101)-(qAccuracy(b)??101));
```
Três questões com `qAccuracy` = `50`, `0` e `null` (nunca respondida). Em que ordem saem?
E se o autor tivesse escrito `||101`?

<details><summary>▸ resposta</summary>

Com `??`: `0`, `50`, `null` — o acerto de **0%** (o seu pior tópico!) vem primeiro, e a
nunca-respondida vai pro fim (101). Com `||`: o `0` é *falsy* → vira `101` → a questão que
você **mais erra** iria para o **fim da lista**, empatada com as nunca vistas. É o bug
clássico de `||` engolindo zero legítimo. → [CONCEITOS](CONCEITOS.md) §1, [app-banco](app-banco.explicado.md) §1b.
</details>

**A.3 — Relógio monotônico** (real: `painel/sync.js:65`)
```js
function nextTs() { lastTs = Math.max(Date.now(), lastTs + 1); return lastTs; }
```
`Date.now()` está travado em `1000` (mesmo milissegundo) e `lastTs=0`. Chamo `nextTs()`
três vezes. Quais os 3 retornos? E se o relógio do sistema **recuar** para `500` na 4ª
chamada?

<details><summary>▸ resposta</summary>

`1000`, `1001`, `1002` — a 1ª pega o relógio; as seguintes, `max(1000, last+1)` = `last+1`.
Na 4ª, `max(500, 1003)` = `1003`: o timestamp **ignora o recuo** do relógio e segue
crescendo. É isso que garante que "quem escreveu depois" sempre tem ts maior — a base do
last-write-wins. → [sync](sync.explicado.md) §2, [ARQUITETURA](ARQUITETURA.md) ADR-6.
</details>

**A.4 — Merge raso na carga** (real: `painel/app-core.js:67`, dentro de `load()`)
```js
const s = Object.assign(structuredClone(DEFAULT_STATE), p);
```
`DEFAULT_STATE` tem `trilha:{semana:1}` e, numa versão nova, ganhou `trilha:{semana:1, pausada:false}`.
Um perfil antigo salvou `p = {curso:"geral", trilha:{semana:3}}`. Depois do merge, quanto
valem `s.curso`, `s.trilha.semana` e `s.trilha.pausada`?

<details><summary>▸ resposta</summary>

`s.curso="geral"`, `s.trilha.semana=3` e `s.trilha.pausada` = **`undefined`** — o
`Object.assign` é **raso**: `p.trilha` substitui o objeto `trilha` **inteiro** do padrão,
e o campo novo aninhado se perde. (Um campo novo no **1º nível** apareceria normalmente.)
É exatamente o limite documentado do ADR-5: evolução de campo aninhado exige migração
explícita. → [app-core](app-core.explicado.md) §3, [ARQUITETURA](ARQUITETURA.md) ADR-5.
</details>

---

## Parte B — Bug plantado (ache e explique)

> Cada trecho abaixo é o código real **com UMA alteração maligna**. Diga qual é a linha,
> qual o sintoma visível no app e por quê.

**B.1** (base real: `painel/app-core.js`, `load()`)
```js
const s = Object.assign(DEFAULT_STATE, p);
if(herdouCic) s.curso = "geral";
return s;
```

<details><summary>▸ resposta</summary>

Sumiu o `structuredClone`: o merge **muta o próprio `DEFAULT_STATE`**. Sintoma: os dados
de um perfil "vazam" para o outro — trocar de perfil (ou recarregar) parte de um padrão já
contaminado com o estado anterior (o `Object.assign` escreve no 1º argumento e o devolve).
Pior: `DEFAULT_STATE.topics` passa a **ser o mesmo objeto** que `S.topics`, então até "criar
perfil novo" nasceria com progresso alheio. → [app-core](app-core.explicado.md) §3.
</details>

**B.2** (base real: `painel/app-plano.js`, `reviewCard`)
```js
const q = [2,3,4,5][quality];
if(q<=3){
  srs.reps=0; srs.interval=1;
}else{ …
```

<details><summary>▸ resposta</summary>

`q<3` virou `q<=3`: agora **"Difícil" (q=3) reseta** `reps` e `interval` — o bug que o
comentário original do fonte *dizia* existir passa a existir de verdade. Sintoma: um card
que você acerta penando **nunca sai** do intervalo de 1 dia (reps sempre 0), e o duplo
castigo (reset **e** ease −0,14) trava a fila de revisão. No SM-2 canônico q=3 progride e
paga só no ease. → [app-plano](app-plano.explicado.md) §1 (e a nota de auditoria lá).
</details>

**B.3** (base real: `painel/app-core.js:95`, `esc`)
```js
const esc = s => (s==null?"":String(s)).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));
```

<details><summary>▸ resposta</summary>

Sumiu a aspa dupla `"` do conjunto. `esc` continua bloqueando `<script>` no **texto**, mas
todo lugar que interpola dado **dentro de atributo** — ex.: `href="${esc(rec.link)}"` — fica
aberto: um link salvo como `x" onclick="alert(1)` **fecha a aspa e injeta um atributo de
evento** (XSS armazenado). A versão real escapa `&<>"` justamente porque o código usa
atributos entre aspas duplas. → [app-core](app-core.explicado.md) §4, [CONCEITOS](CONCEITOS.md) §9.
</details>

**B.4** (base real: `painel/app-core.js:89`, `topicStatus`)
```js
function topicStatus(id){ return S.topics[id].status || 0; }
```

<details><summary>▸ resposta</summary>

Sumiu o `?.`. Para um tópico **nunca tocado**, `S.topics[id]` é `undefined` →
`undefined.status` lança `TypeError` — e como `topicStatus` roda dentro dos renders
(Mapa, Painel…), **a aba inteira morre** na primeira visita de um perfil novo (o mapa
`topics` começa vazio; os registros são criados sob demanda pelo `tRec`). O `?.` devolve
`undefined` e o `|| 0` o converte no status "não iniciado". → [app-core](app-core.explicado.md) §3.
</details>

---

## Parte C — Estenda o app (na sua cópia!)

**C.1 — Campo novo no estado, de ponta a ponta.**
Adicione uma meta semanal de questões: `metaQ: 50` no estado. Passos que você precisa
descobrir: (a) onde declarar o campo; (b) o que acontece com os perfis **antigos** quando
você recarrega; (c) o que falta para ele **sincronizar** entre aparelhos.

<details><summary>▸ resposta</summary>

(a) Em `DEFAULT_STATE` (`painel/app-core.js`): `metaQ: 50`. (b) **Nada a fazer**: é campo
de 1º nível, o merge do `load()` injeta o default em todo perfil antigo na próxima carga
(ADR-5). (c) O sync **não** sobe campos avulsos — ele trabalha por **seções**: inclua
`"metaQ"` no array `SECOES` (`painel/sync.js:23`). O servidor não precisa mudar
(`functions/api/state.js` guarda seções genericamente, com LWW por nome). Teste mental
final: dois aparelhos mudam `metaQ` offline → vence o de `ts` maior — perda aceitável
(ADR-6). → [app-core](app-core.explicado.md) §3, [sync](sync.explicado.md) §3.
</details>

**C.2 — Quinto botão de qualidade ("Muito fácil").**
A UI ganharia um 5º botão (quality=4). O que quebra **hoje** se você só adicionar o botão
no HTML do render? Corrija o mapeamento e diga que valor de `q` faz sentido — e por que
**não** pode passar de 5.

<details><summary>▸ resposta</summary>

Hoje `[2,3,4,5][4]` é **`undefined`**: `q<3` é `false` (comparação com `undefined`), reps
progridem, mas `ease + (0.1 - (5-undefined)*…)` vira **`NaN`** — e o NaN contamina `ease`,
`interval` e `due` para sempre (o card some da fila). Correção: `[2,3,4,5,5][quality]` ou
estender para `[2,3,4,5][Math.min(quality,3)]`. O teto é 5 porque a fórmula do ease foi
calibrada para q∈[0,5]: com q=6 o termo daria `+0,16` por revisão e os intervalos
explodiriam além do que o modelo de esquecimento sustenta. (Se quiser distinguir "Fácil"
de "Muito fácil", o jeito canônico é dar `q=4` ao Fácil e `q=5` ao novo.) →
[app-plano](app-plano.explicado.md) §1, [CONCEITOS](CONCEITOS.md) §1 (NaN).
</details>

**C.3 — Um 4º eixo de aparência (`data-densidade`).**
Quer um modo "compacto" (menos padding). Liste os lugares que um eixo novo toca, na ordem
em que executam — sem escrever o CSS.

<details><summary>▸ resposta</summary>

Na ordem de execução: (1) o **script pré-paint** no `<head>` do `index.html` (~l.1015) —
ler a preferência salva e estampar `data-densidade` no `<html>` **antes** do 1º paint,
senão pisca; (2) o **CSS**: regras `[data-densidade="compacta"]{…}` sobrescrevendo tokens
de espaçamento (e `:where()` se não puder brigar com os outros eixos); (3) o **setter** em
`app-core.js` (região da aparência): função que grava no `localStorage` e aplica no
`documentElement`, seguindo a convenção **"default = ausência de atributo"** (só o desvio
recebe `data-*`); (4) a **UI** de escolha (o seletor de aparência). O padrão já existe em
triplicata — copie o eixo `data-style`. → [index-html](index-html.explicado.md) A.2/B.2, [app-core](app-core.explicado.md) §7.
</details>

**C.4 — Prove o bug antes de consertar (metodologia).**
Você plantou o B.2 (`q<=3`) na sua cópia. Desenhe o **teste mental mínimo** (sequência de
cliques + estado esperado do `srs`) que o denuncia — e diga por que "cliquei e pareceu ok"
não denuncia.

<details><summary>▸ resposta</summary>

Sequência mínima: no mesmo card, clique **Difícil 3×** (simulando 3 dias). Esperado
(código correto): `reps` 1→2→3, `interval` 1→6→~13 (`6×ease`, com ease já reduzido).
Com o bug: `reps` fica **0** e `interval` fica **1** para sempre. "Pareceu ok" não pega
porque a **1ª** revisão é igual nos dois mundos (`interval=1`) — o bug só aparece na
**trajetória**, não no clique isolado. É a moral das sondas do projeto: verificar é
comparar contra o **comportamento esperado ao longo do tempo**, não contra "não deu
erro no console". → [pipeline](pipeline.explicado.md) §6, [app-plano](app-plano.explicado.md) §1.
</details>

---

*Terminou? O teste final continua sendo o do [EXERCICIOS.md](EXERCICIOS.md): abrir um
`painel/app-*.js` cru e explicar cada função sem olhar espelho nenhum.*
