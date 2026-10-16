// Roda com: TZ=America/Sao_Paulo node --test test/   (ou: npm test)
const test = require("node:test");
const assert = require("node:assert");
const { dayKey, lastDayKeys, streakDe } = require("../painel/datas.js");

test("fuso do teste é o do Brasil (UTC-3)", () => {
  assert.strictEqual(new Date(2026, 9, 9, 12).getTimezoneOffset(), 180, "rode com TZ=America/Sao_Paulo (npm test já faz)");
});

test("dayKey: 22h30 locais continuam no MESMO dia (o bug usava UTC e virava amanhã)", () => {
  const noite = new Date(2026, 9, 9, 22, 30);        // 09/10 22:30 BRT = 10/10 01:30 UTC
  assert.strictEqual(noite.toISOString().slice(0, 10), "2026-10-10");   // o que o código antigo gravava
  assert.strictEqual(dayKey(noite), "2026-10-09");
});

test("dayKey: 00h05 locais já é o dia novo", () => {
  assert.strictEqual(dayKey(new Date(2026, 9, 10, 0, 5)), "2026-10-10");
});

test("lastDayKeys: n dias terminando hoje, na ordem, cruzando mês e ano", () => {
  assert.deepStrictEqual(lastDayKeys(3, new Date(2026, 0, 1, 23, 0)), ["2025-12-30", "2025-12-31", "2026-01-01"]);
  assert.strictEqual(lastDayKeys(14).length, 14);
});

test("streakDe: sessão feita às 22h conta no dia certo e a sequência segue", () => {
  const agora = new Date(2026, 9, 9, 22, 45);
  const datas = [dayKey(new Date(2026, 9, 7, 22, 10)), dayKey(new Date(2026, 9, 8, 21, 30)), dayKey(new Date(2026, 9, 9, 21, 50))];
  assert.strictEqual(streakDe(datas, agora), 3);
});

test("streakDe: hoje sem estudar ainda não zera; dois dias sem estudar zeram", () => {
  const datas = ["2026-10-07", "2026-10-08"];
  assert.strictEqual(streakDe(datas, new Date(2026, 9, 9, 9, 0)), 2);
  assert.strictEqual(streakDe(datas, new Date(2026, 9, 10, 9, 0)), 0);
  assert.strictEqual(streakDe([], new Date()), 0);
});
