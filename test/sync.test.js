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
const sec = (data, ts = Date.now()) => ({ data, updated_at: ts });

test("pull: seções remotas ruins são sanitizadas como as do localStorage", async () => {
  const amb = ambiente({ sessions: [{ date: "2026-10-01", min: 20 }] });
  await amb.pull({
    sessions: sec([{ date: "2026-10-09", min: "30" }, { date: "2026-10-09", min: null }, null, { date: 5, min: 3 }]),
    topics: sec("lixo"), questions: sec(null), bancoResp: sec([1]), curso: sec("zzz"),
  });
  const S = amb.S();
  // a sessão local (20 min) agora SOBREVIVE: antes a lista remota a substituía inteira
  assert.deepStrictEqual(S.sessions.map(({ id, ...r }) => r), [{ date: "2026-10-01", min: 20 }, { date: "2026-10-09", min: 30 }, { date: "2026-10-09", min: 0 }]);
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
    // sessão remota sem id ganha id ao entrar (é isso que permite a união); o resto entra intacto
    const comoRemoto = k => (k === "sessions" ? S[k].map(x => (remoto[k].some(r => r.id) ? x : (({ id, ...r }) => r)(x))) : S[k]);
    for (const [k, v] of Object.entries(remoto)) assert.deepStrictEqual(comoRemoto(k), v, `${id}.${k}`);
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
  assert.ok(ts.topics >= Date.now() - 60000, "alteração local recebe versão nova mesmo após falha de persistência");
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
  const adiantado = Date.now() + 60000; // relógio do aparelho 1 min atrasado em relação ao que ele mesmo emitiu
  amb.storage.setItem("painelUFRGS_ts", JSON.stringify({ topics: adiantado }));
  amb.run("S.topics.local = { status: 2 }; Sync.onSaved()");
  const ts = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
  assert.ok(ts.topics > adiantado, "nova edição deve vencer a versão persistida, mesmo com relógio do aparelho atrasado");
});

for (const raw of ['{"topics":0}', '{"topics":9007199254740991}', '{"topics":1e16}']) {
  test(`relógio persistido fora da faixa aceita pela API (${raw}) é descartado e o push usa versão válida`, () => {
    const amb = ambiente({});
    amb.storage.setItem("painelUFRGS_ts", raw);
    amb.run("S.topics.local = { status: 2 }; Sync.onSaved()");
    const ts = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
    assert.ok(Number.isSafeInteger(ts.topics) && ts.topics > 0 && ts.topics <= Date.now() + 300000);
  });
}

test("pull: timestamp remoto não finito não contamina o relógio nem substitui progresso", async () => {
  for (const timestamp of ["Infinity", { valueOf: null, toString: null }]) {
    const amb = ambiente({ topics: { local: { status: 1 } } });
    assert.strictEqual(await amb.pull({ topics: sec({ remoto: { status: 2 } }, timestamp) }), true);
    assert.deepStrictEqual(amb.S().topics, { local: { status: 1 } });
    amb.run("S.topics.novo = { status: 2 }; Sync.onSaved()");
    const ts = JSON.parse(amb.storage.getItem("painelUFRGS_ts"));
    assert.ok(Number.isSafeInteger(ts.topics));
  }
});

test("pull: sessões antigas sem id dos dois aparelhos se UNEM em vez de a remota apagar a local", async () => {
  const comum = { date: "2026-10-01", min: 30, disc: "mat" };
  const amb = ambiente({ sessions: [comum, { date: "2026-10-05", min: 45, disc: "bio" }] });   // 45 min só neste aparelho
  await amb.pull({ sessions: sec([comum, { date: "2026-10-06", min: 20, disc: "fis" }]) });   // 20 min só no outro
  const S = amb.S();
  const total = S.sessions.reduce((a, x) => a + x.min, 0);
  assert.strictEqual(total, 30 + 45 + 20);
  assert.strictEqual(S.sessions.length, 3);                                                     // a comum não duplica
});

/* ---- dois aparelhos contra um servidor falso com a MESMA regra da API (grava só updated_at maior) ---- */
function servidor() {
  const secoes = {};
  return async (url, opt = {}) => {
    if (opt.method === "PUT") {
      const { sections } = JSON.parse(opt.body);
      for (const [k, v] of Object.entries(sections)) if (!secoes[k] || v.updated_at > secoes[k].updated_at) secoes[k] = JSON.parse(JSON.stringify(v));
    }
    return { ok: true, status: 200, json: async () => ({ profile: { id: "p", nome: "P" }, sections: JSON.parse(JSON.stringify(secoes)) }) };
  };
}
const tick = () => new Promise(r => setImmediate(r));
async function ciclo(amb) { await amb.run("Sync.pull()"); await tick(); await amb.run("Sync.push()"); await tick(); }
const min = amb => amb.S().sessions.reduce((a, x) => a + x.min, 0);
const registra = (amb, id, m) => amb.run(`S.sessions.push({ id: "${id}", date: "2026-11-09", min: ${m}, disc: "mat" }); Sync.onSaved();`);

test("dois aparelhos: sessões registradas offline nos dois convergem sem perder minutos", async () => {
  const srv = servidor(), A = ambiente({}), B = ambiente({});
  A.setFetch(srv); B.setFetch(srv);
  await ciclo(A); await ciclo(B);
  registra(A, "a1", 30); registra(B, "b1", 45);            // nenhum viu o outro
  await ciclo(B);                                           // B sobe primeiro (ts maior)
  await ciclo(A);                                           // A recebe [b1], tem a1 a mais → sobe a união
  await ciclo(B);
  await ciclo(A);
  assert.strictEqual(min(A), 75); assert.strictEqual(min(B), 75);
  assert.deepStrictEqual(A.S().sessions.map(x => x.id).sort(), ["a1", "b1"]);
  assert.deepStrictEqual(B.S().sessions.map(x => x.id).sort(), ["a1", "b1"]);
  const C = ambiente({}); C.setFetch(srv); await ciclo(C);   // aparelho novo recebe tudo do servidor
  assert.strictEqual(min(C), 75);
});

test("pull: lista remota vazia e mais nova não apaga as sessões locais — e o servidor as recebe de volta", async () => {
  const srv = servidor(), A = ambiente({ sessions: [{ id: "a1", date: "2026-11-09", min: 30 }] });
  A.setFetch(async (u, o) => { const r = await srv(u, o); const j = await r.json(); return { ...r, json: async () => ({ ...j, sections: { ...j.sections, sessions: { data: [], updated_at: Date.now() + 1000 } } }) }; });
  await A.run("Sync.pull()"); await tick();
  assert.strictEqual(min(A), 30);
  assert.ok(A.run("JSON.parse(localStorage.getItem('painelUFRGS_ts')).sessions") > Date.now() + 1000, "ts novo maior que o remoto, senão a API recusa o push");
});

test("pull: timestamp local maior que o remoto ainda traz as sessões que só existem no servidor", async () => {
  const srv = servidor(), A = ambiente({}), B = ambiente({});
  A.setFetch(srv); B.setFetch(srv);
  registra(B, "b1", 45); await ciclo(B);                     // servidor: [b1]
  registra(A, "a1", 30);                                      // ts local de A é MAIOR que o do servidor
  await ciclo(A);
  assert.strictEqual(min(A), 75);
  await ciclo(B);
  assert.strictEqual(min(B), 75);
});

test("pull: sessões remotas inválidas (null/texto) nunca apagam as locais", async () => {
  const A = ambiente({ sessions: [{ id: "a1", date: "2026-11-09", min: 30 }] });
  await A.pull({ sessions: sec(null) }); await A.pull({ sessions: sec("lixo") });
  assert.strictEqual(min(A), 30);
});

test("pull: mesmo id com minutos diferentes mantém o maior (nunca apaga tempo estudado)", async () => {
  const A = ambiente({ sessions: [{ id: "x", date: "2026-11-09", min: 45 }] });
  await A.pull({ sessions: sec([{ id: "x", date: "2026-11-09", min: 20 }]) });
  assert.strictEqual(min(A), 45);
});

test("pull: ts da seção nunca passa do teto da API (senão ela recusa o PUT inteiro)", async () => {
  const A = ambiente({ sessions: [{ id: "a1", date: "2026-11-09", min: 30 }] });
  const perto = Date.now() + 299000;                       // remoto quase no limite de +5 min
  await A.pull({ sessions: sec([], perto) });
  assert.ok(A.run("JSON.parse(localStorage.getItem('painelUFRGS_ts')).sessions") <= Date.now() + 300000);
});

test("push: com o servidor quase no teto de relógio, nenhuma seção sobe com ts acima do que a API aceita", async () => {
  const A = ambiente({ sessions: [{ id: "a1", date: "2026-11-09", min: 30 }] });
  let corpo = null;
  A.setFetch(async (u, o = {}) => {
    if (o.method === "PUT") { corpo = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ profile: { id: "p", nome: "P" }, sections: {} }) }; }
    return { ok: true, status: 200, json: async () => ({ profile: { id: "p", nome: "P" }, sections: { sessions: { data: [], updated_at: Date.now() + 300000 } } }) };
  });
  await A.run("Sync.pull()"); await new Promise(r => setImmediate(r)); await A.run("Sync.push()");
  const teto = Date.now() + 300000;
  assert.ok(corpo, "houve PUT");
  for (const [k, v] of Object.entries(corpo.sections)) assert.ok(v.updated_at <= teto, `${k} dentro do teto da API`);
});
