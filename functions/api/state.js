// functions/api/state.js — Pages Function do backend V2 (endpoint /api/state).
// Binding D1 esperado: env.DB (configurar no dashboard do projeto Pages OU wrangler.toml).
// Auth: header "Authorization: Bearer <token>" casado com profiles.token.
// GET  /api/state         -> { profile, sections: { <section>: { data, updated_at } } }
// PUT  /api/state  body:  { sections: { <section>: { data, updated_at } }, device? }
//        -> upsert por seção só quando incoming.updated_at > stored.updated_at; devolve o estado mesclado.
// Offline-first: o cliente (painel/sync.js) é a verdade local; isto é a verdade central.
// Ver PLANO-V2.md (passo 0.4).

const CORS = {
  "Access-Control-Allow-Origin": "*",              // inclui file:// (Origin null) — leitura por token
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
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
  const p = await context.env.DB.prepare(
    "SELECT id, nome, role, meta FROM profiles WHERE token = ?"
  ).bind(token).first();
  if (p && p.meta) { try { p.meta = JSON.parse(p.meta); } catch { p.meta = null; } }  // V2.1: perfil (dedicatória/mensagens) vem do D1
  return p || null;
}

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

export async function onRequestPut(context) {
  const prof = await auth(context);
  if (!prof) return json({ error: "sem token válido" }, 401);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "json inválido" }, 400); }
  const incoming = body && body.sections;
  if (!incoming || typeof incoming !== "object") return json({ error: "sections ausente" }, 400);
  const device = (body.device || "").toString().slice(0, 60);

  // estado atual (p/ decidir last-write-wins por seção)
  const cur = {};
  const rows = await context.env.DB.prepare(
    "SELECT section, updated_at FROM states WHERE profile_id = ?"
  ).bind(prof.id).all();
  for (const r of (rows.results || [])) cur[r.section] = r.updated_at;

  const now = Date.now();
  for (const [section, sv] of Object.entries(incoming)) {
    if (!sv || typeof sv !== "object" || sv.data === undefined) continue;
    const ts = Number(sv.updated_at) || now;
    if (cur[section] !== undefined && ts <= cur[section]) continue; // a versão do banco é mais nova → mantém
    await context.env.DB.prepare(
      "INSERT INTO states (profile_id, section, data, updated_at) VALUES (?,?,?,?) " +
      "ON CONFLICT(profile_id, section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
    ).bind(prof.id, section, JSON.stringify(sv.data), ts).run();
    context.waitUntil(context.env.DB.prepare(
      "INSERT INTO sync_events (profile_id, section, updated_at, device, ts) VALUES (?,?,?,?,?)"
    ).bind(prof.id, section, ts, device, now).run());
  }
  // devolve o estado mesclado (o cliente aplica o que for mais novo que o dele)
  return onRequestGet(context);
}
