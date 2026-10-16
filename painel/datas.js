/* datas.js — chaves de dia (AAAA-MM-DD) no fuso LOCAL do aparelho.
   Antes o painel usava toISOString() (UTC): no Brasil, depois das 21h o "hoje" já era
   amanhã — a sessão de estudo caía no dia errado e a sequência (streak) quebrava.
   Sem dependências; também carrega no Node (testes em test/datas.test.js). */
(function (root) {
  const pad = n => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  /* anda por dias de CALENDÁRIO (setDate), não por 86400000 ms: não pula/repete dia em troca de horário de verão */
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  /* as últimas n chaves de dia, da mais antiga à de hoje */
  const lastDayKeys = (n, now = new Date()) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(dayKey(addDays(now, -i)));
    return out;
  };
  /* dias seguidos estudando; se hoje ainda não estudou, conta a partir de ontem */
  const streakDe = (datas, now = new Date()) => {
    const set = datas instanceof Set ? datas : new Set(datas);
    let d = new Date(now), n = 0;
    if (!set.has(dayKey(d))) d = addDays(d, -1);
    while (set.has(dayKey(d))) { n++; d = addDays(d, -1); }
    return n;
  };
  const api = { dayKey, addDays, lastDayKeys, streakDe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api, { todayKey: () => dayKey(new Date()) });
})(typeof window !== "undefined" ? window : globalThis);
