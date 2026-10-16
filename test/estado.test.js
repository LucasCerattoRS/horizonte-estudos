// Roda com: TZ=America/Sao_Paulo node --test test/   (ou: npm test)
const test = require("node:test");
const assert = require("node:assert");
const { normalizaIndice, normalizaEstado, parseMin } = require("../painel/estado.js");

const PADRAO = { version: 1, curso: "geral", topics: {}, sessions: [], questions: [], simulados: [], redacoes: [], rascunhos: {}, chat: [], bancoResp: {}, trilha: { semana: 1 } };
const CURSOS = { geral: {}, cic: {} };
const IDX0 = { active: "alex", profiles: [{ id: "alex", nome: "Alex", emoji: "🌅" }] };

test("índice: {} / null / lixo viram o perfil padrão (antes: TypeError no boot)", () => {
  for (const raw of [{}, null, [], "x", 5, { profiles: "x" }, { active: "a", profiles: [null, 3] }])
    assert.deepStrictEqual(normalizaIndice(raw, IDX0), IDX0);
});
test("índice: perfil ativo inexistente cai no primeiro; entradas inválidas são descartadas", () => {
  const r = normalizaIndice({ active: "fantasma", profiles: [null, { id: "p1", nome: "Bia" }, { id: "p2" }] }, IDX0);
  assert.strictEqual(r.active, "p1");
  assert.deepStrictEqual(r.profiles.map(p => [p.id, p.nome]), [["p1", "Bia"], ["p2", "p2"]]);
});
test("índice válido passa intacto", () => {
  assert.deepStrictEqual(normalizaIndice(IDX0, IDX0), IDX0);
});

test("estado: listas null/string e mapas errados voltam ao padrão", () => {
  const s = normalizaEstado({ sessions: null, questions: "x", topics: "x", bancoResp: [1], trilha: null }, PADRAO, CURSOS);
  assert.deepStrictEqual([s.sessions, s.questions, s.topics, s.bancoResp, s.trilha], [[], [], {}, {}, { semana: 1 }]);
});
test("estado: curso removido/inválido volta ao padrão (antes: CURSOS[S.curso].nome estourava)", () => {
  assert.strictEqual(normalizaEstado({ curso: "zzz" }, PADRAO, CURSOS).curso, "geral");
  assert.strictEqual(normalizaEstado({ curso: "cic" }, PADRAO, CURSOS).curso, "cic");
});
test("estado: sessões lixo (null, min texto, min negativo, sem data) saem; as boas ficam", () => {
  const boa = { date: "2026-10-09", min: 30, disc: "mat" };
  const s = normalizaEstado({ sessions: [null, { min: "abc", date: "2026-10-09" }, { date: 5, min: 3 }, { date: "2026-10-09", min: -3 }, boa] }, PADRAO, CURSOS);
  assert.deepStrictEqual(s.sessions, [boa]);
});
test("estado: JSON que não é objeto (null, array) rende o padrão", () => {
  assert.deepStrictEqual(normalizaEstado(null, PADRAO, CURSOS), PADRAO);
  assert.deepStrictEqual(normalizaEstado([1], PADRAO, CURSOS), PADRAO);
});

test("parseMin: aceita inteiros 1..1440", () => {
  assert.strictEqual(parseMin("30"), 30);
  assert.strictEqual(parseMin(" 45 "), 45);
  assert.strictEqual(parseMin("1440"), 1440);
  assert.strictEqual(parseMin("29.6"), 30);
});
test("parseMin: rejeita o que parseInt aceitava em silêncio", () => {
  for (const v of ["", "0", "-5", "abc", "12abc", "1e3", "1441", "999999999", null, undefined, "NaN", "Infinity"])
    assert.strictEqual(parseMin(v), null, String(v));
});

/* 16/10: min salvo como texto ("30") passava no filtro (+"30" é finito) e ficava string;
   nos totais do Plano `totals[d] + "30"` concatenava ("030"). Revisão: NÃO descartar sessão que a
   regra anterior mantinha (null/""/booleano/"1e3" ficavam) — só converter para número. */
test("estado: min texto vira número; nenhuma sessão que a regra anterior mantinha some", () => {
  const s = normalizaEstado({ sessions: [
    { date: "2026-10-09", min: "30", disc: "mat" },
    { date: "2026-10-09", min: " 45 " },
    { date: "2026-10-09", min: "12.5" },
    { date: "2026-10-09", min: null },
    { date: "2026-10-09" },
    { date: "2026-10-09", min: "" },
    { date: "2026-10-09", min: true },
    { date: "2026-10-09", min: "12abc" },
    { date: "2026-10-09", min: "1e3" },
    { date: "2026-10-09", min: "-5" },
    { date: "2026-10-09", min: Infinity },
  ] }, PADRAO, CURSOS);
  assert.deepStrictEqual(s.sessions, [
    { date: "2026-10-09", min: 30, disc: "mat" },
    { date: "2026-10-09", min: 45 },
    { date: "2026-10-09", min: 12.5 },
    { date: "2026-10-09", min: 0 },
    { date: "2026-10-09", min: 0 },
    { date: "2026-10-09", min: 1 },
    { date: "2026-10-09", min: 1000 },
  ]);
  s.sessions.forEach(x => assert.strictEqual(typeof x.min, "number"));
  const totals = {}; s.sessions.forEach(x => { totals[x.date] = (totals[x.date] || 0) + x.min; });
  assert.strictEqual(totals["2026-10-09"], 1088.5);
});
test("estado: mantém exatamente as sessões que a regra anterior (+min finito ≥ 0) mantinha", () => {
  const antes = x => typeof x.date === "string" && Number.isFinite(+x.min) && +x.min >= 0;
  const mins = [0, 1, 30, 12.5, 1440, 2000, -1, NaN, Infinity, -Infinity, null, undefined, "", " ", "0", "30", " 45 ",
    "12.5", "1e3", "12abc", "abc", "-5", "Infinity", "0x10", true, false, [], [5], [1, 2], {}];
  const sessions = mins.map((min, i) => ({ date: "2026-10-09", min, i }));
  const s = normalizaEstado({ sessions }, PADRAO, CURSOS);
  assert.deepStrictEqual(s.sessions.map(x => x.i), sessions.filter(antes).map(x => x.i));
  s.sessions.forEach(x => assert.ok(Number.isFinite(x.min) && x.min >= 0, String(x.min)));
});
test("estado: não altera o objeto de entrada ao converter min", () => {
  const entrada = { sessions: [{ date: "2026-10-09", min: "30" }] };
  normalizaEstado(entrada, PADRAO, CURSOS);
  assert.strictEqual(entrada.sessions[0].min, "30");
});

/* Não descartar dado válido: estados válidos variados (vários perfis) passam intactos. */
const VALIDOS = {
  alex: { version: 1, curso: "cic", topics: { "mat-1": { status: 2, note: "ok", link: "", srs: null } },
    sessions: [{ date: "2026-10-01", min: 30, disc: "mat" }, { date: "2026-10-02", min: 0 }, { date: "2026-10-03", min: 1440, id: "s1" }, { date: "2026-10-04", min: 2000 }, { date: "2026-10-05", min: 12.5 }],
    questions: [{ id: "q1", ok: true }], simulados: [{ id: "sim1", nota: 700 }], redacoes: [{ id: "r1", texto: "x" }],
    rascunhos: { r: "rasc" }, chat: [{ role: "user", txt: "oi" }], bancoResp: { b1: "A" }, trilha: { semana: 3 }, foco: "fisica", extra: { qualquer: 1 } },
  bia: { version: 1, curso: "geral", topics: {}, sessions: [], questions: [], simulados: [], redacoes: [], rascunhos: {}, chat: [], bancoResp: {}, trilha: { semana: 1 } },
  carol: { curso: "geral", sessions: [{ date: "2026-09-30", min: 45, disc: "bio", nota: "revisão" }] },
};
test("estado: estados válidos de vários perfis passam sem perder nada (idempotente)", () => {
  for (const [id, st] of Object.entries(VALIDOS)) {
    const s = normalizaEstado(structuredClone(st), PADRAO, CURSOS);
    assert.deepStrictEqual(s, Object.assign(structuredClone(PADRAO), st), id);
    assert.deepStrictEqual(normalizaEstado(s, PADRAO, CURSOS), s, id + " (2ª passada)");
  }
});
