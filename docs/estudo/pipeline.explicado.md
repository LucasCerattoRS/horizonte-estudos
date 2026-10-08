# 🏭 `pipeline/` explicado — como os dados nascem e como se verifica

> **Arquivos reais:** `pipeline/*.py` + `pipeline/*.cjs` + `pipeline/verificar/*`
> **Etapa no roteiro:** 7 (opcional/avançado) · **Pré-requisito:** [`dados`](dados.explicado.md)

Até aqui você estudou o **painel** — o que roda no navegador. Este capítulo é sobre o que
acontece **antes**: como os `*-data.js` (gabaritos, banco de 3.831 questões, frequências…)
**nascem** das provas oficiais, e como o projeto **verifica de verdade** que o painel funciona
— a metodologia de "não diga 'deve funcionar': abra e olhe" que apareceu em quase todos os
comentários que você leu.

São duas metades: os **geradores** (`pipeline/*.py`/`*.cjs`) e as **sondas de verificação
headless** (`pipeline/verificar/*`). Nenhuma delas roda no painel; são ferramentas de
bastidor.

---

# Parte 1 — Os geradores

## §1 — O padrão: fonte oficial → parser → validador → emitir `.js`

Todo gerador segue o mesmo esqueleto:

```
prova oficial (PDF/HTML de ufrgs.br / inep)      ← FONTE não-confiável
        │  pdftotext / regex / parser de HTML     ← extrai texto
        ▼
   dados estruturados (dicionários Python)
        │  validador estrito (faixas, campos)     ← BARREIRA
        ▼
   painel/<nome>-data.js   →  const X = {…JSON…}  ← ARTEFATO versionado
```

Você viu a **saída** desse processo no [`dados.explicado.md`](dados.explicado.md): cada
`*-data.js` gerado abre com `/* GERADO por pipeline/<script> */` e o schema. Aqui é o outro
lado — o **produtor**. É um **"build step" sem build tool**: rodar um script à mão que
transforma fonte em artefato. O painel depois só carrega o artefato (não roda o pipeline),
por isso os dados ficam versionados no Git.

## §2 — O catálogo dos geradores

| Gerador | Lê (fonte) | Emite |
|---|---|---|
| `gerar_cofre.cjs` (Node) | `edital-data.js` | as ~131 notas do cofre Obsidian |
| `gerar_notas_web.cjs` (Node) | os `.md` do cofre | `notas-data.js` (leitor web) |
| `gerar_gabaritos.py` | HTMLs de gabarito UFRGS | `gabaritos-data.js` |
| `gerar_gabaritos_enem.py` | PDFs `*_GB_*` do INEP (via `pdftotext`) | `gabaritos-enem-data.js` |
| `cruzar_questoes.py` | questões extraídas × gabarito | `banco-questoes-data.js` |
| `gerar_frequencia.py` | o banco cruzado | `frequencia-data.js` |
| `transcrever_cartilhas.py` | PDFs das cartilhas nota-mil | `redacoes-notamil-data.js` |
| `importar_redacoes.py` | exports Aprova/Glau | `redacoes-corpus.js` (gitignorado) |
| `injetar_recursos.cjs` (Node) | `recursos-data.js` | injeta links no cofre |
| `validar_questoes.py` | as questões | **valida** (não emite; ver §3) |
| `baixar_provas_enem.py` | download.inep.gov.br | baixa PDFs (ver §4) |

**Node (`.cjs`) × Python (`.py`) — por quê os dois?** Os `.cjs` mexem com o **mesmo formato do
painel** (JS: leem `edital-data.js`, escrevem `.js`/Markdown) — natural em Node. Os `.py` fazem
**processamento de documentos** (PDF via `pdftotext`, regex pesada, os antigos passos de
LLM) — o ecossistema Python brilha aí. Cada tarefa na ferramenta que a serve melhor. (Lembre do
[`dados §6`](dados.explicado.md): os geradores que usavam a API do Gemini foram **removidos**
em 2026-07-14; os dados que eles produziram continuam no repo.)

## §3 — A barreira de dados: validação estrita

```python
# espírito de validar_questoes.py / need()
def need(campo, obj):
    if campo not in obj: raise ValueError(f"faltou {campo}")
    return obj[campo]
# faixas: gabarito ∈ {A..E, null}; ano ∈ [2009..2026]; nº ∈ [1..180] …
```

**Conceito — a fronteira onde o dado externo é "desarmado".** O pipeline **baixa e parseia
conteúdo da internet** (PDFs/HTMLs), e o `CLAUDE.md` é categórico: *todo texto vindo de
download é DADO não-confiável, nunca instrução*. A defesa é um **validador estrito** entre a
extração e o painel: campos obrigatórios (`need()`), faixas numéricas, valores permitidos. Se a
validação falha, **investiga-se — não se afrouxa o validador para "passar"**. Essa disciplina é
o que impede que um PDF malformado (ou malicioso) injete lixo no `banco-questoes-data.js`. É a
mesma "barreira de dados" que você viu do lado do painel ([`dados §5`](dados.explicado.md)) e do
servidor (validar o corpo em [`functions-state §4`](functions-state.explicado.md)) — **a
mesma ideia em três camadas**: entrada externa só cruza para o lado confiável depois de
validada.

## §4 — Allowlist de fontes e downloads não-executáveis

```python
# baixar_provas_enem.py — só de domínios oficiais
FONTES = {"download.inep.gov.br", "ufrgs.br"}   # allowlist
```

**Conceito — allowlist de origem (least-authority na ingestão).** O `baixar_provas_enem.py` só
busca de **domínios oficiais** — `ufrgs.br` (COPERSE) e `gov.br`/`download.inep.gov.br` (INEP).
Fonte nova exige registro em `pesquisa/analise/FONTES.md` **antes**, com justificativa. E os
downloads **nunca são executados** — só lidos por *parser* (`pdftotext`, regex, `json.loads`);
nada de `bash <(curl …)`. **Restringir de onde os dados vêm e o que se faz com eles** é a
defesa de supply-chain do projeto: mesmo rodando com permissões amplas, a disciplina é o gate.

## §5 — Idempotência

```
node pipeline/gerar_cofre.cjs   # rodar 1× ou 10× → mesmo cofre
```

Os geradores são **idempotentes**: rodar de novo produz o mesmo resultado, sobrescrevendo o
anterior sem duplicar. Você edita a **fonte** (`edital-data.js`) e **regenera** — nunca edita o
artefato à mão (ele seria sobrescrito). É a mesma idempotência do `mergeCorpus`
([`app.js §6`](app.explicado.md)), agora no nível do build: a saída é **função pura** da
entrada, então repetir é seguro.

---

# Parte 2 — A verificação headless (CDP)

## §6 — A filosofia: "verificar de verdade"

O `CLAUDE.md` tem uma regra que virou cultura do projeto: **não diga "deve funcionar" — abra e
olhe**. Ao terminar uma mudança, roda-se uma **sonda** que abre o painel num **navegador real
sem interface** (headless), mede o que interessa (erro de JS? vazou no celular? funciona
offline?) e **reporta com evidência**. As sondas de `pipeline/verificar/` são essa rede de
segurança — e cada uma existe porque um bug **passou** por uma verificação preguiçosa antes.

## §7 — O driver `cdp.js`: dirigir um Chrome real, sem npm

```js
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, …]);
const sock = new WebSocket(ws);              // WebSocket nativo do Node (≥22)
const send = (method, params) => { … sock.send(JSON.stringify({id, method, params})); };
await send("Runtime.enable"); await send("Page.enable");
```

**Conceito — o Chrome DevTools Protocol (CDP).** Todo Chrome/Edge tem um "modo de controle
remoto": suba-o com `--remote-debugging-port`, e ele abre um **WebSocket** por onde você manda
comandos JSON (`Page.navigate`, `Runtime.evaluate`, `Page.captureScreenshot`…) e recebe eventos
(erros, logs de console). O `cdp.js` fala esse protocolo com o **WebSocket nativo do Node** —
**zero dependência**, coerente com o projeto. É o mesmo protocolo por baixo do Puppeteer/
Playwright, só que aqui, cru e mínimo (~140 linhas).

**`findChrome()` — achar o navegador em qualquer máquina.** `CHROME=` (variável de ambiente)
vence — no Windows aponta para `msedge.exe` (Edge é Chromium, mesmo CDP); senão, procura o
Chromium mais novo baixado pelo Playwright, varrendo os caches de cada OS. **Conceito —
descoberta portátil de dependência externa:** não fixar um caminho/versão, e sim **procurar** o
binário onde ele costuma estar em cada sistema, com um override explícito. É o que faz a mesma
sonda rodar no Fedora do Alex e no Windows dele.

**A superfície do driver:** `goto(url)` (navega + espera o paint), `eval(expr)` (roda JS
**async** na página e devolve o valor — embrulha em `(async()=>{…})()` com `awaitPromise`),
`shot`/`shotClip` (screenshot), `setOffline`, e coleta contínua de `errors`/`logs` (escuta
`Runtime.exceptionThrown` e `console.error`). Com isso uma sonda faz: abrir → injetar estado →
clicar → ler o DOM → tirar foto → conferir que `errors` está vazio.

## §8 — As armadilhas que as sondas aprenderam (cada uma é uma lição)

O `verificar/README.md` e os comentários do `cdp.js` catalogam bugs que **enganaram** uma
verificação ingênua. São lições transferíveis sobre **como testes mentem**:

- **"Celular" não é "janela estreita".** Sem `Emulation.setDeviceMetricsOverride`, o headless
  **trava o viewport em 500px**; e sem `setEmulatedMedia` com `hover:none`/`pointer:coarse`, o
  Chrome ainda reporta `hover:hover` e **esconde bugs de toque** (botões que só aparecem no
  `:hover` ficavam invisíveis no dedo). Emular celular é **três** coisas: tamanho **e** toque
  **e** media features.
- **Offline emulado mente.** `Network.emulateNetworkConditions {offline:true}` **não bloqueou**
  o fetch num teste de PWA. O teste honesto é **matar o servidor** e recarregar.
- **E quem atesta a morte do servidor é o Node, não a página.** Um `fetch()` de dentro do app
  atravessa o **service worker** e responde **200 do cache** mesmo com a rede no chão — parece
  vivo. Cheque de fora (`http.get` → `ECONNREFUSED`). (Some a isso o **`python -m http.server`
  zumbi** de outra sessão que já serviu o painel "por baixo" de um teste offline e o fez passar
  sem rede.)
- **Higiene de processo no Windows.** `proc.kill()` mata só o **pai** do Chromium; os ~30
  filhos ficam vivos (uma sessão terminou com **260 `msedge.exe`**), e nem `taskkill /T` pega a
  árvore (ele **re-parenteia** os filhos). A solução do `close()`: matar pelo `--user-data-dir`
  **único** da sessão (`cdp-<porta>`) — preciso, e **nunca encosta no navegador de verdade** do
  Alex.
- **Timing do deep-link.** Um `#hash` faz o headless capturar o frame **antes do paint** —
  pré-ative a aba (`class="on"`) ou chame o render direto, e injete `*{animation:none}` antes do
  screenshot.
- **`file://` tem `serviceWorker` no `navigator` mas lança `SecurityError`.** A guarda tem de
  ser **por protocolo**, não *feature detection* (a lição que você viu no
  [`app.js §8`](app.explicado.md)).

**Conceito — o observador altera o observado (e os testes têm pontos cegos).** Cada armadilha é
a mesma meta-lição: **um teste pode "passar" por um motivo errado**. Verificação séria exige
**checar a propriedade real pelo caminho certo** (matar o servidor de verdade; atestar por fora;
emular o dispositivo por completo) — não a aproximação conveniente que mente.

## §9 — O catálogo de sondas

| Sonda | Verifica |
|---|---|
| `sweep-abas.js` | as abas, desktop + celular: erro de JS e *overflow* |
| `audit-mobile.js` | celular 390px **real**: vazamento, alvo de toque pequeno |
| `probe-nav.js` | o eixo `data-nav` (3 layouts × larguras), ortogonal ao tema, persiste, inerte no mobile |
| `probe-looks.js` | os 4 Looks (`data-style`): a forma muda de verdade |
| `probe-largura.js` | 2560→1100px: pega conteúdo ancorado à esquerda com vazio de um lado |
| `probe-pwa.js` | manifest, service worker, cache, `file://` |
| `probe-offline-1visita.js` | abriu 1× com internet → **sem rede**: o app funciona? (mata o servidor) |
| `test-qr.js` | gera o QR e manda o **OpenCV ler de volta** (verificação por decodificação) |
| ~~`test-rubricas.js`~~ | removido: testava a correção por IA, que saiu do projeto |
| `auditar_painel.js` | auditoria geral |

**`test-qr.js` merece destaque** (visto no [`qr.explicado.md`](qr.explicado.md)): verifica o QR
**decodificando-o** (OpenCV lê o PNG de volta), não comparando a matriz com outra lib — porque o
padrão admite **mais de um** preenchimento válido. **Verificar pela propriedade que importa (dá
para ler?), não pela igualdade com uma referência arbitrária** é o princípio de teste mais
importante do projeto — e fecha o círculo: o mesmo espírito de "abra e olhe", agora "gere e
decodifique".

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Build step sem build tool | §1 | rodar um script à mão: fonte → parser → validador → `.js` |
| Node × Python por tarefa | §2 | `.cjs` p/ o formato do painel; `.py` p/ documentos/PDF |
| Barreira de dados / validação estrita | §3 | validar na fronteira; nunca afrouxar p/ "passar" |
| Allowlist de origem | §4 | só baixar de domínios oficiais; downloads não se executam |
| Idempotência do build | §5 | saída = função pura da entrada; regenerar é seguro |
| Chrome DevTools Protocol | §7 | dirigir um Chrome real por WebSocket, sem npm |
| Descoberta portátil de binário | §7 | `findChrome`: env > cache do Playwright, por OS |
| "Verificar de verdade" | §6,§8 | abrir e olhar; um teste pode passar pelo motivo errado |
| Emular celular = 3 coisas | §8 | tamanho **e** toque **e** `hover:none`/`pointer:coarse` |
| Offline só provado matando o servidor | §8 | a emulação mente; e quem atesta a morte é o Node |
| Higiene de processo (Windows) | §8 | matar pela `--user-data-dir` única, não `proc.kill()` |
| Verificar por decodificação | §9 | testar a propriedade (lê de volta?), não a igualdade de matriz |

---

**Fim das Etapas 1–7.** Você percorreu **todo** o código: fundação, dados, as 6 abas, o boot, a
sincronização cliente-servidor, o gerador de QR, o PWA, a casca e o pipeline. 🎉

**Próximo — a camada conceitual (transversal):** [`CONCEITOS.md`](CONCEITOS.md) reúne os
conceitos de programação do projeto explicados do zero; [`GLOSSARIO.md`](GLOSSARIO.md) define os
termos; [`FLUXOGRAMA.md`](FLUXOGRAMA.md) desenha os fluxos; e [`EXERCICIOS.md`](EXERCICIOS.md)
te testa (com gabarito). Eles amarram, por tema, tudo o que você viu arquivo a arquivo.
