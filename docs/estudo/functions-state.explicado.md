# 🗄️ `functions/api/` explicado — o backend serverless (Cloudflare + D1)

> **Arquivos reais:** `functions/api/state.js` (78 linhas) + `functions/api/admin.js` (107)
> **Etapa no roteiro:** 5 (avançado) · **Pré-requisito:** [`sync.explicado.md`](sync.explicado.md)

Aqui é **o outro lado** do `sync.js`. O cliente (no navegador) fala com **este** código, que
roda num servidor da Cloudflare e guarda o estado num banco **D1** (SQLite serverless). É
onde você sai do navegador e entra no **backend**: rotas HTTP, autenticação por token, SQL
com *prepared statements*, CORS e controle de acesso por papel (*role*). São só ~185 linhas
somadas — um backend enxuto e completo, ótimo para estudar os fundamentos sem framework.

Vou cobrir os dois arquivos juntos: `state.js` (sincronização do progresso) e `admin.js` (o
Alex editando o perfil-presente de outra pessoa).

---

## §0 — O modelo: Cloudflare Pages Functions

```js
export async function onRequestGet(context) { … }
export async function onRequestPut(context) { … }
export async function onRequestOptions() { … }
```

**Conceito — serverless / functions-as-handlers.** Não há um servidor que você liga e mantém
rodando. Você **exporta funções** com nomes convencionais (`onRequestGet`, `onRequestPut`,
`onRequestOptions`) e a Cloudflare as chama quando chega um `GET`/`PUT`/`OPTIONS` naquela
rota. O arquivo `functions/api/state.js` **é** a rota `/api/state` (o caminho do arquivo vira
a URL — *file-based routing*). Sem `express`, sem `app.listen()`, sem gerência de processo: a
plataforma cuida de escalar, e você só escreve o **tratador de requisição**.

**`context`** é o ambiente da requisição: `context.request` (a requisição HTTP),
`context.env` (as *bindings* — aqui `env.DB`, a conexão com o D1, configurada no painel da
Cloudflare) e `context.waitUntil` (para trabalho em segundo plano — já veremos). **`async`**
porque todo acesso a banco/rede é assíncrono (`await`).

---

## §1 — CORS e o helper de resposta

```js
const CORS = {
  "Access-Control-Allow-Origin": "*",              // inclui file:// (Origin null) — leitura por token
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
```

**Conceito — CORS (Cross-Origin Resource Sharing).** Por segurança, o navegador **bloqueia**
que uma página de uma origem chame uma API de outra origem, a menos que a API **autorize** por
cabeçalhos. O painel roda em `file://` (origem `null`) ou num domínio Pages, e a API noutro —
origens diferentes. Os cabeçalhos `Access-Control-Allow-*` são essa autorização. **`Origin:
*`** libera qualquer origem — o que aqui é aceitável porque a autenticação é por **token no
cabeçalho** (não por cookie): sem o token, `*` não dá acesso a nada; e como não há cookies, não
há risco de CSRF que o `*` amplifique.

**O `OPTIONS` — o *preflight*.** Antes de um `PUT` "não-simples", o navegador manda um
`OPTIONS` perguntando "posso?"; `onRequestOptions` responde `204` (sem corpo) com os cabeçalhos
CORS = "pode". É uma etapa obrigatória do protocolo que todo backend chamado do navegador
precisa tratar.

**`json(obj, status)`** — um mini-helper que embrulha qualquer objeto numa `Response` JSON com
os cabeçalhos certos. **`new Response(...)`** é a API web padrão de resposta (a mesma que o
*service worker* usa — você a reverá no `sw.js`). Centralizar a criação de resposta evita
repetir os cabeçalhos em cada retorno.

---

## §2 — Autenticação por Bearer token (e a defesa contra SQL injection)

```js
async function auth(context) {
  const h = context.request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const p = await context.env.DB.prepare(
    "SELECT id, nome, role, meta FROM profiles WHERE token = ?"
  ).bind(token).first();
  if (p && p.meta) { try { p.meta = JSON.parse(p.meta); } catch { p.meta = null; } }
  return p || null;
}
```

**Conceito — Bearer token: o token É a credencial.** Não há usuário+senha. O cliente manda
`Authorization: Bearer <token>`, e o servidor procura **um perfil cujo `token` bate**. Achou =
autenticado como aquele perfil; não achou = `null` → `401`. O token funciona como uma senha de
uso único e longa (por isso o `sync.js` avisa "vale como uma senha"). É o esquema de auth mais
simples que existe, adequado a um app pessoal.

**Conceito — *prepared statement* e o `?` (a defesa contra SQL injection).** Repare que o
token **nunca** é concatenado na string SQL. A consulta tem um **placeholder** `?`, e
`.bind(token)` passa o valor **separadamente**. O banco trata o `?` como **dado puro**, nunca
como código SQL. Isto é o que **impede SQL injection**: se um token malicioso fosse `' OR
'1'='1`, concatenado ele viraria um SQL que retorna qualquer perfil; via `bind`, ele é só uma
string que **não casa** com token nenhum. **Regra de ouro de todo acesso a banco: nunca
construa SQL concatenando entrada; sempre parametrize.** É a versão-banco da "barreira de
dados" do projeto (entrada externa é dado, nunca comando).

**`.first()`** devolve a primeira linha (ou `null`). O `try/catch` no `JSON.parse(p.meta)`
tolera um `meta` corrompido sem derrubar a auth — o D1 guarda o `meta` como **texto**, então
ele é parseado na saída.

---

## §3 — `GET /state`: ler todas as seções

```js
export async function onRequestGet(context) {
  const prof = await auth(context);
  if (!prof) return json({ error: "sem token válido" }, 401);
  const rows = await context.env.DB.prepare(
    "SELECT section, data, updated_at FROM states WHERE profile_id = ?"
  ).bind(prof.id).all();
  const sections = {};
  for (const r of (rows.results || []))
    sections[r.section] = { data: JSON.parse(r.data), updated_at: r.updated_at };
  return json({ profile: prof, sections });
}
```

Autentica, busca **todas as linhas** da tabela `states` daquele perfil (`.all()` → várias
linhas em `rows.results`) e monta o objeto `{ section: { data, updated_at } }` que o
`sync.js` (§5 de lá) consome no `applyRemote`. **`JSON.parse(r.data)`** de novo na fronteira:
o D1 guarda cada seção como **string JSON** numa coluna, e o servidor a reidrata para
objeto. **Conceito — o banco relacional guarda blobs JSON.** Em vez de modelar cada campo do
estado em colunas SQL (rígido, muitas tabelas), o design guarda cada **seção** como um
documento JSON numa linha `(profile_id, section, data, updated_at)`. É um **modelo
híbrido**: SQL para indexar/versionar por seção, JSON para o conteúdo flexível. Pragmático
para um estado que evolui.

---

## §4 — `PUT /state`: o last-write-wins **no servidor**

```js
export async function onRequestPut(context) {
  const prof = await auth(context);
  if (!prof) return json({ error: "sem token válido" }, 401);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "json inválido" }, 400); }
  const incoming = body && body.sections;
  if (!incoming || typeof incoming !== "object") return json({ error: "sections ausente" }, 400);
  …
  const cur = {};  // ts atual de cada seção no banco
  for (const r of (rows.results || [])) cur[r.section] = r.updated_at;

  const now = Date.now();
  for (const [section, sv] of Object.entries(incoming)) {
    if (!sv || typeof sv !== "object" || sv.data === undefined) continue;   // validação de entrada
    const ts = Number(sv.updated_at) || now;
    if (cur[section] !== undefined && ts <= cur[section]) continue;         // banco é mais novo → mantém
    await context.env.DB.prepare(
      "INSERT INTO states (profile_id, section, data, updated_at) VALUES (?,?,?,?) " +
      "ON CONFLICT(profile_id, section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
    ).bind(prof.id, section, JSON.stringify(sv.data), ts).run();
    context.waitUntil(context.env.DB.prepare(
      "INSERT INTO sync_events (profile_id, section, updated_at, device, ts) VALUES (?,?,?,?,?)"
    ).bind(prof.id, section, ts, device, now).run());
  }
  return onRequestGet(context);   // devolve o estado mesclado
}
```

**Conceito — o mesmo LWW por seção, agora no servidor.** Este é o **espelho** da lógica do
`sync.js`: para cada seção recebida, o servidor só grava **se o `updated_at` de entrada for
maior** que o guardado (`ts <= cur[section]` → pula). Ter a **mesma regra dos dois lados** é o
que garante **convergência** — não importa quem sobe primeiro, o de timestamp maior sempre
vence, em qualquer ordem. É por isso que reenviar é inofensivo (o cliente pode reenviar à
vontade; o servidor ignora o que é mais velho).

**Conceito — UPSERT (`INSERT … ON CONFLICT … DO UPDATE`).** Uma única instrução que **insere
se não existe, atualiza se existe**. A `PRIMARY KEY (profile_id, section)` detecta o conflito;
`excluded.*` é uma pseudo-tabela do SQLite que se refere aos **valores que você tentou
inserir** — então `SET data=excluded.data` diz "use o data novo". Sem UPSERT, você faria um
`SELECT` para ver se existe e um `INSERT`-ou-`UPDATE` conforme — duas idas ao banco e uma
condição de corrida entre elas. O UPSERT é **atômico** e uma viagem só.

**Conceito — `waitUntil`: trabalho em segundo plano sem segurar a resposta.** O registro no
log `sync_events` (auditoria: quem sincronizou o quê, de qual aparelho) **não** precisa
terminar antes de responder ao cliente. `context.waitUntil(promise)` diz à plataforma "mantenha
a função viva até esta promessa acabar, mas **pode responder já**". O usuário não espera o log;
o log acontece "depois". É o padrão *fire-and-forget* para efeitos colaterais não-críticos —
melhora a latência percebida sem perder o registro.

**Validação de entrada** (`if (!sv || … || sv.data === undefined) continue`) e o `try/catch`
no `request.json()` (→ `400`) tratam corpo malformado sem quebrar. **Nunca confie no corpo da
requisição** — mesma disciplina da barreira de dados, agora na porta do servidor. O `PUT`
termina **chamando `onRequestGet`** para devolver o estado já mesclado (reaproveita a leitura —
DRY).

---

## §5 — `admin.js`: controle de acesso por papel e a fronteira de privilégio

```js
async function requireAdmin(context) {
  const token = …;
  const p = await context.env.DB.prepare("SELECT id, nome, role FROM profiles WHERE token = ?").bind(token).first();
  return (p && p.role === "admin") ? p : null;
}
export async function onRequestGet(context) {
  const adm = await requireAdmin(context);
  if (!adm) return json({ error: "acesso restrito a admin" }, 403);
  …
}
```

**Conceito — RBAC (Role-Based Access Control).** `admin.js` é o backend do editor com que o
Alex ajusta a dedicatória/mensagens do painel-presente da namorada. Toda rota começa por
`requireAdmin`, que exige não só um token válido, mas um perfil com **`role === "admin"`**.
Sem isso → **`403` Forbidden** (diferente de `401` Unauthorized: 401 = "não sei quem é você";
403 = "sei quem é, mas não pode"). Restringir operações sensíveis a um papel é o alicerce de
autorização em qualquer sistema multiusuário.

**Conceito — princípio do menor privilégio (a fronteira que o comentário grita):**

```js
//  NUNCA escreve o progresso de estudo dela (topics/sessions/...); só meta + curso.
```

Mesmo sendo admin, o `PUT /admin` só grava **`meta`** (dedicatória/mensagens) e a seção
**`curso`** — **jamais** o progresso de estudo (tópicos, sessões, redações) da pessoa. O admin
tem poder para **personalizar o presente**, não para **adulterar os estudos** dela. Essa
**limitação deliberada de escopo** é o *princípio do menor privilégio*: conceda só o poder
necessário à tarefa, nada além. É uma decisão de design **e** de respeito — codificada na
ausência de qualquer `UPDATE` no progresso.

O `curso` é gravado como uma **seção da state dela** com `updated_at = now`, para que o
**aparelho dela puxe a mudança no próximo sync** (via o mesmo LWW do §4) — o admin escreve no
banco central, e a sincronização normal entrega ao dispositivo. Os dois endpoints conversam
pelo mesmo modelo de dados.

**`new URL(context.request.url).searchParams.get("target")`** lê o `?target=ID` da query —
qual perfil editar. Parsear a URL com o objeto `URL` (em vez de regex) é o jeito correto e
seguro de pegar parâmetros.

---

## §6 — O quadro completo: cliente ↔ servidor

Vale fixar como as duas metades se encaixam (você agora conhece as duas):

```
  painel/sync.js  (navegador, verdade LOCAL)          functions/api/  (Cloudflare, verdade CENTRAL)
  ─────────────────────────────────────────          ───────────────────────────────────────────
  onSaved → diff por seção → ts por seção             GET /state  → lê states do perfil (por token)
  push  ──(PUT /state, Bearer token)────────────────▶ PUT /state  → grava só seção com ts maior (LWW)
  applyRemote ◀──(estado mesclado)──────────────────  devolve o estado mesclado
        merge por id + só-mais-novo-vence                    upsert atômico + log em waitUntil
```

**A regra que faz tudo convergir:** *last-write-wins por seção, aplicado identicamente dos dois
lados*. O cliente decide o que subir; o servidor decide o que aceitar; ambos usam "timestamp
maior vence". Some a isso o merge-por-id (que não perde itens de aparelhos distintos) e você
tem um sistema de sincronização **simples, sem fila persistente e convergente** — o mesmo que
apps comerciais gastam muito código para obter.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Serverless / functions-as-handlers | §0 | exporta `onRequestGet/Put`; a plataforma chama e escala |
| Roteamento por arquivo | §0 | `functions/api/state.js` = rota `/api/state` |
| `context` (request/env/waitUntil) | §0 | requisição + bindings (D1) + trabalho em 2º plano |
| CORS + preflight `OPTIONS` | §1 | autorizar a chamada cross-origin; `Origin:*` seguro com token |
| Bearer token = credencial | §2 | o token casa com `profiles.token`; sem usuário/senha |
| Prepared statement / `bind(?)` | §2 | dado separado do SQL → **impede SQL injection** |
| Blob JSON em coluna SQL | §3,§4 | híbrido: SQL versiona a seção, JSON guarda o conteúdo |
| LWW por seção no servidor | §4 | grava só se `ts` de entrada > guardado (espelha o cliente) |
| UPSERT (`ON CONFLICT DO UPDATE`) | §4 | inserir-ou-atualizar atômico; `excluded.*` = valores novos |
| `waitUntil` (fire-and-forget) | §4 | logar em 2º plano sem atrasar a resposta |
| Validar o corpo da requisição | §2,§4 | `400`/`401` para entrada malformada; nunca confiar no cliente |
| RBAC (`role === "admin"`) | §5 | `403` para quem não é admin; 401 ≠ 403 |
| Princípio do menor privilégio | §5 | admin edita só meta+curso, **nunca** o progresso de estudo |
| `URL`/`searchParams` | §5 | ler `?target=` corretamente, sem regex |
| Convergência por LWW dos dois lados | §6 | a mesma regra no cliente e no servidor = estado convergente |

---

**Próximo no roteiro:** [`sw.explicado.md`](sw.explicado.md) — **Etapa 6**. Voltamos ao
navegador para o **service worker**: as estratégias de cache que fazem o painel **funcionar
offline**, o ciclo de vida (install/activate/fetch) e o versionamento do cache (`CACHE_V`).
