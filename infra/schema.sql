-- schema.sql — D1 (SQLite) do backend V2 do Horizonte.
-- Aplicar:  wrangler d1 execute horizonte-db --remote --file=infra/schema.sql
-- Ver PLANO-V2.md (passos 0.1–0.3).

-- Perfis + auth por token (sem sistema de contas; token longo colado 1× no navegador).
CREATE TABLE IF NOT EXISTS profiles (
  id       TEXT PRIMARY KEY,          -- 'alex', 'bia', ...
  nome     TEXT,
  token    TEXT UNIQUE NOT NULL,      -- openssl rand -hex 24
  role     TEXT NOT NULL DEFAULT 'user',  -- 'admin' = Alex (edição remota, V2.2)
  created  INTEGER NOT NULL,
  meta     TEXT                       -- V2.1: JSON do perfil-presente (dedicatória, mensagens/pools, curso...). NULL p/ quem não tem kit.
);
-- Banco já existente (criado antes da V2.1): adicionar a coluna com
--   wrangler d1 execute horizonte-db --remote --command "ALTER TABLE profiles ADD COLUMN meta TEXT"

-- Estado por SEÇÃO (topics, sessions, simulados, redacoes, questions, rascunhos,
-- chat, bancoResp, curso, ...). Merge é por seção: vence o updated_at maior.
CREATE TABLE IF NOT EXISTS states (
  profile_id  TEXT NOT NULL,
  section     TEXT NOT NULL,
  data        TEXT NOT NULL,          -- JSON da seção
  updated_at  INTEGER NOT NULL,       -- epoch ms; last-write-wins por seção
  PRIMARY KEY (profile_id, section),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

-- Auditoria de sync (permite recuperar de conflito raro; opcional mas barato).
CREATE TABLE IF NOT EXISTS sync_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  TEXT NOT NULL,
  section     TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  device      TEXT,
  ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_states_profile ON states(profile_id);
CREATE INDEX IF NOT EXISTS idx_events_profile ON sync_events(profile_id, ts);

-- Push de revisão (SM-2 avisa quando vence — ver painel/push.js + functions/api/push.js
-- + worker-push/). Uma linha por assinatura de navegador (1 perfil pode ter várias:
-- celular + PC); a chave de verdade é o endpoint (o pushManager já garante 1 por
-- combinação navegador+origem). last_sent throttla o worker-push a no máx. 1 push/dia
-- por assinatura mesmo que o Cron dispare 2x (idempotência, ver worker-push/src/index.js).
CREATE TABLE IF NOT EXISTS subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created     INTEGER NOT NULL,
  last_sent   INTEGER,             -- epoch ms do último push OK; NULL = nunca mandou
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);
-- Banco já existente (criado antes desta tabela): re-rodar o schema inteiro é seguro
-- (todo CREATE é IF NOT EXISTS — só a tabela/índice novos são de fato criados):
--   wrangler d1 execute horizonte-db --remote --file=infra/schema.sql
CREATE INDEX IF NOT EXISTS idx_subs_profile ON subscriptions(profile_id);
