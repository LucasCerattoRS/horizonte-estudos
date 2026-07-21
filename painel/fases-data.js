/* ============================================================
   FASES-DATA — cronograma MACRO de 16 meses (FASE 3 do roadmap)
   CURADO À MÃO (sem gerador — como recursos-data.js / redacao-data.js).
   Carregado por <script> ANTES do app.js: expõe os globais DATAS_PROVA e FASES.

   Distinção do SM-2 (aba Cronograma): o SM-2 é o MICRO (o que revisar HOJE);
   estas fases são o MACRO (em que trecho da trajetória de 16 meses você está).
   Nada aqui entra no estado do usuário (S/localStorage) — é derivado de Date.now().
   ============================================================ */

/* --- Datas-âncora das provas ---------------------------------------------
   SEMPRE com "T00:00:00" explícito: sem a hora, new Date("2026-11-28") é
   interpretado como UTC e vira 27/nov no fuso -03 (off-by-one). O resto do
   app já usa esse cuidado (renderWeek, etc.).

   ⚠️ Só ufrgs2027 é data OFICIAL (calendário COPERSE já publicado). As demais
   são ESTIMATIVAS pelo padrão histórico (ENEM = 2 domingos de novembro; UFRGS
   = fim de novembro) — o calendário oficial de 2027/2028 ainda não saiu.
   Ajuste aqui quando o INEP/COPERSE publicarem; é a fonte única de datas. */
const DATAS_PROVA = {
  enem2026:  new Date("2026-11-08T00:00:00"), // estimativa (1º domingo de nov)
  ufrgs2027: new Date("2026-11-28T00:00:00"), // OFICIAL — ciclo curto (diagnóstico)
  enem2027:  new Date("2027-11-07T00:00:00"), // estimativa (1º domingo de nov)
  ufrgs2028: new Date("2027-11-27T00:00:00"), // estimativa — ALVO REAL (ciclo longo)
};
/* O alvo real do preparo é a UFRGS 2028 (a última prova do ciclo longo). */
const DATA_ALVO = DATAS_PROVA.ufrgs2028;
const ALVO_KEY  = "ufrgs2028";

/* Quais datas ainda são ESTIMATIVA (calendário oficial não publicado). A UI
   marca essas contagens com "≈" e uma nota — não mostrar estimativa como fato. */
const DATAS_ESTIMADAS = new Set(["enem2026", "enem2027", "ufrgs2028"]);

/* --- As 4 fases (jul/2026 → nov/2027) ------------------------------------
   Limites por mês (âncora suave). `inicio` inclusivo, `fim` exclusivo — a fase
   corrente é aquela cujo [inicio, fim) contém hoje. `marco` = a prova que fecha
   a fase (só rótulo). `prioridades` = o que priorizar enquanto se está nela. */
const FASES = [
  {
    id: "fundacao",
    nome: "Fundação & Diagnóstico",
    icon: "🌱",
    janela: "jul–nov 2026",
    inicio: new Date("2026-07-01T00:00:00"),
    fim:    new Date("2026-12-01T00:00:00"),
    marco:  "UFRGS 2027 + ENEM 2026 (simulado real)",
    resumo: "Construir base em todas as disciplinas e usar as provas de novembro como raio-X — elas não são o alvo, revelam onde você está.",
    prioridades: [
      "Marque no Mapa do Edital o que já domina — o diagnóstico começa aí",
      "Faça UFRGS 2027 e ENEM 2026 como raio-X, sem cobrança de nota",
      "Amplitude antes de profundidade: passe por todas as disciplinas",
    ],
  },
  {
    id: "consolidacao",
    nome: "Consolidação",
    icon: "🧱",
    janela: "dez 2026–abr 2027",
    inicio: new Date("2026-12-01T00:00:00"),
    fim:    new Date("2027-05-01T00:00:00"),
    marco:  "fechar as lacunas do diagnóstico",
    resumo: "Post-mortem das provas de novembro: atacar as lacunas que elas expuseram e fechar os buracos antes que virem dívida.",
    prioridades: [
      "Ataque primeiro os tópicos que as provas reais mostraram fracos",
      "A média harmônica pune nota baixa — suba seus piores assuntos",
      "Redação: uma por semana, corrigida pela rubrica oficial",
    ],
  },
  {
    id: "aprofundamento",
    nome: "Aprofundamento",
    icon: "🔬",
    janela: "mai–ago 2027",
    inicio: new Date("2027-05-01T00:00:00"),
    fim:    new Date("2027-09-01T00:00:00"),
    marco:  "profundidade + simulados cronometrados",
    resumo: "Profundidade nos tópicos duros e de alta incidência da banca, redação intensiva e simulados completos com tempo.",
    prioridades: [
      "Aprofunde os tópicos de alta incidência (veja a aba Análise)",
      "Simulados completos e cronometrados, do começo ao fim",
      "Redação intensiva: repertório, estrutura e revisão",
    ],
  },
  {
    id: "reta-final",
    nome: "Reta Final",
    icon: "🎯",
    janela: "set–nov 2027",
    inicio: new Date("2027-09-01T00:00:00"),
    fim:    new Date("2027-11-28T00:00:00"),
    marco:  "ENEM 2027 + UFRGS 2028 (o alvo real)",
    resumo: "Zero conteúdo novo: só revisão (a fila SM-2 fica pesada agora) e simulados. Chegar inteiro no dia.",
    prioridades: [
      "Nada de assunto novo — revise a fila SM-2 e os erros recorrentes",
      "Confie no que já domina; simulados para manter o ritmo",
      "Logística da prova conferida; descanse na véspera",
    ],
  },
];

/* --- TRILHA DE ARRANQUE (o "norte visível" da FASE 5) ---------------------
   Curada à mão. O começo cativante que o Alex pediu: semana 1 = Português +
   Redação + Matemática + Física; depois abre p/ humanas, sempre com as exatas
   (o foco/déficit dele) no centro. RITMO DO USUÁRIO, não do calendário — ele
   avança quando sente que andou (não pune quem faltou uma semana). Ao terminar,
   entrega o bastão ao "Foco da semana" (algorítmico) que já existe no Painel.
   `nucleo` = códigos de prova (mapeados a disciplinas em app-painel.js) + o
   pseudo-código "redacao" (abre a aba Redação). Exposto como global TRILHA. */
const TRILHA = {
  intro: "Uma matéria de cada vez, no seu ritmo — conclua a semana quando sentir que andou, sem cobrança de calendário.",
  semanas: [
    { titulo:"Arranque",                  nucleo:["LP","redacao","MAT","FIS"],  nota:"Base de texto + as duas exatas-mãe. É por aqui que tudo começa." },
    { titulo:"Fecha o tripé de exatas",   nucleo:["MAT","FIS","QUI","redacao"], nota:"Química entra e completa MAT · FIS · QUI — o seu foco declarado." },
    { titulo:"Primeira ponte p/ humanas", nucleo:["MAT","FIS","GEO","LP"],       nota:"Segura as exatas e abre Geografia devagar." },
    { titulo:"História soma repertório",  nucleo:["MAT","QUI","HIS","redacao"],  nota:"Exatas em dia; História começa a render argumento p/ a redação." },
    { titulo:"Amplitude",                 nucleo:["FIS","BIO","LIT","GEO"],      nota:"Biologia e Literatura entram — a média harmônica pune buraco." },
    { titulo:"Consolida e vira a chave",  nucleo:["MAT","FIS","QUI","redacao"],  nota:"Revisa o núcleo de exatas + redação. Depois desta, o Foco da semana assume o leme." },
  ],
};
