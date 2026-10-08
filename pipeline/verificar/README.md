# Verificação headless do painel (sem npm, sem dependência nova)

Ferramentas de **verificar de verdade** — a regra do `CLAUDE.md` ("não diga 'deve funcionar':
abra e olhe"). Tudo roda com o **Node do sistema** e o **Chromium que já está no cache do
Playwright**; nada é instalado.

```bash
# 1) sobe um servidor local (o SW e o localStorage exigem origem http, não file://)
python3 -m http.server 8899 &        # a partir da RAIZ do repo

# 2) rode a sonda que interessa (todas assumem http://127.0.0.1:8899/painel/index.html)
node pipeline/verificar/sweep-abas.js      # as 11 abas, desktop + celular: erro de JS e overflow
node pipeline/verificar/audit-mobile.js    # celular 390px REAL: vazamento, alvo de toque pequeno
node pipeline/verificar/probe-nav.js       # eixo data-nav (lateral/topo/inferior): 3 layouts × larguras 2560→1100,
                                           #   ortogonal ao tema/Look, persiste no reload, INERTE no celular.
                                           #   Sobe o PRÓPRIO servidor (porta aleatória) — NÃO precisa do 8899 acima.
node pipeline/verificar/probe-pwa.js       # manifest, service worker, cache, offline, file://

# ...menos esta, que SOBE E MATA o próprio servidor (não use o de cima com ela):
node pipeline/verificar/probe-offline-1visita.js   # abriu 1x com internet → ficou sem rede: o app funciona?
```

**No Windows:** `CHROME='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'` (o Edge é
Chromium, mesmo CDP) e crie `C:\tmp` (o `cdp.js` fixa `--user-data-dir=/tmp/cdp-*`).

**⚠️ Mate o servidor no fim.** `python -m http.server 8899` sobrevive à sessão e vira zumbi: em
14/07 havia **16** deles acumulados, e um estava servindo o painel **por baixo do teste offline** —
o app "passava" sem rede porque a rede nunca caiu. `probe-offline-1visita.js` por isso usa **porta
aleatória** e confirma a morte do servidor **pelo Node**, nunca pela página.

## `cdp.js` — o driver
Sobe o Chromium com `--remote-debugging-port` e conversa com ele pelo **DevTools Protocol**
usando o `WebSocket` nativo do Node (≥22). Expõe `goto`, `eval` (async, com `await` lá dentro),
`shot`, `shotClip`, `setOffline`, e coleta erros de JS/console.

```js
const { open } = require("./cdp.js");
const p = await open({ mobile: true });     // 390×844, toque, hover:none, pointer:coarse
await p.goto("http://127.0.0.1:8899/painel/index.html");
const n = await p.eval(`go("banco"); return BQ.length;`);
await p.shot("/tmp/x.png");
p.close();
```

## Armadilhas aprendidas (por que estas sondas existem)
- **`opt.mobile` não é "janela estreita".** Sem `setDeviceMetricsOverride` o headless trava o
  viewport em **500px**; sem `setEmulatedMedia` com `hover:none`/`pointer:coarse`, o Chrome
  ainda reporta `hover:hover` e **esconde bugs de toque** (botões com `opacity:0` que só
  aparecem no `:hover` ficavam invisíveis no celular e as auditorias não viam).
- **Offline emulado mente.** `Network.emulateNetworkConditions {offline:true}` não bloqueou o
  fetch no teste do PWA. O teste honesto é **matar o servidor** (`kill $(cat srv.pid)`) e
  recarregar — foi assim que o offline do service worker ficou provado.
- **E quem atesta a morte do servidor é o Node, não a página.** Um `fetch()` de dentro do app
  atravessa o **service worker** (regra 4, cache-first) e responde **200 do cache** mesmo com a
  rede no chão — parece que o servidor está vivo. Cheque de fora (`http.get` → `ECONNREFUSED`),
  ou por uma rota que o SW ignora de propósito (`/api/*`).
- **Recarregar antes de cortar a rede invalida o teste offline.** A 1ª carga **não passa pelo SW**
  (a página que o registra não é controlada por ele), então só a **2ª** enche o cache. O
  `probe-pwa.js` recarregava e *depois* ficava offline — por isso nunca viu que quem abre o app
  **uma única vez** e some da rede encontrava a casca vazia (0 questões). Ver `probe-offline-1visita.js`.
- **Windows deixa lixo de processo.** `proc.kill()` mata só o pai do Chromium e nem `taskkill /T`
  pega a árvore (ele re-parenteia os filhos): uma sessão terminou com **260 `msedge.exe` vivos**.
  O `close()` do `cdp.js` agora mata pelo `--user-data-dir` único da sessão (`cdp-<porta>`), o que
  também garante que **nunca** encoste no navegador de verdade do Alex.
- **`file://` tem `serviceWorker` no `navigator`, mas qualquer chamada lança `SecurityError`**
  (origem opaca). Guarda tem de ser **por protocolo** (`/^https?:$/`), não por feature detection.
- **Deep-link por `#hash`** faz o headless capturar o frame antes do paint. Pré-ative a aba
  (`class="on"`) ou chame o render direto; e injete `*{animation:none!important}` antes do
  screenshot para não pegar o fade.
- **Estado sintético:** injete no `localStorage` via `p.eval` usando os **campos reais** que o
  app grava (`S.simulados[].score`, não `acertos` — errar isso produz `NaN` na tela e faz você
  caçar um bug que é seu, do teste).
