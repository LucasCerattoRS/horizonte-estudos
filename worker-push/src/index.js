// worker-push/src/index.js — dispara os avisos de revisão SM-2 vencida, 1x/dia (Cron Trigger).
// Não tem rota HTTP real: o fetch() é só o handler mínimo que o `wrangler deploy` exige.
// Quem faz o trabalho é scheduled(), chamado pelo Cron configurado em wrangler.toml.
// Lê o MESMO D1 do backend principal (functions/, ver painel/sync.js): a seção "topics"
// de cada perfil inscrito (tabela subscriptions) é o mesmo JSON que o SM-2 do painel
// escreve (painel/app-plano.js, reviewCard/tRec). Ver docs/ATIVAR-PUSH.md.

import { buildPushHTTPRequest } from "@pushforge/builder";

// mesmo throttle que o "1x/dia" promete ao usuário: mesmo que o Cron dispare 2x (retry,
// horário de verão, etc.), uma assinatura já avisada nas últimas ~20h não repete.
const THROTTLE_MS = 20 * 60 * 60 * 1000;

// Réplica MÍNIMA do critério de dueCards() em painel/app-plano.js — não dá pra importar
// o app.js real aqui (ele depende de globais de navegador: $, el, S...). Se o critério de
// "vencido" mudar lá, replicar aqui também.
function contarVencidas(topicsJSON) {
  let topics;
  try { topics = JSON.parse(topicsJSON); } catch { return 0; }
  if (!topics || typeof topics !== "object") return 0;
  const now = Date.now();
  let n = 0;
  for (const id in topics) {
    const srs = topics[id] && topics[id].srs;
    if (srs && typeof srs.due === "number" && srs.due <= now) n++;
  }
  return n;
}

async function enviarUm(env, sub, n) {
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    message: {
      payload: {
        title: n === 1 ? "1 revisão pendente" : `${n} revisões pendentes`,
        body: "Sua fila de repetição espaçada está esperando — reveja antes de esquecer.",
        url: "./#revisao",
      },
      adminContact: "mailto:" + (env.VAPID_CONTACT || "no-reply@horizonte.invalid"),
      options: { urgency: "normal", ttl: 12 * 60 * 60 },
    },
  });
  return fetch(endpoint, { method: "POST", headers, body });
}

async function rodar(env) {
  if (!env.VAPID_PRIVATE_KEY) { console.error("VAPID_PRIVATE_KEY ausente — ver docs/ATIVAR-PUSH.md"); return; }
  const now = Date.now();
  const rows = await env.DB.prepare(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth, s.last_sent, st.data
     FROM subscriptions s
     JOIN states st ON st.profile_id = s.profile_id AND st.section = 'topics'`
  ).all();

  let avisados = 0, ignorados = 0, expirados = 0, erros = 0;
  for (const sub of (rows.results || [])) {
    if (sub.last_sent && (now - sub.last_sent) < THROTTLE_MS) { ignorados++; continue; }
    const n = contarVencidas(sub.data);
    if (n === 0) { ignorados++; continue; }
    try {
      const res = await enviarUm(env, sub, n);
      if (res.status === 201) {
        await env.DB.prepare("UPDATE subscriptions SET last_sent = ? WHERE id = ?").bind(now, sub.id).run();
        avisados++;
      } else if (res.status === 404 || res.status === 410) {
        // assinatura expirada/revogada no navegador — limpeza padrão do protocolo Web Push
        await env.DB.prepare("DELETE FROM subscriptions WHERE id = ?").bind(sub.id).run();
        expirados++;
      } else {
        console.warn("push falhou", sub.id, res.status, await res.text().catch(() => ""));
        erros++;
      }
    } catch (e) {
      console.error("push erro", sub.id, e);
      erros++;
    }
  }
  console.log(`worker-push: ${avisados} avisados, ${ignorados} sem novidade/throttle, ${expirados} expiradas removidas, ${erros} erros`);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(rodar(env));
  },
  async fetch() {
    return new Response("horizonte-push: sem rota HTTP — roda por Cron Trigger (ver scheduled()).", { status: 200 });
  },
};
