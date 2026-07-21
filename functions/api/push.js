// functions/api/push.js — registro de assinaturas de push (Pages Function, mesmo padrão de state.js).
// Auth: header "Authorization: Bearer <token>" (o mesmo token do sync — profiles.token).
// POST   /api/push   body { endpoint, keys:{p256dh,auth} }  -> upsert em subscriptions
// DELETE /api/push   body { endpoint }                       -> remove a assinatura
// Quem MANDA os pushes de verdade é o worker-push/ (Cron Trigger 1x/dia) — este
// endpoint só guarda "quem quer ser avisado" no D1. Ver painel/push.js e docs/ATIVAR-PUSH.md.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function auth(context) {
  const h = context.request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  return await context.env.DB.prepare("SELECT id FROM profiles WHERE token = ?").bind(token).first();
}

export async function onRequestPost(context) {
  const prof = await auth(context);
  if (!prof) return json({ error: "sem token válido" }, 401);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "json inválido" }, 400); }
  const endpoint = (body && body.endpoint || "").toString();
  const keys = body && body.keys;
  if (!endpoint || !/^https:\/\//.test(endpoint) || !keys || !keys.p256dh || !keys.auth)
    return json({ error: "assinatura incompleta (endpoint/keys.p256dh/keys.auth)" }, 400);

  await context.env.DB.prepare(
    "INSERT INTO subscriptions (profile_id, endpoint, p256dh, auth, created) VALUES (?,?,?,?,?) " +
    "ON CONFLICT(endpoint) DO UPDATE SET profile_id=excluded.profile_id, p256dh=excluded.p256dh, auth=excluded.auth"
  ).bind(prof.id, endpoint, String(keys.p256dh), String(keys.auth), Date.now()).run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const prof = await auth(context);
  if (!prof) return json({ error: "sem token válido" }, 401);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const endpoint = (body && body.endpoint || "").toString();
  if (!endpoint) return json({ error: "endpoint ausente" }, 400);

  // só apaga se a assinatura for do PRÓPRIO perfil (token não vira licença pra apagar a de outro)
  await context.env.DB.prepare("DELETE FROM subscriptions WHERE endpoint = ? AND profile_id = ?")
    .bind(endpoint, prof.id).run();

  return json({ ok: true });
}
