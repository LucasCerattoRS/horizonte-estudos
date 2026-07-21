/* ============================================================
   PAINEL UFRGS/ENEM — Leituras obrigatórias (a "anatomia" de cada obra)
   Formato por obra:
     frase     → a ideia central em uma frase
     eixos[]   → repertório p/ REDAÇÃO: {tema, oQue (no livro), comoUsar}
     objetivas[] → o que cai na OBJETIVA (conceitos/escola/forma)
     conexao   → diálogo com outra obra / gancho UFRGS (sul-rio-grandense etc.)
   lista: "ingressante" (4 obras 2027, valem até ~2029 — PRIORIDADE)
          "remanescente" (8 obras que seguem da lista anterior)
          "coringa" (NÃO é obrigatória UFRGS — repertório curinga p/ ENEM)
   ============================================================ */

const LEITURAS = [
  {
    id: "krenak", titulo: "Ideias para adiar o fim do mundo", autor: "Ailton Krenak",
    ano: "2019", genero: "Ensaio", lista: "ingressante", tags: ["indígena", "ambiental"],
    frase: "Ensaio-manifesto que ataca a ideia de “humanidade” como um clube excludente e propõe, a partir do pensamento indígena, adiar o colapso reaprendendo a viver junto à natureza e a sonhar outros mundos.",
    eixos: [
      { tema: "Crise climática e relação com a natureza",
        oQue: "Krenak recusa a separação entre humano e natureza: a Terra é um organismo vivo (a montanha, o rio são pessoas), não um estoque de recursos a explorar.",
        comoUsar: "Repertório para meio ambiente, sustentabilidade e consumo — argumente contra a lógica que trata a natureza como mercadoria descartável." },
      { tema: "Povos originários e colonialismo",
        oQue: "A noção de “humanidade” foi construída para incluir uns (brancos, europeus) e empurrar outros (indígenas, negros) para a “sub-humanidade”.",
        comoUsar: "Use em temas de desigualdade, apagamento cultural e direitos dos povos indígenas: a crítica de Krenak expõe quem historicamente ficou de fora do “nós”." },
      { tema: "Sentido da vida e “humanidade zumbi”",
        oQue: "Ele critica uma humanidade anestesiada, correndo atrás de progresso e produtividade sem perceber que caminha para o abismo.",
        comoUsar: "Repertório para saúde mental, produtivismo e o vazio da era do consumo." },
    ],
    objetivas: [
      { rotulo: "Gênero", texto: "Ensaio de tom oral — nasce de conferências/falas; linguagem direta, não acadêmica." },
      { rotulo: "Pensamento ameríndio", texto: "Perspectiva não-antropocêntrica; “adiar o fim do mundo” = resistência cotidiana, não salvação heroica." },
    ],
    conexao: "Dialoga com Macunaíma: ambos descolonizam o olhar sobre o Brasil, mas Krenak é ensaio contemporâneo, não ficção.",
  },
  {
    id: "macunaima", titulo: "Macunaíma", autor: "Mário de Andrade",
    ano: "1928", genero: "Rapsódia (romance modernista)", lista: "ingressante", tags: ["modernismo"],
    frase: "A “rapsódia” modernista de Macunaíma, o “herói sem nenhum caráter”, que sai da Amazônia rumo à São Paulo industrial atrás da muiraquitã — um mosaico de mitos e falas de todo o Brasil para inventar uma identidade nacional plural e contraditória.",
    eixos: [
      { tema: "Identidade nacional e miscigenação",
        oQue: "Macunaíma nasce “preto retinto”, tem irmãos de outras raças e não tem caráter fixo — é a síntese do brasileiro em formação.",
        comoUsar: "Repertório para temas de identidade, diversidade cultural e formação do povo brasileiro." },
      { tema: "Modernização, cidade e tecnologia",
        oQue: "O choque do herói mítico amazônico com a máquina e a metrópole: Macunaíma confunde a máquina com uma divindade e não a domina.",
        comoUsar: "Use em temas sobre progresso técnico, urbanização acelerada e o descompasso entre tradição e modernidade." },
      { tema: "Cultura popular e oralidade",
        oQue: "O livro colhe folclore, lendas, provérbios e bordões (“Ai, que preguiça!”) de várias regiões.",
        comoUsar: "Repertório para valorização da cultura popular e do patrimônio imaterial." },
    ],
    objetivas: [
      { rotulo: "Escola", texto: "Modernismo, 1ª fase; ligado à Antropofagia (devorar a cultura estrangeira e reprocessá-la)." },
      { rotulo: "“Sem caráter”", texto: "Duplo sentido: sem índole fixa E sem ética/moral estável." },
      { rotulo: "Forma", texto: "Rapsódia = colagem de episódios e registros; descoloniza a língua misturando falares." },
    ],
    conexao: "Faz par com Krenak na lista de 2027: os dois reinventam o Brasil por dentro, contra o olhar colonial.",
  },
  {
    id: "afuria", titulo: "A fúria (contos)", autor: "Silvina Ocampo",
    ano: "1959", genero: "Contos", lista: "ingressante", tags: ["fantástico", "argentina"],
    frase: "Coletânea do fantástico rio-platense em que a crueldade irrompe do cotidiano doméstico e burguês, quase sempre pela mão de crianças e mulheres de aparência inocente.",
    eixos: [
      { tema: "Violência sob a boa aparência",
        oQue: "O mal se esconde atrás das boas maneiras e dos ambientes respeitáveis da elite.",
        comoUsar: "Repertório para temas sobre hipocrisia social e violência velada nas relações “civilizadas”." },
      { tema: "Infância desidealizada",
        oQue: "As crianças de Ocampo são cruéis, manipuladoras — o oposto do mito da inocência infantil.",
        comoUsar: "Use para questionar idealizações (da infância, da família) e discutir formação e ambiente." },
      { tema: "Condição feminina",
        oQue: "Mulheres presas a papéis domésticos cuja tensão acaba explodindo em fúria.",
        comoUsar: "Repertório para papéis de gênero e sobrecarga/silenciamento feminino." },
    ],
    objetivas: [
      { rotulo: "Fantástico", texto: "Rio-platense: o real é perturbado sem explicação sobrenatural nítida — o estranho brota do comum." },
      { rotulo: "Narrador", texto: "Naturaliza o horror, contando atrocidades com frieza." },
    ],
    conexao: "Única obra hispano-americana da lista de ingressantes; contraste de tom com o lirismo de Ana Cristina Cesar.",
  },
  {
    id: "anac", titulo: "A teus pés (poesia)", autor: "Ana Cristina Cesar",
    ano: "1982", genero: "Poesia", lista: "ingressante", tags: ["poesia", "geração mimeógrafo"],
    frase: "Livro da “geração mimeógrafo” que simula uma confissão íntima (diário, cartas, bilhetes) mas arma armadilhas: a intimidade é máscara literária, não biografia.",
    eixos: [
      { tema: "Intimidade e performance do eu",
        oQue: "O “eu” que se confessa é uma construção; o leitor é atraído a achar que é desabafo real e é frustrado.",
        comoUsar: "Repertório para exposição da vida privada, autenticidade e imagem de si nas redes sociais." },
      { tema: "Escrita feminina e corpo",
        oQue: "Voz feminina que fala de desejo e subjetividade fora dos moldes.",
        comoUsar: "Use em temas de autoria feminina e representação da mulher." },
    ],
    objetivas: [
      { rotulo: "Contexto", texto: "Poesia marginal dos anos 70/80 (geração mimeógrafo), fora do circuito das grandes editoras." },
      { rotulo: "Erro clássico", texto: "“Falsa confissão”: NÃO ler o eu lírico como biografia (nem projetar a morte da autora nos versos)." },
      { rotulo: "Linguagem", texto: "Mistura prosa, citações e tom coloquial; muita intertextualidade." },
    ],
    conexao: "",
  },
  {
    id: "quincas", titulo: "Quincas Borba", autor: "Machado de Assis",
    ano: "1891", genero: "Romance realista", lista: "remanescente", tags: ["realismo"],
    frase: "Rubião herda a fortuna do filósofo Quincas Borba e sua doutrina, o “Humanitismo” (“ao vencedor, as batatas”), e é devorado pela sociedade do Rio até enlouquecer e morrer na miséria.",
    eixos: [
      { tema: "Meritocracia e darwinismo social",
        oQue: "O Humanitismo justifica que o forte destrói o fraco como lei natural — “ao vencedor, as batatas”.",
        comoUsar: "Repertório afiadíssimo contra o discurso da meritocracia e a naturalização da desigualdade." },
      { tema: "Aparência, status e ascensão social",
        oQue: "Rubião, novo-rico ingênuo, é manipulado pelo casal Cristiano e Sofia Palha, que exploram seu dinheiro e sua paixão.",
        comoUsar: "Use em temas sobre status, consumo de imagem e relações de interesse." },
      { tema: "Loucura e exclusão",
        oQue: "Sem dinheiro e sem lugar, Rubião enlouquece e é descartado.",
        comoUsar: "Repertório para saúde mental e abandono dos vulneráveis." },
    ],
    objetivas: [
      { rotulo: "Escola", texto: "Realismo; narrador irônico e cúmplice do leitor, típico de Machado." },
      { rotulo: "Humanitismo", texto: "Paródia das teorias cientificistas do séc. XIX (positivismo, darwinismo social)." },
    ],
    conexao: "",
  },
  {
    id: "demonio", titulo: "O Demônio Familiar", autor: "José de Alencar",
    ano: "1857", genero: "Teatro (comédia de costumes)", lista: "remanescente", tags: ["romantismo", "teatro"],
    frase: "Comédia em que o escravo doméstico Pedro, tentando arranjar a vida amorosa dos senhores para subir na vida, provoca confusões — e é “premiado” com a alforria, que na peça funciona como afastamento/punição.",
    eixos: [
      { tema: "Escravidão e paternalismo",
        oQue: "O “demônio familiar” é a própria escravidão convivendo dentro de casa; a crítica é ambígua, feita do ponto de vista do senhor.",
        comoUsar: "Repertório para herança escravista e racismo estrutural — atenção: a peça expõe a ótica senhorial da época." },
      { tema: "Lugar social e ascensão",
        oQue: "Pedro é punido por querer mais do que a sociedade escravista lhe reservava.",
        comoUsar: "Use em temas sobre mobilidade social e barreiras impostas a quem “sai do lugar”." },
    ],
    objetivas: [
      { rotulo: "Escola/forma", texto: "Romantismo; teatro de Alencar; comédia de costumes do Segundo Reinado." },
      { rotulo: "Leitura crítica", texto: "A alforria como desfecho-castigo revela a perspectiva do senhor, não a do escravizado." },
    ],
    conexao: "Par histórico com Quincas Borba para pensar o Brasil do séc. XIX (escravidão e sociedade).",
  },
  {
    id: "dalloway", titulo: "Mrs. Dalloway", autor: "Virginia Woolf",
    ano: "1925", genero: "Romance modernista", lista: "remanescente", tags: ["modernismo", "inglesa"],
    frase: "Um único dia de Clarissa Dalloway em Londres organizando uma festa, entrelaçado ao colapso do veterano Septimus, num fluxo de consciência em que o tempo interior importa mais que o relógio do Big Ben.",
    eixos: [
      { tema: "Saúde mental e trauma de guerra",
        oQue: "Septimus sofre de “shell shock” (trauma da 1ª Guerra) e é tratado com descaso pelos médicos, até o suicídio.",
        comoUsar: "Repertório forte para saúde mental, pós-guerra e a frieza da medicina/instituições." },
      { tema: "Papéis de gênero e escolhas",
        oQue: "Clarissa reflete sobre a vida que não viveu, entre o casamento seguro e os desejos abandonados.",
        comoUsar: "Use em temas sobre expectativas de gênero e liberdade das mulheres." },
    ],
    objetivas: [
      { rotulo: "Técnica", texto: "Fluxo de consciência; tempo psicológico × cronológico (as badaladas do Big Ben)." },
      { rotulo: "Estrutura", texto: "Clarissa e Septimus como espelhos (vida × morte), sem nunca se encontrarem." },
    ],
    conexao: "",
  },
  {
    id: "visaoplantas", titulo: "A visão das plantas", autor: "Djaimilia Pereira de Almeida",
    ano: "2019", genero: "Romance", lista: "remanescente", tags: ["pós-colonial", "portuguesa"],
    frase: "Um ex-traficante de escravizados português, já velho, cultiva um belo jardim à beira-mar — mas a beleza que ele cria não redime a violência que praticou: a natureza é indiferente ao mal humano.",
    eixos: [
      { tema: "Colonialismo e (não) redenção",
        oQue: "O passado do tráfico atlântico não se apaga com jardins e boas maneiras.",
        comoUsar: "Repertório para reparação histórica, herança da escravidão e responsabilidade das ex-metrópoles." },
      { tema: "Memória, impunidade e esquecimento",
        oQue: "O algoz vive tranquilo; o horror colonial é recalcado, não punido.",
        comoUsar: "Use em temas sobre memória histórica e o perigo do apagamento do passado." },
    ],
    objetivas: [
      { rotulo: "Contexto", texto: "Literatura pós-colonial de língua portuguesa (autora luso-angolana)." },
      { rotulo: "Chave de leitura", texto: "Ausência de redenção; a natureza (o jardim) é amoral, floresce sobre a violência." },
    ],
    conexao: "Conversa com Niketche, O avesso da pele e Krenak: colonialidade e seus rastros no presente.",
  },
  {
    id: "niketche", titulo: "Niketche: uma história de poligamia", autor: "Paulina Chiziane",
    ano: "2002", genero: "Romance", lista: "remanescente", tags: ["africana", "moçambique"],
    frase: "Em Moçambique, Rami descobre os vários amores do marido e, em vez de guerra, reúne as outras mulheres — a poligamia vira caminho de descoberta e solidariedade feminina e revela o choque entre o Sul patriarcal e o Norte matriarcal do país.",
    eixos: [
      { tema: "Condição da mulher e sororidade",
        oQue: "De rivais a aliadas: as mulheres se unem em vez de competir pelo mesmo homem.",
        comoUsar: "Repertório fortíssimo para empoderamento feminino, sororidade e autonomia da mulher." },
      { tema: "Tradição × modernidade e colonialismo",
        oQue: "Leis do Estado e moral cristã colidem com costumes locais (o Norte matriarcal, a poligamia).",
        comoUsar: "Use em temas sobre choque cultural, colonialidade e direitos em sociedades plurais." },
      { tema: "Corpo, desejo e cultura",
        oQue: "A “niketche” é a dança de iniciação sexual e amorosa — o corpo feminino como saber e poder.",
        comoUsar: "Repertório para tabus sobre sexualidade e valorização de culturas não-ocidentais." },
    ],
    objetivas: [
      { rotulo: "Contexto", texto: "Literatura africana de língua portuguesa; Chiziane é a 1ª romancista moçambicana." },
      { rotulo: "Forma", texto: "Oralidade, provérbios; a poligamia funciona como crítica social, não exotismo." },
    ],
    conexao: "",
  },
  {
    id: "avesso", titulo: "O avesso da pele", autor: "Jeferson Tenório",
    ano: "2020", genero: "Romance", lista: "remanescente", tags: ["afro-brasileira", "sul-rio-grandense"],
    frase: "O filho Pedro reconstrói a vida do pai, Henrique, professor negro morto pela violência policial em Porto Alegre — narrando em 2ª pessoa (“você”) para entender o racismo que moldou e destruiu essa vida.",
    eixos: [
      { tema: "Racismo estrutural e necropolítica",
        oQue: "Henrique é morto por engano numa abordagem policial: o corpo negro tratado como suspeito e descartável.",
        comoUsar: "Repertório central para temas de racismo, violência policial e segurança pública." },
      { tema: "Educação e resistência",
        oQue: "O pai é professor; a leitura e o conhecimento aparecem como forma de resistir e existir.",
        comoUsar: "Use em temas sobre o papel da educação e o acesso desigual a ela." },
      { tema: "Família, herança e afeto",
        oQue: "O “avesso da pele” é o que se herda: dor, história e amor entre pai e filho.",
        comoUsar: "Repertório para vínculos familiares e construção da identidade." },
    ],
    objetivas: [
      { rotulo: "Contexto", texto: "Literatura afro-brasileira contemporânea; racismo estrutural." },
      { rotulo: "Forma", texto: "Narração em 2ª pessoa (o filho fala com o pai morto); ambientação em Porto Alegre/RS." },
    ],
    conexao: "Eixo sul-rio-grandense da UFRGS: POA como cenário, junto de Falero (Mas em que mundo tu vive).",
  },
  {
    id: "falero", titulo: "Mas em que mundo tu vive", autor: "José Falero",
    ano: "2020", genero: "Contos / crônicas", lista: "remanescente", tags: ["periférica", "sul-rio-grandense"],
    frase: "Contos e crônicas da periferia de Porto Alegre (a Vila Sapo) que dão voz ao trabalhador gaúcho e expõem, com humor e fala popular, o abismo de classe e a colonialidade do dia a dia.",
    eixos: [
      { tema: "Desigualdade e classe",
        oQue: "O contraste entre a periferia e a elite, o trabalho precarizado e a falta de perspectiva.",
        comoUsar: "Repertório para desigualdade social, mundo do trabalho e precarização (uberização)." },
      { tema: "Linguagem e identidade",
        oQue: "A fala gaúcha popular é levada a sério como matéria literária.",
        comoUsar: "Use em temas sobre variação linguística e preconceito com o modo de falar." },
    ],
    objetivas: [
      { rotulo: "Contexto", texto: "Literatura marginal/periférica contemporânea; ambientação POA/RS." },
      { rotulo: "Gancho com LP", texto: "Oralidade e variação linguística — conecta com a prova de Língua Portuguesa (norma × variação)." },
    ],
    conexao: "Faz dupla com O avesso da pele: dois olhares sobre Porto Alegre e suas desigualdades.",
  },
  {
    id: "lupicinio", titulo: "Seleta de Canções", autor: "Lupicínio Rodrigues",
    ano: "séc. XX", genero: "Canção (letras)", lista: "remanescente", tags: ["canção", "sul-rio-grandense"],
    frase: "Dezesseis canções do compositor gaúcho, mestre da “dor de cotovelo”, em que o eu lírico traído transforma ciúme, orgulho ferido e vingança em samba-canção — repertório da cultura popular do RS.",
    eixos: [
      { tema: "Amor, ciúme e masculinidade",
        oQue: "O eu lírico é o homem traído que acusa e sofre; a “dor de cotovelo” como marca.",
        comoUsar: "Repertório para relações afetivas — mas leia CRITICAMENTE a moral machista do “homem ferido”." },
      { tema: "Cultura popular e regionalismo",
        oQue: "Boemia, futebol e a Porto Alegre da época (é dele o hino do Grêmio).",
        comoUsar: "Use em temas sobre patrimônio cultural e identidade regional." },
    ],
    objetivas: [
      { rotulo: "Gênero", texto: "Canção como gênero literário: a letra vale com sua melodia e contexto." },
      { rotulo: "Recursos", texto: "Eu lírico; figuras (prosopopeia, hipérbole); ler a moral de época com distanciamento crítico." },
    ],
    conexao: "Fecha o eixo sul-rio-grandense da lista, ao lado de Tenório e Falero.",
  },

  /* ---------- CORINGA (não é obrigatória UFRGS — repertório p/ ENEM) ---------- */
  {
    id: "cemanos", titulo: "Cem Anos de Solidão", autor: "Gabriel García Márquez",
    ano: "1967", genero: "Romance", lista: "coringa", tags: ["realismo mágico", "curinga ENEM"],
    frase: "A ascensão e queda da cidade fictícia de Macondo e de sete gerações dos Buendía como metáfora da América Latina: um ciclo infinito de exploração, guerras inúteis, esquecimento e incapacidade de aprender com o passado — a verdadeira “solidão” do título.",
    eixos: [
      { tema: "Memória, fake news e apagamento histórico",
        oQue: "A Companhia Bananeira (norte-americana) massacra mais de 3 mil grevistas; no dia seguinte, governo e empresa somem com os corpos e impõem a versão de que “nada aconteceu”. Com o tempo, todos acreditam na mentira e o único que lembra é tido por louco.",
        comoUsar: "Excelente para manipulação da informação, revisionismo histórico, fake news e a importância de preservar a memória." },
      { tema: "Tecnologia e alienação",
        oQue: "A “praga da insônia” faz Macondo perder a memória: as pessoas esquecem o nome e a função das coisas e precisam etiquetar tudo (“isto é uma vaca, ela dá leite”).",
        comoUsar: "Analogia perfeita para dependência tecnológica, terceirização da memória para o smartphone e temas como Alzheimer/envelhecimento." },
      { tema: "Trabalho e imperialismo",
        oQue: "A Companhia Bananeira traz “progresso” (trem, eletricidade), explora a mão de obra até o limite, drena as riquezas e vai embora, deixando a cidade em ruínas.",
        comoUsar: "Ótimo para precarização do trabalho, neocolonialismo, exploração ambiental e os danos da globalização desenfreada." },
      { tema: "Saúde mental e individualismo",
        oQue: "A solidão dos Buendía é emocional, não física: eles são incapazes de amar e de se comunicar, presos às próprias obsessões.",
        comoUsar: "Repertório forte para a “multidão solitária” das cidades, depressão e individualismo na era das redes." },
    ],
    objetivas: [
      { rotulo: "Realismo mágico", texto: "A magia NÃO é fantasia tipo Harry Potter: o elemento mágico denuncia uma realidade política tão absurda que parece mentira (a miséria e os golpes são “normais”; o gelo é “mágico”)." },
      { rotulo: "Tempo cíclico", texto: "O tempo anda em círculos, não para frente — reflete a estagnação política da América Latina, repetindo ditaduras e dependência geração após geração." },
    ],
    conexao: "Não está na lista UFRGS, mas é curinga de redação no ENEM e ajuda a entender o realismo mágico latino-americano.",
  },
];

if (typeof module !== "undefined") module.exports = { LEITURAS };
