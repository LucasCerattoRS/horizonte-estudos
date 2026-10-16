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
