/* ============================================================
   PAINEL UFRGS/ENEM — Dados do edital (programa oficial UFRGS)
   Fonte: pesquisa/UFRGS_programa-conteudos.txt (Resoluções CEPE)
   Estrutura: DISCIPLINAS[] → eixos[] → topicos[] (unidade de status)
   Cada tópico carrega subtópicos (detalhe) e a prova a que pertence.
   ============================================================ */

// Provas objetivas UFRGS (9) — pesos somam 15; LP inclui Redação (peso 3 fixo)
const PROVAS = ["LP", "LIT", "HIS", "GEO", "MAT", "FIS", "QUI", "BIO", "LEM"];
const PROVA_NOME = {
  LP: "Língua Portuguesa + Redação", LIT: "Literatura", HIS: "História",
  GEO: "Geografia", MAT: "Matemática", FIS: "Física", QUI: "Química",
  BIO: "Biologia", LEM: "Língua Estrangeira"
};

// Perfis de peso por curso (soma 15; LP=3 sempre). Aproximações — conferir Manual do Candidato.
const CURSOS = {
  cic:      { nome: "Ciência da Computação",  pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  ecp:      { nome: "Engenharia de Computação", pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  engfis:   { nome: "Engenharia Física",      pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:2, FIS:3, QUI:1, BIO:2, LEM:1 } },
  estat:    { nome: "Estatística",            pesos: { LP:3, LIT:2, HIS:1, GEO:1, MAT:3, FIS:1, QUI:1, BIO:1, LEM:2 } },
  mat:      { nome: "Matemática (Bach/Lic)",  pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  quim:     { nome: "Química (Bach/Lic)",     pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:2, FIS:2, QUI:2, BIO:2, LEM:1 } },
  engciv:   { nome: "Engenharia Civil/Mecânica", pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  med:      { nome: "Medicina",               pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:1, FIS:1, QUI:3, BIO:3, LEM:1 } },
  biomed:   { nome: "Biomedicina",            pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:1, FIS:1, QUI:3, BIO:3, LEM:1 } },
  direito:  { nome: "Direito",                pesos: { LP:3, LIT:2, HIS:3, GEO:2, MAT:1, FIS:1, QUI:1, BIO:1, LEM:1 } },
  geral:    { nome: "Geral (equilibrado)",    pesos: { LP:3, LIT:2, HIS:2, GEO:1, MAT:2, FIS:1, QUI:1, BIO:2, LEM:1 } }
};

// t(nome, ...subtopicos) — helper de tópico
const t = (nome, ...subs) => ({ nome, subs });

const DISCIPLINAS = [
  {
    id: "bio", nome: "Biologia", prova: "BIO", icon: "🧬",
    nota: "Ênfase evolutiva e ecológica.",
    eixos: [
      { nome: "Organização dos seres vivos", topicos: [
        t("Composição química", "Água, sais, carboidratos, lipídios, proteínas, ácidos nucleicos, enzimas"),
        t("Estrutura, funcionamento e diversidade das células", "Célula procarionte × eucarionte; organelas; membrana e transporte"),
        t("Divisão celular", "Mitose e meiose; ciclo celular"),
        t("Diferenciação celular e tecidos animais e vegetais", "Tecidos epitelial, conjuntivo, muscular, nervoso; tecidos vegetais"),
      ]},
      { nome: "Diversidade dos seres vivos", topicos: [
        t("Origem da vida e evolução dos principais grupos", "Hipóteses; grandes reinos; filogenia"),
        t("Caracterização dos grupos", "Vírus, bactérias, protistas, fungos, plantas, animais"),
        t("Estrutura e função (fisiologia comparada)", "Sistemas: digestório, circulatório, respiratório, excretor, nervoso, endócrino"),
      ]},
      { nome: "Continuidade da vida", topicos: [
        t("Reprodução, crescimento e desenvolvimento", "Reprodução assexuada/sexuada; embriologia"),
        t("Hereditariedade", "Leis de Mendel; ligação gênica; herança ligada ao sexo; genética molecular"),
        t("Processos evolutivos", "Seleção natural; deriva; especiação; evidências"),
      ]},
      { nome: "Seres vivos e ambiente em interação", topicos: [
        t("Fluxo de energia e matéria nos ecossistemas", "Cadeias/teias; pirâmides; ciclos biogeoquímicos"),
        t("Dinâmica das comunidades biológicas", "Relações ecológicas; sucessão; biomas"),
        t("Conservação da natureza", "Impactos ambientais; poluição; biodiversidade"),
      ]},
    ]
  },
  {
    id: "fis", nome: "Física", prova: "FIS", icon: "⚡",
    eixos: [
      { nome: "Mecânica", topicos: [
        t("Cinemática", "Grandezas escalares/vetoriais; MRU e MRUV; gráficos; MCU e lançamento de projéteis"),
        t("Dinâmica", "3 leis de Newton; forças; momento de força; centro de gravidade e equilíbrio do corpo rígido"),
        t("Gravitação", "Lei da atração gravitacional; leis de Kepler; satélites"),
        t("Quantidade de Movimento Linear", "Impulso; conservação da QDM; centro de massa; colisões elásticas e inelásticas"),
        t("Trabalho e Energia", "Trabalho; potência; energia cinética/potencial; conservação da energia mecânica; máquinas simples"),
        t("Hidrostática", "Densidade; pressão; Lei de Stevin; Pascal; Arquimedes"),
      ]},
      { nome: "Termodinâmica", topicos: [
        t("Termometria e calorimetria", "Temperatura e escalas; calor; transmissão; dilatação; calor específico; mudanças de fase"),
        t("Gases e leis da termodinâmica", "Gás ideal; energia interna; 1ª e 2ª leis; transformações; máquinas térmicas; entropia"),
      ]},
      { nome: "Ondas e Óptica", topicos: [
        t("Movimento harmônico simples", "Osciladores massa-mola; pêndulo; gráficos e energia no MHS"),
        t("Ondas mecânicas e eletromagnéticas", "Propagação; superposição; reflexão; interferência; ressonância"),
        t("Acústica", "Ondas sonoras; intensidade; altura; timbre; batimentos; efeito Doppler"),
        t("Óptica", "Luz e espectro EM; óptica geométrica; espelhos e lentes; óptica ondulatória"),
      ]},
      { nome: "Eletromagnetismo", topicos: [
        t("Eletrostática", "Carga; eletrização; Lei de Coulomb; campo elétrico; Lei de Gauss; potencial"),
        t("Eletrodinâmica", "Corrente; resistência; tensão; fem; potência; circuitos; medidas elétricas"),
        t("Magnetismo", "Campo magnético; Ampère; Biot-Savart; força magnética; motor elétrico"),
        t("Indução eletromagnética", "Faraday; Lenz; transformador; comportamentos magnéticos da matéria"),
      ]},
      { nome: "Física Moderna", topicos: [
        t("Quantização e dualidade", "Corpo negro; efeito fotoelétrico; fótons; dualidade onda-partícula"),
        t("Relatividade restrita", "Postulados de Einstein; dilatação temporal; contração de Lorentz; energia relativística"),
        t("Física atômica e nuclear", "Modelos de Rutherford e Bohr; níveis de energia; radioatividade; reações nucleares; partículas elementares"),
      ]},
    ]
  },
  {
    id: "qui", nome: "Química", prova: "QUI", icon: "🧪",
    nota: "Modelo Rutherford-Bohr; TRPECV; recomendações IUPAC (mol).",
    eixos: [
      { nome: "Estrutura e matéria", topicos: [
        t("Caracterização física de sistemas materiais", "Estados; substâncias e misturas; densidade; solubilidade; separação de misturas; diagrama de fases"),
        t("Estrutura atômica", "Leis ponderais; modelos atômicos; número atômico/massa; isotopia; classificação periódica; propriedades periódicas"),
        t("Ligações químicas", "Iônica, covalente, metálica; fórmulas; TRPECV; geometria e polaridade; forças intermoleculares"),
      ]},
      { nome: "Reações e cálculos", topicos: [
        t("Cálculos estequiométricos", "Mol; massa molar; fórmulas percentual/mínima; relações ponderais e volumétricas"),
        t("Compostos inorgânicos", "Ionização/dissociação (Arrhenius); ácidos, bases, sais, óxidos; Brönsted-Lowry e Lewis"),
        t("Reações inorgânicas", "Balanceamento; oxirredução (nox, oxidante/redutor); síntese, análise, troca simples e dupla"),
        t("Soluções", "Concentrações; diluição e mistura; volumetria de neutralização; propriedades coligativas"),
      ]},
      { nome: "Físico-química", topicos: [
        t("Termoquímica", "Entalpia; reações endo/exotérmicas; Lei de Hess; entalpias de ligação"),
        t("Cinética química", "Teoria das colisões; energia de ativação; fatores de velocidade; lei de Guldberg-Waage"),
        t("Equilíbrio químico", "Kc e Kp; Le Chatelier; equilíbrios iônicos; Kw; pH e pOH; hidrólise"),
        t("Eletroquímica", "Pilhas e potencial padrão; eletrólise; leis de Faraday"),
      ]},
      { nome: "Química orgânica", topicos: [
        t("Compostos orgânicos", "Cadeias carbônicas; funções orgânicas; nomenclatura; isomeria plana e espacial; fontes naturais; biomoléculas"),
        t("Reações orgânicas", "Oxirredução; combustão; esterificação/hidrólise; adição; substituição; eliminação"),
      ]},
    ]
  },
  {
    id: "geo", nome: "Geografia", prova: "GEO", icon: "🌍",
    eixos: [
      { nome: "A dinâmica da natureza e a questão ambiental", topicos: [
        t("Elementos do universo e noções espaciais", "Sistema solar; Terra e Lua; orientação; movimentos da Terra; fusos horários"),
        t("Cartografia", "Coordenadas geográficas; interpretação de mapas; escalas e projeções; sensoriamento remoto e geoprocessamento"),
        t("Geologia e geomorfologia", "Estrutura da Terra; rochas e minerais; tectônica de placas; formas e agentes do relevo"),
        t("Solos", "Formação; classificação; conservação"),
        t("Atmosfera e clima", "Composição e camadas; tempo × clima; elementos; massas de ar; correntes; tipos de clima"),
        t("Vegetação e hidrografia", "Formações vegetais; extrativismo; ciclo hidrológico; oceanos; dinâmica fluvial; poluição hídrica"),
        t("Problemas ambientais globais", "Camada de ozônio; chuva ácida; efeito estufa; desertificação; biodiversidade; legislação"),
      ]},
      { nome: "Relações econômicas e sociais do homem no espaço", topicos: [
        t("Organização do espaço mundial", "Nova ordem mundial; blocos econômicos; focos de tensão; questão ambiental mundial; Antártica"),
        t("Atividades econômicas", "Agricultura; recursos naturais (energéticos, minerais); indústria; transportes; redes e fluxos; sistemas financeiros"),
        t("População e sua dinâmica espacial", "Estrutura, crescimento e distribuição; condições de vida; movimentos sociais; migrações"),
        t("Estruturação do espaço agrário", "Sistemas agropecuários; problemas ambientais rurais; estrutura fundiária e reforma agrária"),
        t("Processo de urbanização", "Estrutura urbana; problemas; tendências; sistemas urbanos"),
      ]},
    ]
  },
  {
    id: "his", nome: "História", prova: "HIS", icon: "📜",
    nota: "Articulação RS ↔ Brasil ↔ América Latina ↔ Mundial.",
    eixos: [
      { nome: "História Geral", topicos: [
        t("Sociedades Antigas do Oriente e do Ocidente", "Relações sociais e de produção; organização política; cultura"),
        t("Sociedades cristãs e islâmicas (séc. V-XV)", "Feudalismo; papel da Igreja; expansão do Islã; contradições do sistema feudal"),
        t("Formação e consolidação do capitalismo", "Renascimento, Reforma, expansão marítima; Antigo Sistema Colonial; revoluções burguesas; Revolução Industrial; imperialismo; 1ª Guerra; Revolução de 1917; nazifascismo; crise de 1929; 2ª Guerra; Guerra Fria; regimes militares na América Latina"),
        t("Mundialização, Globalização e Fragmentação", "Fim do campo socialista; fragmentação política; neoliberalismo; globalização"),
      ]},
      { nome: "História do Brasil", topicos: [
        t("Povos originários e colonização", "Organização social e resistência indígena; ocupação territorial; fronteiras"),
        t("Processo de emancipação política", "Crise do sistema colonial; significado da independência"),
        t("Império", "Bases e contradições; escravidão e liberdade; imigração açoriana e ítalo-germânica no RS; Guerra dos Farrapos; proclamação da República"),
        t("República Oligárquica", "Pós-abolição; coronelismo; positivismo e PRR no RS; crise oligárquica"),
        t("Populismo e Era Vargas", "Getúlio Vargas; redemocratização e trabalhismo; industrialização; golpe de 1964"),
        t("República após 1964", "Ditadura civil-militar; repressão e resistência; redemocratização e Nova República; RS atual e relações platinas"),
      ]},
    ]
  },
  {
    id: "port", nome: "Língua Portuguesa", prova: "LP", icon: "📚",
    nota: "Foco em leitura e interpretação, não decoreba gramatical.",
    eixos: [
      { nome: "Leitura e análise de textos", topicos: [
        t("Interpretação", "Compreensão global; significação contextual; inferências; elementos coesivos"),
        t("Estruturação do texto e dos parágrafos"),
        t("Variedades de texto e de linguagem"),
      ]},
      { nome: "Gramática contextual", topicos: [
        t("Sintaxe", "Frase, período, oração; coordenação e subordinação; discurso direto/indireto; pontuação, regência e concordância"),
        t("Morfologia", "Estrutura e formação de palavras; classes de palavras; flexão nominal e verbal"),
        t("Ortografia", "Sistema oficial vigente; relações fonema-letra"),
        t("Semântica", "Significação nos níveis lexical, frasal e textual; relações de sentido; deslocamentos"),
      ]},
      { nome: "Funcionamento social da língua", topicos: [
        t("Variação linguística", "Categorias sociais; contextos de comunicação"),
      ]},
    ]
  },
  {
    id: "red", nome: "Redação", prova: "LP", icon: "✍️",
    nota: "Dissertativo-argumentativo. Sem proposta de intervenção (≠ ENEM). Peso 3. Mínimo 30 linhas. Tema 2026: evasão/abandono escolar.",
    eixos: [
      { nome: "Critérios de avaliação (analítica)", topicos: [
        t("Abordagem do tema", "Compreensão adequada; atender às orientações da prova"),
        t("Definição do ponto de vista", "Posicionamento que orienta a reflexão dissertativa"),
        t("Contextualização do assunto", "Dados da realidade; citações, paráfrases, alusões"),
        t("Estruturação", "Hierarquia das partes; progressão e unidade; parágrafos"),
        t("Linguagem", "Norma padrão; coordenação/subordinação; pontuação; ortografia"),
      ]},
      { nome: "Treino e produção", topicos: [
        t("Repertório sociocultural", "Banco de repertórios; dados; filósofos; obras — ver redações nota 1000"),
        t("Prática cronometrada", "Escrever temas completos ≥30 linhas dentro do tempo"),
      ]},
    ]
  },
  {
    id: "lit", nome: "Literatura", prova: "LIT", icon: "📖",
    nota: "Do Renascimento ao pós-1970 + 12 obras obrigatórias. Forte eixo sul-rio-grandense.",
    eixos: [
      { nome: "Periodização", topicos: [
        t("Renascimento", "Gil Vicente e Camões"),
        t("Literatura no Período Colonial", "Literatura informativa; Carta de Caminha"),
        t("Barroco", "Gregório de Matos; Antônio Vieira"),
        t("Arcadismo", "Cláudio Manuel da Costa; Tomás Antônio Gonzaga; Basílio da Gama"),
        t("Romantismo", "Poesia (Gonçalves Dias, Castro Alves); romance (Alencar, Macedo); teatro (Martins Pena)"),
        t("Final do século XIX", "Machado, Aluísio, Pompéia, Eça; parnasianismo (Bilac); simbolismo (Cruz e Sousa); Partenon Literário (RS)"),
        t("Início do século XX", "Euclides da Cunha; Augusto dos Anjos; Lima Barreto; regionalismo (Simões Lopes Neto, Amaro Juvenal)"),
        t("Modernismo (1ª fase)", "Semana de 22; vanguardas; Fernando Pessoa; Bandeira, Mário e Oswald de Andrade; modernismo no RS"),
        t("Entre 30 e 45", "Romance de 30 (Graciliano, Jorge Amado, Erico Verissimo, Dyonélio); poesia (Drummond, Vinícius, Cecília, Quintana)"),
        t("Entre 45 e 70", "Guimarães Rosa, Clarice; João Cabral; Concretismo; crônica; teatro (Nelson Rodrigues, Suassuna); Tropicalismo"),
        t("Depois de 70", "Rubem Fonseca, Dalton Trevisan, João Ubaldo; canção (Caetano, Chico); ficção sul-rio-grandense (Scliar, Caio F., Sérgio Faraco)"),
      ]},
      { nome: "Obras obrigatórias UFRGS 2027 — ingressantes", topicos: [
        t("Ideias para adiar o fim do mundo — Ailton Krenak", "Ensaio; pensamento indígena; crítica à 'humanidade zumbi'; fabular novos mundos"),
        t("Macunaíma — Mário de Andrade", "Rapsódia; 'herói sem nenhum caráter'; descolonização da língua; contraste com Krenak"),
        t("A fúria (contos) — Silvina Ocampo", "Fantástico argentino; crianças cruéis; fissura do cotidiano burguês"),
        t("A teus pés (poesia) — Ana Cristina Cesar", "Ed. Brasiliense 1982; falsa confissão; geração mimeógrafo; não ler como biografia"),
      ]},
      { nome: "Obras obrigatórias UFRGS 2027 — remanescentes", topicos: [
        t("Quincas Borba — Machado de Assis", "Realismo; Humanitismo; 'ao vencedor, as batatas'; loucura e aniquilação do subalterno"),
        t("O Demônio Familiar — José de Alencar", "Comédia de costumes; crítica ao paternalismo escravista; alforria como punição"),
        t("Mrs. Dalloway — Virginia Woolf", "Fluxo de consciência; Clarissa × Septimus; tempo do Big Ben; shell shock"),
        t("A visão das plantas — Djaimilia P. de Almeida", "Ex-traficante cultiva jardim; jardim-cemitério; natureza indiferente; sem redenção"),
        t("Niketche — Paulina Chiziane", "Poligamia; dança de iniciação; Norte matriarcal × Sul patriarcal; motim das mulheres"),
        t("O avesso da pele — Jeferson Tenório", "Pai morto por bala policial em POA; 2ª pessoa; necropolítica; racismo estrutural"),
        t("Mas em que mundo tu vive — José Falero", "Crônicas da Vila Sapo (POA); voz gaúcha; abismo de classes; colonialidade"),
        t("Seleta de Canções — Lupicínio Rodrigues", "16 canções; dor-de-cotovelo; eu lírico traído/acusatório; prosopopeia; ler moralidade machista criticamente"),
      ]},
    ]
  },
  {
    id: "mat", nome: "Matemática", prova: "MAT", icon: "📐",
    nota: "~4min24s/questão. Gargalo é montagem (traduzir enunciado), não velocidade. Frequentemente articula 2+ conceitos.",
    eixos: [
      { nome: "Números e funções", topicos: [
        t("Conjuntos numéricos", "Naturais/inteiros (primos, MDC, MMC); racionais (razões, %, juros); reais; complexos (algébrica, geométrica, trigonométrica)"),
        t("Variáveis e funções", "Grandezas proporcionais; gráficos; função real; domínio/imagem; transformadas; inversa; linear/afim; quadrática"),
        t("Progressões", "Sequências (termo geral, recorrência); PA e PG (termo geral, interpolação, soma)"),
        t("Logaritmo e exponencial", "Funções exponenciais e logarítmicas; propriedades; equações exponenciais e logarítmicas"),
        t("Polinômios", "Grau, raízes, propriedades; equações algébricas; funções algébricas (zeros e sinais)"),
      ]},
      { nome: "Geometria e trigonometria", topicos: [
        t("Trigonometria", "Arcos e ângulos; razões no triângulo retângulo; funções circulares; identidades; leis dos senos e cossenos"),
        t("Geometria plana", "Polígonos e círculos; congruência e semelhança; áreas e perímetros; relações métricas"),
        t("Geometria espacial", "Poliedros; áreas e volumes (prismas, pirâmides, cilindros, cones, esferas); sólidos de revolução"),
        t("Geometria analítica plana", "Pontos e distâncias; retas (equações, paralelismo, perpendicularismo); circunferência; cônicas"),
      ]},
      { nome: "Álgebra linear e dados", topicos: [
        t("Matrizes, determinantes e sistemas", "Operações e propriedades; determinantes; sistemas lineares m×n (m,n ≤ 4)"),
        t("Análise combinatória, probabilidade e estatística", "Princípios de contagem; permutações, arranjos, combinações; binômio de Newton; probabilidade condicional; medidas de tendência e variabilidade"),
      ]},
    ]
  },
  {
    id: "lem", nome: "Língua Estrangeira", prova: "LEM", icon: "🌐",
    nota: "Escolher 1 idioma (Alex: Inglês). 100% compreensão de texto — sem metalinguagem.",
    eixos: [
      { nome: "Categorias da prova", topicos: [
        t("Compreensão de texto", "Contextualização (autoria, público, veículo); conteúdo (tema, pontos de vista, implícitos); recursos linguísticos (anafóricos, conectores)"),
        t("Vocabulário", "Paráfrases; equivalências lexicais; oposições semânticas; formação de palavras"),
        t("Gramática contextual", "Uso de nomes, pronomes, artigos, verbos, preposições, conjunções, advérbios aplicados à compreensão"),
      ]},
    ]
  },
];

// Diferenças ENEM (camada extra sobre o núcleo comum)
const ENEM_EXTRA = [
  { nome: "Filosofia", nota: "Só cai no ENEM (Ciências Humanas). Prioridade baixa p/ foco UFRGS." },
  { nome: "Sociologia", nota: "Só cai no ENEM. Prioridade baixa." },
  { nome: "Artes", nota: "Só cai no ENEM (Linguagens). Prioridade baixa." },
  { nome: "Redação ENEM", nota: "Exige proposta de intervenção (≠ UFRGS). 5 competências, TRI não se aplica à redação." },
];

if (typeof module !== "undefined") module.exports = { DISCIPLINAS, CURSOS, PROVAS, PROVA_NOME, ENEM_EXTRA };
