# 🔳 `qr.js` explicado — um gerador de QR Code do zero

> **Arquivo real:** `painel/qr.js` (268 linhas) · **Etapa no roteiro:** 5 (avançado)
> **Pré-requisito:** curiosidade — este é um **estudo isolado**, quase não depende do resto

Este é o arquivo mais bonito para estudar **teoria de codificação** — e o mais
autossuficiente. Ele gera um **QR Code inteiro do zero** (sem biblioteca, porque o painel
não tem build nem CDN e roda em `file://`), só para levar o **token de login** até o celular
sem digitar. Por dentro, ele te ensina três coisas que aparecem em muito lugar: **corpos
finitos (GF(256))**, **correção de erros Reed-Solomon** e o **desenho estruturado** de um QR
(padrões, máscaras, penalidades).

Não é preciso saber álgebra abstrata: vou explicar as ideias de forma concreta. Se algum
bloco parecer denso, fique com o **conceito** — a intuição é o que transfere.

> **Nota de método (no topo do arquivo):** o QR foi **verificado por decodificação** — o
> `pipeline/verificar/test-qr.js` gera os PNGs e manda o **OpenCV lê-los de volta** (14
> casos). O comentário explica por que **não** dá para verificar comparando a matriz com
> outra biblioteca: *"o padrão admite mais de um preenchimento válido depois do terminador,
> e as duas divergem aí sem erro"*. **Lição de epistemologia de teste:** quando existe mais
> de uma saída correta, valide pela **propriedade que importa** (dá para ler de volta?), não
> pela **igualdade** com uma referência arbitrária. Guarde isso — vale para qualquer gerador.

---

## §1 — GF(256): o "corpo finito" onde o Reed-Solomon vive

```js
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
```

**O problema que isto resolve.** Reed-Solomon precisa fazer contas (somar, multiplicar,
dividir) com **bytes** (0–255) de um jeito em que **toda** operação devolva outro byte e
**toda** divisão seja possível. Os inteiros normais não servem (255×2 estoura 8 bits). A
matemática oferece uma estrutura sob medida: o **corpo finito GF(256)** — 256 "números" com
soma e multiplicação próprias, onde tudo fecha em 8 bits e existe inverso para dividir.

**Como as operações funcionam nesse corpo:**
- **Soma** em GF(256) é **XOR** (`^`). Estranho, mas é isso: somar é "ou-exclusivo" bit a
  bit. (Por isso você vê `^` onde esperaria `+` no Reed-Solomon.)
- **Multiplicação** é mais complexa — mas há um truque. Existe um elemento **gerador** (o 2)
  cujas potências (2⁰, 2¹, 2², … no corpo) percorrem **todos** os 255 valores não-nulos.
  Então todo número é `2ᵏ` para algum `k`. Multiplicar `2ᵃ × 2ᵇ = 2ᵃ⁺ᵇ` → vira **somar os
  expoentes**. É a mesma ideia da **régua de cálculo / logaritmo**: multiplicar é somar no
  mundo dos expoentes.

**O código monta duas tabelas** para usar esse truque:
- `EXP[k]` = `2ᵏ` no corpo (o "antilog"): o laço faz `x <<= 1` (dobra) e, se estourar 8 bits
  (`x & 256`), reduz com `x ^= 0x11d` — o **polinômio primitivo** `x⁸+x⁴+x³+x²+1` que
  "dá a volta" dentro do corpo (o equivalente ao `% 256`, mas na aritmética de GF).
- `LOG[v]` = o expoente `k` tal que `2ᵏ = v` (o "log").
- `mul(a,b)` então é `EXP[LOG[a] + LOG[b]]` — **soma os logs e volta pelo antilog**. (E `0`
  multiplicado por qualquer coisa é `0`, tratado à parte.) A tabela `EXP` tem 512 posições
  para o `LOG[a]+LOG[b]` (que pode chegar a ~508) não precisar de `% 255`.

**Conceito — pré-computar tabelas para transformar operação cara em consulta barata.** É o
mesmo *space-time trade-off* dos índices do `app-banco`, agora na aritmética: em vez de
multiplicar no corpo toda vez (caro), some dois logs e consulte uma tabela (barato).

---

## §2 — Reed-Solomon: redundância que conserta manchas

```js
function rsGen(deg) {                       // polinômio gerador, grau `deg`
  let p = [1];
  for (let i = 0; i < deg; i++) {
    const q = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); }
    p = q;
  }
  return p;
}
function rsEcc(data, ecLen) {               // resto da divisão = codewords de correção
  const gen = rsGen(ecLen), res = new Uint8Array(ecLen);
  for (const b of data) {
    const f = b ^ res[0];
    res.copyWithin(0, 1); res[ecLen - 1] = 0;
    for (let i = 0; i < ecLen; i++) res[i] ^= mul(gen[i + 1], f);
  }
  return res;
}
```

**A ideia (sem fórmulas).** Reed-Solomon adiciona **codewords de correção** (ECC) aos dados,
de modo que, se parte do QR ficar suja/rasgada, o leitor **reconstrói** o que faltou — é por
isso que um QR com o logo no meio ou um café derramado ainda lê. Quanto mais ECC, mais dano
tolera (o nível **M** daqui recupera ~15%).

**Como é calculado.** Trata-se os dados como os coeficientes de um **polinômio** e divide-se
por um **polinômio gerador** especial (`rsGen`); o **resto** dessa divisão são os codewords de
ECC (`rsEcc`). `rsEcc` é uma **divisão polinomial longa** feita na aritmética de GF(256) —
por isso todo `+` é `^` (soma no corpo) e toda `×` é `mul`. O `res.copyWithin(0,1)` desliza o
resto (como "abaixar o próximo dígito" na divisão que você aprendeu na escola). Você não
precisa seguir cada passo; o **conceito** é: *dados ÷ gerador → o resto é a "assinatura" que
permite detectar e corrigir erros*.

> **Onde mais isso vive:** Reed-Solomon está em CDs/DVDs, códigos de barras, transmissões de
> satélite e RAID de disco. QR é só uma aplicação. Entender aqui é entender um pilar das
> comunicações digitais.

---

## §3 — O bitstream: empacotar o texto em codewords

```js
function encodeData(bytes, v) {
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4);                                  // modo byte (0100)
  put(bytes.length, countBits(v));            // quantos bytes
  bytes.forEach(b => put(b, 8));              // os dados
  const cap = dataCw(v) * 8;
  if (bits.length > cap) return null;          // não cabe nesta versão
  put(0, Math.min(4, cap - bits.length));      // terminador
  while (bits.length % 8) bits.push(0);        // fecha o último byte
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let i = 0; cw.length < dataCw(v); i++) cw.push(i % 2 ? 0x11 : 0xec);   // preenchimento
  return cw;
}
```

**O QR fala em bits, não em bytes.** `encodeData` monta a sequência de bits exigida pelo
padrão, na ordem certa:
1. **Indicador de modo** (`0100` = "modo byte") — diz ao leitor como interpretar o resto.
2. **Contagem** — quantos bytes vêm (8 bits até a versão 9, 16 da 10 em diante —
   `countBits`).
3. **Os dados** — cada byte em 8 bits.
4. **Terminador** (até 4 zeros) e **padding** para fechar o byte.
5. **Bytes de preenchimento** alternando `0xEC`/`0x11` (valores fixos do padrão) até
   completar a capacidade da versão.

**`put(val, n)` — escrever `n` bits de um número, do mais significativo ao menos.** O
`(val >>> i) & 1` extrai o i-ésimo bit. É o idioma de **serialização em nível de bit** —
onde você constrói um fluxo de bits campo a campo. `parseInt(..., 2)` reagrupa cada 8 bits
num byte. Este vai-e-volta bit↔byte é o pão-com-manteiga de qualquer formato binário
(protocolos de rede, formatos de arquivo).

---

## §4 — Interleaving: espalhar o dano

```js
function interleave(cw, v) {
  const nb = N_BLOCKS[v], ec = EC_PER_BLK[v], total = dataCw(v);
  // divide em nb blocos, calcula ECC de cada, e INTERCALA
  …
  for (let i = 0; i < curto + 1; i++) dat.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ec; i++) ecc.forEach(b => out.push(b[i]));
  return out;
}
```

**Por que intercalar.** As versões maiores dividem os dados em vários **blocos**, cada um com
seu ECC. Se os bytes de um bloco ficassem todos **juntos** numa região do QR, um borrão
naquela região destruiria um bloco inteiro — além da capacidade de correção. A solução do
padrão é **intercalar**: pega o 1º byte de cada bloco, depois o 2º de cada, e assim por
diante. Assim, um dano **localizado** no QR se espalha como **um poucos bytes em cada
bloco** — dentro do que o Reed-Solomon de cada um consegue consertar.

**Conceito — interleaving contra erro em rajada (burst error).** Transformar um "erro
concentrado" em "vários erros espalhados e pequenos" é uma técnica geral de tolerância a
falhas (usada em CDs contra arranhões, em rádio contra interferência). O mesmo princípio:
código de correção lida bem com erros **esparsos**; então **rearranje** para que o dano
natural (concentrado) vire esparso.

---

## §5 — A matriz e seus "padrões de função"

`novaMatriz(v)` desenha tudo que **não** são dados — as estruturas fixas que o leitor usa
para se orientar. Cada `set(x,y,val,reservado)` marca o módulo **e** o reserva (`res=1`),
para que a colocação de dados depois **não** escreva por cima.

- **Finder patterns** (`finder`) — os três **olhos** 7×7 nos cantos. São o que o leitor
  acha primeiro para localizar e alinhar o código. Desenhados como borda + centro cheios.
- **Timing patterns** — as linhas pontilhadas (alterna 1/0) ligando os olhos; dão ao leitor a
  **régua** para contar os módulos.
- **Alignment patterns** (`ALIGN`) — quadradinhos extras (da versão 2 em diante) que ajudam a
  corrigir **distorção de perspectiva** (QR fotografado torto). O código evita colocá-los
  sobre os olhos.
- **Format info** e (v≥7) **version info** — áreas reservadas para os metadados (nível de
  correção, máscara, versão), preenchidas depois com **BCH** (§8).
- **Módulo escuro** — um único módulo sempre 1 (`set(8, n-8, 1)`), exigência do padrão.

**Conceito — separar "estrutura" de "carga".** O QR é metade **andaime fixo** (padrões de
função, iguais em todo QR daquela versão) e metade **carga** (seus dados). Reservar o andaime
antes de colocar dados é o que impede um sobrescrever o outro — a `res` (máscara de reserva) é
a "planta baixa" que protege as áreas fixas.

---

## §6 — Colocar os dados: o zigue-zague

```js
function colocarDados(m, cw) {                // zigue-zague de baixo p/ cima, 2 colunas por vez
  const n = m.n; let i = 0;
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5;                    // pula a coluna de tempo
    const up = ((dir + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const y = up ? n - 1 - k : k;
      for (const x of [dir, dir - 1]) {
        if (m.res[y * n + x]) continue;         // não escreve em módulo reservado
        const bit = i < cw.length * 8 ? (cw[i >> 3] >>> (7 - (i & 7))) & 1 : 0;
        m.mods[y * n + x] = bit; i++;
      }
    }
  }
}
```

O padrão manda preencher os dados num **zigue-zague**: sobe e desce em **colunas de duas em
duas**, da direita para a esquerda, **pulando** módulos reservados (`m.res`) e a coluna de
tempo (a 6). **`cw[i >> 3] >>> (7 - (i & 7)) & 1`** extrai o i-ésimo bit do fluxo: `i >> 3` é
`i/8` (qual byte — deslocamento de 3 bits = dividir por 8), `i & 7` é `i % 8` (qual bit dentro
do byte — os 3 bits baixos). São idiomas de **manipulação de bits** que valem reconhecer:
`>>3` e `&7` são divisão e resto por 8 feitos com deslocamento/máscara (mais rápidos que
`/` e `%`, e comuns em código de baixo nível).

---

## §7 — Máscaras e penalidades: escolher o desenho menos confuso

```js
const MASKS = [ (x,y)=>(x+y)%2===0, (x,y)=>y%2===0, … ];  // 8 fórmulas
function aplicarMascara(m, k) {
  const n = m.n, f = MASKS[k];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (!m.res[y*n+x] && f(x,y)) m.mods[y*n+x] ^= 1;      // inverte os módulos onde a fórmula bate
}
```

**Por que mascarar.** Se os dados, por azar, formassem grandes áreas todas pretas, ou
listras parecidas com os olhos, o leitor se confundiria. O padrão define **8 máscaras** —
fórmulas `f(x,y)` que **invertem** (XOR) certos módulos de dados num xadrez/listra, para
**quebrar** esses padrões ruins. A máscara só mexe em módulos **não reservados** (os dados),
nunca no andaime.

**Como escolher a melhor.** Aplica-se **cada uma das 8** e mede-se uma **penalidade**
(`penalidade(m)`) segundo quatro regras do padrão; **vence a de menor penalidade**:

```js
for (let k = 0; k < 8; k++) { const m = tentar(k), p = penalidade(m); if (p < melhorP) { melhorP = p; melhor = m; } }
```

As quatro regras de `penalidade` (que você não precisa decorar, só entender o **objetivo** —
"parecer o menos possível com algo que engana o leitor"):
1. **Corridas** de 5+ módulos iguais em linha/coluna (listras longas confundem).
2. **Blocos 2×2** da mesma cor (áreas chapadas).
3. **Padrão parecido com o olho** (`1011101` cercado de claro) fora dos olhos de verdade —
   penalidade pesada (40), pois um falso "olho" desorienta o leitor.
4. **Desequilíbrio** entre módulos claros e escuros (o ideal é ~50/50 de preto).

**Conceito — gerar várias soluções e escolher pela função-custo.** É o mesmo esqueleto do
**argmin** que você viu no `app-analise`/`app-banco`, agora escolhendo entre 8 renderizações
por uma métrica de qualidade. "Tente todas as opções válidas, pontue cada uma, fique com a
melhor" é um padrão de projeto recorrente.

---

## §8 — BCH: a correção de erro dos **metadados**

```js
function formatInfo(m, mask) {
  let d = (ECL_BITS << 3) | mask;
  let r = d;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);   // divisão BCH
  const bits = ((d << 10) | r) ^ 0x5412;                             // + máscara fixa do padrão
  …coloca os 15 bits em duas cópias ao redor dos olhos…
}
```

Os **metadados** (nível de correção + máscara, nas format info; a versão, na version info)
também precisam de proteção — se o leitor errar a máscara, lê tudo errado. Eles usam um
código **BCH** (primo do Reed-Solomon, também baseado em divisão de polinômios em corpo
finito, com o gerador `0x537`), e ainda são **XORados com uma máscara fixa** (`0x5412`) para
garantir que nunca fiquem todos-zero (que confundiria o leitor). E são gravados em **duas
cópias** em lugares diferentes — redundância física: se um canto borrar, o outro salva.

**Conceito — proteger o metadado ainda mais que o dado.** Faz sentido: se você não sabe
**como** decodificar (a máscara, o nível), o dado inteiro é inútil. Por isso os metadados
ganham ECC próprio **e** duplicação. Um princípio geral: *a informação que descreve como ler
o resto é a mais crítica de todas*.

---

## §9 — Bytes UTF-8 com um truque de uma linha

```js
function utf8(s) {
  const out = [];
  for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0));
  return out;
}
```

**O truque clássico de "string → bytes UTF-8" sem `TextEncoder`.**
`encodeURIComponent("ção")` produz `"%C3%A7%C3%A3o"` (os bytes UTF-8 em `%XX`); `unescape(...)`
desfaz o `%XX` tratando cada um como **um byte** (caractere 0–255); `charCodeAt(0)` pega o
valor. Resultado: o array de bytes UTF-8. É um idioma **antigo e um pouco hacky** (usa
`unescape`, tecnicamente obsoleto), mas funciona em qualquer navegador sem depender de
`TextEncoder` — coerente com a filosofia "zero dependência, roda em `file://`" do projeto. Um
código consciente do seu ambiente prefere o truque robusto ao "mais correto" que talvez
falhe.

---

## §10 — Juntando tudo: `matrix` e `draw`

```js
matrix(texto, mask) {
  const bytes = utf8(texto);
  let v = 0, cw = null;
  for (let i = 1; i <= MAXV; i++) { cw = encodeData(bytes, i); if (cw) { v = i; break; } }   // menor versão que cabe
  if (!v) throw new Error("QR: texto longo demais…");
  const dados = interleave(cw, v);
  … tenta as 8 máscaras, escolhe a de menor penalidade …
  return { size: melhor.n, mods: melhor.mods, version: v };
}
```

O `matrix` orquestra o pipeline inteiro: bytes → **menor versão que cabe** (tenta 1, 2, 3… e
para na primeira que couber) → interleave → para cada máscara: nova matriz + colocar dados +
mascarar + format info → escolher a melhor por penalidade. `draw` então pinta a matriz num
`<canvas>`, **sempre preto no branco** com uma **margem** (a "zona quieta" que o padrão exige
em volta — o leitor precisa de contraste e do vazio ao redor; por isso o QR não respeita o
tema escuro do painel). A escala transforma cada módulo lógico em um quadrado de N píxeis.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Verificar por decodificação | topo | quando há várias saídas certas, teste a propriedade (lê de volta?), não a igualdade |
| Corpo finito GF(256) | §1 | 256 "números" onde soma=XOR e tudo fecha em 8 bits |
| Log/antilog (régua de cálculo) | §1 | multiplicar vira somar expoentes + consulta de tabela |
| Polinômio primitivo (`0x11d`) | §1 | o "dá a volta" da aritmética do corpo |
| Reed-Solomon (ECC) | §2 | redundância que reconstrói partes danificadas |
| Divisão polinomial → resto = ECC | §2 | os codewords de correção são o resto |
| Serialização em bits (`put`) | §3 | montar um fluxo de bits campo a campo |
| `>>3` e `&7` (byte/bit) | §6 | dividir por 8 e pegar o resto com deslocamento/máscara |
| Interleaving (burst error) | §4 | espalhar o dano concentrado em erros pequenos e esparsos |
| Estrutura × carga (reserva) | §5 | reservar o andaime fixo antes de colocar dados |
| Zigue-zague de colocação | §6 | preencher em colunas de 2, subindo/descendo, pulando reservados |
| Máscara + escolha por penalidade | §7 | 8 opções, pontue cada uma, fique com a melhor (argmin) |
| Proteger o metadado (BCH + cópias) | §8 | quem diz "como ler" é o mais crítico → ECC próprio e duplicado |
| UTF-8 via `unescape(encodeURIComponent)` | §9 | string→bytes sem dependência, ciente do ambiente |
| Menor versão que cabe | §10 | tenta 1,2,3… e para na primeira suficiente |
| Zona quieta + preto-no-branco | §10 | o leitor exige contraste e margem — ignora o tema |

---

**Próximo no roteiro:** [`functions-state.explicado.md`](functions-state.explicado.md) — **o
outro lado do `sync.js`**: a Cloudflare Pages Function que guarda o estado num banco **D1**
(SQLite serverless), autentica o token e faz o *merge* por seção no servidor. Sai do
navegador de vez e entra no *backend*.
