/* ============================================================
   RUBRICAS-REDACAO — critérios de correção por banca.
   Curado à mão; cada rubrica CONFERIDA NA FONTE (ver pesquisa/analise/FONTES.md).
   Usado pela aba Redação: exibição + prompt de correção automática.
   Cada banca com a SUA rubrica — nunca uma média (escalas diferentes).
   ============================================================ */
const RUBRICAS = {
  enem: {
    nome: "ENEM",
    escala: 1000,
    fonte: "Matriz de referência oficial (Cartilha do Participante, INEP)",
    criterios: [
      { id:"c1", curta:"Norma culta",     max:200, desc:"Domínio da modalidade escrita formal da língua portuguesa." },
      { id:"c2", curta:"Tema/repertório",  max:200, desc:"Compreender a proposta e aplicar conceitos de várias áreas; repertório legitimado e produtivo." },
      { id:"c3", curta:"Argumentação",     max:200, desc:"Selecionar, relacionar, organizar e interpretar informações em defesa de um ponto de vista." },
      { id:"c4", curta:"Coesão",           max:200, desc:"Mecanismos linguísticos de coesão entre e dentro dos parágrafos." },
      { id:"c5", curta:"Proposta",         max:200, desc:"Proposta de intervenção com 5 elementos: agente, ação, meio/modo, resultado e detalhamento — respeitando os direitos humanos." },
    ],
    // 2 avaliadores independentes; nota de cada competência = média dos dois.
    // Discrepância (chama 3º avaliador): diferença total > 100 OU > 80 em qualquer competência.
    aval: { modo:"espelhado", discrepTotal:100, discrepCrit:80 },
  },
  fuvest: {
    nome: "FUVEST",
    escala: 50,          // nota ponderada da banca: aspectos 1–5 × pesos 4,3,3 → varia de 10 a 50
    notaMin: 10,         // texto avaliado nunca fica abaixo de 10 (só a redação zerada vai a 0)
    notaFinal: "soma-ponderada",   // Σ (nota do aspecto × peso) — NÃO é média ponderada
    genero: "Dissertação de caráter argumentativo, sustentando um ponto de vista sobre o tema, com uso referenciado da coletânea.",
    fonte: "Guia do Vestibular FUVEST (Manual do Candidato), §Avaliação — 'Quais são os critérios de avaliação da redação?' e 'Como as notas são atribuídas na redação?'. Três aspectos; cada um dos DOIS avaliadores independentes atribui de 1 a 5 por aspecto; os pontos são multiplicados por 4, 3 e 3, dando a nota ponderada de 10 a 50.",
    criterios: [
      { id:"tema", curta:"Tema/organização", peso:4, min:1, max:5, desc:"Desenvolvimento do tema e organização do texto dissertativo-argumentativo: o texto se configura como dissertação argumentativa e atende ao tema; lê e relaciona adequadamente as ideias da coletânea (paráfrase NÃO é desenvolvimento); há progressão temática, pertinência das informações e capacidade crítico-argumentativa — não uma dissertação meramente expositiva." },
      { id:"coer", curta:"Coerência/coesão",  peso:3, min:1, max:5, desc:"Coerência dos argumentos e articulação das partes do texto: argumentos organizados de modo a extrair conclusões apropriadas, sem contradições, circularidade, quebra de progressão, argumentação de senso comum ou conclusão que não decorre do exposto; coesão = relações semânticas entre as partes e uso adequado de conectivos." },
      { id:"gram", curta:"Gramática/vocab.",  peso:3, min:1, max:5, desc:"Correção gramatical e adequação vocabular: domínio da norma-padrão escrita (ortografia, morfologia, sintaxe, pontuação) e clareza; vocabulário adequado e expressivo, com precisão e concisão, evitando clichês e frases feitas." },
    ],
    zero: "Recebem nota zero: redação em branco, tema diverso do solicitado, texto fora da modalidade discursiva pedida, extensão claramente abaixo do limite ou elementos verbais/visuais não relacionados ao tema.",
    // 2 avaliadores independentes, cada um pontuando 1–5 por aspecto. Divergência de 1 ponto
    // num aspecto → vale a MÉDIA dos dois. Divergência MAIOR que 1 ponto em qualquer aspecto
    // → 3ª avaliação, e a nota do 3º PREVALECE (não é a média do par mais próximo — o Guia
    // diz "prevalecerá a terceira nota").
    aval: { modo:"espelhado", discrepCrit:1, terceiroPrevalece:true },
  },
  glau: {
    nome: "Glau (tema livre)",
    escala: 10,
    fonte: "Critérios gerais Glau (rubrica genérica, 4 critérios × 2,5)",
    criterios: [
      { id:"c1", curta:"Escrita formal",  peso:2.5, desc:"Domínio da escrita formal da língua portuguesa." },
      { id:"c2", curta:"Tema",            peso:2.5, desc:"Desenvolvimento do tema e organização do texto dissertativo-argumentativo." },
      { id:"c3", curta:"Argumentos",      peso:2.5, desc:"Selecionar, organizar e relacionar argumentos de forma coerente." },
      { id:"c4", curta:"Coesão",          peso:2.5, desc:"Articulação das partes do texto (coesão)." },
    ],
    aval: { modo:"espelhado", discrepCrit:2 },
  },
  ufrgs: {
    nome: "UFRGS",
    escala: 20,          // soma das duas modalidades (analítica 0–10 + holística 0–10)
    conversao: 15,       // no concurso, a soma 0–20 é convertida a um escore 0–15 (= nº de questões da prova de LP)
    genero: "Dissertação argumentativa — ponto de vista fundamentado, do tipo pedido, dentro do limite de linhas.",
    fonte: "Edital CV 2026 (COPERSE/UFRGS), §6.16.5–6.16.7. A prova é avaliada em DUAS modalidades por examinadores distintos, cada uma com escore independente 0–10; o resultado final é a soma das duas, convertida a 0–15. A Redação vale 50% do escore bruto da prova de Língua Portuguesa e Redação (peso 3 na média harmônica, na maioria dos cursos).",
    // As duas MODALIDADES oficiais são os dois critérios pontuados (0–10 cada) —
    // é exatamente o que a banca faz: um examinador da analítica, um da holística.
    criterios: [
      { id:"analitica", curta:"Analítica",  max:10, desc:"Estrutura, conteúdo e expressão linguística. CONTEÚDO: abordagem própria do tema, a partir de um ponto de vista claro, consistente e autônomo, com argumentação estruturada que o sustenta na progressão do texto. EXPRESSÃO LINGUÍSTICA: convenções ortográficas, semântica, pontuação, sintaxe e morfossintaxe." },
      { id:"holistica", curta:"Holística",  max:10, desc:"O texto como um todo: apresentado como uma unidade, dentro de uma estrutura integrada, lógica e coesa. Assumir a temática para redigir uma redação do tipo pedido, no limite de linhas, adotando um ponto de vista e selecionando argumentos que dão sustentação ao texto." },
    ],
    // Regra de agregação/discrepância oficial (usada pela correção multi-avaliador — ver aval):
    aval: { modo:"modalidades", discrep:2.5, criterioTerceiro:"desempate" },
    // Requisitos formais impressos na prova (eliminatórios/limitantes):
    instrucoes: [
      "Conter um título na linha destinada a esse fim.",
      "Extensão mínima de 30 linhas (aquém disso o texto NÃO é avaliado) e máxima de 50 linhas.",
      "Segmentos emendados, rasurados, repetidos ou linhas em branco são descontados do cômputo.",
      "Escrita a caneta esferográfica azul ou preta, em letra legível de tamanho regular.",
    ],
  },
};

/* Propostas oficiais estruturadas (tema + coletânea), por banca.
   ENEM: temas 2018–2024 vêm de REDACOES_NOTAMIL (cartilhas). Aqui só o que exige
   coletânea/estrutura própria. UFRGS 2025/2026 (caderno escaneado) e demais anos
   entram quando extraídos. */
const PROPOSTAS_REDACAO = [
  {
    banca:"fuvest", ano:2025, tipo:"Dissertação argumentativa",
    tema:"As relações sociais por meio da solidariedade",
    fonte:"Vestibular FUVEST 2025 — 2ª fase (Guia de Respostas)",
    coletanea:"5 textos: (1) literário — a caridade como ascensão social (Machado de Assis); (2) filosófico — ajuda mútua como sobrevivência; (3) cultural — a escolha nas atitudes solidárias; (4) declaração — mobilização política/coletiva; (5) trecho de música — solidariedade como meio de vida.",
    pdf:"../pesquisa/provas-antigas/fuvest/fuvest2025_guia_respostas.pdf",
  },
];

/* ============================================================
   PERSONA BASE DO CORRETOR IA — systemInstruction fixa do Gemini.
   A rubrica da banca entra POR CIMA, no prompt de cada correção;
   isto aqui é o "quem corrige": método, postura e limites.
   Curado à mão (pedido do Alex, 2026-07-12).
   ============================================================ */
const CORRETOR_PERSONA = `Você é um corretor profissional de redações de vestibular, com mais de 15 anos de experiência em bancas oficiais (ENEM/INEP, UFRGS/COPERSE, FUVEST). Corrigir redações é a sua única função — você não conversa sobre outros assuntos.

MÉTODO (siga sempre, nesta ordem):
1. Primeira leitura integral, sem anotar: identifique a tese, o projeto de texto e a impressão global — como a banca faz.
2. Segunda leitura, critério a critério da rubrica recebida no pedido. Avalie CADA critério de forma independente; um texto pode ser forte em argumentação e fraco em norma culta.
3. Só então feche as notas, conferindo se o conjunto reflete o que uma banca real daria.

POSTURA DE NOTA:
- Nota realista de banca, nem generosa nem punitiva. Elogio não vale ponto; simpatia pelo tema não vale ponto.
- Distinga erro sistemático (se repete, derruba o critério) de deslize isolado (pesa pouco).
- Fuga do tema ou do gênero pedido: diga explicitamente e reflita na nota como a banca refletiria — isso não se "compensa" com boa escrita.
- Nunca invente critérios de outra banca: a rubrica recebida é a lei da correção.

COMO COMENTAR (é o que mais importa para o candidato):
- SEMPRE cite trechos literais da redação entre aspas como evidência de cada apontamento — nota sem evidência não ensina.
- Para cada critério, aponte 1 melhoria concreta e acionável que valeria pontos na próxima versão ("troque X por Y", "o 2º parágrafo precisa de Z").
- Tom direto, respeitoso e específico; zero jargão vazio ("melhore a coesão" NÃO — diga onde e como).
- Não reescreva a redação inteira; mostre o caminho, não o texto pronto.
- Requisitos formais de folha (nº de linhas, título, caneta) você não consegue verificar no texto digitado: quando a banca os tiver, lembre-os como observação, sem descontar nota por eles.

Escreva sempre em português brasileiro. Sua resposta final é sempre o JSON no esquema pedido — a análise vive nos campos de comentário.`;

if (typeof module !== "undefined") module.exports = { RUBRICAS, PROPOSTAS_REDACAO, CORRETOR_PERSONA };
