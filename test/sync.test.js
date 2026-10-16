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
  const ls = new Map([["painelUFRGS_token", "tok"]]);
  const localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
  const noop = () => {};
  const ctx = {
    console, structuredClone, setTimeout: noop, clearTimeout: noop, JSON, Map, Object, Array, Number, String, Math, Date, Promise,
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
  return {
    async pull(sections) { ctx.resposta = { profile: { id: "p", nome: "P" }, sections }; return vm.runInContext("Sync.pull()", ctx); },
    S: () => JSON.parse(vm.runInContext("JSON.stringify(S)", ctx)),
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
