// Sync.pull → applyRemote → mergeSecao: o estado remoto tem de passar pela MESMA sanitização
// do localStorage (normalizaEstado). Antes, sessions:null / curso inexistente / min "30" do
// servidor entravam crus em S e quebravam a tela. Carrega estado.js + sync.js num vm com stubs.
const test = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const PAINEL = path.join(__dirname, "..", "painel");
const PADRAO = { version: 1, curso: "geral", topics: {}, sessions: [], questions: [], simulados: [], redacoes: [], rascunhos: {}, chat: [], bancoResp: {}, trilha: { semana: 1 } };

function ambiente(estadoLocal) {
  const ls = new Map();
  const localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
  const noop = () => {};
  const ctx = {
    console, structuredClone, setTimeout: noop, clearTimeout: noop, addEventListener: noop, JSON, Map, Object, Array, Number, String, Math, Date, Promise,
    localStorage, navigator: { userAgent: "node" },
    location: { protocol: "http:", hash: "", pathname: "/", search: "", origin: "http://x" },
    history: { replaceState: noop },
    document: { readyState: "complete", querySelector: () => null, getElementById: () => null, addEventListener: noop },
    resposta: null,
    fetch: async () => ({ ok: true, status: 200, json: async () => ctx.resposta }),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PAINEL, "estado.js"), "utf8"), ctx);
  vm.runInContext(`const DEFAULT_STATE = ${JSON.stringify(PADRAO)}; const CURSOS = { geral: {}, cic: {} };
    let S = normalizaEstado(${JSON.stringify(estadoLocal)}, DEFAULT_STATE, CURSOS);
    let salvos = 0; function save() { salvos++; if (window.Sync && Sync.onSaved) Sync.onSaved(); }`, ctx);
  vm.runInContext(fs.readFileSync(path.join(PAINEL, "sync.js"), "utf8"), ctx);
  localStorage.setItem("painelUFRGS_token", "tok");
  return {
    async pull(sections) { ctx.resposta = { profile: { id: "p", nome: "P" }, sections }; return vm.runInContext("Sync.pull()", ctx); },
    S: () => JSON.parse(vm.runInContext("JSON.stringify(S)", ctx)),
    run: fonte => vm.runInContext(fonte, ctx),
    setFetch: f => { ctx.fetch = f; },
    storage: localStorage,
  };
}
const sec = (data, ts = 1e13) => ({ data, updated_at: ts });

test("pull: seções remotas ruins são sanitizadas como as do localStorage", async () => {
  const amb = ambiente({ sessions: [{ date: "2026-10-01", min: 20 }] });
  await amb.pull({
    sessions: sec([{ date: "2026-10-09", min: "30" }, { date: "2026-10-09", min: null }, null, { date: 5, min: 3 }]),
    topics: sec("lixo"), questions: sec(null), bancoResp: sec([1]), curso: sec("zzz"),
  });
  const S = amb.S();
  assert.deepStrictEqual(S.sessions, [{ date: "2026-10-09", min: 30 }, { date: "2026-10-09", min: 0 }]);
  assert.deepStrictEqual([S.topics, S.questions, S.bancoResp, S.curso], [{}, [], {}, "geral"]);
});

for (const operacao of ["pull", "push"]) {
  test(`${operacao}: resposta pendente após logout não altera estado nem perfil`, async () => {
    const amb = ambiente({ topics: { local: { status: 1 } } });
    let responder;
    amb.setFetch(() => new Promise(r => { responder = r; }));
    const pendente = amb.run(`Sync.${operacao}()`);
    amb.run("Sync.logout()");
    responder({ ok: true, json: async () => ({ profile: { id: "antigo", nome: "Teste" }, sections: { topics: sec({ remoto: { status: 2 } }) } }) });
    await pendente;
    assert.deepStrictEqual(amb.S().topics, { local: { status: 1 } });
    assert.strictEqual(amb.run("Sync.profile"), null);
    assert.strictEqual(amb.storage.getItem("painelUFRGS_ts"), null);
  });
}

test("pull: estados remotos válidos (vários perfis) entram intactos", async () => {
  const perfis = {
    alex: { curso: "cic", topics: { "mat-1": { status: 2, note: "", link: "", srs: null } },
      sessions: [{ id: "s1", date: "2026-10-01", min: 30 }, { id: "s2", date: "2026-10-02", min: 0 }],
      questions: [{ id: "q1", ok: true }], simulados: [{ id: "x", nota: 650 }], redacoes: [], rascunhos: { a: "b" }, chat: [{ role: "user", txt: "oi" }], bancoResp: { b: "C" } },
    bia: { curso: "geral", topics: {}, sessions: [{ date: "2026-09-30", min: 45, disc: "bio" }], questions: [], simulados: [], redacoes: [{ id: "r", t: "x" }], rascunhos: {}, chat: [], bancoResp: {} },
  };
  for (const [id, remoto] of Object.entries(perfis)) {
    const amb = ambiente({ trilha: { semana: 4 }, foco: "fisica" });
    const sections = {}; for (const [k, v] of Object.entries(remoto)) sections[k] = sec(v);
    await amb.pull(sections);
    const S = amb.S();
    for (const [k, v] of Object.entries(remoto)) assert.deepStrictEqual(S[k], v, `${id}.${k}`);
    assert.deepStrictEqual([S.trilha, S.foco], [{ semana: 4 }, "fisica"], id + ": campos locais fora do sync preservados");
  }
});

test("pull: união por id mantém sessões locais e remotas válidas", async () => {
  const amb = ambiente({ sessions: [{ id: "a", date: "2026-10-01", min: 10 }] });
  await amb.pull({ sessions: sec([{ id: "b", date: "2026-10-02", min: "25" }, { id: "c", date: "2026-10-02", min: "abc" }]) });
  assert.deepStrictEqual(amb.S().sessions, [{ id: "a", date: "2026-10-01", min: 10 }, { id: "b", date: "2026-10-02", min: 25 }]);
});

test("pull: falha ao persistir não bloqueia o envio de alterações seguintes", async () => {
  const amb = ambiente({});
  amb.run('save = () => { throw new Error("quota esgotada"); }');
  assert.strictEqual(await amb.pull({ topics: sec({ remoto: { status: 1 } }) }), false);
  assert.strictEqual(amb.run("Sync._applying"), false);
  amb.run("S.topics.local = { status: 2 }; Sync.onSaved()");
  const ts = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
  assert.ok(ts.topics > 1e13, "alteração local recebe versão nova mesmo após falha de persistência");
});

for (const raw of ['"lixo"', '7', 'true', '[]', '{"topics":"inválido"}']) {
  test(`relógio local corrompido (${raw}) não bloqueia push`, async () => {
    const amb = ambiente({ topics: { local: { status: 2 } } });
    amb.storage.setItem("painelUFRGS_ts", raw);
    let enviado;
    amb.setFetch(async (url, opcoes) => {
      enviado = JSON.parse(opcoes.body);
      return { ok: true, json: async () => ({ sections: {} }) };
    });
    await amb.run("Sync.push()");
    assert.ok(Number.isSafeInteger(enviado.sections.topics.updated_at));
    const salvo = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
    assert.ok(!Array.isArray(salvo) && typeof salvo === "object");
    assert.strictEqual(salvo.topics, enviado.sections.topics.updated_at);
  });
}

test("relógio local persistido continua crescente após reabrir offline", () => {
  const amb = ambiente({});
  amb.storage.setItem("painelUFRGS_ts", '{"topics":10000000000000}');
  amb.run("S.topics.local = { status: 2 }; Sync.onSaved()");
  const ts = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
  assert.ok(ts.topics > 1e13, "nova edição deve vencer a versão persistida, mesmo com relógio do aparelho atrasado");
});
