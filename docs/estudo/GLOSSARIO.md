# 📖 GLOSSÁRIO — termos técnicos em ordem alfabética

> Dicionário de bolso do material de estudo. Cada verbete: uma definição curta + onde ele
> aparece no painel. Para o conceito **explicado do zero**, veja [CONCEITOS.md](CONCEITOS.md);
> para o **código**, o `*.explicado.md` linkado.

## A

**allowlist (lista de permissão).** Definir explicitamente **o que é permitido** (em vez de
tentar barrar o proibido). Usada nas fontes de download (só domínios oficiais) e no `mdLite`
(só as tags seguras). Oposto de *blocklist*. → [pipeline](pipeline.explicado.md) §4, [app-edital](app-edital.explicado.md) §6.

**argmax / argmin.** "O item que **maximiza** (ou minimiza) algo" — não o valor máximo, mas
**qual** elemento o atinge. Ex.: a competência mais fraca da redação. → [app-painel](app-painel.explicado.md) §5e.

**arrow function.** Função curta `x => x*2`; sem chaves, retorna a expressão. Para devolver
objeto, `x => ({…})`. → [edital-data](edital-data.explicado.md) §3.

**async / await.** Açúcar para Promises: `await` "espera" um valor assíncrono como se fosse
síncrono, dentro de uma função `async`. → [sync](sync.explicado.md) §5.

## B

**barreira de dados.** Princípio: todo conteúdo externo (download, corpo HTTP, LLM) é **dado
não-confiável**, validado numa fronteira antes de virar "confiável". → [dados](dados.explicado.md) §5.

**Bearer token.** Autenticação por um token no cabeçalho `Authorization: Bearer <t>`; o token
**é** a credencial (sem usuário/senha). → [functions-state](functions-state.explicado.md) §2.

**BCH.** Família de códigos corretores de erro (primo do Reed-Solomon) usada nos **metadados** do
QR (format/version info). → [qr](qr.explicado.md) §8.

**bubbling (propagação).** Um evento de clique "sobe" pela árvore do DOM do alvo até a raiz;
`stopPropagation()` corta a subida. → [app-edital](app-edital.explicado.md) §3e.

## C

**cache busting.** Forçar o descarte do cache antigo — aqui, mudando o **nome** do cache
(`CACHE_V`) e apagando os demais. → [sw](sw.explicado.md) §2.

**canvas.** API de desenho **imediato** (pinta pixels, sem DOM por forma); ótima para muitos
pontos, mas a interação é calculada à mão. → [app-analise](app-analise.explicado.md) §2.

**CDP (Chrome DevTools Protocol).** O "controle remoto" do Chrome por WebSocket: comandos JSON
para navegar, avaliar JS, tirar screenshot. Base das sondas de verificação. → [pipeline](pipeline.explicado.md) §7.

**clamp.** Prender um valor num intervalo: `Math.max(min, Math.min(max, x))`. → [app-painel](app-painel.explicado.md) §1c.

**closure.** Uma função "lembra" as variáveis do escopo onde nasceu; base do módulo-IIFE com
estado privado. → [sync](sync.explicado.md) §0.

**coerção de tipo.** Conversão implícita/explícita entre tipos; `+"640"` → número `640`. →
[app-painel](app-painel.explicado.md) §1a.

**CORS.** Regras que o navegador impõe a chamadas entre origens diferentes; o servidor autoriza
por cabeçalhos `Access-Control-Allow-*`. → [functions-state](functions-state.explicado.md) §1.

**CRDT (tipo de dado replicado sem conflito).** Estrutura cujo *merge* **converge** independente
de ordem; aqui, "CRDT-lite" = união por id. → [sync](sync.explicado.md) §4.

**custom properties (variáveis CSS).** `--cor: #x` no `:root`, lidas com `var(--cor)`; os *tokens*
de design que os temas reescrevem. → [index-html](index-html.explicado.md) B.1.

## D

**`data-*` (data attribute).** Atributo HTML customizado (`data-theme="claro"`), lido no JS por
`el.dataset.theme` e no CSS por `[data-theme="claro"]`. Os 3 eixos de tema. → [index-html](index-html.explicado.md) B.2.

**debounce.** "Espere parar de mexer": cancelar o timer anterior e reagendar, para uma rajada
virar um disparo só. → [sync](sync.explicado.md) §3.

**degradação graciosa.** O mesmo código se adapta a contextos diferentes em vez de quebrar
(`semCofre()`, guards `typeof`, PWA em `file://`). → [app-edital](app-edital.explicado.md) §2.

**desestruturação.** Extrair campos por nome: `const {outcome} = …`; `for (const [k,v] of …)`. →
[app.js](app.explicado.md) §8.

**devicePixelRatio (dpr).** Razão entre pixels físicos e CSS; num canvas retina, buffer = css×dpr
para não borrar. → [app-analise](app-analise.explicado.md) §2b.

**`<dialog>`.** Elemento HTML de modal nativo; `.showModal()` abre com foco preso e fecha no Esc,
sem biblioteca. → [app-edital](app-edital.explicado.md) §5.

**DOM.** A árvore de elementos da página, lida/alterada pelo JS. → [app-core](app-core.explicado.md).

**DSL interna.** Uma "mini-linguagem" feita de funções (o helper `t(nome,...subs)`) que deixa os
dados declarativos. → [edital-data](edital-data.explicado.md) §3.

## E

**encolhimento bayesiano (shrinkage).** Puxar uma taxa crua para um **prior** com
pseudo-contagens, para amostra pequena não mentir. `riscoDe`. → [app-banco](app-banco.explicado.md) §3.

**especificidade (CSS).** O "peso" de um seletor na disputa de qual regra vence; `:where()` tem
peso **zero** (aplica sem brigar). → [index-html](index-html.explicado.md) B.3.

**escape (HTML).** Transformar `<`/`&` em entidades para dado não virar código no `innerHTML`
(anti-XSS): `esc`/`escapeHtml`. → [app-edital](app-edital.explicado.md) §3d.

**event delegation.** Um listener no container que descobre o alvo no clique, em vez de um por
elemento. → [app-core](app-core.explicado.md).

## F

**falsy / truthy.** Valores que contam como falso (`false,0,"",null,undefined,NaN`) ou verdadeiro
num `if`. Alimenta `.filter(Boolean)` e `x || padrão`. → [CONCEITOS](CONCEITOS.md) §1.

**fetch.** API de requisição HTTP assíncrona (devolve Promise). → [sync](sync.explicado.md) §5.

**fire-and-forget.** Disparar trabalho sem esperar terminar; no servidor, `waitUntil` loga em 2º
plano sem segurar a resposta. → [functions-state](functions-state.explicado.md) §4.

**flatMap.** `map` + achatar um nível: junta arrays aninhados num só. → [app-plano](app-plano.explicado.md) §7.

**FOUC (flash of unstyled content).** O "pisca" de estilo errado antes do JS corrigir; evitado
pelo boot pré-paint no `<head>`. → [index-html](index-html.explicado.md) A.2.

## G

**GF(256) (corpo finito).** 256 "números" com soma (XOR) e multiplicação próprias, onde toda
divisão existe — a base aritmética do Reed-Solomon. → [qr](qr.explicado.md) §1.

**guard clause.** Saída antecipada que trata o caso especial primeiro (`if(!nb) return …`),
evitando aninhar o resto. → [app-edital](app-edital.explicado.md) §7.

## H

**hit-test.** Descobrir qual elemento está sob o ponteiro — no canvas, calculado à mão pela
distância (`Math.hypot`). → [app-analise](app-analise.explicado.md) §2f.

## I

**idempotência.** Rodar 1× ou N× dá o mesmo resultado (o `mergeCorpus`, os geradores). →
[app.js](app.explicado.md) §6.

**IIFE.** *Immediately Invoked Function Expression*: `(()=>{…})()` — roda na hora, isola
temporários, serve para módulos e para montar índices. → [app-edital](app-edital.explicado.md) §8.

**innerHTML.** Propriedade que lê/escreve o HTML interno de um elemento (interpreta o texto como
marcação — daí o escape). → [app-edital](app-edital.explicado.md) §3.

**interleaving.** Intercalar dados de blocos diferentes para que um dano concentrado vire erros
esparsos (correção contra *burst error*). → [qr](qr.explicado.md) §4.

## L

**Lamport clock (relógio lógico).** Timestamp **monotônico** (`Math.max(now, last+1)`) que resolve
empates e recuos de relógio em sistemas distribuídos. → [sync](sync.explicado.md) §2.

**localStorage.** Armazenamento chave→valor persistente por origem/aparelho; onde vive o progresso
e as preferências. → [app-core](app-core.explicado.md).

**lookup table (índice).** Estrutura pré-computada para busca O(1) (`TID2INFO`, `BQ_IDX`); troca
CPU repetida por memória. → [app-banco](app-banco.explicado.md) §2.

**LWW (last-write-wins).** Resolução de conflito "o mais novo vence" — aqui, **por seção**. →
[sync](sync.explicado.md) §1.

## M

**máquina de estados (FSM).** Um objeto de estado + transições que o mudam; o wizard, o ciclo de
status. Guardas proíbem transições inválidas. → [app-redacao](app-redacao.explicado.md) §1.

**margin convention.** Layout de gráfico: reservar paddings e desenhar na área interna. →
[app-plano](app-plano.explicado.md) §6.

**média harmônica.** `Σw / Σ(w/x)`; pune notas baixas — modela o argumento do vestibular. →
[app-painel](app-painel.explicado.md) §1b.

**memoização.** Guardar o resultado de uma função pura para não recalcular (`PROPS()` +
`_PROPSCACHE`). → [app-redacao](app-redacao.explicado.md) §2.

## N

**namespace (SVG).** Elementos SVG exigem `createElementNS(…svg…)`; `createElement` comum não
renderiza. → [app-painel](app-painel.explicado.md) §6.

**NaN.** "Not a Number"; contamina contas. Barrado com `+x||0` e `!(x>=0)`. → [app-plano](app-plano.explicado.md) §7.

**normalização.** Reduzir dados a uma forma canônica: um schema comum (`PROPS`) ou texto sem
acento/caixa para comparar (`norm`). → [app-redacao](app-redacao.explicado.md) §2, [app.js](app.explicado.md) §6.

**nullish coalescing (`??`).** `a ?? b` usa `b` só se `a` é `null`/`undefined` (0 e "" passam) —
diferente de `||`. → [app-banco](app-banco.explicado.md) §1b.

## O

**optional chaining (`?.`).** Acessa propriedade sem estourar em `null`: `rec?.link`,
`r.comp?.[i]`. → [app-edital](app-edital.explicado.md) §3e.

**ortogonalidade (eixos).** Dimensões independentes que **compõem** (cor × forma × layout) — 48
aparências de 3 conjuntos pequenos. → [index-html](index-html.explicado.md) B.2.

## P

**pega-ou-cria (`||=`).** `x ||= []` garante que `x` existe e devolve a referência; base do
group-by. → [app-painel](app-painel.explicado.md) §1c.

**prepared statement.** Consulta SQL com placeholder `?` + `.bind(valor)`; separa dado de código →
**impede SQL injection**. → [functions-state](functions-state.explicado.md) §2.

**prior (bayesiano).** A crença "padrão" antes de ver dados; o encolhimento puxa a estimativa para
ele com pouca amostra. → [app-banco](app-banco.explicado.md) §3.

**Promise.** Objeto que representa um valor futuro (sucesso `.then` / falha `.catch`); base do
`async/await`. → [app-banco](app-banco.explicado.md) §5.

**PWA (Progressive Web App).** App web instalável e offline, via manifest + service worker. →
[app.js](app.explicado.md) §8, [sw](sw.explicado.md).

## R

**RBAC (controle de acesso por papel).** Permissão por `role` (só admin edita perfis); 403 para
quem não pode. → [functions-state](functions-state.explicado.md) §5.

**reentrância (guarda de).** Flag que impede uma função de disparar a si mesma em laço
(`_applying` no sync). → [sync](sync.explicado.md) §5.

**Reed-Solomon.** Correção de erros que reconstrói dados danificados (CDs, QR); calculada por
divisão polinomial em GF(256). → [qr](qr.explicado.md) §2.

**reflow.** Recálculo de layout do navegador; ler `offsetWidth` força um reflow para **reiniciar**
uma animação CSS. → [app-banco](app-banco.explicado.md) §4a.

**relógio lógico.** Ver *Lamport clock*.

**rest / spread (`...`).** `...args` junta em array; `[...a]`/`{...o}` espalha (cópia rasa). →
[edital-data](edital-data.explicado.md) §3.

## S

**serverless.** Backend como funções que a plataforma chama e escala (`onRequestGet`), sem servir
um processo. → [functions-state](functions-state.explicado.md) §0.

**service worker.** Script-proxy entre app e rede; intercepta `fetch` para servir cache/offline.
→ [sw](sw.explicado.md).

**shadow diff.** Comparar cada seção do estado com um retrato para detectar o que mudou sem
instrumentar cada mutador. → [sync](sync.explicado.md) §3.

**SM-2.** Algoritmo de repetição espaçada: o intervalo cresce ao acertar e reseta só ao
errar ("Difícil" não reseta; derruba o `ease`). →
[app-plano](app-plano.explicado.md) §1.

**SQL injection.** Ataque que injeta código via dados concatenados no SQL; evitado por *prepared
statements*. → [functions-state](functions-state.explicado.md) §2.

**stale-while-revalidate.** Servir o cache (possivelmente velho) **já** e revalidar por baixo para
a próxima. → [sw](sw.explicado.md) §4.

**`stopPropagation`.** Corta o *bubbling* de um evento para o pai não reagir. → [app-edital](app-edital.explicado.md) §3e.

**`structuredClone`.** Cópia **profunda** de um objeto (aninhados incluídos), diferente do spread
raso. → [app.js](app.explicado.md) §3.

## T

**template literal.** String com crase, multilinha e `${expr}` — o motor de template do JS puro.
→ [app-edital](app-edital.explicado.md) §3b.

**ternário.** `cond ? a : b`; encadeado, é um `if/else if` como expressão. → [app-edital](app-edital.explicado.md) §1.

**token.** Segredo que autentica (aqui, casado com `profiles.token`); tratado como senha. →
[sync](sync.explicado.md) §6.

## U

**UPSERT.** `INSERT … ON CONFLICT DO UPDATE`: insere-ou-atualiza atômico (`excluded.*` = valores
novos). → [functions-state](functions-state.explicado.md) §4.

**UTF-8.** Codificação de texto em bytes; obtida sem dependência via
`unescape(encodeURIComponent(s))`. → [qr](qr.explicado.md) §9.

## W

**`waitUntil`.** Diz à plataforma/SW "não termine o evento até esta Promise acabar" (install do
SW; log fire-and-forget). → [sw](sw.explicado.md) §1, [functions-state](functions-state.explicado.md) §4.

## X

**XSS (cross-site scripting).** Injeção de HTML/JS via dado não escapado no `innerHTML`; evitado
por `esc` e por reconstrução (allowlist). → [app-edital](app-edital.explicado.md) §3d, §6.

## Z

**zona quieta (quiet zone).** A margem branca obrigatória em volta do QR para o leitor achar o
código. → [qr](qr.explicado.md) §10.

---

*Próximo: [FLUXOGRAMA.md](FLUXOGRAMA.md) — os principais fluxos em diagrama · [EXERCICIOS.md](EXERCICIOS.md)
— teste-se.*
