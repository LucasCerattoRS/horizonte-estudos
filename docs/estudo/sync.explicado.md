# ☁️ `sync.js` explicado — sincronização entre aparelhos

> **Arquivo real:** `painel/sync.js` (481 linhas) · **Etapa no roteiro:** 5 (avançado)
> **Pré-requisitos:** [`app-core`](app-core.explicado.md), [`app.js`](app.explicado.md)

Este é o arquivo **mais denso em ciência da computação** do projeto. Ele resolve um
problema clássico e difícil — **manter o mesmo estado sincronizado entre dois aparelhos
(PC e celular) que editam offline** — e o faz com ideias de **sistemas distribuídos**:
relógio lógico, *last-write-wins* por seção, *merge* convergente, *debounce* e detecção de
mudança por *diff*. Se você entender este arquivo, entende o miolo de como apps como Notion
ou Todoist sincronizam.

É também um estudo de **encapsulamento**: tudo vive numa IIFE, e a única superfície pública
é `window.Sync`.

> **Contexto:** faz parte do "backend V2". Fica **desligado por padrão** — sem token no
> `localStorage`, **nada** acontece e o painel é o de sempre (100% offline). O outro lado
> (o servidor) é a Cloudflare Function documentada em
> [`functions-state.explicado.md`](functions-state.explicado.md).

---

## §0 — A IIFE-módulo e o estado privado

```js
(function () {
  "use strict";
  const TOKEN_KEY = "painelUFRGS_token";
  const SECOES = ["topics","sessions","questions","simulados","redacoes","rascunhos","chat","bancoResp","curso"];
  const DEBOUNCE = 1500;
  let shadow = {};        // retrato do último estado conhecido (baseline do diff)
  let pushTimer = null;
  let lastTs = 0;         // relógio lógico monotônico
  …
  const Sync = { … };
  window.Sync = Sync;
  …
})();
```

**Conceito — módulo via IIFE + closure (encapsulamento sem `import`).** Como não há ES
modules (`file://`), todo o arquivo é uma **função executada na hora**. As variáveis dentro
dela (`shadow`, `pushTimer`, `lastTs`, `TOKEN_KEY`…) são **privadas** — invisíveis ao resto
do app, presas pela *closure*. A **única** coisa exposta é `window.Sync`, um objeto com os
métodos públicos (`login`, `pull`, `push`, `logout`). É o padrão **module pattern** clássico
do JS pré-ESM: um objeto público, um mar de estado privado. Comparado às outras fatias (que
vazam funções globais de propósito, para se chamarem), `sync.js` faz o oposto — **esconde**
tudo menos a API. A diferença faz sentido: as fatias são um app só fatiado; `sync` é um
**subsistema** com fronteira bem definida.

**`"use strict"`** liga o modo estrito (erros em vez de falhas silenciosas — ex.: atribuir
a variável não declarada lança). **`SECOES`** lista as 9 partes do estado que sincronizam
(o `S.topics`, `S.sessions`, etc.) — a **unidade de sincronização** é a seção, não o estado
inteiro nem cada item.

---

## §1 — A ideia central: last-write-wins **por seção**

O estado `S` tem 9 seções. Em vez de sincronizar "o `S` inteiro" (um aparelho sobrescreveria
o outro) ou "cada item" (complexo), a `sync` trata **cada seção** como unidade, com **seu
próprio timestamp** de última modificação.

```js
const TS_KEY = "painelUFRGS_ts";   // { secao: updated_at(ms) } local
function tsMap() { try { return JSON.parse(localStorage.getItem(TS_KEY)) || {}; } catch (e) { return {}; } }
```

**Conceito — Last-Write-Wins (LWW) por partição.** Cada seção carrega um `updated_at`. Na
hora de mesclar, **a versão com timestamp maior vence** — mas só *daquela seção*. Assim, se
o PC mexeu em `redacoes` e o celular em `sessions`, os dois updates sobrevivem (seções
diferentes), sem um atropelar o outro. Particionar o estado e resolver conflito por partição
é o meio-termo pragmático entre "granularidade grossa demais" e "fina demais". O custo:
dentro de uma seção, ainda é o mais-novo-ganha (você perde a edição mais antiga se dois
aparelhos mexeram na **mesma** seção offline — aceitável para um app pessoal).

---

## §2 — O relógio lógico (`nextTs`)

```js
function nextTs() { lastTs = Math.max(Date.now(), lastTs + 1); return lastTs; }
```

**Conceito — relógio lógico monotônico (à la Lamport).** Usar só `Date.now()` como
timestamp tem dois furos: (1) dois eventos no **mesmo milissegundo** empatam; (2) o relógio
do sistema pode **voltar** (ajuste de horário, fusos). `nextTs` garante um número
**estritamente crescente**: pega o maior entre "agora" e "último + 1". Se o relógio empatar
ou recuar, ele **força +1** para nunca repetir nem inverter. É uma versão mínima do relógio
de Lamport — o suficiente para que "quem escreveu depois" seja sempre identificável, mesmo
com relógios imperfeitos.

E, ao receber dados do outro aparelho, ele **avança o próprio relógio** para acompanhar:

```js
if (rts > lastTs) lastTs = rts;   // acompanha o relógio do outro aparelho (evita clock-skew perder update)
```

Sem isso, se o celular estivesse "adiantado", um update legítimo do PC poderia parecer mais
antigo e ser descartado. Sincronizar o relógio lógico com o do par é exatamente o que o
relógio de Lamport faz na teoria.

---

## §3 — Detectar mudança sem instrumentar cada mutador (o *shadow diff*)

Este é o truque mais elegante do arquivo.

```js
function snap() { SECOES.forEach(s => { shadow[s] = JSON.stringify(S[s]); }); }

Sync.onSaved = function () {
  if (!Sync.ativo() || Sync._applying || typeof S === "undefined") return;
  const ts = tsMap(), t = nextTs(); let changed = false;
  SECOES.forEach(secao => {
    const cur = JSON.stringify(S[secao]);
    if (cur !== shadow[secao]) { shadow[secao] = cur; ts[secao] = t; changed = true; }
  });
  if (changed) { setTs(ts); status("dirty"); clearTimeout(pushTimer); pushTimer = setTimeout(() => Sync.push(), DEBOUNCE); }
};
```

**O problema:** o app tem **dezenas** de funções que mudam o estado (`cycleStatus`,
`reviewCard`, `saveQ`, `saveRed`…). Como saber **qual seção mudou** para marcar seu
timestamp, sem colocar código de sync em cada uma delas?

**A solução — *diff* central por sombra (shadow).** `snap()` tira um **retrato** (JSON) de
cada seção — o *baseline*. `onSaved` (chamado pelo `save()` do `app-core` em **toda**
mutação) compara o estado atual de cada seção com o retrato: as que **mudaram** de string
ganham o novo timestamp, e o retrato é atualizado. Assim, **uma única função** cobre todos
os mutadores — o `save()` já era chamado por todos, e o diff descobre o que mexeu. Elegante
e à prova de esquecimento: uma função nova que chame `save()` é sincronizada de graça.

**Conceito — *debounce*.** `clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500)` —
se você faz 10 mutações em 3 segundos, o push **não** dispara 10 vezes: cada mutação
**cancela** o timer anterior e reagenda, então o envio só acontece **1,5 s após a última**
mudança. Junta uma rajada de edições num só envio. (O mesmo `clearTimeout`+`setTimeout` do
`toast` no `app-banco`, aqui a serviço da rede.) `status("dirty")` acende o indicador de
"há alterações locais a enviar".

**Comparar por `JSON.stringify`** é uma **igualdade estrutural** barata: se a serialização
mudou, o conteúdo mudou. Não é o mais rápido para estados enormes, mas é simples e correto
para o tamanho aqui.

---

## §4 — O *merge* convergente (`mergeSecao`)

```js
function mergeSecao(secao, remoto) {
  const local = S[secao];
  if (Array.isArray(remoto) && Array.isArray(local) && remoto.length && remoto.every(x => x && x.id)) {
    const byId = new Map(local.filter(x => x && x.id).map(x => [x.id, x]));
    remoto.forEach(x => byId.set(x.id, x));       // conflito no mesmo id: vence o remoto
    S[secao] = [...byId.values()];
  } else {
    S[secao] = remoto;                             // topics/bancoResp map, curso string → substitui
  }
}
```

**Conceito — merge por id (união estilo CRDT).** Para seções que são **listas de itens com
`id`** (questões, simulados, redações), o merge faz uma **união por id**: monta um `Map`
id→item do local, sobrepõe os remotos, e o resultado tem **todos** os itens dos dois
aparelhos. Se o PC criou a redação `r5` e o celular a `r6`, depois do sync **os dois têm
ambas** — nada se perde. Conflito no **mesmo** id (raro) resolve para o remoto. Para o resto
(mapas como `topics`/`bancoResp`, ou a string `curso`), é substituição direta (LWW por
seção do §1).

**Por que isso importa — convergência.** Esse merge é **comutativo e idempotente** o
suficiente para que, aplicá-lo repetidamente ou em ordens diferentes, os dois aparelhos
**convirjam** para o mesmo estado. É a propriedade que dispensa uma **fila de envio
persistente**: como reenviar é inofensivo (o servidor só grava seção com ts maior) e o
merge sempre converge, o próprio `TS_KEY` no `localStorage` "lembra" o que falta subir, e o
próximo boot/push reenvia. O comentário do topo do arquivo resume: *"Reenviar é inofensivo e
convergente → dispensa fila persistente."* É a sacada que simplifica o sistema inteiro.

**`new Map(...)` com pares `[chave, valor]`** é o jeito idiomático de indexar por id
preservando ordem de inserção; `[...byId.values()]` volta a array. `Map` aqui (não objeto)
porque ids podem ser strings arbitrárias e queremos `.set` sobrescrevente.

---

## §5 — O protocolo `pull`/`push`

```js
Sync.pull = async function () {
  if (!Sync.ativo()) { render(); return false; }
  status("sync");
  try {
    const r = await fetch(apiBase() + "/state", { headers: { Authorization: "Bearer " + Sync.token } });
    if (!r.ok) { Sync.lastErro = r.status === 401 ? "auth" : "rede"; status(r.status === 401 ? "bad" : "off"); return false; }
    const j = await r.json();
    Sync.profile = j.profile || null;
    applyMeta(Sync.profile && Sync.profile.meta);
    applyRemote(j.sections);
    status("ok");
    Sync.push();                                   // sobe o que for local-mais-novo
    return true;
  } catch (e) { Sync.lastErro = "rede"; status("off"); hookOnline(); return false; }
};
```

**`fetch` + `async`/`await` + Bearer token.** A comunicação é HTTP: `fetch` com o cabeçalho
`Authorization: Bearer <token>` (o padrão de autenticação por token). `await` espera a
resposta; `r.ok` checa o status; `r.json()` parseia o corpo. **A distinção de erro importa:**
`401` = token inválido (`"auth"`/`bad`); qualquer outra falha ou exceção = problema de rede
(`off`), que dispara `hookOnline()` (re-tenta quando o navegador emitir o evento `online`).
Tratar "sem rede" diferente de "credencial errada" é crucial — veremos no boot por quê.

**`applyRemote` — só o mais-novo vence:**

```js
function applyRemote(sections) {
  const ts = tsMap(); let mudou = false;
  Sync._applying = true;
  for (const [secao, sv] of Object.entries(sections)) {
    if (!SECOES.includes(secao) || !sv) continue;
    const rts = Number(sv.updated_at) || 0;
    if (rts > lastTs) lastTs = rts;                       // acompanha o relógio remoto
    if (!(secao in ts) || rts > ts[secao]) { mergeSecao(secao, sv.data); ts[secao] = rts; mudou = true; }
  }
  setTs(ts);
  if (mudou && typeof save === "function") save();        // onSaved é no-op (guard _applying)
  Sync._applying = false;
  snap();                                                  // baseline = estado já mesclado
  if (mudou) reRender();
}
```

**A guarda de reentrância `_applying` — evitar o laço de feedback.** Repare a armadilha:
`applyRemote` chama `save()` para persistir o estado mesclado; mas `save()` chama
`onSaved()`, que detectaria "mudança" e **agendaria outro push** — um **loop**
(pull→save→push→pull…). A flag `_applying=true` faz `onSaved` sair na hora
(`if(Sync._applying) return`). Depois de aplicar, `snap()` redefine o *baseline* para o
estado **já mesclado**, para que a próxima mutação real seja detectada corretamente. **Guardas
de reentrância** como essa são essenciais sempre que um "salvar" pode disparar o próprio
mecanismo que o observa. É o mesmo perigo de um `onChange` que muda o valor que observa.

**`push`** manda o estado inteiro (cada seção com seu ts); o servidor só grava as seções com
ts **maior** que o dele, e responde com o estado mesclado, que `applyRemote` reincorpora —
**convergência** em ação. O `pull` termina chamando `push` (sobe o que era local-mais-novo);
o `push` termina chamando `applyRemote` (baixa o que o outro subiu). Os dois se completam.

---

## §6 — Segurança do token: login por link/QR

Digitar 48 caracteres hex no celular é inviável, então o token entra pela **URL** (via QR).
Isso levanta um risco de segurança que o código trata com cuidado:

```js
function tokenDaURL() {
  const h = location.hash || "";
  const m = h.match(/[#&]token=([A-Za-z0-9._-]+)/);
  if (!m) return null;
  const t = m[1];
  const limpo = h.replace(/[#&]token=[A-Za-z0-9._-]+/, "");
  try { history.replaceState(null, "", location.pathname + location.search + (limpo === "#" ? "" : limpo)); }
  catch (e) { location.hash = limpo; }
  return t;
}
```

**Conceito — não deixar segredo na URL.** Um token na URL (`#token=abc`) é um **segredo**
(quem tiver o link entra no seu perfil — a dica no QR até avisa: *"Vale como uma senha"*). O
código o **lê e apaga do endereço no mesmo instante** com `history.replaceState` — assim ele
**não fica no histórico** do navegador nem vaza se você compartilhar o link depois. É uma
prática de segurança padrão: credenciais que chegam pela URL devem ser **removidas
imediatamente** da barra de endereço. A regex aceita só caracteres válidos de token
(`[A-Za-z0-9._-]`) — parsing restrito, como o hash de aba no `app.js`.

**A distinção offline × token-inválido no boot:**

```js
Sync.login(t).then(ok => {
  if (ok) { toast("✓ conectado…"); return; }
  if (Sync.lastErro === "auth") { Sync.logout(); toast("⚠ esse link de login não vale mais"); }
  else { status("off"); hookOnline(); toast("sem conexão agora — sincroniza quando voltar"); }
});
```

**Por que isso é sutil e importante:** se o login falha, **não** se pode simplesmente jogar
o token fora — o celular pode ter aberto o link **sem rede** (no elevador, no metrô). Só um
**401 real** (`lastErro==="auth"`) significa "token inválido" → aí sim desloga. Uma falha de
rede guarda o token e re-tenta quando a conexão voltar. Confundir "sem rede" com "credencial
errada" faria o app **descartar um token válido** por um tropeço de conexão — um bug de UX
cruel. Distinguir os modos de falha é marca de código de rede maduro.

---

## §7 — UI auto-injetada e o editor admin

**`injectUI` — a UI que se instala sozinha.** O comentário diz *"zero edição no
index.html"*: `sync.js` **cria** seu próprio botão ☁ e o anexa ao cabeçalho
(`document.querySelector(".profile-pick")…appendChild`). Assim o recurso é **totalmente
autocontido** no arquivo — some se você remover o `<script>`, sem deixar HTML órfão. É uma
escolha de modularidade: a feature carrega tudo o que precisa.

**A máquina de status (`EST`).** Um mapa `estado → {texto, cor, título}` (☁ conectado, ↻
sincronizando, ↑ enviando, ⚠ erro…) e `status(estado)` pinta o botão. É a mesma ideia de
`statusClass` do `app-edital`, agora para o indicador de rede — **um dicionário traduz
estado em aparência**.

**`escapeHtml`** — o arquivo traz o **próprio** escape (`&<>"` → entidades), porque insere o
**nome do perfil** (vindo do servidor, portanto não 100% confiável) via `innerHTML`. Mesmo
princípio anti-XSS do `esc` do `app-core`: **todo dado externo em `innerHTML` é escapado**.

**O editor admin (V2.2)** — só aparece se `Sync.profile.role === "admin"` (o Alex). Permite
editar a **dedicatória e mensagens de OUTRO perfil** (o da namorada) via `GET/PUT /admin`. Um
detalhe de modelagem: os bilhetes multi-linha viram um `<textarea>` onde cada bilhete é
separado por uma linha só com `===` (`SEP`), e no salvar faz `split(/\n===\n/)`. Traduzir uma
lista de textos longos para um campo editável e de volta é um probleminha real de UI, resolvido
com um separador improvável de aparecer no conteúdo. E `JSON.parse(JSON.stringify(adminMeta))`
faz uma **cópia profunda** para preservar campos que o formulário não edita (fotos, emoji,
título) — clonar antes de mutar, de novo.

---

## §8 — O boot e o `readyState`

```js
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
```

**Conceito — rodar após o DOM, sem perder o disparo.** `sync.js` carrega depois de `app.js`,
mas precisa do DOM pronto para injetar o botão. Se o documento ainda está **carregando**,
espera o `DOMContentLoaded`; se **já** carregou (o script entrou tarde), chama `boot()`
direto. Sem esse `if`, um script que carrega **depois** do `DOMContentLoaded` **nunca**
veria o evento (já passou) e o boot não rodaria. É o padrão robusto de "execute quando o DOM
estiver pronto, esteja ele pronto agora ou daqui a pouco".

`boot()` injeta a UI, tira o retrato inicial (`snap()` — para não empurrar como "mudança" o
que já existia), processa um eventual token da URL e, se ativo, faz o primeiro `pull`.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Módulo via IIFE + closure | §0 | estado privado; só `window.Sync` é público |
| `"use strict"` | §0 | erros em vez de falhas silenciosas |
| Unidade de sync = seção | §0,§1 | nem o estado todo, nem cada item |
| Last-Write-Wins por partição | §1 | conflito resolvido por seção, via timestamp |
| Relógio lógico monotônico | §2 | `Math.max(now, last+1)` resolve empates e recuos |
| Sincronizar o relógio com o par | §2 | avançar `lastTs` ao ver ts remoto maior (clock skew) |
| Shadow diff (detecção central) | §3 | comparar cada seção com um retrato; cobre todo mutador |
| Debounce | §3 | `clearTimeout`+`setTimeout`: rajada de edições → 1 envio |
| Igualdade estrutural por `JSON.stringify` | §3 | "mudou a string = mudou o conteúdo" |
| Merge por id (união CRDT-lite) | §4 | `Map` id→item une os dois aparelhos sem perder nada |
| Convergência dispensa fila | §4 | reenviar é inofensivo; o `ts` local lembra o que falta |
| `fetch` + `await` + Bearer token | §5 | protocolo HTTP autenticado por token |
| Só-mais-novo-vence (`applyRemote`) | §5 | troca a seção só se `rts > ts local` |
| Guarda de reentrância (`_applying`) | §5 | impedir o laço pull→save→push→pull |
| Distinguir 401 × falha de rede | §5,§6 | credencial errada ≠ sem conexão |
| Não deixar segredo na URL | §6 | ler o token e apagá-lo com `replaceState` |
| UI auto-injetada | §7 | a feature cria o próprio botão; zero HTML órfão |
| Dicionário estado→aparência | §7 | `EST` traduz o status de rede em ícone/cor |
| Escapar dado do servidor | §7 | `escapeHtml` no nome do perfil (anti-XSS) |
| Cópia profunda antes de mutar | §7 | `JSON.parse(JSON.stringify())` preserva campos não editados |
| `readyState` + `DOMContentLoaded` | §8 | rodar quando o DOM estiver pronto, cedo ou tarde |

---

**Próximo no roteiro:** [`qr.explicado.md`](qr.explicado.md) — o **gerador de QR code do
zero** (modo byte, correção de erro Reed-Solomon), que produz o QR de login usado aqui. Um
mergulho autocontido em **codificação** — um dos estudos isolados mais bonitos do projeto.
