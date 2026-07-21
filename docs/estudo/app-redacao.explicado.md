# ✍️ `app-redacao.js` explicado — Redação, o wizard e Leituras

> **Arquivo real:** `painel/app-redacao.js` (521 linhas)
> **Etapa no roteiro:** 3 (as abas) · **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`app-banco`](app-banco.explicado.md), [`dados`](dados.explicado.md)

A última das seis abas. Ela orquestra o treino de redação: um **wizard** de três passos
(escolher a rubrica → escolher o tema → escrever), um **editor com autosave**, o
lançamento de **nota manual** pela rubrica oficial da banca, gráficos de evolução, e a
biblioteca de leitura (redações nota-1000 + textos-modelo + as **obras obrigatórias**).

Como você já domina os padrões recorrentes (guardas `typeof … !== "undefined"`, o ciclo
*muta→save→render*, SVG por `svgNS`, preservar o que está aberto com um `Set`, escape com
`esc`), vou **referenciar** esses quando aparecerem e gastar a tinta nos conceitos
**novos**: o **wizard como máquina de estados**, a **memoização** de `PROPS()`, o
**autosave dirigido por evento** e a **UI dirigida por dados** (a rubrica).

> **Contexto de produto (importante):** o projeto **removeu a correção de redação por
> IA** (a API do Gemini saiu — ver [`dados §6`](dados.explicado.md)). O que restou: o
> editor **escreve e salva rascunho**, e a nota entra por **"Registrar nota manual"**,
> pontuada pela rubrica oficial. A função `correcaoHTML` deste arquivo hoje serve para
> **exibir correções já salvas** (e o texto avisa "orientação, não nota oficial") — não
> há chamada de LLM viva. Guarde isso ao ler: o "wizard de correção" é, na prática, um
> guia de escrita + registro de nota.

---

## §0 — As fontes de dados da aba

```js
const _NOTAMIL  = typeof REDACOES_NOTAMIL !== "undefined" ? REDACOES_NOTAMIL : [];
const _RUBRICAS = typeof RUBRICAS !== "undefined" ? RUBRICAS : {};
const _PROPOSTAS= typeof PROPOSTAS_REDACAO !== "undefined" ? PROPOSTAS_REDACAO : [];
const _PUFRGS   = typeof PROPOSTAS_UFRGS !== "undefined" ? PROPOSTAS_UFRGS : [];
const _TMODELO  = typeof TEXTOS_MODELO !== "undefined" ? TEXTOS_MODELO : [];
```

Cinco fontes, cada uma com o **guarda com fallback** que você já conhece (se o
`*-data.js` não carregou, vira `[]`/`{}` e nada quebra). Repare a variedade: rubricas
(curada), propostas UFRGS (gerada), redações nota-mil (gerada), textos-modelo (curada).
A aba costura todas numa experiência só — o desafio central do arquivo.

---

## §1 — O wizard como máquina de estados

```js
let WIZ = { passo:1, banca:null, propId:null, filtro:"todas" };
```

**Conceito — máquina de estados finita (finite state machine).** Todo o wizard é
governado por **um objeto de estado** `WIZ`: em que passo você está (`passo`), qual
rubrica escolheu (`banca`), qual tema (`propId`). As transições são funções
(`wizBanca`, `wizTema`, `wizIr`) que **mudam `WIZ` e re-renderizam**. Nada de estado
espalhado pela tela — a tela é sempre um **desenho do `WIZ` atual**. Este é o coração de
qualquer fluxo multi-passo (checkout, onboarding, formulário em etapas).

### As transições com guardas

```js
function wizIr(n){
  if(n===2&&!WIZ.banca) return;                 // não pode ir ao Tema sem escolher rubrica
  if(n===3&&(!WIZ.banca||!WIZ.propId)) return;  // nem a Escrever sem rubrica E tema
  WIZ.passo=n; renderRedWizard();
}
function wizBanca(k){ WIZ.banca=k; WIZ.passo=2; WIZ.filtro = PROPS().some(p=>p.banca===k)?k:"todas"; renderRedWizard(); }
function wizTema(id){ WIZ.propId=id; WIZ.passo=3; renderRedWizard(); abrirEditor(); }
```

**As guardas de transição** impedem estados inválidos: você **não pula** para o passo 3
sem ter rubrica e tema. É a diferença entre uma máquina de estados **bem-comportada** (só
transições legais) e um formulário onde o usuário se enfia num beco. Escolher a rubrica
(`wizBanca`) já **avança** para o passo 2 e ajusta o filtro; escolher o tema (`wizTema`)
avança para o 3 e **abre o editor** — as transições encadeiam o fluxo natural.

### Desenhar o estado: `cls(n)` deriva a aparência do modelo

```js
const cls=n=>{
  if(WIZ.passo===n) return "passo atual";
  if(n===1&&rb) return "passo feito";
  if(n===2&&prop) return "passo feito";
  if((n===2&&!rb)||(n===3&&(!rb||!prop))) return "passo trava";
  return "passo";
};
```

**Conceito — a UI é uma função pura do estado.** Cada botão de passo recebe uma classe
CSS **calculada** a partir de `WIZ`: o passo atual, os já cumpridos (`feito`), os
bloqueados (`trava`). Você não guarda "este passo está travado" em lugar nenhum — **deriva**
isso do estado toda vez. É o mesmo princípio de `faseAtual` (estado derivado, não
salvo) e a essência do que React chama de *render*: `view = f(state)`. Sempre que puder
**calcular** a aparência em vez de **guardá-la e sincronizá-la**, faça — elimina a classe
inteira de bug "a tela discorda do estado".

---

## §2 — `PROPS()`: memoização e unificação de fontes

```js
let _PROPSCACHE=null;
function PROPS(){
  if(_PROPSCACHE) return _PROPSCACHE;
  const out=[];
  _PUFRGS.forEach(p=>out.push({ id:`ufrgs-${p.ano}`, banca:"ufrgs", ano:p.ano, tema:p.tema, genero:p.genero||"Dissertação", … }));
  _PROPOSTAS.forEach(p=>out.push({ id:`${p.banca}-${p.ano}`, banca:p.banca, … }));
  _NOTAMIL.forEach(c=>out.push({ id:`enem-${c.ano}`, banca:"enem", ano:c.ano, tema:c.tema, … }));
  out.sort((a,b)=>b.ano-a.ano);
  out.push({ id:"livre", banca:"livre", … });
  return _PROPSCACHE=out;
}
```

**Conceito — memoização (cache de resultado).** `PROPS()` funde **três fontes
heterogêneas** (propostas UFRGS, FUVEST/outras, temas ENEM das cartilhas nota-mil) numa
**lista única e normalizada**. Isso custa laços e um `sort`. Como o resultado nunca muda
durante a sessão, ele é **calculado uma vez** e guardado em `_PROPSCACHE`; as próximas
chamadas devolvem o cache na primeira linha. É a mesma ideia dos índices pré-computados do
`app-banco`, mas **preguiçosa** (*lazy*): só computa na primeira vez que alguém chama
`PROPS()`, não no carregamento do arquivo.

**A linha `return _PROPSCACHE=out;`** — atribui **e** devolve no mesmo gesto (o valor de
uma atribuição é o valor atribuído). Idioma compacto de "guarda no cache e retorna".

**Conceito — normalização (schema comum).** Cada fonte tem campos diferentes
(`p.genero` numa, `p.tipo` noutra, nada em outra); `PROPS` mapeia **todas** para o mesmo
formato `{id, banca, ano, tema, genero, comando, coletanea, pdf}`, preenchendo defaults
(`p.genero||"Dissertação"`). Depois disso, o resto do código trata tudo igual — não
precisa saber de onde veio. **Unificar formatos diferentes num schema comum na fronteira**
é o que mantém a lógica downstream simples (o mesmo espírito da barreira de dados).

O `id` composto (`` `ufrgs-${p.ano}` ``, `` `enem-${c.ano}` ``) dá a cada proposta uma
identidade estável para casar com o status salvo (`propStatus`) e o rascunho.

---

## §3 — `propStatus`: o estado de cada proposta

```js
function propStatus(id){
  const rs=S.redacoes.filter(r=>r.propId===id && r.nota!=null);
  if(rs.length){
    const best=rs.reduce((a,b)=>(b.nota/b.max>a.nota/a.max?b:a));
    return { cls:"ok", txt:`✓ corrigida · ${best.nota}/${best.max}` };
  }
  if(S.rascunhos && S.rascunhos[id]) return { cls:"pend", txt:"rascunho salvo" };
  return { cls:"novo", txt:"nunca escrita" };
}
```

Classifica cada proposta em três estados — **corrigida** (tem nota; mostra a **melhor**,
via `reduce`-argmax pela fração `nota/max`, respeitando o reescalonamento que você viu no
[`app-analise §3c`](app-analise.explicado.md)), **rascunho salvo** ou **nunca escrita**.
É a informação que pinta a "faixa de status" em cada card de tema. Note a **ordem das
verificações**: nota vence rascunho vence vazio — o estado "mais avançado" ganha.

---

## §4 — Registrar nota manual (`openRed`/`saveRed`)

```js
function saveRed(){
  const tipo=$("#drTipo").value, tema=$("#drTema").value.trim();
  const r={ id:"r"+Date.now(), date:$("#drData").value||todayKey(), tipo, tema, obs:… };
  if(tipo==="enem"){
    r.comp=ENEM_COMP.map((_,i)=>+$("#drC"+i).value);
    r.nota=r.comp.reduce((a,b)=>a+b,0); r.max=1000;
  } else {
    r.nota=+$("#drNota").value; r.max=+$("#drMax").value||30;
    if(!(r.nota>=0) || !(r.max>0) || r.nota>r.max){ alert("Confira nota e nota máxima."); return; }
  }
  S.redacoes.push(r); save(); $("#dlgRed").close(); renderRedacao();
}
```

**Dois caminhos por tipo.** Para o **ENEM**, a nota é a **soma das 5 competências**
(`r.comp.reduce((a,b)=>a+b,0)`, cada uma 0–200 → total 0–1000). Para as demais bancas, o
usuário digita nota e máximo, com **validação de sanidade**:

```js
if(!(r.nota>=0) || !(r.max>0) || r.nota>r.max){ alert("Confira nota e nota máxima."); return; }
```

**Nota de sintaxe — `!(r.nota>=0)` em vez de `r.nota<0`.** São quase iguais, **mas
diferem em `NaN`**: se o campo está vazio, `+$("#drNota").value` é `NaN`, e `NaN<0` é
`false` (deixaria passar!), enquanto `NaN>=0` também é `false`, então `!(NaN>=0)` é
`true` → **barra**. Escrever a condição pela **negação do que é válido** captura o `NaN`
de brinde. É a mesma disciplina anti-`NaN` de sempre, agora na validação de entrada.
`+valor` (coerção) e `||30` (default) você já conhece.

**A guarda de UI** `redTipoUI()` mostra os 5 seletores de competência só para o ENEM e o
par nota/máximo para o resto — a tela **se adapta ao tipo** escolhido.

---

## §5 — Autosave dirigido por evento (o rascunho)

```js
$("#dlgCorrige").addEventListener("close", ()=>{
  if(!_corrigePropId) return;
  const t=$("#crTexto").value.trim();
  S.rascunhos ||= {};
  if(t) S.rascunhos[_corrigePropId]={ texto:t, ts:Date.now() };
  else delete S.rascunhos[_corrigePropId];
  save();
  if($("#tab-redacao").classList.contains("on")) renderRedWizard();
});
```

**Conceito — persistência dirigida por evento (event-driven autosave).** Em vez de um
botão "Salvar rascunho", o código **escuta o evento `close` do `<dialog>`**: fechar o
editor **salva sozinho**. O `<dialog>` nativo dispara `close` seja qual for a forma de
fechar (Esc, clique fora, `.close()`), então o autosave é robusto — não há caminho de
saída que não passe por ali.

**Detalhes que valem ouro:**
- `S.rascunhos ||= {}` — cria o dicionário de rascunhos na 1ª vez (pega-ou-cria).
- **Salvar por proposta** (`S.rascunhos[_corrigePropId]`): cada tema tem seu próprio
  rascunho, indexado pelo `id` da proposta.
- `if(t) … else delete …` — se o texto ficou **vazio**, o rascunho é **apagado**
  (`delete`), não salvo em branco. Limpar o que esvaziou evita "rascunhos fantasma".
- `ts:Date.now()` — carimba a data (para futuras decisões de "qual é mais recente").

**Conceito — a fonte da verdade do texto é o DOM até fechar.** Enquanto o editor está
aberto, o texto vive no `<textarea>`; só ao fechar ele "desce" para o estado `S`. Isso
evita salvar a cada tecla (custoso); o momento natural de persistir é a saída. Comparado
a um autosave por *timer*, o evento `close` é mais simples e igualmente seguro aqui.

---

## §6 — `correcaoHTML`: UI dirigida por dados (a rubrica)

```js
function correcaoHTML(rb, res){
  const byId=Object.fromEntries((res.criterios||[]).map(c=>[c.id,c]));
  const linhas=rb.criterios.map(c=>{
    const r=byId[c.id]||{nota:"?",comentario:"—"};
    const teto=c.max!=null?c.max:rb.escala;
    return `…<b>${esc(c.curta)}</b>…${r.nota}${c.max!=null?"/"+teto:""}…${esc(r.comentario||"")}…`;
  }).join("");
  …
}
```

**Conceito — renderização dirigida por dados (data-driven UI).** A função **não sabe**
quais critérios existem — ela **percorre `rb.criterios`** (os critérios da rubrica
escolhida) e desenha uma linha por critério. Adicionar/remover um critério é editar
`rubricas-redacao-data.js`, **sem tocar nesta função**. A UI é um **reflexo dos dados**.

**`Object.fromEntries(... .map(c=>[c.id,c]))`** monta um índice `id→critério da
correção`, para casar cada critério **esperado** (da rubrica) com o **avaliado** (da
correção salva) por id — com fallback `{nota:"?"}` se faltar. É o padrão join-por-índice
do `app-banco`, em miniatura.

O bloco `avBadge` mostra como a **nota da banca** foi obtida (nº de avaliadores, 3º
avaliador em discrepância, conversão UFRGS analítica+holística, soma ponderada FUVEST) —
tudo **lido da rubrica** (`rb.aval`, `rb.notaFinal`, `rb.conversao`). De novo: a lógica de
exibição é genérica; o **comportamento vem do dado**. E o rodapé fixo — *"Correção
automática (Gemini) … orientação, não nota oficial"* — é o vestígio honesto da era com IA.

---

## §7 — Gráficos: evolução e o ponto fraco (argmin)

`chartRed` é uma **linha de evolução** em SVG (mesmo esqueleto de `chartTime`/evolução do
`app-analise`: grade, `polyline`, `<circle>` com `<title>` de tooltip nativo). Cada ponto
usa `r.nota/r.max` — a **fração**, nunca a nota crua (a lição do reescalonamento).

`chartComp` traz um idioma de argmin diferente do que você viu:

```js
const med=ENEM_COMP.map((_,i)=>enems.reduce((a,r)=>a+(r.comp?.[i]||0),0)/enems.length);
const worst=med.indexOf(Math.min(...med));
```

**`med.indexOf(Math.min(...med))` — achar o índice do menor.** `Math.min(...med)` acha o
**menor valor** (spread espalha o array como argumentos); `indexOf` acha **onde** ele
está. Duas passadas, mas lê-se num sopro: "o índice da menor média" = a competência mais
fraca. (Compare com o argmin por `reduce` do `app-banco`/`propStatus` — mesma pergunta,
duas expressões; use a que ficar mais clara no contexto.)

**`r.comp?.[i]||0`** — *optional chaining* com índice: se `r.comp` não existe, `?.[i]` dá
`undefined`, e `||0` completa. Protege redações antigas sem o array de competências.

---

## §8 — Leituras: as obras obrigatórias

```js
function renderLeituras(){
  const fc = $("#ltFilters");
  if(fc && !fc.dataset.done){ fc.dataset.done = 1; LT_FILTROS.forEach(f=>{ … }); }
  const openIds = new Set([...document.querySelectorAll("#ltList .lt.open")].map(c=>c.dataset.id));
  const list = $("#ltList"); list.innerHTML = "";
  const obras = ltFiltro==="todas" ? _LEITURAS : _LEITURAS.filter(o=>o.lista===ltFiltro);
  obras.forEach(o=>{ … if(openIds.has(o.id)) card.classList.add("open"); });
}
```

Reúne padrões que você já domina: **filtros montados uma vez** (`dataset.done`, como em
Recursos), **preservação do que está aberto** (o `Set` de `openIds`, exatamente como
`renderEdital`), e **degradação graciosa** — `LT_NOTA[o.id] && !semCofre()` só mostra o
link do cofre a quem tem Obsidian.

O dado de cada obra (de `leituras-data.js`) vem em três seções — `frase` (a ideia
central), `eixos` (repertório **para a redação**: tema/o-que-tem-no-livro/como-usar) e
`objetivas` (o que cai na **prova objetiva**) — refletindo os dois usos de literatura na
UFRGS. `obsLeitura`/`ytLeitura` montam deep-links com `encodeURIComponent` (o mesmo escape
de URL de sempre). Reconhecer os padrões repetidos aqui **sem precisar reestudá-los** é o
sinal de que a Etapa 3 cumpriu seu papel.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Máquina de estados finita | §1 | um objeto `WIZ` governa o fluxo; a tela desenha o estado |
| Guardas de transição | §1 | proibir estados inválidos (não pular etapas) |
| UI = função pura do estado | §1 | `cls(n)` **deriva** a aparência; não guarda "travado" |
| Memoização (cache lazy) | §2 | `_PROPSCACHE` computa uma vez, devolve depois |
| `return cache = valor` | §2 | atribuir e retornar no mesmo gesto |
| Normalização (schema comum) | §2 | fundir fontes heterogêneas num formato único |
| Ordem de estados (mais avançado ganha) | §3 | nota > rascunho > vazio |
| `!(x>=0)` para pegar `NaN` | §4 | validar pela negação do válido barra o `NaN` |
| Soma via `reduce` | §4 | as 5 competências → nota ENEM |
| Autosave dirigido por evento | §5 | ouvir `close` do `<dialog>`; salvar na saída |
| Rascunho por chave + `delete` no vazio | §5 | um rascunho por proposta; apagar o que esvaziou |
| UI dirigida por dados | §6 | percorrer `rb.criterios`; comportamento vem do dado |
| Join por índice (`Object.fromEntries`) | §6 | casar critério esperado × avaliado por id |
| argmin por `indexOf(Math.min(...))` | §7 | o índice do menor = a competência mais fraca |
| Optional chaining com índice | §7 | `r.comp?.[i]\|\|0` protege dado antigo |
| Padrões reaproveitados | §8 | `dataset.done`, `Set` de abertos, `semCofre` — já dominados |

---

**Fim da Etapa 3.** As seis abas estão documentadas. Você já viu o **padrão de render**
em todas as suas variações e a maioria dos idiomas de JS do projeto.

**Próximo no roteiro:** [`app.explicado.md`](app.explicado.md) — **Etapa 4, o boot**. A 8ª
e última fatia (carrega por último): `init()` liga os `<select>`, renderiza a 1ª tela e
resolve o *deep-link* por hash; `mergeCorpus()` funde as redações; e a IIFE registra o
**PWA** (service worker) só em `http(s)`. É onde a ordem dos `<script>` que você vem
ouvindo desde o começo finalmente se explica na prática.
