# 🔔 Ativar o push de revisão (SM-2 avisa quando vence)

Todo o código está pronto e commitado. Faltam **passos manuais que só você pode rodar**
(login no Cloudflare, segredos) — nada disso pode ser feito por mim. Siga na ordem.

## Por que existe um `worker-push/` separado do `functions/`?

**Cloudflare Pages Functions não suporta Cron Triggers** (é recurso só de Workers "puros",
confirmado antes de construir isto). O aviso diário precisa de algo que acorde sozinho
1×/dia — então é um **segundo projeto Cloudflare** (`worker-push/`), lendo o **mesmo banco
D1** (`horizonte-db`, mesmo `database_id`) via binding próprio. O site principal
(`painel-horizonte`, via `functions/`) não muda de forma nenhuma nisso.

## Passo 1 — Gerar as chaves VAPID

```bash
npx @pushforge/builder vapid
```

Isso imprime duas coisas — **guarde as duas, não vão pro Git**:
- **Public Key** (uma linha tipo `BMy2-...`) — não é segredo, mas também não precisa estar
  em lugar nenhum além do passo 2.
- **Private Key (JWK)** (um JSON `{"kty":"EC",...}`) — este SIM é segredo. Nunca cole em
  arquivo commitado; só vai para o `wrangler secret put` do passo 4.

## Passo 2 — Colar a chave pública no cliente

Abra `painel/push.js`, ache a linha:
```js
const VAPID_PUBLIC_KEY = "COLE_AQUI_A_CHAVE_PUBLICA_VAPID";
```
Troque pelo valor do passo 1. Só isso — é a única edição de código que falta. Comitar
normalmente (a chave pública não é segredo, pode ir pro Git).

## Passo 3 — Aplicar a migração no D1 (tabela `subscriptions`)

```bash
wrangler d1 execute horizonte-db --remote --file=infra/schema.sql
```
Seguro re-rodar o schema inteiro: todo `CREATE` é `IF NOT EXISTS` — só a tabela
`subscriptions` (e seu índice) são de fato criados; o resto já existe e é ignorado.

## Passo 4 — Configurar o segredo e o D1 do worker

De dentro de `worker-push/`:
```bash
cd worker-push
npm install                          # baixa @pushforge/builder (zero deps transitivas)
wrangler secret put VAPID_PRIVATE_KEY
# cole o JSON da "Private Key (JWK)" do passo 1 quando pedir, Enter, pronto.
```
(Opcional) definir o contato do JWT VAPID — não te avisa nada, é só o campo padrão do
protocolo Web Push:
```bash
wrangler secret put VAPID_CONTACT   # ex.: seu-email@gmail.com
```

## Passo 5 — Deploy do worker

```bash
cd worker-push
wrangler deploy
```
Isso cria o projeto **`horizonte-push`** no seu Cloudflare (separado do
`painel-horizonte`) e registra o Cron Trigger (`0 12 * * *` = 09:00 em Brasília — mude em
`worker-push/wrangler.toml` se quiser outro horário, `[triggers] crons = [...]`).

## Passo 6 — Deploy do site principal (como sempre)

Nada mudou no fluxo — `setup/deploy-pages.sh` já copia `functions/` e `painel/` inteiros,
então `functions/api/push.js` e `painel/push.js` sobem juntos:
```bash
setup/deploy-pages.sh painel-horizonte --branch main
```

## Passo 7 — Testar de ponta a ponta

1. Abra o site (instalado como PWA, se for testar no iOS — **obrigatório lá**, senão a
   permissão é negada em silêncio).
2. Vá em **Cronograma** → clique **"🔔 Avise-me quando vencer"** → aceite a permissão do
   navegador. O botão deve virar **"🔔 Avisos ativados"**.
3. Confira que a assinatura chegou no banco:
   ```bash
   wrangler d1 execute horizonte-db --remote --command "SELECT profile_id, created FROM subscriptions"
   ```
4. Force um teste sem esperar o Cron — no dashboard do Cloudflare, projeto
   `horizonte-push` → **Triggers → Cron Triggers → Trigger manually** (ou
   `wrangler deployments` + o botão "Run" na aba Cron do dashboard). Se você tiver algum
   tópico com revisão vencida (`srs.due <= agora`), a notificação deve chegar em segundos.
5. Clique na notificação → deve abrir/focar o painel direto na aba **Cronograma**.

## Notas e limites conhecidos

- **iOS:** só funciona com o app instalado na Tela de Início (Compartilhar → Adicionar à
  Tela de Início) — Safari não entrega push a abas comuns.
- **Throttle:** no máx. 1 aviso a cada ~20h por assinatura (`worker-push/src/index.js`),
  mesmo que o Cron dispare mais de uma vez no dia.
- **Assinatura expirada/revogada** (o navegador ou o usuário desinstalou/limpou dados): o
  worker detecta pela resposta 404/410 do serviço de push e apaga a linha sozinho — sem
  ação manual.
- **Custo:** Cron Triggers e D1 estão dentro do free tier da Cloudflare para o volume de
  uso pessoal deste projeto (1 execução/dia, poucas linhas na tabela).
- **Desativar:** botão vira "🔔 Avisos ativados" → clique de novo para desligar
  (`Push.unsubscribe()`, remove local + `/api/push` DELETE).
