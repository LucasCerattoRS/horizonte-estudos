# 🧠 CONCEITOS — programação do zero, pelo exemplo deste projeto

> Camada **transversal** do material de estudo. Enquanto os `*.explicado.md` seguem o código
> **arquivo a arquivo**, aqui os conceitos são reagrupados **por tema** e explicados **do
> zero** — cada um com um exemplo tirado do painel e um ponteiro para onde ele aparece.
> Use como **enciclopédia**: leia de cabo a rabo, ou pule para o conceito que travou.

Índice: [1. JavaScript](#1-fundamentos-de-javascript) · [2. DOM e render](#2-o-dom-e-a-renderização-sem-framework) ·
[3. Estado](#3-estado-e-persistência) · [4. Dados](#4-modelagem-de-dados) · [5. Algoritmos](#5-algoritmos-e-estruturas) ·
[6. Estatística](#6-estatística-aplicada) · [7. Dataviz](#7-visualização-de-dados) · [8. Rede](#8-rede-e-sistemas-distribuídos) ·
[9. Segurança](#9-segurança) · [10. PWA](#10-pwa-e-offline) · [11. CSS](#11-css-e-design-system) · [12. Método](#12-metodologia)

---

## 1. Fundamentos de JavaScript

**Valores *truthy* / *falsy*.** Todo valor em JS "vale" como verdadeiro ou falso num `if`. São
*falsy*: `false`, `0`, `""`, `null`, `undefined`, `NaN`. Todo o resto é *truthy*. Isso alimenta
idiomas como `.filter(Boolean)` (remove vazios) e `x || padrão` (usa o padrão se `x` for falsy).

**`||` (OU) × `??` (nullish) × `||=` / `??=`.**
- `a || b` → `b` se `a` for **falsy** (inclui `0`, `""`).
- `a ?? b` → `b` só se `a` for **`null`/`undefined`** (`0` e `""` passam).
- `a ||= b` → atribui `b` se `a` for falsy (pega-ou-cria).
Escolher errado é bug clássico: no painel, `qAccuracy ?? 101` **precisa** de `??` (um acerto de
`0%` é válido); já `simEP[pv] || 500` usa `||` (0 não é escala válida). Ver
[app-banco](app-banco.explicado.md) §1b e [app-painel](app-painel.explicado.md) §1a.

**Coerção de tipo e o `+` unário.** O valor de um `<input>` é **string** (`"640"`); `+valor`
converte para número. Sem isso, `"640"+"500"` concatena. Ver [app-painel](app-painel.explicado.md) §1a.

**`NaN` e como barrá-lo.** `NaN` (Not a Number) contamina toda conta (`NaN + 1 = NaN`).
Defesas: `+x || 0` (coage e dá fallback), e validar pela **negação do válido**: `!(nota>=0)`
pega `NaN` (que `nota<0` deixaria passar). Ver [app-plano](app-plano.explicado.md) §7 e [app-redacao](app-redacao.explicado.md) §4.

**Arrow functions e o `return` implícito.** `x => x*2` é uma função curta; sem chaves, o corpo é
o valor de retorno. Para **retornar um objeto**, embrulhe em parênteses: `x => ({a:x})` (senão
`{` vira bloco). Ver o helper `t` em [edital-data](edital-data.explicado.md) §3.

**Rest / spread (`...`).** `(...args)` **junta** argumentos num array; `[...arr]` / `{...obj}`
**espalha** (copia rasa). `Math.max(...nums)` passa o array como argumentos. `{...x, novo:1}`
copia acrescentando sem mutar. Ver [edital-data](edital-data.explicado.md) §3 e [app-painel](app-painel.explicado.md) §5d.

**Desestruturação.** `const {outcome} = await ...` e `for (const [k,v] of Object.entries(o))`
extraem campos por nome. Ver [app.js](app.explicado.md) §8 e [app-painel](app-painel.explicado.md) §5e.

**Optional chaining `?.`.** `rec?.link` devolve `undefined` (em vez de estourar) se `rec` for
`null`. Com índice: `r.comp?.[i]`. Ver [app-edital](app-edital.explicado.md) §3e.

**Ternário (e encadeado).** `cond ? a : b`; encadeando, vira um `if/else if/else` como
expressão: `s===2?"s2":s===1?"s1":""`. Ver [app-edital](app-edital.explicado.md) §1.

**Closures.** Uma função "lembra" as variáveis do escopo onde nasceu, mesmo depois. É o que
permite o **módulo via IIFE**: variáveis privadas presas na closure, só `window.Sync` exposto.
Ver [sync](sync.explicado.md) §0.

**IIFE (função executada na hora).** `(()=>{…})()` roda um bloco e devolve/isola algo sem vazar
temporários — usada para montar índices (`TID2INFO`) e para módulos (`sync.js`, `qr.js`). Ver
[app-edital](app-edital.explicado.md) §8.

**Métodos de array (o vocabulário).** `map` (transforma), `filter` (seleciona), `reduce` (dobra
numa coisa só), `find`/`findIndex` (o primeiro que…), `some`/`every` (algum?/todos?),
`flatMap` (map + achatar), `sort` (ordena — com comparador numérico `(a,b)=>a-b`, senão ordena
como string). Onipresentes; ver praticamente todo arquivo.

---

## 2. O DOM e a renderização (sem framework)

**O DOM.** A página é uma **árvore** de nós (elementos). O JS a lê/modifica: `querySelector`
(o `$` do projeto), `.innerHTML`, `.appendChild`, `.classList`, `.dataset`. Ver [app-core](app-core.explicado.md).

**Template literals como motor de template.** A crase permite HTML multilinha com `${expr}`:
```js
card.innerHTML = `<div class="nm">${esc(d.nome)}</div>`;
```
É o "JSX dos pobres": monta HTML como string e joga no `.innerHTML`. Ver [app-edital](app-edital.explicado.md) §3b.

**Fragmento condicional.** `${cond ? `<b>…</b>` : ""}` = renderização condicional sem framework.
Ver [app-edital](app-edital.explicado.md) §3d.

**O ciclo de vida do render: muta → `save()` → re-render.** Não há reatividade automática. Você
muda o estado `S`, chama `save()` (persiste) e **explicitamente** re-renderiza a tela afetada.
Simples e previsível; o preço é lembrar de chamar. Ver [app-edital](app-edital.explicado.md) §4.

**Render idempotente preservando estado de UI.** Reconstruir do zero (`innerHTML=""` + recriar)
é fácil de raciocinar, mas perde o que estava aberto/rolado. Truque: **capturar** o estado
efêmero antes (um `Set` de ids abertos) e **reaplicar** depois. É o que React faz por baixo. Ver
[app-edital](app-edital.explicado.md) §3a.

**Re-render cirúrgico.** Quando redesenhar tudo perderia a rolagem, reconstrua **só** o nó que
mudou e faça `card.replaceWith(novo)`. Ver [app-banco](app-banco.explicado.md) §4d.

**Event delegation × `onclick` direto.** Ou você liga um `onclick` por elemento (e relig­a no
re-render), ou põe **um** listener no container que descobre o alvo no clique (`e.target.closest`).
O painel usa delegação para a navegação e `onclick` direto onde já reconstrói tudo. Ver
[app-core](app-core.explicado.md) (nav) e [app-edital](app-edital.explicado.md) §3e.

**`stopPropagation` e o *bubbling*.** Um clique "sobe" pela árvore (bubbling); `e.stopPropagation()`
corta a subida para o pai não reagir também. Ver [app-edital](app-edital.explicado.md) §3e.

**`<dialog>` nativo.** `.showModal()` abre um modal de verdade (trava foco, fecha no Esc) sem
biblioteca. Os modais são declarados no HTML e o JS os preenche. Ver [app-edital](app-edital.explicado.md) §5 e
[index-html](index-html.explicado.md) C.3.

**Escapar para `innerHTML` (anti-XSS).** `innerHTML` **interpreta** HTML. Todo dado interpolado
passa por `esc()` (`<`→`&lt;`) para texto não virar código. Ver [app-edital](app-edital.explicado.md) §3d.

**Sanitização por reconstrução (allowlist).** Para aceitar um pouco de formatação segura,
`mdLite` **escapa tudo** e depois reintroduz só um conjunto fechado de tags (`<b>`, `<ul>`…).
Ver [app-edital](app-edital.explicado.md) §6.

---

## 3. Estado e persistência

**`localStorage`.** Um dicionário string→string que **sobrevive** ao fechar o navegador, **por
origem/aparelho**. É onde vive todo o progresso (`S`), o tema, o token. Não sincroniza sozinho
entre máquinas. Ver [app-core](app-core.explicado.md).

**Estado versionado + migração.** O estado salvo pode ser de uma versão antiga. Ao carregar,
mescla-se **sobre os padrões**: `Object.assign(structuredClone(DEFAULT_STATE), lido)` — campos
novos ganham o default. É a migração *forward-compatible*. Ver [app-core](app-core.explicado.md) e [app.js](app.explicado.md) §3.

**`structuredClone` (cópia profunda) × cópia rasa.** `{...obj}` copia só o primeiro nível
(objetos aninhados são compartilhados); `structuredClone` copia tudo. Use profunda quando for
mutar aninhados sem afetar o original. Ver [app.js](app.explicado.md) §3, [sync](sync.explicado.md) §7.

**Estado de módulo.** Uma variável no topo de um arquivo (`noteTarget`, `WIZ`, `bqEsp`) guarda
contexto entre chamadas — o "estado" de um fluxo. Simples, mas global compartilhado. Ver
[app-edital](app-edital.explicado.md) §5, [app-redacao](app-redacao.explicado.md) §1.

**Fonte da verdade.** Cada dado tem **um** dono. O texto do editor mora no `<textarea>` até
fechar, quando "desce" para `S`. O edital mora em `edital-data.js`; o resto deriva. Ver
[app-redacao](app-redacao.explicado.md) §5 e [edital-data](edital-data.explicado.md) §0.

---

## 4. Modelagem de dados

**Chave estável × rótulo de tela.** Nunca use o texto visível como identificador. `"MAT"` é a
chave (nunca muda); `"Matemática"` é o rótulo (pode mudar). Ver [edital-data](edital-data.explicado.md) §1.

**Array ordenado × objeto-mapa.** Lista para "quais e em que ordem"; objeto/`Map` para "o valor
disto" em O(1). Ver [edital-data](edital-data.explicado.md) §1.

**Chave estrangeira.** Um campo que **liga** estruturas: `disciplina.prova` (`"BIO"`) aponta para
`PROVAS`, `PROVA_NOME`, `CURSOS[c].pesos`. Três tabelas costuradas por um código. Ver
[edital-data](edital-data.explicado.md) §4.

**Dados aninhados (árvore).** `array → objeto → array`. Renderiza com laços encaixados. `DISCIPLINAS
→ eixos → topicos` é a espinha do app. Ver [edital-data](edital-data.explicado.md) §4.

**Chave composta como string.** Indexar por várias colunas: `"ENEM|2023|CN|45"`. Ver [app-banco](app-banco.explicado.md) §2.

**Normalização (schema comum).** Fundir fontes heterogêneas num formato único na fronteira
(`PROPS()` junta UFRGS+FUVEST+ENEM). Ver [app-redacao](app-redacao.explicado.md) §2.

**Gerado × curado à mão.** A 1ª linha do `*-data.js` diz qual; gerado nunca se edita à mão (edite
a fonte e regenere). Ver [dados](dados.explicado.md) §1.

**Dado embutido como `const` global.** `file://` bloqueia `fetch` de JSON, então o dado vira `const
X = {…}` num `.js` carregado por `<script>`. Ver [dados](dados.explicado.md) §2.

---

## 5. Algoritmos e estruturas

**Lookup table pré-computada (space-time trade-off).** Pague **uma** varredura no carregamento e
guarde um índice para buscar em O(1) depois. `TID2INFO`, `BQ_IDX`, `dmap`, `EXP/LOG` do QR. Ver
[app-banco](app-banco.explicado.md) §2, [qr](qr.explicado.md) §1.

**Memoização.** Cache do resultado de uma função pura: `PROPS()` computa uma vez, devolve o cache
depois. Ver [app-redacao](app-redacao.explicado.md) §2.

**Group-by + reduce.** Agrupar eventos por categoria acumulando (`||=` inicia o balde). O padrão
mais recorrente do app (histórico de provas, minutos por dia…). Ver [app-banco](app-banco.explicado.md) §6d.

**argmax / argmin.** Achar o item que maximiza/minimiza algo. Duas formas: laço com `best/bestW`
(ou `reduce`), ou `indexOf(Math.min(...))`. Ver [app-painel](app-painel.explicado.md) §5e, [app-redacao](app-redacao.explicado.md) §7.

**Ordenação multi-chave.** Desempate encadeado com `||`: `b.prio-a.prio || b.n-a.n || nome.localeCompare`.
Ver [app-analise](app-analise.explicado.md) §1d.

**Máquina de estados.** Um objeto de estado + transições que o mudam e re-renderizam. O wizard
(`WIZ`), o ciclo de status (`(x+1)%3`), as fases. Guardas de transição proíbem estados inválidos.
Ver [app-redacao](app-redacao.explicado.md) §1, [app-edital](app-edital.explicado.md) §4.

**Clamp.** Prender num intervalo: `Math.max(min, Math.min(max, x))`. Onipresente na dataviz. Ver
[app-painel](app-painel.explicado.md) §1c.

**Idempotência.** Rodar 1× ou N× dá o mesmo resultado. `mergeCorpus` (Set de ids), os geradores.
Ver [app.js](app.explicado.md) §6, [pipeline](pipeline.explicado.md) §5.

**Reed-Solomon e corpos finitos.** ECC que reconstrói dados danificados, sobre a aritmética de
GF(256) (soma=XOR, multiplicação via log/antilog). Ver [qr](qr.explicado.md) §1–§2.

**SM-2 (repetição espaçada).** O intervalo entre revisões cresce ao acertar e reseta **só ao
errar** ("Difícil" não reseta — progride e paga derrubando o `ease`); o `ease` ajusta a
velocidade. Ver [app-plano](app-plano.explicado.md) §1.

---

## 6. Estatística aplicada

**Baseline uniforme.** Comparar o observado com "e se fosse tudo igual?" (`total/nº`) revela
**concentração**. Alta incidência = muito acima do uniforme. Ver [app-edital](app-edital.explicado.md) §9, [app-analise](app-analise.explicado.md) §1e.

**Limiar de confiança.** Uma amostra minúscula não decide; abaixo de `MIN_RESP`/`MIN_AMOSTRA`,
recua para o padrão e **rotula a origem** ("observada" × "estimada"). Ver [app-analise](app-analise.explicado.md) §1e.

**Encolhimento bayesiano (pseudo-contagens / suavização).** O mais profundo do app: em vez da
taxa crua (que **mente** com pouco dado), some **observações-fantasma** de um prior — com pouco
dado a estimativa fica perto do prior; com muito, perto da taxa real. `riscoDe` faz isso. É o que
dá médias confiáveis (o "por que 1 avaliação 5★ não ranqueia acima de mil 4.8★"). Ver
[app-banco](app-banco.explicado.md) §3.

**Reescalonamento pela fração.** Quando a escala muda (a rubrica virou 0–20), o valor cru mente;
compare sempre em **proporção** (`nota/max`), guardando o suficiente para renormalizar. Ver
[app-analise](app-analise.explicado.md) §3c.

**Prioridade = combinação de sinais.** Multiplicar/somar fatores num só score (peso × incidência
× lacuna × acerto). E **não misturar objetivos** distintos num ranking (alerta ≠ ranking). Ver
[app-painel](app-painel.explicado.md) §5.

**Média harmônica.** `Σw / Σ(w/x)`: pune nota baixa (uma prova fraca derruba tudo), modelando o
argumento real do vestibular. Ver [app-painel](app-painel.explicado.md) §1b.

---

## 7. Visualização de dados

**SVG (modo retido).** Cada forma é um **nó no DOM** (`<circle>`, `<rect>`); tem `onclick` de
graça; bom para poucos elementos. Criado por `createElementNS` (namespace!). Ver [app-painel](app-painel.explicado.md) §6.

**Canvas (modo imediato).** Você **pinta pixels**; nada persiste no DOM; bom para **muitos**
pontos, mas a interação (tooltip/clique) você calcula à mão (**hit-test** por `Math.hypot`). Ver
[app-analise](app-analise.explicado.md) §2.

**`devicePixelRatio`.** Buffer (`cv.width`) × tamanho visual (`style.width`) são diferentes; em
retina, buffer = css × dpr + `setTransform(dpr,…)`, senão borra. Ver [app-analise](app-analise.explicado.md) §2b.

**Funções de escala (data→pixel).** `xOf`/`yOf` convertem valor em coordenada; Y é **invertido**
(`1-p`) porque a tela cresce para baixo. Ver [app-analise](app-analise.explicado.md) §2d.

**Anel de progresso.** `stroke-dasharray = C` (circunferência) + `stroke-dashoffset = C*(1-p)` +
`rotate(-90)`. Ver [app-painel](app-painel.explicado.md) §4.

**Margin convention.** Reservar paddings e desenhar na área interna — a anatomia de todo gráfico.
Escala com **piso honesto** (`Math.max(60,…)`) para não enganar. Ver [app-plano](app-plano.explicado.md) §6.

---

## 8. Rede e sistemas distribuídos

**`fetch` + `async`/`await`.** Requisição HTTP assíncrona; `await` espera a resposta; `.then/.catch`
para Promises. Ver [sync](sync.explicado.md) §5.

**Bearer token.** Autenticação por um token no cabeçalho `Authorization: Bearer <t>` — o token
**é** a credencial (sem usuário/senha). Ver [functions-state](functions-state.explicado.md) §2.

**Last-Write-Wins por seção.** Particiona o estado; cada seção tem `updated_at`; o mais novo vence
— **por seção**, então edições em seções diferentes coexistem. Ver [sync](sync.explicado.md) §1.

**Relógio lógico monotônico (Lamport).** `Math.max(now, last+1)` garante timestamp sempre
crescente, resolvendo empates de ms e recuos de relógio; e acompanha o relógio do par. Ver
[sync](sync.explicado.md) §2.

**Merge convergente (CRDT-lite).** União por id (`Map`) não perde itens de aparelhos distintos; a
regra idêntica nos dois lados faz o estado **convergir**, dispensando fila persistente. Ver
[sync](sync.explicado.md) §4 e [functions-state](functions-state.explicado.md) §6.

**Debounce.** `clearTimeout` + `setTimeout`: uma rajada de eventos vira **um** disparo (o push só
1,5 s após a última mudança). Ver [sync](sync.explicado.md) §3.

**Shadow diff.** Comparar cada seção com um retrato detecta o que mudou **sem** instrumentar cada
mutador. Ver [sync](sync.explicado.md) §3.

**Guarda de reentrância.** Uma flag (`_applying`) impede o laço "salvar → observar → salvar". Ver
[sync](sync.explicado.md) §5.

**Serverless (functions-as-handlers).** Exportar `onRequestGet/Put`; a plataforma chama e escala;
a rota vem do caminho do arquivo. Ver [functions-state](functions-state.explicado.md) §0.

**UPSERT.** `INSERT … ON CONFLICT DO UPDATE` insere-ou-atualiza atômico (`excluded.*` = valores
novos). Ver [functions-state](functions-state.explicado.md) §4.

**`waitUntil` (fire-and-forget).** Logar em 2º plano sem segurar a resposta. Ver [functions-state](functions-state.explicado.md) §4.

---

## 9. Segurança

**Barreira de dados.** Todo conteúdo externo (download, corpo de requisição, resposta de LLM) é
**DADO não-confiável, nunca instrução**. Validar numa fronteira antes de cruzar para o lado
confiável. Três camadas: painel ([dados](dados.explicado.md) §5), servidor ([functions-state](functions-state.explicado.md) §4), pipeline
([pipeline](pipeline.explicado.md) §3).

**SQL injection e prepared statements.** Nunca concatene entrada no SQL; use `?` + `.bind(valor)`
— o banco trata o valor como **dado**, não código. Ver [functions-state](functions-state.explicado.md) §2.

**XSS e escape de HTML.** Todo dado em `innerHTML` é escapado (`esc`/`escapeHtml`), ou a
formatação é reconstruída por allowlist. Ver [app-edital](app-edital.explicado.md) §3d, §6.

**Allowlist de origem.** Só baixar/aceitar de fontes oficiais registradas; downloads não são
executáveis. Ver [pipeline](pipeline.explicado.md) §4.

**RBAC + menor privilégio.** Operação sensível exige `role === "admin"` (403 senão); e mesmo o
admin edita **só** meta+curso, **nunca** o progresso — concede só o poder necessário. Ver
[functions-state](functions-state.explicado.md) §5.

**Segredo fora da URL.** Um token que chega por `#token=` é lido e **apagado na hora**
(`replaceState`), para não ficar no histórico nem vazar. Ver [sync](sync.explicado.md) §6.

**Distinguir 401 × offline.** Não descarte um token válido por uma falha de rede; só um 401 real
significa credencial inválida. Ver [sync](sync.explicado.md) §6.

---

## 10. PWA e offline

**Service worker = proxy programável.** Roda entre o app e a rede; intercepta requisições
(`fetch`) e decide cache × rede. Ciclo: install → activate → fetch. Ver [sw](sw.explicado.md) §0–§1.

**Estratégias de cache por tipo.** api→só rede; terceiros→passa direto; navegação→rede-primeiro
(cai pro cache); assets→**stale-while-revalidate** (serve o cache já, revalida por baixo). Ver
[sw](sw.explicado.md) §3–§4.

**Cache versionado.** Subir `CACHE_V` e apagar os antigos = *cache busting*. Ver [sw](sw.explicado.md) §2.

**App Shell + aquecimento.** Instalar leve (só a casca); encher os dados pesados em 2º plano —
porque a 1ª visita não passa pelo SW. Ver [sw](sw.explicado.md) §5.

**Guarda por protocolo.** `file://` tem `serviceWorker` no `navigator` **mas lança**
`SecurityError`; a guarda é `/^https?:$/`, não *feature detection*. Ver [app.js](app.explicado.md) §8.

**`Response.clone()`.** Um corpo lê-se uma vez; clone para ir ao cache **e** ser devolvido. Ver
[sw](sw.explicado.md) §4.

---

## 11. CSS e design system

**Variáveis CSS (tokens).** Cor/medida vivem em `--var` no `:root`; componentes usam `var(--x)`;
trocar o tema = trocar as variáveis num lugar só. Ver [index-html](index-html.explicado.md) B.1.

**Eixos ortogonais.** `data-theme` (cor) × `data-style` (forma) × `data-nav` (layout),
independentes, **compõem**: 48 aparências de 3 conjuntos pequenos. Ver [index-html](index-html.explicado.md) B.2.

**Convenção "default = ausência de atributo".** O padrão não recebe `data-*`; só os desvios. DOM
limpo, caminho comum rápido. Ver [index-html](index-html.explicado.md) A.2, B.2.

**`:where()` (especificidade zero).** Aplicar uma regra **sem** brigar por prioridade — o layout
aplica a forma e o tema ainda vence a cor. Ver [index-html](index-html.explicado.md) B.3.

**Boot pré-paint (anti-FOUC).** Script síncrono no `<head>` aplica o tema salvo antes do 1º
paint, evitando o "flash". Ver [index-html](index-html.explicado.md) A.2.

**Fontes de sistema.** Zero webfont (quebraria offline/`file://`); pilha por SO que degrada sem
quebrar. Ver [index-html](index-html.explicado.md) B.1.

---

## 12. Metodologia

**Build step sem build tool.** Rodar um script à mão (`.py`/`.cjs`) que transforma fonte oficial
em artefato `.js` versionado. Ver [pipeline](pipeline.explicado.md) §1.

**Verificar de verdade.** "Não diga 'deve funcionar': abra e olhe." Sondas headless via CDP; e a
consciência de que **um teste pode passar pelo motivo errado** (offline emulado mente; emular
celular são 3 coisas; quem atesta a morte do servidor é o Node). Ver [pipeline](pipeline.explicado.md) §6–§8.

**Verificar pela propriedade, não pela igualdade.** Quando há mais de uma saída correta, teste a
propriedade que importa (o QR **lê de volta?**), não a igualdade com uma referência. Ver [qr](qr.explicado.md)
topo, [pipeline](pipeline.explicado.md) §9.

**Degradação graciosa.** O mesmo código roda em contextos diferentes e **se adapta** em vez de
quebrar: `semCofre()`, os guards `typeof … !== "undefined"`, o PWA em `file://`, cachear o 404.
Onipresente.

**Restrições-mãe do projeto.** Sem build, sem npm, roda em `file://` → sem ES modules (globais em
ordem), dado embutido em `.js`, guardas por protocolo. Quase toda decisão de arquitetura decorre
daí. Ver [app-core](app-core.explicado.md) §0, [index-html](index-html.explicado.md) C.4.

---

*Próximo: [GLOSSARIO.md](GLOSSARIO.md) (termos em ordem alfabética) · [FLUXOGRAMA.md](FLUXOGRAMA.md)
(os fluxos em diagrama) · [EXERCICIOS.md](EXERCICIOS.md) (teste-se).*
