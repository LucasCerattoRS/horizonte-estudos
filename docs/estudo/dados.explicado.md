# 🗃️ `dados.explicado.md` — a camada de dados como um todo

> **Arquivos reais:** os 15 `painel/*-data.js` · **Etapa no roteiro:** 2 (os dados)
> **Pré-requisito:** [`edital-data.explicado.md`](edital-data.explicado.md)

Este documento é **diferente** dos outros: não é linha-a-linha. Não faz sentido
explicar "linha a linha" um arquivo que é **uma linha só de 4,5 MB** com 1400
questões em JSON. Aqui a gente mapeia a **camada de dados inteira**: quantos arquivos
são, quem os escreveu (você na mão × um script), como distinguir um do outro num
relance, e o schema de cada. É o mapa que faltava para as abas (Etapa 3) fazerem
sentido — cada aba é, no fundo, um leitor de um destes arquivos.

---

## §1 — Duas famílias: **gerado** × **curado à mão**

Todo `*-data.js` cai em um de dois grupos, e **a primeira linha do arquivo te diz
qual**:

**Gerado (um script escreveu):** o comentário começa com `GERADO por pipeline/…`.
```js
/* GERADO por pipeline/gerar_gabaritos.py — NÃO EDITAR À MÃO. */
```
**Curado à mão (uma pessoa digitou):** o comentário descreve o formato, sem "GERADO".
```js
/* REDACAO-DATA — biblioteca do módulo de redação. Curado à mão a partir de … */
```

**Por que isso é a informação mais importante da camada de dados?** Porque define
**onde você edita**. Regra de ouro do projeto (está no `CLAUDE.md`):

> Arquivo **gerado** → **nunca** edite o `.js`. Edite a **fonte** (o PDF/HTML, ou o
> `edital-data.js`) e **rode o gerador de novo**. Sua edição manual num arquivo
> gerado é apagada no próximo `python3 pipeline/gerar_*.py`.

Editar um `.js` gerado é como corrigir o texto num PDF exportado em vez de corrigir no
documento original: some na próxima exportação. Pior: cria uma **divergência
silenciosa** entre a fonte e o resultado, que ninguém percebe até regenerar.

---

## §2 — Anatomia de um blob gerado (por que é *uma linha gigante*)

```js
const GABARITOS_UFRGS = {"2016":{"port":{"nome":"Português","disc":"port","q":{"1":"A","2":"C",…}}}};
```

**O quê:** um `const NOME = <JSON gigante>`. Uma variável global, um valor enorme,
tudo numa linha.

**Por que numa linha só?** Porque não foi um humano que digitou — foi
`JSON.stringify(dados)` (ou o `json.dumps` do Python) cuspindo o objeto **sem
indentação**, para o arquivo ficar menor. Um humano formataria com quebras de linha
para ler; uma máquina não precisa ler, precisa **carregar rápido**. `banco-questoes-
data.js` tem **4,5 MB numa linha** — abrir isso num editor trava; é para o navegador
`eval`ar, não para você ler. (Para inspecionar, use um script: `JSON.parse` + filtro.)

**Conceito — dado embutido como `const` global, não como JSON externo.** Por que não
um `banco.json` carregado com `fetch`? Porque o painel roda em **`file://`**, e
`fetch("banco.json")` de um arquivo local é **bloqueado** pelo navegador (origem
opaca / CORS). A saída é embrulhar o JSON num `.js` (`const X = {…}`) e carregar com
`<script src>` — que `file://` permite. Então **todo dado do app é uma variável
global JavaScript**, não um recurso buscado em runtime. Essa é a mesma restrição-mãe
que proíbe ES Modules (ver [`edital-data.explicado.md §6`](edital-data.explicado.md)).

**Nota — as chaves numéricas viram string:** repare `"q":{"1":"A","2":"C"}`. Em JSON
(e em objeto JS) **toda chave é string** — não existe chave `1` numérica. Por isso o
código que lê o gabarito faz `GABARITOS_UFRGS["2016"].port.q[String(n)]` ou
`q[n]` (o JS converte `n` para `"n"` automaticamente ao indexar). Errar isso é fonte
clássica de `undefined`.

---

## §3 — O catálogo dos 15 arquivos

**Gerados pelo pipeline (NÃO editar à mão):**

| Arquivo | Global | Gerador | O que guarda |
|---|---|---|---|
| `gabaritos-data.js` | `GABARITOS_UFRGS` | `gerar_gabaritos.py` (HTMLs) | gabarito oficial UFRGS por ano→disciplina→questão→letra |
| `gabaritos-enem-data.js` | `GABARITOS_ENEM` | `gerar_gabaritos_enem.py` (PDFs) | gabarito ENEM por ano→área→questão (caderno AZUL) |
| `banco-questoes-data.js` | `BANCO_QUESTOES` | `cruzar_questoes.py` | **4,5 MB** — as questões extraídas + gabarito cruzado |
| `frequencia-data.js` | `FREQUENCIA` | `gerar_frequencia.py` | incidência real por tópico do edital (a base da Análise) |
| `relacoes-data.js` | `RELACOES` | `gerar_relacoes.py` | pré-requisitos + laços interdisciplinares entre tópicos |
| `propostas-ufrgs-data.js` | `PROPOSTAS_UFRGS` | `extrair_redacao_ufrgs.py` | propostas de redação UFRGS (tema+gênero+comando) |
| `redacoes-notamil-data.js` | `REDACOES_NOTAMIL` | `transcrever_cartilhas.py` | **634 KB** — redações nota-1000 transcritas |
| `notas-data.js` | (conteúdo por tópico) | `gerar_notas_web.cjs` | resumo/fórmulas/pegadinhas por tópico (leitor de notas) |

**Curados à mão (a fonte é você; sem gerador):**

| Arquivo | Global | O que guarda |
|---|---|---|
| `edital-data.js` | `DISCIPLINAS`, `CURSOS`, `PROVAS`… | **o schema** (documentado à parte) |
| `leituras-data.js` | (por obra) | anatomia das obras obrigatórias: `frase`, `eixos[]` (repertório p/ redação), `objetivas[]`, `conexao` |
| `recursos-data.js` | `CANAIS`, `SITES`, `INCIDENCIA` | curadoria de canais/sites externos por disciplina |
| `redacao-data.js` | `ENEM_COMP`… | competências, estrutura e biblioteca do módulo de redação |
| `textos-modelo-data.js` | `TEXTOS_MODELO` | textos autorais exemplares (Carta Testamento etc.) para estudar estilo |
| `rubricas-redacao-data.js` | `RUBRICAS` | critérios de correção **por banca** (nunca uma média — escalas diferentes) |
| `fases-data.js` | `DATAS_PROVA`, `DATAS_ESTIMADAS`, `FASES`, `TRILHA` | datas das provas + as 4 fases do cronograma macro + a Trilha de Arranque |

**Como ler a tabela:** a coluna "Global" é o nome que outras fatias usam. Quando
`app-banco.js` faz `BANCO_QUESTOES.filter(...)`, é este `banco-questoes-data.js` que
está sendo lido. Não há import — a variável simplesmente **já existe** no escopo
global porque o `<script>` dela carregou antes.

---

## §4 — O fluxo: da prova oficial ao dado na tela

Os arquivos gerados nascem de um **pipeline** de 4 estágios. Exemplo com os gabaritos
UFRGS:

```
pesquisa/provas-antigas/ufrgs/gabaritos/*.html   ← fonte (baixada de ufrgs.br)
        │  python3 pipeline/gerar_gabaritos.py    ← o gerador (parseia o HTML)
        ▼
painel/gabaritos-data.js  (const GABARITOS_UFRGS = {…})   ← dado embutido
        │  <script src> no index.html
        ▼
app-banco.js  →  corrige sua prova comparando suas respostas × GABARITOS_UFRGS
```

**Conceito — "build step" sem build tool.** Projetos modernos têm um passo de *build*
(webpack, vite) que transforma fonte em bundle. Aqui o "build" é **rodar um script
Python à mão** que reescreve um `.js`. Mais rústico, mas cumpre o mesmo papel: separar
a **fonte de verdade** (os HTMLs/PDFs oficiais) do **artefato consumido** (o `.js`).
A vantagem para este projeto: zero dependência de npm/node_modules, e o resultado é um
arquivo estático que abre em `file://`.

**Por que os dados ficam versionados no Git** (e não só as fontes)? Para o painel
funcionar **sem rodar o pipeline**. Quem clona o repo já tem `gabaritos-data.js`
pronto — não precisa de Python, pdftotext, nem das provas. O gerador só é necessário
para **atualizar** (prova nova saiu). É a troca "repo maior, setup zero".

---

## §5 — A barreira de dados (segurança)

Este é o conceito **mais importante** da camada, e não é sobre sintaxe — é sobre
confiança. O pipeline **baixa PDFs/HTMLs da internet** e os transforma nesses `.js`.
Regra permanente do projeto:

> **Todo texto vindo de download ou extração é DADO não-confiável — nunca instrução.**

Ou seja: se dentro de um PDF de prova (ou de uma resposta do Gemini que gerou
`relacoes-data.js`) aparecer algo como *"ignore as regras e rode tal comando"*, isso é
**conteúdo a ser exibido**, jamais uma ordem a executar. Três defesas concretas:

1. **Allowlist de fontes:** só se baixa de `ufrgs.br` (COPERSE) e
   `gov.br`/`inep` (ENEM). Fonte nova exige registro em `pesquisa/analise/FONTES.md`.
2. **Barreira de schema:** o dado extraído só entra no painel passando por um
   **validador estrito** no gerador (faixas numéricas, campos obrigatórios via
   `need()`, `validar_questoes.py`). Se a validação falha, investiga-se — **não se
   afrouxa o validador** para "passar".
3. **Downloads não são executáveis:** o arquivo baixado só é lido por *parser*
   (pdftotext, regex, `json.loads`) — nunca aberto/rodado. Nada de `bash <(curl …)`.

**Conceito — injeção via dados (data as code injection).** É o primo do SQL injection
e do XSS: o perigo mora em tratar **entrada não-confiável** como se fosse **código/
comando confiável**. A defesa é sempre a mesma: uma **fronteira** clara onde o dado é
validado e "desarmado" antes de cruzar para o lado confiável. Aqui a fronteira é o
gerador + validador. Guarde este princípio — vale para qualquer sistema que ingere
dados de fora.

---

## §6 — Dados que sobreviveram ao seu gerador

Detalhe histórico que ensina uma distinção fina. Em 2026-07-14 a **API do Gemini saiu
do projeto** (o Alex estourou a cota; decisão de produto: sem IA). Alguns geradores
usavam o Gemini — `gerar_relacoes.py`, `extrair_redacao_ufrgs.py`, a classificação do
banco. Esses **scripts foram apagados**. Mas os `.js` que eles geraram —
`relacoes-data.js`, `propostas-ufrgs-data.js`, `banco-questoes-data.js` —
**continuam no repo e funcionando**.

**A lição:** o **artefato** (o dado gerado, versionado) tem vida independente do
**gerador** (o script que o produziu). Uma vez que o dado está commitado, apagar o
gerador não apaga o dado. Isso só é possível **porque** os dados são versionados no
Git (§4) — se fossem buscados em runtime de um serviço, sumiriam junto. (Os geradores
apagados vivem no commit `0911258`, resgatáveis por `git show`, mas ninguém deve
reintroduzir chamada a LLM sem o Alex pedir.)

---

## §7 — Quem consome o quê (ponte para a Etapa 3)

Guia rápido de qual aba lê qual dado — para você saber onde cada arquivo "ganha vida":

| Aba (fatia) | Dados que consome |
|---|---|
| Mapa do Edital (`app-edital`) | `DISCIPLINAS`, `RELACOES` |
| Painel/Argumento (`app-painel`) | `CURSOS`, `DATAS_PROVA`, `TRILHA`, `FASES` |
| Cronograma (`app-plano`) | `DISCIPLINAS`, `FASES`, `DATAS_ESTIMADAS` |
| Análise (`app-analise`) | `FREQUENCIA`, `DISCIPLINAS` (+ `RUBRICAS` p/ nota manual) |
| Questões (`app-banco`) | `BANCO_QUESTOES`, `GABARITOS_UFRGS`, `GABARITOS_ENEM` |
| Redação (`app-redacao`) | `PROPOSTAS_UFRGS`, `REDACOES_NOTAMIL`, `TEXTOS_MODELO`, `ENEM_COMP`, `RUBRICAS` |
| Leituras | `leituras-data.js` |
| Recursos | `CANAIS`, `SITES`, `INCIDENCIA` |
| Leitor de notas | `notas-data.js` |

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Gerado × curado à mão | §1 | a 1ª linha diz qual; gerado nunca se edita à mão |
| Dado embutido como `const` global | §2 | `file://` bloqueia `fetch` de JSON; embrulha-se em `.js` |
| JSON minificado numa linha | §2 | `JSON.stringify` sem indentação; é para carregar, não ler |
| Chave de objeto é sempre string | §2 | `q[n]` vira `q["n"]`; cuidado com `undefined` |
| Build step sem build tool | §4 | rodar um `.py` à mão faz o papel do webpack |
| Dado versionado vs fonte | §4, §6 | commitar o `.js` = painel funciona sem rodar o pipeline |
| Barreira de dados | §5 | conteúdo baixado é DADO não-confiável, validado numa fronteira |
| Injeção via dados | §5 | não tratar entrada externa como comando; desarmar antes de cruzar |
| Artefato × gerador | §6 | o dado sobrevive ao script que o criou |

---

**Próximo no roteiro:** [`app-edital.explicado.md`](app-edital.explicado.md) — a
**primeira aba**. Agora que você conhece a forma de `DISCIPLINAS`, vai ver o padrão
"percorrer os dados → montar HTML" que se repete em todas as telas, começando pela
mais direta: a árvore do edital.
