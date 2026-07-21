# 📴 `sw.js` explicado — o service worker (offline de verdade)

> **Arquivo real:** `painel/sw.js` (150 linhas) · **Etapa no roteiro:** 6 (PWA e a casca)
> **Pré-requisitos:** [`app.js §8`](app.explicado.md) (o registro do SW), [`functions-state`](functions-state.explicado.md)

Este é o arquivo que faz o painel **funcionar sem internet** — abrir instantâneo na segunda
visita, servir as 3.831 questões offline, comportar-se como um app instalado. Ele é um
**service worker**: um tipo especial de script que o navegador roda **entre o app e a rede**,
podendo **interceptar toda requisição** e decidir se responde do cache ou da rede. Entender
este arquivo é entender como qualquer PWA (Progressive Web App) fica offline.

> **Lembrete de [`app.js §8`](app.explicado.md):** o SW **só é registrado em `http(s)`**. Em
> `file://` nada disto roda (origem opaca → `SecurityError`), e o painel local segue idêntico,
> só sem o offline. Este arquivo, portanto, vale para o **site publicado**.

---

## §0 — O que é um service worker

Um service worker é um script que:
- roda num **thread separado** da página (não tem acesso ao DOM);
- **persiste** entre visitas (o navegador o mantém registrado);
- pode **interceptar requisições de rede** da sua origem (via o evento `fetch`) e respondê-las
  como quiser — do cache, da rede, ou uma resposta sintética.

**Conceito — um proxy programável dentro do navegador.** Pense no SW como um **porteiro** que
fica entre o app e a internet: toda vez que o app pede um arquivo, o pedido passa **primeiro**
pelo SW, que decide o que fazer. É isso que permite offline: se a rede caiu, o porteiro
entrega a cópia guardada. O preço dessa capacidade é um **ciclo de vida próprio** (install →
activate → fetch) e algumas armadilhas de *timing* que este arquivo documenta na marra.

---

## §1 — O ciclo de vida: install → activate → fetch

```js
self.addEventListener("install",  e => { e.waitUntil( … addAll(SHELL) … skipWaiting() ) });
self.addEventListener("activate", e => { e.waitUntil( … apaga caches velhos … clients.claim() … aquecer() ) });
self.addEventListener("fetch",    e => { … intercepta cada requisição … });
```

**Os três eventos são o ciclo de vida do SW:**

1. **`install`** — roda **uma vez**, quando o navegador vê uma versão nova do `sw.js`. É onde
   se **pré-carrega** o essencial no cache (a `SHELL`). `self` é o próprio service worker (o
   equivalente a `window`, mas no contexto do SW).

2. **`activate`** — roda quando o SW novo **assume o controle**. É o momento de **limpar**
   caches antigos e fazer setup. Aqui também dispara o "aquecimento" dos dados.

3. **`fetch`** — roda a **cada requisição** de rede da página. É o coração: onde as estratégias
   de cache são aplicadas.

**`e.waitUntil(promise)`** — recapitulando do [`functions-state`](functions-state.explicado.md):
diz ao navegador "não considere este evento terminado até esta promessa acabar". No `install`,
segura o SW até a `SHELL` estar cacheada; no `activate`, até a limpeza e o aquecimento
terminarem. Sem isso, o navegador poderia matar o SW no meio do trabalho.

**`skipWaiting()` + `clients.claim()` — assumir o controle na hora.** Por padrão, um SW novo
fica **esperando** todas as abas antigas fecharem antes de assumir (para não trocar a versão
"embaixo" de uma aba aberta). `skipWaiting()` (no install) pula essa espera, e
`clients.claim()` (no activate) faz o SW novo **controlar as páginas já abertas**
imediatamente. Juntos: a versão nova entra em vigor **agora**, sem exigir que o usuário feche
tudo. É o que faz "subir o `CACHE_V` e recarregar" bastar para atualizar.

---

## §2 — Versionamento de cache

```js
const CACHE_V = "horizonte-v26";
…
// no activate:
const nomes = await caches.keys();
await Promise.all(nomes.filter(n => n !== CACHE_V).map(n => caches.delete(n)));
```

**Conceito — o cache é versionado por nome.** Todo o conteúdo é guardado num cache chamado
`"horizonte-v26"`. Quando você publica uma mudança e **sobe o `CACHE_V`** (para `v27`), o SW
novo, ao ativar, **apaga todos os caches cujo nome não é o atual** — jogando fora o conteúdo
velho e forçando o recache do novo. É a estratégia clássica de *cache busting*: em vez de
tentar invalidar arquivos um a um, **troca-se o balde inteiro** mudando o nome.

**⚠️ Armadilha operacional (do `CLAUDE.md`):** *"Ao publicar mudança no painel, suba o
`CACHE_V`"* — senão o app instalado continua servindo a versão velha do cache antigo, e o
usuário não vê a atualização. Esquecer de subir a versão é o bug nº 1 de quem mantém um PWA. O
`deploy-pages.sh` ainda emite `_headers` com `no-cache` no próprio `sw.js`/`manifest`, para o
**navegador** sempre buscar o SW novo (senão ele cacheria o próprio arquivo que controla o
cache — um impasse).

---

## §3 — As quatro estratégias de cache (a ordem importa)

O evento `fetch` aplica **quatro regras**, nesta ordem. Cada uma existe por um motivo — o
comentário no topo do arquivo é uma aula:

```js
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                    // só GET; POST/PUT nunca do cache
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // REGRA 2
  if (url.pathname.includes("/api/")) return;          // REGRA 1
  if (req.mode === "navigate") { … }                   // REGRA 3
  … // REGRA 4
});
```

**Regra 1 — `/api/*` nunca cacheia (network-only).** O estado do servidor (D1) precisa ser
sempre fresco: uma resposta velha aqui mostraria **progresso errado** ou perfil
desatualizado. `return` sem `respondWith` = "não intercepto, deixa ir à rede normal".

**Regra 2 — outra origem passa direto (pass-through).** Requisições ao Gemini, YouTube, Google
não são cacheadas (`url.origin !== self.location.origin` → `return`). Cachear resposta de IA
seria "mentira" (dado velho), e guardar conteúdo de terceiros é ruído. O SW só cuida da
**própria origem**.

**Regra 3 — navegação: rede primeiro, cache como rede de segurança (network-first).**

```js
if (req.mode === "navigate") {
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (cacheavel(net)) (await caches.open(CACHE_V)).put("./index.html", net.clone());
      return net;
    } catch {
      const c = await caches.open(CACHE_V);
      return (await c.match("./index.html")) || (await c.match("./")) ||
        new Response("<h1>Offline</h1>…", { status: 503, … });
    }
  })());
  return;
}
```

Ao **abrir o app** (`req.mode === "navigate"`), tenta a **rede primeiro** — para pegar a versão
mais nova do HTML (e o redirect do Cloudflare Access quando a sessão expira). **Se a rede
falhar** (`catch`), serve o `index.html` **do cache** — é assim que o app abre offline. Só se
nem isso existir, uma página "Offline" sintética (`new Response(...)`). **Network-first** é a
estratégia certa para o **documento**: você quer o mais novo quando dá, mas nunca uma tela
branca quando não dá.

**Regra 4 — recursos: cache primeiro, revalidando por baixo (veja §4).**

**Conceito — estratégias de cache são escolhas por tipo de recurso.** Não existe "a" estratégia
certa: dado que muda toda hora (API) quer *network-only*; o documento quer *network-first*;
recursos versionados querem *cache-first*. **Casar a estratégia com a natureza do recurso** é a
habilidade central de escrever um service worker. Este arquivo é um catálogo limpo das quatro.

---

## §4 — Stale-while-revalidate (a regra 4)

```js
e.respondWith((async () => {
  const c = await caches.open(CACHE_V);
  const hit = await c.match(req);
  const rede = fetch(req).then(res => {
    if (cacheavel(res)) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await rede) || new Response("", { status: 504 });
})());
```

Para tudo o mais (`app.js`, `*-data.js`, ícones, PDFs): **responde do cache imediatamente** se
houver (`hit`), **e em paralelo** busca a versão nova na rede para **atualizar o cache** por
baixo. Da próxima vez, o cache já tem o novo.

**Conceito — stale-while-revalidate (SWR).** "Sirva o possivelmente-velho **agora** (rápido), e
revalide para a **próxima** vez." É o melhor dos dois mundos para recursos que mudam devagar:
**velocidade** (nunca espera a rede) sem **ficar preso** numa versão velha para sempre. É a
mesma estratégia que CDNs e o próprio `fetch`/cache HTTP usam. É o que faz a **segunda abertura
ser instantânea** mesmo com os 4,4 MB do banco de questões: eles vêm do cache, e a checagem de
atualização acontece invisível.

**`Response.clone()` — um detalhe crucial.** Um corpo de `Response` só pode ser **lido uma
vez** (é um *stream*). Como aqui a resposta precisa ir **para o cache** (`c.put`) **e** ser
**devolvida** ao app, é preciso `res.clone()` — uma cópia para cada destino. Esquecer o
`clone()` dá o erro "body already used". É a pegadinha nº 1 de quem mexe com `fetch`/cache.

**`cacheavel = r => r && r.status === 200 && r.type === "basic"`** — só cacheia respostas **OK
de mesma origem** (`type "basic"`). Não guarda erros nem respostas opacas de terceiros. Um
guarda simples que evita "cachear lixo".

---

## §5 — SHELL × DADOS: instalar leve, aquecer depois

```js
const SHELL = [ "./", "./index.html", "./app-core.js", … "./qr.js", "./edital-data.js", "./manifest.webmanifest", "./icons/…" ];
const DADOS = [ "./banco-questoes-data.js", "./notas-data.js", … /* ~5,8 MB */ ];
```

**A divisão é deliberada.** A **`SHELL`** é o mínimo para o app **abrir** (o HTML, os 8
scripts de código, o edital, os ícones) — cacheada no `install`. Os **`DADOS`** (o conteúdo:
3.831 questões, notas, gabaritos… ~5,8 MB) ficam **fora** do install, senão a instalação
baixaria quase 6 MB **antes de o app sequer abrir**. Eles são **aquecidos** em segundo plano,
depois que o SW assume:

```js
async function aquecer() {
  const c = await caches.open(CACHE_V);
  for (const u of DADOS) {
    if (await c.match(u)) continue;      // a regra 4 já pegou
    try { const r = await fetch(u); if (cacheavel(r) || (r.status === 404 && r.type === "basic")) await c.put(u, r); }
    catch { /* sem rede: a próxima visita online aquece */ }
  }
}
```

**Conceito — app shell + carregamento em segundo plano.** Separar "a casca que abre rápido" do
"conteúdo pesado que enche depois" é o padrão **App Shell** dos PWAs. O usuário vê o app de pé
em instantes; os dados chegam por baixo. `aquecer()` roda **um arquivo por vez, sem pressa**
(no `activate`, via `waitUntil`), para **não competir por banda** com a página que está
carregando.

**A sutileza que justifica tudo (o comentário conta a cicatriz):** a **1ª visita não passa pelo
SW** — a página que **registra** o SW não é controlada por ele ainda (ele só controla a partir
da próxima navegação, ou do `clients.claim`). Então a regra 4 **não cacheia nada** na primeira
carga. Sem o `aquecer()`, quem abrisse o app **uma vez** e ficasse sem rede acharia a casca
**vazia** — 0 questões, 0 leituras — justamente o que a promessa de offline deveria evitar.
Medido em 14/07 com o servidor morto: *"boot de 7s e todos os dados AUSENTES"*. O `aquecer()` é
a correção: assim que o SW assume, ele **puxa os dados para o cache** proativamente. Esta é a
lição de "verificar de verdade": só matando o servidor num teste headless o bug apareceu.

---

## §6 — Dois detalhes de robustez que valem ouro

**Cachear o 404 dos arquivos opcionais de propósito.**

```js
if (cacheavel(r) || (r.status === 404 && r.type === "basic")) await c.put(u, r);
```

`perfil-seed.js` e `redacoes-corpus.js` **podem não existir** neste site (o seed só está no da
Bia; o corpus é do Alex e nunca é publicado). O `index.html` os carrega como `<script src>`.
Offline, tentar buscar um arquivo inexistente deixa o `<script>` **pendurado ~4s** tentando a
rede — e como `<script src>` **trava o parser**, o app inteiro esperava **8s** por dois
arquivos que não existem. A solução engenhosa: **cachear o próprio 404**. Assim, offline, o
navegador recebe o "não existe" **na hora** (do cache) em vez de esperar a rede estourar —
*"offline falha igual a online"*. Cachear uma resposta de **erro** é contraintuitivo, mas aqui
é exatamente o certo: o 404 **é** a resposta correta, e você a quer rápida.

**`addAll` é tudo-ou-nada → adicione um a um.**

```js
await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
```

`cache.addAll([...])` **falha inteiro se UM arquivo faltar** (ex.: o `perfil-seed.js` ausente).
Isso abortaria o install do SW por causa de um arquivo opcional. A defesa: adicionar **cada um
por si** com `.catch(() => {})`, para que um arquivo faltante seja ignorado sem derrubar os
demais. **Conceito — degradar por item, não por lote:** quando um passo do conjunto pode falhar
sem invalidar o resto, isole cada passo. `Promise.all` aqui só espera todos terminarem (os
`.catch` garantem que nenhum rejeita).

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Service worker = proxy programável | §0 | roda entre app e rede; intercepta requisições |
| Ciclo de vida install/activate/fetch | §1 | pré-carrega / limpa+assume / intercepta |
| `waitUntil` | §1 | segura o evento até a promessa terminar |
| `skipWaiting` + `clients.claim` | §1 | a versão nova assume **já**, sem fechar abas |
| Cache versionado por nome | §2 | subir `CACHE_V` e apagar os velhos = cache busting |
| Estratégia por tipo de recurso | §3 | api→só rede; doc→rede-primeiro; asset→cache-primeiro |
| Network-first (navegação) | §3 | o mais novo quando há rede; cache quando não há |
| Stale-while-revalidate | §4 | serve o cache já; revalida por baixo p/ a próxima |
| `Response.clone()` | §4 | o corpo lê-se uma vez; clone p/ cache **e** retorno |
| Guarda `cacheavel` | §4 | só cacheia 200 de mesma origem (não guarda lixo) |
| App Shell + aquecimento em 2º plano | §5 | casca leve instala rápido; dados enchem depois |
| A 1ª visita não passa pelo SW | §5 | por isso `aquecer()` puxa os dados proativamente |
| Cachear o 404 de propósito | §6 | offline, o "não existe" chega na hora (não trava o parser) |
| Degradar por item (`add`+`catch`) | §6 | um arquivo faltante não derruba o install inteiro |

---

**Próximo no roteiro:** [`index-html.explicado.md`](index-html.explicado.md) — a **casca**,
em partes: (a) a estrutura HTML e o script de boot pré-*paint*; (b) o sistema de temas por
variáveis CSS (os **3 eixos** `data-theme` × `data-style` × `data-nav`); (c) o corpo e os
diálogos. É o maior arquivo — por isso vem quando você já entende todo o JS que ele carrega.
