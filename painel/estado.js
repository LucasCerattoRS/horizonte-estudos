/* estado.js — sanitiza o que vem do localStorage / do arquivo importado antes de o app usar.
   Um valor corrompido (JSON de outro formato, campo null, curso removido) derrubava o boot
   inteiro com TypeError e o painel ficava em branco até limpar os dados do site.
   Sem dependências; também carrega no Node (test/estado.test.js). */
(function (root) {
  const ehObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const LISTAS = ["sessions", "questions", "simulados", "redacoes", "chat"];
  const MAPAS = ["topics", "rascunhos", "bancoResp", "trilha"];
  const MAX_MIN = 1440;   // um dia: acima disso é erro de digitação, e estraga barras e totais

  /* índice de perfis: devolve sempre {active, profiles[≥1]} com active existente */
  function normalizaIndice(raw, padrao) {
    const perfis = ehObj(raw) && Array.isArray(raw.profiles)
      ? raw.profiles.filter(p => ehObj(p) && typeof p.id === "string" && p.id).map(p => ({ ...p, nome: String(p.nome == null ? p.id : p.nome) }))
      : [];
    if (!perfis.length) return structuredClone(padrao);
    const active = perfis.some(p => p.id === raw.active) ? raw.active : perfis[0].id;
    return { ...raw, active, profiles: perfis };
  }

  /* estado de um perfil: `padrao` é o DEFAULT_STATE, `cursos` o mapa CURSOS */
  function normalizaEstado(p, padrao, cursos) {
    const s = Object.assign(structuredClone(padrao), ehObj(p) ? p : {});
    LISTAS.forEach(k => { s[k] = Array.isArray(s[k]) ? s[k].filter(ehObj) : []; });
    MAPAS.forEach(k => { if (!ehObj(s[k])) s[k] = structuredClone(padrao[k]); });
    // min salvo como texto ("30", " 45 ", "12.5") vira número (senão `totals[d] + "30"` concatena);
    // null, "", booleano, "12abc", "1e3", negativo e infinito saem. Número já válido fica como está.
    s.sessions = s.sessions.flatMap(x => {
      if (typeof x.date !== "string") return [];
      const m = minSalvo(x.min);
      return m === null ? [] : [m === x.min ? x : { ...x, min: m }];
    });
    if (!cursos || !cursos[s.curso]) s.curso = padrao.curso;
    return s;
  }

  /* minutos de uma sessão JÁ salva: número finito ≥ 0, ou texto de número decimal simples → número;
     o resto → null. Mais tolerante que parseMin (aceita 0 e > MAX_MIN) para não apagar sessão antiga. */
  function minSalvo(v) {
    if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
    if (typeof v !== "string") return null;
    const t = v.trim();
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  }

  /* minutos de uma sessão digitada: inteiro 1..1440, senão null ("1e3" e "12abc" não viram 1 e 12 em silêncio) */
  function parseMin(v) {
    const t = String(v == null ? "" : v).trim();
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = Math.round(Number(t));
    return n >= 1 && n <= MAX_MIN ? n : null;
  }

  const api = { normalizaIndice, normalizaEstado, parseMin, minSalvo, MAX_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
