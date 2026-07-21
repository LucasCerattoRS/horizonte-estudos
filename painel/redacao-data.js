/* ============================================================
   REDACAO-DATA — biblioteca do módulo de redação
   Curado à mão a partir de pesquisa/redacoes-notamil/INDICE.md
   e dos PDFs de prova em pesquisa/provas-antigas/ufrgs/.
   ============================================================ */

/* Competências do ENEM (matriz oficial, 0–200 em níveis de 40) */
const ENEM_COMP = [
  { id:"c1", curta:"Norma culta",    nome:"Domínio da escrita formal da língua portuguesa" },
  { id:"c2", curta:"Tema/repertório",nome:"Compreender o tema e aplicar conhecimentos de várias áreas" },
  { id:"c3", curta:"Argumentação",   nome:"Selecionar e organizar informações em defesa de um ponto de vista" },
  { id:"c4", curta:"Coesão",         nome:"Mecanismos linguísticos para a construção da argumentação" },
  { id:"c5", curta:"Intervenção",    nome:"Proposta de intervenção com respeito aos direitos humanos" },
];

/* Coletânea "Redação a Mil" (Lucas Felpi) — ~202 redações nota 1000 */
const REDAMIL_DIR = "../pesquisa/redacoes-notamil/";
const REDACOES_MIL = [
  { ano:2018, tema:"Manipulação do comportamento do usuário pelo controle de dados na internet", n:31, pdf:"Redacao-a-Mil-1.0_2018_Manipulacao-de-dados-na-internet.pdf" },
  { ano:2019, tema:"Democratização do acesso ao cinema no Brasil", n:44, pdf:"Redacao-a-Mil-2.0_2019_Democratizacao-do-cinema.pdf" },
  { ano:2020, tema:"Estigma associado às doenças mentais na sociedade brasileira", n:24, pdf:"Redacao-a-Mil-3.0_2020_Estigma-doencas-mentais.pdf" },
  { ano:2021, tema:"Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil", n:18, pdf:"Redacao-a-Mil-4.0_2021_Registro-civil-e-cidadania.pdf" },
  { ano:2022, tema:"Desafios para a valorização de comunidades e povos tradicionais no Brasil", n:27, pdf:"Redacao-a-Mil-5.0_2022_Comunidades-e-povos-tradicionais.pdf" },
  { ano:2023, tema:"Enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil", n:47, pdf:"Redacao-a-Mil-6.0_2023_Trabalho-de-cuidado-da-mulher.pdf" },
  { ano:2024, tema:"Desafios para a valorização da herança africana no Brasil", n:11, pdf:"Redacao-a-Mil-7.0_2024_Heranca-africana.pdf" },
];

/* Propostas de redação UFRGS: agora em painel/propostas-ufrgs-data.js
   (const PROPOSTAS_UFRGS gerada por pipeline/extrair_redacao_ufrgs.py, com
   tema/gênero/comando/coletânea extraídos do PDF). */

if (typeof module !== "undefined") module.exports = { ENEM_COMP, REDACOES_MIL };
