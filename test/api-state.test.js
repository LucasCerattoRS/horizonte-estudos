const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const fonte = fs.readFileSync(path.join(__dirname, "../functions/api/state.js"), "utf8");
const api = import("data:text/javascript;base64," + Buffer.from(fonte).toString("base64"));

// Adaptador D1 mínimo; as consultas e restrições são executadas pelo SQLite real.
function contexto(db, sections, antesDeGravar = async () => {}) {
  const pendentes = [];
  return {
    request: new Request("https://teste.invalid/api/state", {
      method: "PUT", headers: { Authorization: "Bearer teste" },
      body: JSON.stringify({ sections }),
    }),
    waitUntil: p => pendentes.push(p),
    pendentes,
    env: { DB: { prepare(sql) {
      let args = [];
      return {
        bind(...valores) { args = valores; return this; },
        async first() { return db.prepare(sql).get(...args); },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() {
          if (sql.startsWith("INSERT INTO states")) await antesDeGravar();
          const r = db.prepare(sql).run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
      };
    } } },
  };
}

test("state: gravação antiga concorrente não sobrescreve versão mais nova", async t => {
  const { onRequestPut } = await api;
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, "../infra/schema.sql"), "utf8"));
  db.exec("INSERT INTO profiles (id, nome, token, created) VALUES ('p', 'Teste', 'teste', 0)");
  let chegou, liberar;
  const gravando = new Promise(r => { chegou = r; });
  const pausa = new Promise(r => { liberar = r; });
  const antiga = contexto(db, { topics: { data: { status: 1 }, updated_at: 100 } }, async () => { chegou(); await pausa; });
  const nova = contexto(db, { topics: { data: { status: 2 }, updated_at: 200 } });
  const primeira = onRequestPut(antiga);
  await gravando; // ambas leem o banco vazio; a antiga termina a gravação por último
  try { assert.equal((await onRequestPut(nova)).status, 200); }
  finally { liberar(); }
  assert.equal((await primeira).status, 200);
  await Promise.all([...antiga.pendentes, ...nova.pendentes]);
  assert.equal(db.prepare("SELECT updated_at FROM states").get().updated_at, 200);
  assert.deepEqual(JSON.parse(db.prepare("SELECT data FROM states").get().data), { status: 2 });
  assert.equal(db.prepare("SELECT count(*) AS n FROM sync_events").get().n, 1);
});

test("state: timestamps inválidos são rejeitados sem gravação parcial", async t => {
  const { onRequestPut } = await api;
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, "../infra/schema.sql"), "utf8"));
  db.exec("INSERT INTO profiles (id, nome, token, created) VALUES ('p', 'Teste', 'teste', 0)");
  for (const updated_at of [0, 9007199254740991, Date.now() + 3600000, "Infinity", "-Infinity", -1, "NaN", {}, null, 1.5, "1e100", { valueOf: null, toString: null }]) {
    const ctx = contexto(db, {
      topics: { data: { status: 1 }, updated_at: 100 },
      sessions: { data: [], updated_at },
    });
    const resposta = await onRequestPut(ctx);
    await Promise.all(ctx.pendentes);
    assert.equal(resposta.status, 400, JSON.stringify(updated_at));
    assert.equal(db.prepare("SELECT count(*) AS n FROM states").get().n, 0);
  }
});
