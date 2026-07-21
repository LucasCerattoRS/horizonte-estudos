# 📋 `edital-data.js` explicado — o schema dos dados

> **Arquivo real:** `painel/edital-data.js` (280 linhas)
> **Etapa no roteiro:** 2 (os dados) · **Pré-requisito:** [`app-core.explicado.md`](app-core.explicado.md)

## Por que começar pelos dados?

Há uma máxima famosa (atribuída a Fred Brooks, e repetida por Linus Torvalds):

> *"Mostre-me suas tabelas e eu não precisarei ver seu código; ele será óbvio."*

Este arquivo é a **tabela**. Ele não tem lógica — não calcula, não desenha, não
guarda estado. É só **a forma dos dados**: quais são as 9 provas da UFRGS, quanto
cada uma pesa em cada curso, e a árvore inteira do edital (disciplina → eixo →
tópico → subtópicos). **Quase toda tela do painel é um `for` sobre estas estruturas.**
Se você entende o formato aqui, o resto do app vira "óbvio": é sempre alguém
percorrendo `DISCIPLINAS` ou consultando `CURSOS`.

Por isso ele carrega **antes** de tudo no `index.html` (é um `*-data.js`, vem antes
das 8 fatias de `app.js`). Quando `app-core.js` roda, `DISCIPLINAS` e `CURSOS` já
existem como **variáveis globais**.

---

## §0 — O cabeçalho e a filosofia

```js
/* ============================================================
   PAINEL UFRGS/ENEM — Dados do edital (programa oficial UFRGS)
   Fonte: pesquisa/UFRGS_programa-conteudos.txt (Resoluções CEPE)
   Estrutura: DISCIPLINAS[] → eixos[] → topicos[] (unidade de status)
   Cada tópico carrega subtópicos (detalhe) e a prova a que pertence.
   ============================================================ */
```

**O quê:** um comentário de bloco documentando a origem e a forma dos dados.

**Por que importa:** repare em **"unidade de status"**. Essa frase decide a
granularidade de todo o app. O painel guarda seu progresso **por tópico** — não por
disciplina (grosso demais) nem por subtópico (fino demais). Quando você marca algo
como "estudado", a unidade é o **tópico**. Toda a lógica de progresso do
`app-core.js` (`topicId`, `topicStatus`, `discProgress`) gira em torno dessa decisão
tomada aqui, no comentário. **Comentário que define contrato vale código.**

**Conceito — "dado como fonte da verdade" (single source of truth):** o edital
oficial vira **um** arquivo. Se a UFRGS mudar um tópico, você edita **aqui** e todo o
app se atualiza — o Mapa do Edital, o Cronograma, a Análise, o cofre Obsidian (que é
*gerado* a partir daqui via `pipeline/gerar_cofre.cjs`). O oposto — espalhar a lista
de tópicos por várias telas — obrigaria a corrigir em N lugares e sempre esquecer um.

---

## §1 — As 9 provas: um *array* e um *mapa*

```js
// Provas objetivas UFRGS (9) — pesos somam 15; LP inclui Redação (peso 3 fixo)
const PROVAS = ["LP", "LIT", "HIS", "GEO", "MAT", "FIS", "QUI", "BIO", "LEM"];
const PROVA_NOME = {
  LP: "Língua Portuguesa + Redação", LIT: "Literatura", HIS: "História",
  GEO: "Geografia", MAT: "Matemática", FIS: "Física", QUI: "Química",
  BIO: "Biologia", LEM: "Língua Estrangeira"
};
```

**O quê:** dois jeitos de guardar as mesmas 9 provas — uma **lista ordenada**
(`PROVAS`) e um **dicionário de código→nome** (`PROVA_NOME`).

**Por que os dois?** Porque servem a perguntas diferentes:
- `PROVAS` responde *"quais existem, e em que ordem?"* — perfeito para um `for`
  que monta colunas de tabela sempre na mesma sequência.
- `PROVA_NOME["MAT"]` responde *"como escrevo isso na tela?"* em tempo **constante**,
  sem varrer nada.

**Conceito — chave curta × rótulo:** o código `"MAT"` é um **identificador estável**
(nunca muda, é seguro usar em `if`, em chaves de objeto, em nome de arquivo). O nome
`"Matemática"` é **texto de interface** (pode mudar, ganhar acento, ser traduzido).
Separar os dois é uma regra de ouro: **nunca use o texto visível como identificador**
— no dia em que "Matemática" virar "Matemática Básica", nada quebra, porque o código
continua `"MAT"`.

**Nota de sintaxe — objeto como mapa:** em JS não existe um tipo "dicionário"
embutido para isso; usa-se o **objeto literal** `{ chave: valor }`. `PROVA_NOME.LP`
e `PROVA_NOME["LP"]` são equivalentes. A forma com colchetes é obrigatória quando a
chave está numa variável: `PROVA_NOME[codigo]`.

> **Alternativa:** `Map`. Um `new Map([["LP","..."],...])` seria mais "correto"
> academicamente (chaves de qualquer tipo, ordem garantida, `.size`). Aqui o objeto
> literal vence por ser **mais curto de escrever e de ler**, serializável em JSON de
> graça, e as chaves já são strings simples. Regra prática: `Map` quando as chaves são
> dinâmicas/não-string ou você precisa de `.size`/iteração garantida; objeto literal
> para tabelas fixas escritas à mão, como esta.

---

## §2 — `CURSOS`: os pesos que alimentam o simulador

```js
// Perfis de peso por curso (soma 15; LP=3 sempre). Aproximações — conferir Manual do Candidato.
const CURSOS = {
  cic:      { nome: "Ciência da Computação",  pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  ecp:      { nome: "Engenharia de Computação", pesos: { LP:3, LIT:1, HIS:1, GEO:1, MAT:3, FIS:2, QUI:1, BIO:1, LEM:2 } },
  /* … med, direito, etc … */
  geral:    { nome: "Geral (equilibrado)",    pesos: { LP:3, LIT:2, HIS:2, GEO:1, MAT:2, FIS:1, QUI:1, BIO:2, LEM:1 } }
};
```

**O quê:** um **objeto de objetos**. A chave externa (`cic`, `med`, `geral`) é o
código do curso; o valor é um objeto com `nome` (rótulo) e `pesos` (um mapa
prova→número).

**Como é usado:** na aba **Argumento**, o painel calcula sua nota final ponderada
como uma **média harmônica** dos acertos por prova, usando esses pesos. Quando você
troca de curso no seletor, o app faz `CURSOS[cursoEscolhido].pesos` e recalcula. Os
pesos de `cic` e `med` são bem diferentes (Computação pesa MAT=3; Medicina pesa
BIO=3, QUI=3, MAT=1), então o *mesmo desempenho* dá **argumentos diferentes** por
curso — é exatamente o que o simulador mostra.

**Conceito — dado paralelo à estrutura (parallel keys):** repare que as chaves de
`pesos` (`LP`, `LIT`, …) são **exatamente** os elementos de `PROVAS`. Isso não é
coincidência: é um **contrato implícito**. Código em outras fatias faz
`PROVAS.map(p => curso.pesos[p])` confiando que toda prova tem um peso. É poderoso e
frágil ao mesmo tempo: poderoso porque um `for` cobre tudo; frágil porque, se você
adicionar uma prova em `PROVAS` e esquecer o peso em algum curso, `curso.pesos[p]`
vira `undefined` e a conta vira `NaN`. **Armadilha real** — a mesma família de bug
que a nota de verificação do projeto cita (`NaN` na tela por campo que não bate).

**Nota sobre o alinhamento visual:** os espaços depois de `cic:` e `ecp:` alinham as
colunas. Isso é **puro estilo** — o JS ignora espaço em branco. Serve só para o olho
humano comparar os pesos linha a linha, como uma planilha. Um formatador automático
(Prettier) desmancharia esse alinhamento; por isso este projeto **não usa** um.

> **Alternativa de modelagem:** poderia ser uma matriz `[curso][prova] = peso`. Seria
> mais compacto, mas ilegível ("qual coluna é QUI mesmo?"). Nomear cada peso pela sigla
> troca alguns bytes por **legibilidade e segurança** (errar a ordem de uma matriz é
> silencioso; esquecer `QUI:` é um erro que você vê).

---

## §3 — O helper `t`: fabricando tópicos

```js
// t(nome, ...subtopicos) — helper de tópico
const t = (nome, ...subs) => ({ nome, subs });
```

**O quê:** uma micro-função que monta o objeto de um tópico. `t("Cinemática", "MRU",
"MRUV")` devolve `{ nome: "Cinemática", subs: ["MRU", "MRUV"] }`.

Esta única linha concentra **três** recursos de JS que vale destrinchar:

**1. Arrow function** — `(args) => valor`. Forma curta de função. Como o corpo é só
uma expressão, não precisa de `return` nem de chaves de bloco.

**2. Rest parameters (`...subs`)** — o `...` "junta" **todos os argumentos restantes**
num array. Chamar `t("X", "a", "b", "c")` faz `subs = ["a","b","c"]`. Chamar
`t("X")` (sem subs) faz `subs = []` — array vazio, nunca `undefined`. Isso é ouro:
a fatia que desenha subtópicos pode fazer `topico.subs.map(...)` **sempre**, sem
checar se existe. Compare com as duas formas no arquivo:
```js
t("Estruturação do texto e dos parágrafos")          // subs = []  (sem detalhe)
t("Cinemática", "Grandezas escalares/vetoriais; …")  // subs = ["…"] (um bloco)
```

**3. Object shorthand (`{ nome, subs }`)** — quando a chave tem o mesmo nome da
variável, `{ nome: nome, subs: subs }` encurta para `{ nome, subs }`. Puro açúcar
sintático, mas onipresente em JS moderno.

**⚠️ Armadilha — o parêntese ao redor do objeto:** por que `=> ({ nome, subs })` e
não `=> { nome, subs }`? Porque `{` depois da seta é ambíguo: o JS pensa que é o
**corpo em bloco** da função (com duas "labels" `nome` e `subs`), não um objeto — e
devolveria `undefined`. Os parênteses forçam a leitura como **expressão**. É um dos
erros mais comuns de quem aprendeu arrow functions há pouco. **Decore:** para
retornar um objeto literal direto de uma arrow, embrulhe em `( )`.

**Conceito — DSL interna (mini-linguagem):** `t(...)` transforma a declaração dos
dados numa espécie de **linguagem de domínio**. Sem ele, cada tópico seria
`{ nome: "...", subs: [...] }` repetido ~131 vezes — ruidoso e fácil de errar. Com
ele, o edital lê quase como uma lista: `t("Dinâmica", "3 leis de Newton; forças; …")`.
É a mesma ideia de "builder" que bibliotecas usam para deixar a configuração
declarativa e enxuta.

---

## §4 — `DISCIPLINAS`: a árvore de três níveis

Esta é a estrutura central. Um **array** de disciplinas; cada disciplina tem
**eixos**; cada eixo tem **tópicos** (feitos com `t`). Três níveis de aninhamento.

```js
const DISCIPLINAS = [
  {
    id: "bio", nome: "Biologia", prova: "BIO", icon: "🧬",
    nota: "Ênfase evolutiva e ecológica.",
    eixos: [
      { nome: "Organização dos seres vivos", topicos: [
        t("Composição química", "Água, sais, carboidratos, lipídios, proteínas, …"),
        t("Estrutura, funcionamento e diversidade das células", "Célula procarionte × eucarionte; …"),
        /* … */
      ]},
      /* … outros eixos … */
    ]
  },
  /* … fis, qui, geo, his, port, red, lit, mat, lem … */
];
```

**O quê — os campos de uma disciplina:**

| Campo | Papel | Exemplo |
|---|---|---|
| `id` | identificador estável (curto, sem acento) | `"bio"` |
| `nome` | rótulo de tela | `"Biologia"` |
| `prova` | **liga** a disciplina a uma das 9 provas (e, via `CURSOS`, ao peso) | `"BIO"` |
| `icon` | emoji para a UI | `"🧬"` |
| `nota` | dica de estratégia (opcional) | `"Ênfase evolutiva…"` |
| `eixos` | os grandes blocos temáticos | `[…]` |

**A ligação que amarra tudo:** o campo `prova` é a **chave estrangeira** do modelo.
`"bio"` aponta para `prova: "BIO"`, que existe em `PROVAS`, tem rótulo em
`PROVA_NOME["BIO"]` e peso em `CURSOS[curso].pesos.BIO`. Traçar esse caminho —
disciplina → prova → peso — é como o simulador Argumento sabe quanto Biologia vale
para Medicina. **Três estruturas separadas, costuradas por um código de 3 letras.**

**Detalhe importante — `port` e `red` compartilham a prova `"LP"`:**
```js
{ id: "port", nome: "Língua Portuguesa", prova: "LP", … }
{ id: "red",  nome: "Redação",           prova: "LP",
  nota: "…Peso 3. Mínimo 30 linhas. Tema 2026: evasão/abandono escolar." }
```
São **duas disciplinas** (aparecem separadas no Mapa do Edital, têm tópicos próprios)
mas **uma só prova** na hora de pontuar (a Redação está embutida no peso 3 de LP, como
diz o comentário do §1). Modelar assim permite estudar/pontuar Redação como matéria
própria sem inventar uma 10ª prova que não existe no vestibular.

**Conceito — dados aninhados (tree / nested data):** a forma `array → objeto → array
→ objeto` é uma **árvore**. Renderizar árvore é sempre o mesmo padrão de laços
encaixados:
```js
DISCIPLINAS.forEach(d =>
  d.eixos.forEach(e =>
    e.topicos.forEach(t => /* desenha uma linha */)));
```
Você verá **exatamente isso** em `app-edital.js`. Entender a árvore aqui é entender
metade daquela fatia de graça.

**Nota — subtópicos são UMA string, não um array de itens:**
```js
t("Dinâmica", "3 leis de Newton; forças; momento de força; centro de gravidade e equilíbrio")
```
O detalhe vem como **um texto único** separado por `;`, não como `["3 leis", "forças",
…]`. É uma escolha de simplicidade: o detalhe é para **ler**, não para iterar item a
item. Se algum dia precisar da lista, um `.split(";")` resolve — mas enquanto ninguém
precisa, guardar como texto é mais simples de escrever e de mostrar.

**Observação sobre Literatura:** o eixo *"Obras obrigatórias"* usa o mesmo `t`, mas o
"subtópico" vira uma **mini-sinopse crítica** de cada obra (`t("Macunaíma — Mário de
Andrade", "Rapsódia; 'herói sem nenhum caráter'; …")`). Mesma estrutura, uso
diferente — a flexibilidade de guardar texto livre no campo `subs`.

---

## §5 — `ENEM_EXTRA`: a camada que a UFRGS não cobra

```js
// Diferenças ENEM (camada extra sobre o núcleo comum)
const ENEM_EXTRA = [
  { nome: "Filosofia",   nota: "Só cai no ENEM (Ciências Humanas). Prioridade baixa p/ foco UFRGS." },
  { nome: "Sociologia",  nota: "Só cai no ENEM. Prioridade baixa." },
  { nome: "Artes",       nota: "Só cai no ENEM (Linguagens). Prioridade baixa." },
  { nome: "Redação ENEM", nota: "Exige proposta de intervenção (≠ UFRGS). 5 competências, TRI não se aplica à redação." },
];
```

**O quê:** um array bem mais simples (sem eixos/tópicos) com o que o **ENEM** cobra
**além** do núcleo comum com a UFRGS.

**Por que separado de `DISCIPLINAS`?** Porque o foco do projeto é UFRGS. Misturar
Filosofia na árvore principal poluiria o Mapa do Edital com matéria de prioridade
baixa. Mantê-la numa lista à parte deixa claro: *"isto é bônus para o ENEM, não perca
tempo agora"*. O formato mais pobre (só `nome` + `nota`) reflete o menor investimento
— não há progresso por tópico aqui.

**Conceito — modelar a intenção, não só o fato:** separar `ENEM_EXTRA` de
`DISCIPLINAS` codifica uma **decisão de estudo** (priorizar UFRGS) na própria forma
dos dados. A estrutura não é neutra; ela empurra o usuário para o foco certo.

---

## §6 — O *export guard*: o mesmo arquivo no navegador e no Node

```js
if (typeof module !== "undefined") module.exports = { DISCIPLINAS, CURSOS, PROVAS, PROVA_NOME, ENEM_EXTRA };
```

**O quê:** *"se existir um objeto `module` (estou rodando no Node), exporte estas
estruturas."*

**Por que a checagem `typeof module !== "undefined"`?** Porque este arquivo vive
**duas vidas**:

1. **No navegador** (`file://`, via `<script src>`): não existe `module`. Referir
   `module.exports` direto lançaria `ReferenceError` e **quebraria o arquivo inteiro**.
   O `if` protege: no browser a linha é pulada, e `DISCIPLINAS` etc. ficam como
   **variáveis globais** (é assim que `app-core.js` as enxerga).
2. **No Node** (o pipeline, ex. `pipeline/gerar_cofre.cjs`): existe `module`. Aí o
   `require("./edital-data.js")` recebe `{ DISCIPLINAS, … }` e gera o cofre Obsidian a
   partir do **mesmo** edital que o painel usa.

**Nota de sintaxe — `typeof x !== "undefined"`:** é o jeito **seguro** de perguntar
"esta variável existe?". Um simples `if (module)` lançaria `ReferenceError` se
`module` nunca foi declarado. O operador `typeof` é especial: aplicado a um nome
inexistente, devolve a **string** `"undefined"` em vez de estourar. Guarde este
padrão — é o teste de existência padrão em JS para variáveis globais incertas.

**Conceito — este é o padrão UMD (Universal Module Definition), na versão mínima.**
Bibliotecas antigas (jQuery, Lodash) traziam um bloco parecido, porém maior, para
funcionar em `<script>`, CommonJS (Node) **e** AMD, tudo no mesmo arquivo. Aqui, como
só precisamos de dois ambientes (global no browser + CommonJS no Node), a versão de
uma linha basta.

> **Por que não `import`/`export` (ES Modules)?** Porque o painel abre por `file://`,
> cujo **origin é "opaco"**; o navegador bloqueia `import` entre arquivos locais por
> segurança (CORS). Esta é uma **restrição-mãe** do projeto: nada de ESM, tudo é
> `<script>` global carregado em ordem. Ver a mesma discussão em
> [`app-core.explicado.md`](app-core.explicado.md) e no `CLAUDE.md`.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde apareceu | Ideia em uma linha |
|---|---|---|
| Data como fonte da verdade | §0 | um edital, um arquivo; o resto deriva daqui |
| Array ordenado × objeto-mapa | §1 | lista para *"quais e em que ordem"*, mapa para *"nome disso"* em O(1) |
| Chave estável × rótulo de tela | §1, §4 | nunca use o texto visível como identificador |
| Chaves paralelas (contrato implícito) | §2 | `pesos` espelha `PROVAS`; poderoso e frágil (`NaN` se quebrar) |
| Arrow + rest params + shorthand | §3 | `t = (nome, ...subs) => ({nome, subs})` em uma linha |
| Objeto entre parênteses na arrow | §3 | `=> ({...})` para não confundir com bloco |
| DSL interna / builder | §3 | `t(...)` deixa os dados declarativos e enxutos |
| Dados aninhados (árvore) | §4 | array→objeto→array; renderiza com laços encaixados |
| Chave estrangeira | §4 | o campo `prova` costura DISCIPLINAS × PROVAS × CURSOS |
| Modelar a intenção | §5 | separar ENEM_EXTRA codifica a prioridade de estudo |
| Export guard / UMD mínimo | §6 | `typeof module` faz o arquivo servir browser e Node |

---

**Próximo no roteiro:** [`dados.explicado.md`](dados.explicado.md) — a visão de
conjunto dos **demais** `*-data.js`: quais são **gerados** pelo pipeline (os blobs de
questões, gabaritos, frequência) e quais são **curados à mão** (redação, recursos,
fases), com o schema de cada um. Depois disso, começam as **abas** (Etapa 3), onde
toda essa estrutura de dados finalmente vira tela.
