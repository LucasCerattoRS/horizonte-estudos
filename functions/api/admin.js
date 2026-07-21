// functions/api/admin.js — edição remota de perfis (V2.2). SOMENTE role=admin.
// Auth: header "Authorization: Bearer <token>"; o token TEM de ser de um perfil role='admin'.
// GET  /api/admin              -> { profiles: [{id,nome,role,hasMeta,progress:{sections,last}}] }
// GET  /api/admin?target=ID    -> { profile:{id,nome,role,meta}, sections:{...} }  (lê perfil-presente + progresso)
// PUT  /api/admin?target=ID    body { meta?:{...}, curso?:"..." }
//        -> grava profiles.meta (a dedicatória/mensagens da pessoa) e/ou a seção 'curso' da state dela.
//        NUNCA escreve o progresso de estudo dela (topics/sessions/...); só meta + curso.
// Ver PLANO-V2.md (V2.1 + V2.2). O cliente (painel/sync.js) usa isto no editor admin do Alex.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// devolve o perfil admin, ou null se o token não for de um admin
async function requireAdmin(context) {
  const h = context.request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const p = await context.env.DB.prepare(
    "SELECT id, nome, role FROM profiles WHERE token = ?"
  ).bind(token).first();
  return (p && p.role === "admin") ? p : null;
}

function parseMeta(row) {
  if (row && row.meta) { try { row.meta = JSON.parse(row.meta); } catch { row.meta = null; } }
  return row;
}

export async function onRequestGet(context) {
  const adm = await requireAdmin(context);
  if (!adm) return json({ error: "acesso restrito a admin" }, 403);
  const url = new URL(context.request.url);
  const target = (url.searchParams.get("target") || "").trim();

  if (!target) {
    // lista os perfis com um resumo de progresso (p/ o Alex escolher quem editar)
    const rows = await context.env.DB.prepare(
      "SELECT id, nome, role, (meta IS NOT NULL) AS has_meta FROM profiles ORDER BY id"
    ).all();
    const prog = await context.env.DB.prepare(
      "SELECT profile_id, count(*) AS n, max(updated_at) AS last FROM states GROUP BY profile_id"
    ).all();
    const pm = {};
    for (const r of (prog.results || [])) pm[r.profile_id] = { sections: r.n, last: r.last };
    return json({
      profiles: (rows.results || []).map(r => ({
        id: r.id, nome: r.nome, role: r.role, hasMeta: !!r.has_meta,
        progress: pm[r.id] || { sections: 0, last: 0 },
      })),
    });
  }

  const prof = parseMeta(await context.env.DB.prepare(
    "SELECT id, nome, role, meta FROM profiles WHERE id = ?"
  ).bind(target).first());
  if (!prof) return json({ error: "perfil inexistente" }, 404);
  const rows = await context.env.DB.prepare(
    "SELECT section, data, updated_at FROM states WHERE profile_id = ?"
  ).bind(target).all();
  const sections = {};
  for (const r of (rows.results || [])) sections[r.section] = { data: JSON.parse(r.data), updated_at: r.updated_at };
  return json({ profile: prof, sections });
}

export async function onRequestPut(context) {
  const adm = await requireAdmin(context);
  if (!adm) return json({ error: "acesso restrito a admin" }, 403);
  const url = new URL(context.request.url);
  const target = (url.searchParams.get("target") || "").trim();
  if (!target) return json({ error: "target ausente" }, 400);
  const exists = await context.env.DB.prepare("SELECT id FROM profiles WHERE id = ?").bind(target).first();
  if (!exists) return json({ error: "perfil inexistente" }, 404);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: "json inválido" }, 400); }

  if (body.meta !== undefined) {
    await context.env.DB.prepare("UPDATE profiles SET meta = ? WHERE id = ?")
      .bind(JSON.stringify(body.meta), target).run();
  }
  // curso é uma SEÇÃO da state dela: gravo com ts novo p/ o aparelho dela puxar no próximo sync.
  if (typeof body.curso === "string" && body.curso) {
    const now = Date.now();
    await context.env.DB.prepare(
      "INSERT INTO states (profile_id, section, data, updated_at) VALUES (?,?,?,?) " +
      "ON CONFLICT(profile_id, section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
    ).bind(target, "curso", JSON.stringify(body.curso), now).run();
    context.waitUntil(context.env.DB.prepare(
      "INSERT INTO sync_events (profile_id, section, updated_at, device, ts) VALUES (?,?,?,?,?)"
    ).bind(target, "curso", now, "admin:" + adm.id, now).run());
  }

  const p2 = parseMeta(await context.env.DB.prepare(
    "SELECT id, nome, role, meta FROM profiles WHERE id = ?"
  ).bind(target).first());
  return json({ ok: true, profile: p2 });
}
