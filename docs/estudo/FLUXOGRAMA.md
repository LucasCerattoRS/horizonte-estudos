# 🔀 FLUXOGRAMA — os principais fluxos do painel

> Os caminhos de execução mais importantes, em **diagrama** (Mermaid, que o GitHub renderiza) +
> texto. Se um `.explicado.md` conta o "o quê" de cada função, aqui você vê **como elas se
> encadeiam** no tempo. Comece pelo **boot**.

---

## 1. O boot — do `<script>` à primeira tela

```mermaid
flowchart TD
  A["Navegador carrega index.html"] --> B["&lt;head&gt;: script pré-paint<br/>aplica tema/estilo/nav salvos"]
  B --> C["&lt;body&gt; pintado já no tema certo"]
  C --> D["&lt;script&gt; dados: DISCIPLINAS, BANCO_QUESTOES…"]
  D --> E["&lt;script&gt; 8 fatias: app-core → … → app-painel"]
  E --> F["app.js (última fatia)"]
  F --> G["mergeCorpus(): funde redações importadas"]
  G --> H["init(): preenche selects + renderiza Painel e Edital"]
  H --> I["deep-link: #hash de aba? go(aba)"]
  F --> J["IIFE pwa(): se http(s), registra sw.js"]
  E --> K["qr.js, sync.js"]
  K --> L["sync boot(): se há token, pull()"]
```

**A leitura:** o tema é aplicado **antes** do paint (sem flash); os dados carregam antes do
código; o código carrega em ordem (core primeiro); `app.js` por último **executa** o boot; o
PWA e o sync entram depois. → [app.js](app.explicado.md), [index-html](index-html.explicado.md) C.4.

---

## 2. O ciclo de render — o "batimento cardíaco" do app

```mermaid
flowchart LR
  U["Usuário clica<br/>(ex.: cycleStatus)"] --> M["muta o estado S"]
  M --> S["save()"]
  S --> LS["grava no localStorage"]
  S --> OS["Sync.onSaved()"]
  M --> R["renderX() explícito"]
  R --> DOM["atualiza o DOM"]
  OS -->|"diff por seção → dirty"| PUSH["agenda push (debounce)"]
```

**A leitura:** não há reatividade mágica. Toda interação segue **muta `S` → `save()` →
re-renderiza**. O `save()` persiste **e** avisa o sync (que decide o que subir). Esquecer o
re-render = tela desatualizada. → [app-edital](app-edital.explicado.md) §4, [app-core](app-core.explicado.md).

---

## 3. Sincronização entre aparelhos — pull e push

```mermaid
sequenceDiagram
  participant PC as Painel (PC)
  participant API as /api/state (Cloudflare)
  participant DB as D1 (SQLite)
  Note over PC: boot com token
  PC->>API: GET /state (Bearer token)
  API->>DB: SELECT states WHERE profile
  DB-->>API: seções + updated_at
  API-->>PC: { profile, sections }
  Note over PC: applyRemote: troca seção só se ts remoto > local
  PC->>API: PUT /state (as seções locais)
  API->>DB: UPSERT só onde ts entrada > guardado (LWW)
  API-->>PC: estado mesclado
  Note over PC: converge; o ts local lembra o que falta subir
```

**A leitura:** a **mesma regra dos dois lados** (o mais novo vence, por seção) faz o estado
**convergir** sem fila persistente. `pull` termina chamando `push`; `push` termina reincorporando
o merge do servidor. → [sync](sync.explicado.md) §5, [functions-state](functions-state.explicado.md) §6.

---

## 4. SM-2 — revisar um card de repetição espaçada

```mermaid
flowchart TD
  A["Clica Errei/Difícil/Bom/Fácil<br/>(quality 0..3)"] --> B{"q &lt; 3?<br/>(só Errei: q=2)"}
  B -->|sim| C["reps=0, interval=1<br/>(revê amanhã)"]
  B -->|não| D{"qual repetição?"}
  D -->|1ª| E["interval = 1"]
  D -->|2ª| F["interval = 6"]
  D -->|3ª+| G["interval = round(interval × ease)"]
  C --> H["ease ajustado (piso 1.3)"]
  E --> H
  F --> H
  G --> H
  H --> I["due = agora + interval dias"]
  I --> J{"acertou bem<br/>e reps ≥ 3?"}
  J -->|sim| K["status = dominado"]
  J -->|não| L["mantém/parcial"]
  K --> S["save() + re-render"]
  L --> S
```

**A leitura:** o intervalo cresce geometricamente ao acertar (`× ease`) e **reseta só ao
errar** — "Difícil" (q=3) **não** reseta: progride o intervalo e paga derrubando o `ease`
(−0,14), o "controlador" da velocidade. Acertar com folga várias vezes promove a domínio. →
[app-plano](app-plano.explicado.md) §1.

---

## 5. Como um `*-data.js` nasce — o pipeline

```mermaid
flowchart LR
  PDF["Prova oficial<br/>(PDF/HTML de ufrgs.br/inep)"] --> P["parser<br/>(pdftotext/regex)"]
  P --> V{"validador estrito<br/>(campos, faixas)"}
  V -->|falha| X["investigar<br/>(NÃO afrouxar)"]
  V -->|ok| E["emite painel/&lt;nome&gt;-data.js<br/>const X = {…JSON…}"]
  E --> G["commit no Git (artefato versionado)"]
  G --> APP["&lt;script&gt; no index.html → global no painel"]
```

**A leitura:** um "build step" manual: fonte não-confiável → parser → **barreira** de validação →
artefato `.js` versionado. O painel carrega o artefato pronto (não roda o pipeline). →
[pipeline](pipeline.explicado.md) §1, [dados](dados.explicado.md).

---

## 6. Corrigir uma prova oficial pelo gabarito

```mermaid
flowchart TD
  A["Escolhe UFRGS/ENEM · ano · prova"] --> B["renderProva: grade ABCDE por questão"]
  B --> C{"modo?"}
  C -->|imediato| D["marca → corrige na hora<br/>(pinta, mostra resolução se errou)"]
  C -->|no fim| E["marca tudo → Corrigir"]
  D --> F{"respondeu todas?"}
  E --> G["checa pendentes"]
  F -->|sim| H["pvFinalizar"]
  G --> H
  H --> I["score (anulada = acerto)"]
  I --> J["push em S.simulados + save"]
  J --> K["mostra % + mostrarBilhete(pct)"]
```

**A leitura:** a grade só tem a letra do gabarito; o cruzamento com o banco (enunciado/tópico) só
aparece **se o gabarito bater** (guarda de integridade). Questão anulada conta como acerto. →
[app-banco](app-banco.explicado.md) §6.

---

## 7. Service worker — a decisão a cada requisição

```mermaid
flowchart TD
  R["fetch de um recurso"] --> M{"método = GET?"}
  M -->|não| PASS["deixa ir à rede"]
  M -->|sim| O{"mesma origem?"}
  O -->|não| PASS2["passa direto (terceiros)"]
  O -->|sim| API{"caminho tem /api/ ?"}
  API -->|sim| NET["só rede (nunca cacheia)"]
  API -->|não| NAV{"é navegação?"}
  NAV -->|sim| NF["rede primeiro;<br/>falhou → index.html do cache"]
  NAV -->|não| SWR["cache primeiro;<br/>revalida por baixo (SWR)"]
```

**A leitura:** cada tipo de recurso tem a estratégia certa. É o que faz a 2ª abertura ser
instantânea e o app abrir offline. → [sw](sw.explicado.md) §3–§4.

---

## 8. O wizard de redação — máquina de estados

```mermaid
stateDiagram-v2
  [*] --> Passo1
  Passo1: Passo 1 — escolher a rubrica (banca)
  Passo2: Passo 2 — escolher o tema (proposta)
  Passo3: Passo 3 — escrever & registrar nota
  Passo1 --> Passo2: wizBanca(k)
  Passo2 --> Passo3: wizTema(id) → abre editor
  Passo2 --> Passo1: trocar critério
  Passo3 --> Passo2: trocar tema
  Passo3 --> [*]: fecha editor → autosave do rascunho
  note right of Passo2: guardas: não avança sem<br/>banca (2) e sem tema (3)
```

**A leitura:** o objeto `WIZ` governa o fluxo; as guardas proíbem pular etapas; fechar o editor
**salva o rascunho sozinho** (evento `close` do `<dialog>`). → [app-redacao](app-redacao.explicado.md) §1, §5.

---

## Como os fluxos se conectam

```mermaid
flowchart LR
  DADOS["*-data.js<br/>(pipeline)"] --> CORE["app-core: S, save, $"]
  CORE --> ABAS["as 6 abas (render*)"]
  ABAS --> BOOT["app.js: init()"]
  BOOT --> SYNC["sync.js ↔ /api ↔ D1"]
  BOOT --> SW["sw.js (offline)"]
  CORE -.muta→save→render.-> ABAS
```

Da esquerda para a direita: os **dados** (nascidos no pipeline) alimentam o **core**, que serve
as **abas**, ligadas no **boot**, estendido por **sync** (nuvem) e **service worker** (offline). O
laço pontilhado é o ciclo de render do §2, que pulsa dentro de tudo.

---

*Próximo: [EXERCICIOS.md](EXERCICIOS.md) — teste o que você aprendeu (com gabarito ao final).*
