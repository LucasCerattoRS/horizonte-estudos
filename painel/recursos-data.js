/* ============================================================
   PAINEL UFRGS/ENEM — Curadoria de recursos externos
   "Encaminhar via links a lugares e pessoas que propagam o assunto."

   Fonte única (consumida pelo painel e pelo injetor do cofre Obsidian):
     CANAIS[discId]  → canais/pessoas por disciplina, categorizados e avaliados
     SITES[]         → referências de texto (transdisciplinares)
     INCIDENCIA[...]  → leitura CURADA de padrão/frequência nas provas
                        (estimativa de curadoria, não contagem automática;
                         a contagem real exige tópico marcado em cada questão)

   discId casa com DISCIPLINAS[].id do edital-data.js:
     bio fis qui geo his port red lit mat lem
   tier: "essencial" | "bom" | "complementar"
   ============================================================ */

// URL canônica quando conhecida e verificada; senão cai numa busca do YouTube
const ytBuscaCanal = nome => `https://www.youtube.com/results?search_query=${encodeURIComponent(nome)}`;

const CANAIS = {
  mat: [
    { nome: "Professor Ferretto", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/@ProfessorFerretto",
      foco: "Curso completo e estruturado do zero ao vestibular. A espinha dorsal para Matemática." },
    { nome: "Equaciona com Paulo Pereira", tipo: "canal", tier: "bom",
      url: "https://www.youtube.com/@Equaciona",
      foco: "Resolução de questões passo a passo — ótimo para treinar a montagem do problema." },
    { nome: "Matemática Rio (Rafael Procópio)", tipo: "canal", tier: "bom",
      url: "https://www.youtube.com/@MatematicaRio",
      foco: "Didática leve e macetes com foco em ENEM." },
    { nome: "Gis com Giz Matemática", tipo: "canal", tier: "complementar",
      url: "https://www.youtube.com/@GisComGiz",
      foco: "Base do zero, ritmo calmo — bom para destravar um tópico que não entrou." },
  ],
  fis: [
    { nome: "Física Total (Marcelo Boaro)", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/@fisicatotal",
      foco: "Teoria + exercícios em curso completo por assunto. Referência para exatas." },
    { nome: "Professor Douglas Gomes", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Professor Douglas Gomes Física"),
      foco: "Resolução de provas e foco em ENEM/vestibular." },
    { nome: "Me Salva! (Física)", tipo: "canal", tier: "complementar",
      url: ytBuscaCanal("Me Salva Física"),
      foco: "Trilhas curtas por tópico; parte gratuita útil para revisão." },
    { nome: "Khan Academy — Física", tipo: "site", tier: "complementar",
      url: "https://pt.khanacademy.org/science/physics",
      foco: "Exercícios interativos com correção; bom para fixar conceito." },
  ],
  qui: [
    { nome: "Marcelão da Química", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/marcelaodaquimica",
      foco: "Curso completo + resolução de vestibulares e provas militares." },
    { nome: "Prof. Paulo Valim (Química)", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Paulo Valim Química"),
      foco: "Explicações claras de físico-química e orgânica." },
    { nome: "Química em Ação / Manual do Enem", tipo: "canal", tier: "complementar",
      url: ytBuscaCanal("Química ENEM aula"),
      foco: "Revisões rápidas para os assuntos mais cobrados." },
  ],
  bio: [
    { nome: "Biologia Total (Paulo Jubilut)", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/user/jubilut",
      foco: "Maior canal de Biologia do país; cobertura completa para ENEM/vestibular." },
    { nome: "Biologia com Samuel Cunha", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Biologia com Samuel Cunha"),
      foco: "Aulas objetivas e resolução de questões." },
    { nome: "Toda Matéria — Biologia", tipo: "site", tier: "complementar",
      url: "https://www.todamateria.com.br/biologia/",
      foco: "Resumos de texto para consulta rápida antes da questão." },
  ],
  geo: [
    { nome: "Professor Ricardo Marcílio", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/@profricardomarcilio",
      foco: "Geografia física e humana para ENEM/vestibular, bem estruturada." },
    { nome: "Geobrasil / Professor Rakan", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Geografia ENEM aula geopolítica"),
      foco: "Atualidades e geopolítica — reforço para a parte de espaço mundial." },
    { nome: "Brasil Escola — Geografia", tipo: "site", tier: "complementar",
      url: "https://brasilescola.uol.com.br/geografia",
      foco: "Verbetes de apoio para climatologia, relevo e demografia." },
  ],
  his: [
    { nome: "Débora Aladim", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/channel/UCx7HKmnCIIbRBF2FjAoV0bg",
      foco: "História para ENEM com narrativa forte; um dos maiores canais do país." },
    { nome: "Historicidade / Prof. Bruno Rebelli", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("História ENEM aula vestibular"),
      foco: "Revisões temáticas e resolução de questões." },
    { nome: "História do RS — Farroupilha e imigração", tipo: "canal", tier: "complementar",
      url: ytBuscaCanal("História Rio Grande do Sul Revolução Farroupilha imigração"),
      foco: "Eixo sul-rio-grandense que a UFRGS cobra e o ENEM ignora." },
  ],
  port: [
    { nome: "Professor Noslen", tipo: "canal", tier: "essencial",
      url: "https://www.youtube.com/@ProfessorNoslen",
      foco: "Gramática e interpretação para ENEM; didática popular (2.4M)." },
    { nome: "Português com Letícia", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Português com Letícia"),
      foco: "Sintaxe e semântica explicadas com calma." },
    { nome: "Norma culta / Brasil Escola — Gramática", tipo: "site", tier: "complementar",
      url: "https://brasilescola.uol.com.br/gramatica",
      foco: "Consulta pontual de regência, concordância e crase." },
  ],
  red: [
    { nome: "Redação — Professora Pamba", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("Professora Pamba redação"),
      foco: "Estrutura dissertativa e repertório; adaptar para o modelo UFRGS (sem intervenção)." },
    { nome: "Redação dissertativo-argumentativa UFRGS", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("redação UFRGS dissertativo argumentativa como fazer"),
      foco: "UFRGS não pede proposta de intervenção — busque material específico, não só ENEM." },
    { nome: "Cofre Obsidian — técnica de redação", tipo: "cofre", tier: "essencial",
      url: "obsidian://open?vault=cofre-obsidian&file=Reda%C3%A7%C3%A3o%2F00%20Mapa%20%E2%80%94%20Reda%C3%A7%C3%A3o",
      foco: "Suas notas de estrutura, repertório e prática cronometrada + redações nota 1000 baixadas." },
  ],
  lit: [
    { nome: "Análise das obras obrigatórias UFRGS 2027", tipo: "canal", tier: "essencial",
      url: ytBuscaCanal("obras obrigatórias UFRGS 2027 análise Krenak Macunaíma"),
      foco: "Busca já mirada nas 12 obras da lista — priorize as 4 de ingressantes." },
    { nome: "Literatura para vestibular (escolas literárias)", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("escolas literárias Barroco Romantismo Modernismo vestibular"),
      foco: "Periodização do Renascimento ao pós-1970." },
    { nome: "Cultura sul-rio-grandense (Partenon, regionalismo)", tipo: "canal", tier: "complementar",
      url: ytBuscaCanal("literatura sul-rio-grandense Simões Lopes Neto Erico Verissimo"),
      foco: "Eixo gaúcho recorrente na UFRGS." },
  ],
  lem: [
    { nome: "English in Brazil (Ana Luiza Bergamini)", tipo: "canal", tier: "bom",
      url: "https://www.youtube.com/@englishinbrazil",
      foco: "Leitura e vocabulário — a prova UFRGS é 100% compreensão de texto, sem metalinguagem." },
    { nome: "Estratégia de reading para prova", tipo: "canal", tier: "bom",
      url: ytBuscaCanal("estratégia leitura inglês prova vestibular reading skills"),
      foco: "Skimming/scanning e inferência de vocabulário pelo contexto." },
  ],
};

// Referências de texto que servem a quase tudo (consulta rápida)
const SITES = [
  { nome: "Brasil Escola", url: "https://brasilescola.uol.com.br", tags: ["todas"],
    foco: "Verbetes amplos por disciplina; bom ponto de partida." },
  { nome: "Mundo Educação", url: "https://mundoeducacao.uol.com.br", tags: ["todas"],
    foco: "Similar ao Brasil Escola, com exercícios comentados." },
  { nome: "Khan Academy Brasil", url: "https://pt.khanacademy.org", tags: ["mat", "fis", "qui", "bio"],
    foco: "Trilhas de exatas com exercícios interativos e correção." },
  { nome: "Toda Matéria", url: "https://www.todamateria.com.br", tags: ["todas"],
    foco: "Resumos curtos e diretos — revisão de véspera." },
  { nome: "Vestibular UFRGS (oficial)", url: "http://www.ufrgs.br/vestibular", tags: ["oficial"],
    foco: "Manual do Candidato, provas e gabaritos oficiais — a fonte dos padrões reais." },
];

/* Incidência curada por tópico (padrão de recorrência nas provas).
   alta  = cai quase sempre / peso alto no argumento
   media = recorrente
   baixa = periférico / raro
   Chave = nome EXATO do tópico no edital-data.js. Ausente ⇒ tratado como "media".
   Estimativa de curadoria; refine marcando questões reais no Banco. */
const INCIDENCIA = {
  mat: {
    "Variáveis e funções": "alta",
    "Geometria plana": "alta",
    "Análise combinatória, probabilidade e estatística": "alta",
    "Logaritmo e exponencial": "alta",
    "Geometria espacial": "alta",
    "Progressões": "media",
    "Trigonometria": "media",
    "Geometria analítica plana": "media",
    "Matrizes, determinantes e sistemas": "media",
    "Polinômios": "media",
    "Conjuntos numéricos": "media",
  },
  fis: {
    "Dinâmica": "alta",
    "Trabalho e Energia": "alta",
    "Eletrodinâmica": "alta",
    "Cinemática": "alta",
    "Termometria e calorimetria": "media",
    "Ondas mecânicas e eletromagnéticas": "media",
    "Óptica": "media",
    "Hidrostática": "media",
    "Física atômica e nuclear": "baixa",
    "Relatividade restrita": "baixa",
  },
  qui: {
    "Cálculos estequiométricos": "alta",
    "Compostos orgânicos": "alta",
    "Equilíbrio químico": "alta",
    "Soluções": "alta",
    "Eletroquímica": "media",
    "Termoquímica": "media",
    "Estrutura atômica": "media",
    "Ligações químicas": "media",
    "Cinética química": "media",
    "Reações orgânicas": "media",
  },
  bio: {
    "Hereditariedade": "alta",
    "Fluxo de energia e matéria nos ecossistemas": "alta",
    "Processos evolutivos": "alta",
    "Estrutura, funcionamento e diversidade das células": "alta",
    "Dinâmica das comunidades biológicas": "media",
    "Estrutura e função (fisiologia comparada)": "media",
    "Divisão celular": "media",
  },
  geo: {
    "Atividades econômicas": "alta",
    "Atmosfera e clima": "alta",
    "Organização do espaço mundial": "alta",
    "Processo de urbanização": "media",
    "População e sua dinâmica espacial": "media",
    "Cartografia": "media",
    "Problemas ambientais globais": "media",
  },
  his: {
    "Formação e consolidação do capitalismo": "alta",
    "República após 1964": "alta",
    "Populismo e Era Vargas": "alta",
    "Império": "media",
    "República Oligárquica": "media",
    "Mundialização, Globalização e Fragmentação": "media",
  },
  port: {
    "Interpretação": "alta",
    "Sintaxe": "alta",
    "Semântica": "media",
    "Morfologia": "media",
    "Variação linguística": "media",
  },
  red: {
    "Estruturação": "alta",
    "Repertório sociocultural": "alta",
    "Prática cronometrada": "alta",
  },
  lit: {
    "Ideias para adiar o fim do mundo — Ailton Krenak": "alta",
    "Macunaíma — Mário de Andrade": "alta",
    "A fúria (contos) — Silvina Ocampo": "alta",
    "A teus pés (poesia) — Ana Cristina Cesar": "alta",
    "Modernismo (1ª fase)": "media",
    "Romantismo": "media",
    "Final do século XIX": "media",
  },
  lem: {
    "Compreensão de texto": "alta",
    "Vocabulário": "alta",
    "Gramática contextual": "media",
  },
};

if (typeof module !== "undefined") module.exports = { CANAIS, SITES, INCIDENCIA };
