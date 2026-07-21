# 🚀 `app.js` explicado — o boot

> **Arquivo real:** `painel/app.js` (171 linhas — a 8ª fatia, **carrega por último**)
> **Etapa no roteiro:** 4 (o boot) · **Pré-requisitos:** todas as fatias anteriores

Esta é a fatia que **liga a máquina**. Enquanto as outras sete definem funções que
esperam ser chamadas, `app.js` é a única que **executa** algo no nível do arquivo:
`mergeCorpus(); init();`. Quando o navegador termina de ler este `<script>`, o painel
está de pé. É o **ponto de entrada** — o lugar onde toda a ordem dos `<script>` que você
vem ouvindo desde o começo finalmente **importa**.

Além do boot, o arquivo cuida do **backup** (exportar/importar JSON), do **seletor de
perfis**, do **kit presenteável** (dedicatória e bilhetes) e do registro do **PWA**.

---

## §0 — Por que este arquivo carrega por último

O comentário do topo diz: *"CARREGA POR ÚLTIMO (boot: mergeCorpus/init)"*. Recapitulando
o invariante que perpassa todo o projeto: são 8 `<script>` globais, sem ES modules
(porque `file://` bloqueia `import`). Cada fatia define funções globais; **este arquivo,
o último, chama-as**. Se `app.js` carregasse antes de `app-edital.js`, a chamada
`renderEdital()` estouraria (`renderEdital is not defined`). A ordem no `index.html` não é
estética — é **dependência de execução**. Ver a lista em [`app-core §0`](app-core.explicado.md)
e no `CLAUDE.md`.

---

## §1 — O ponto de entrada: `mergeCorpus(); init();`

```js
mergeCorpus();
init();
```

Estas duas linhas no **nível do arquivo** (fora de qualquer função) são o boot. Rodam
assim que o `<script>` é parseado. **Conceito — top-level code como entry point.** Sem um
`main()` explícito nem um framework que "monta o app", o ponto de entrada é literalmente
o código solto no fim do último script. `mergeCorpus()` primeiro (funde redações
importadas no estado), depois `init()` (desenha tudo). A ordem importa: `init` renderiza a
aba Redação, então o corpus precisa já estar mesclado.

---

## §2 — `exportData`: download de arquivo sem servidor

```js
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  const a=el("a"); a.href=URL.createObjectURL(blob);
  const slug=activeProfile().nome.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  a.download=`painel-ufrgs-${slug||"perfil"}-${todayKey()}.json`; a.click();
}
```

**Conceito — gerar e baixar um arquivo 100% no navegador.** Como não há servidor, o
backup é criado em memória e "baixado" por um truque:
1. **`new Blob([texto], {type})`** — embrulha a string JSON num objeto Blob (um "arquivo
   em memória"). `JSON.stringify(S, null, 2)` serializa o estado com indentação de 2
   espaços (legível).
2. **`URL.createObjectURL(blob)`** — cria uma URL temporária `blob:` que aponta para esse
   arquivo em memória.
3. **`<a download>` + `a.click()`** — cria um link de download **programaticamente** e o
   "clica" por código. O atributo `download` faz o navegador **baixar** em vez de navegar,
   com o nome de arquivo dado.

**A geração do slug** é uma sanitização clássica: minúsculas → troca tudo que não é
`a-z0-9` por `-` → remove hífens das pontas (`replace(/(^-|-$)/g,"")`). "Bia" vira
`bia`. O `|| "perfil"` cobre um nome que vire slug vazio. É a receita padrão de
"transformar texto livre num nome de arquivo/URL seguro".

> Detalhe fino: idealmente `URL.revokeObjectURL(a.href)` liberaria a memória do blob
> depois. Aqui é omitido (o blob é pequeno e a página logo é descartada) — um trade-off
> aceitável, mas vale saber que a URL fica "viva" até a página fechar.

---

## §3 — `importData`: ler arquivo e mesclar no estado

```js
function importData(){
  const inp=el("input"); inp.type="file"; inp.accept="application/json";
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ S=Object.assign(structuredClone(DEFAULT_STATE),JSON.parse(r.result)); save(); location.reload(); }
      catch(e){ alert("Arquivo inválido."); } }; r.readAsText(f); };
  inp.click();
}
```

O caminho inverso, com três conceitos:

**`FileReader` — ler arquivo do disco de forma assíncrona.** Um `<input type=file>` criado
na hora; quando o usuário escolhe o arquivo, `FileReader.readAsText(f)` lê o conteúdo e
dispara `r.onload` com o texto em `r.result`. É a API padrão de leitura de arquivos locais
no navegador (assíncrona porque ler disco leva tempo).

**`Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(...))` — mesclar sobre os
defaults.** Este é o padrão-ouro de import **à prova de futuro**: começa de uma cópia
fresca do `DEFAULT_STATE` e sobrepõe o que veio do arquivo. Assim, se o backup for de uma
versão **antiga** (sem um campo que hoje existe), esse campo ganha o **valor padrão** em
vez de ficar `undefined`. É a mesma filosofia do `load()` em [`app-core`](app-core.explicado.md):
o estado carregado nunca deve estar "incompleto". `structuredClone` garante uma cópia
**profunda** (senão perfis compartilhariam objetos aninhados).

**`try/catch` + `location.reload()`.** Um arquivo corrompido faria `JSON.parse` lançar; o
`catch` transforma isso num `alert` amigável em vez de quebrar. E, no sucesso,
`location.reload()` é o **re-init mais simples possível**: em vez de re-renderizar tudo à
mão, recarrega a página e deixa o boot rodar de novo com o novo `S`. Bruto, mas
infalível — e importar é raro, então o custo do reload não incomoda.

---

## §4 — `renderProfiles`: o seletor de perfis

```js
function renderProfiles(){
  const sel=$("#profileSel"); if(!sel) return;
  IDX.profiles.forEach(p=>{ const o=el("option"); o.value=p.id; o.textContent=`${p.emoji||"👤"} ${p.nome}`; if(p.id===IDX.active)o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>switchProfile(sel.value);
  const add=$("#profileAdd"); if(add) add.onclick=()=>{ const n=prompt("Nome do novo perfil:"); if(n) addProfile(n); };
  const del=$("#profileDel"); if(del){ del.onclick=()=>{ … if(confirm(`Apagar o perfil "${p.nome}" e TODO o progresso dele?…`)) deleteProfile(p.id); };
    del.style.display = IDX.profiles.length<=1 ? "none" : ""; }
}
```

Preenche o `<select>` de perfis (do sistema multi-perfil de [`app-core`](app-core.explicado.md))
e liga os botões. **`prompt`/`confirm`** — os diálogos nativos do navegador para pedir um
nome ou confirmar exclusão. São síncronos e feios, mas zero-código; para um app pessoal
offline, é uma escolha pragmática. **Detalhe de UX:** o botão de apagar **some**
(`display:none`) quando só há um perfil — não se pode ficar sem nenhum. Regra de negócio
codificada na visibilidade do botão.

---

## §5 — `init`: a sequência de arranque

```js
function init(){
  fillCursoSelect();
  fillDiscSelect($("#logDisc"));
  const qf=$("#qFilter"); DISCIPLINAS.forEach(d=>{ … qf.appendChild(o); });
  fillProvaSelects(); renderProva();
  fillBqFilters();
  renderPainel();
  renderEdital($("#editalDiscs"));
  …
}
```

**Conceito — a função de inicialização.** `init` é a coreografia do arranque: preenche
todos os `<select>` (curso, disciplinas, filtros do banco e das provas) e **renderiza as
duas telas iniciais** (Painel e Mapa do Edital). As demais abas só renderizam quando
visitadas (via `go`), mas essas duas são desenhadas já — o Painel é a home. Repare que
`init` só **chama** funções das outras fatias: é o maestro, não o músico.

### O deep-link por hash e a nota de segurança

```js
const h=location.hash.slice(1);
if(/^[a-z-]+$/.test(h) && $("#tab-"+h)) go(h);
```

Permite abrir o painel direto numa aba via URL (`index.html#banco` → abre Questões). Mas
o comentário conta uma **cicatriz de bug** que vale ouro:

> *o hash também carrega o `#token=…` do login por QR (sync.js o consome depois), e
> "#tab-token=abc" é seletor inválido — quebrava o init inteiro.*

**Conceito — parsing defensivo de entrada não confiável.** O `location.hash` pode conter
**qualquer coisa** (um token de login, lixo colado). Sem o guarda, `$("#tab-"+h)` com um
hash tipo `token=abc123` viraria um **seletor CSS inválido**, `querySelector` lançaria, e
o `init` **inteiro** morreria — a página não carregaria. A regex `/^[a-z-]+$/` só aceita
nomes de aba plausíveis (letras e hífen), e o `&& $("#tab-"+h)` confirma que a aba existe
**antes** de navegar. É a mesma lição da barreira de dados: **valide a entrada antes de
usá-la como comando/seletor**. Um caractere inesperado não pode derrubar o app.

### Saudação por hora e rodapé por contexto

```js
const hr=new Date().getHours();
$("#heroTitle").textContent = hr<6?`Madrugada de estudo, ${nome}.`:hr<12?`Bom dia, ${nome}.`:hr<18?`Boa tarde, ${nome}.`:`Boa noite, ${nome}.`;
```

Um **ternário encadeado** escolhe a saudação pela hora — um toque humano barato. E o
rodapé se adapta ao contexto: mostra "sincronizado" **se** o `Sync` está ativo, senão
"salvo neste navegador" — porque, como diz o comentário, dizer "sem servidor" seria
**mentira** no site publicado (onde o D1 sincroniza). Texto que se ajusta à verdade do
ambiente.

---

## §6 — `mergeCorpus`: mesclagem idempotente com match difuso

```js
function mergeCorpus(){
  if(typeof REDACOES_CORPUS==="undefined" || !Array.isArray(REDACOES_CORPUS)) return;
  const have=new Set(S.redacoes.map(r=>r.id));
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const props=PROPS().filter(p=>p.id!=="livre");
  let add=0;
  REDACOES_CORPUS.forEach(r=>{
    if(!r || !r.id || have.has(r.id)) return;      // idempotente: já tenho, pulo
    const rec=structuredClone(r);
    if(!rec.propId){
      const p=props.find(p=>norm(p.tema)===norm(rec.tema));
      if(p && (!rec.banca || rec.banca===p.banca)) rec.propId=p.id;
    }
    S.redacoes.push(rec); add++;
  });
  if(add){ S.redacoes.sort(…); save(); }
}
```

**Conceito — operação idempotente.** `mergeCorpus` roda **a cada boot**, mas o `Set`
`have` (ids que já existem) faz cada redação ser adicionada **no máximo uma vez**
(`have.has(r.id)` pula as repetidas). Rodar 1× ou 100× dá o mesmo resultado — a definição
de **idempotência**. É o que torna seguro chamá-la no boot sem duplicar dados. (O mesmo
princípio do gerador do cofre, mencionado no `CLAUDE.md`.)

**A função `norm` — normalização para comparar textos "iguais o suficiente".** Para casar
uma redação importada com a proposta certa do wizard, compara os **temas** — mas
"Manipulação de Dados" e "manipulacao de dados" deveriam bater. `norm` resolve:
- `.toLowerCase()` — caixa baixa;
- **`.normalize("NFD").replace(/[̀-ͯ]/g,"")`** — o truque de **remover acentos**:
  `NFD` separa a letra do seu acento (`"ã"` → `"a"` + combining tilde), e a regex apaga
  os **caracteres combinantes** (a faixa Unicode `U+0300–U+036F` são os diacríticos). Sobra
  a letra base.
- `.replace(/[^a-z0-9]+/g," ").trim()` — colapsa pontuação/espaços.

Assim `norm("Manipulação de dados!")` === `norm("manipulacao  de dados")`. **Conceito —
match difuso por normalização:** em vez de exigir igualdade exata (frágil), reduz ambos os
lados a uma **forma canônica** e compara. É como buscadores toleram acento e caixa. Se
casar, liga o `propId` (acende o status no grid do wizard). `structuredClone(r)` antes de
mexer garante que o dado original não é mutado.

---

## §7 — O kit presenteável: recursos que só existem se houver `PERFIL_SEED`

```js
function sorteioSeed(v){ return Array.isArray(v) ? v[Math.floor(Math.random()*v.length)] : v; }
function mostrarBilhete(pct){
  const m = (typeof PERFIL_SEED!=="undefined" && PERFIL_SEED) ? PERFIL_SEED.mensagens : null;
  if(!m) return;
  const txt = pct>=70 ? sorteioSeed(m.meta) : pct<=40 ? sorteioSeed(m.animo) : null;
  if(!txt) return;
  const k="painelUFRGS_bilhete_dia";
  if(localStorage.getItem(k)===todayKey()) return;   // no máx. 1 por dia
  localStorage.setItem(k, todayKey());
  …
}
```

O "kit" é a versão-presente do painel (para a namorada, a Bia), ativada pela presença de
`PERFIL_SEED` (injetado só no build `--kit`). Três padrinhos técnicos:

**Feature flag por presença de dado.** Todo o kit é guardado por `typeof PERFIL_SEED !==
"undefined"`. Sem o seed, nada disso aparece — o mesmo código serve ao painel normal e ao
presente. É *feature flagging* sem framework: **a existência do dado é a flag** (o mesmo
sinal que `semCofre()` usa às avessas).

**`sorteioSeed` — pool aleatório.** Aceita uma string **ou** um array; se array, sorteia
um item (`Math.random()*length | Math.floor`). Assim mensagens de meta/ânimo podem ser um
**pool** de onde um bilhete diferente sai a cada vez, sem repetir sempre o mesmo texto.

**Flag "uma vez por dia" no `localStorage`.** `if(localStorage.getItem(k)===todayKey())
return;` — o bilhete aparece **no máximo uma vez por dia**: guarda a data de hoje sob uma
chave e, se já foi mostrado hoje, sai. Padrão comum para "não incomodar mais de X por
período". E as fotos usam `im.onerror=()=>im.remove()` — se uma imagem falhar (caminho
quebrado), **ela se remove sozinha** em vez de deixar o ícone de imagem quebrada. Robustez
silenciosa.

---

## §8 — O PWA: instalar e funcionar offline (mas só em `http(s)`)

```js
(function pwa(){
  if(!/^https?:$/.test(location.protocol)) return;
  if("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  let convite=null;
  window.addEventListener("beforeinstallprompt", e=>{
    e.preventDefault(); convite=e;
    … cria o botão ⤓ …
  });
  window.addEventListener("appinstalled", ()=>{ … remove o botão … });
})();
```

**A guarda de protocolo — a mais importante do arquivo.** `if(!/^https?:$/.test(location.
protocol)) return;` — todo o PWA só roda em `http:`/`https:`. Em **`file://`** ele é
pulado inteiro. Por quê? Porque `file://` tem **origem opaca**: como avisa o `CLAUDE.md`,
lá `"serviceWorker" in navigator` é `true` (a API existe), mas **qualquer chamada lança
`SecurityError`**. Então a guarda tem de ser **por protocolo**, não por *feature
detection* — testar se a API existe **não basta**, ela existe e mesmo assim falha. Esta é
uma das armadilhas mais sutis do projeto, e a razão de o painel local (`file://`) seguir
idêntico, só sem o offline.

**`beforeinstallprompt` — o convite de instalação (padrão do Chrome).** O navegador
dispara esse evento quando o app é "instalável"; o código faz `e.preventDefault()` para
**segurar** o convite e o guarda em `convite`, mostrando um botão ⤓ próprio. Ao clicar:

```js
b.onclick=async()=>{ b.disabled=true; convite.prompt();
  const {outcome}=await convite.userChoice;
  if(outcome==="accepted") b.remove(); else b.disabled=false; };
```

**`async`/`await` + desestruturação.** `convite.prompt()` abre o diálogo nativo;
`await convite.userChoice` **espera** a decisão do usuário (uma Promise), e `{outcome}`
extrai o campo do resultado. Se aceitou, o botão some; se recusou, reabilita. É um bom
exemplo pequeno de `await` para "esperar o usuário responder". O `appinstalled` limpa o
botão caso a instalação venha por outro caminho.

**Por que uma IIFE?** `(function pwa(){ … })()` roda o setup na hora e **não deixa
`convite` nem os listeners vazarem** para o escopo global — o mesmo isolamento do
`TID2INFO`, agora para um bloco de efeitos colaterais que não precisa ser reusado.

---

## Resumo dos conceitos deste arquivo

| Conceito | Onde | Ideia em uma linha |
|---|---|---|
| Top-level como entry point | §0, §1 | `mergeCorpus();init();` no fim do último script liga o app |
| Ordem de `<script>` = dependência | §0 | o boot chama funções; tem de vir depois de quem as define |
| Download no navegador (Blob) | §2 | `Blob`+`createObjectURL`+`<a download>`+`click()` |
| Slug de texto livre | §2 | minúsculas → `-` → tira hífen das pontas |
| `FileReader` (ler arquivo) | §3 | leitura assíncrona de arquivo local |
| Merge sobre defaults (forward-compat) | §3 | `Object.assign(clone(DEFAULT), lido)` completa campos novos |
| `try/catch` + `reload` no import | §3 | arquivo ruim vira alerta; reload = re-init infalível |
| `prompt`/`confirm` nativos | §4 | diálogos zero-código para app pessoal |
| Regra de negócio na visibilidade | §4 | esconder "apagar" quando só há 1 perfil |
| Função de init (maestro) | §5 | preenche selects, renderiza as 2 telas iniciais |
| Parsing defensivo do hash | §5 | regex `/^[a-z-]+$/` impede seletor inválido derrubar o init |
| Rodapé/saudação por contexto | §5 | texto que se ajusta à hora e ao Sync ativo |
| Idempotência | §6 | `Set` de ids: rodar no boot não duplica |
| Match difuso por normalização | §6 | `NFD`+remover diacríticos → forma canônica p/ comparar |
| Feature flag por dado | §7 | `PERFIL_SEED` presente = kit ligado |
| Pool aleatório (`sorteioSeed`) | §7 | string ou array; sorteia um item |
| Flag "1× por dia" no `localStorage` | §7 | guarda `todayKey()` e checa antes de repetir |
| `img.onerror` autolimpa | §7 | imagem quebrada se remove sozinha |
| Guarda por **protocolo** (não feature) | §8 | `file://` tem SW no navigator mas lança `SecurityError` |
| `beforeinstallprompt` | §8 | segurar o convite e oferecer botão de instalar |
| `async`/`await` + desestruturação | §8 | `const {outcome}=await convite.userChoice` |
| IIFE para isolar efeitos | §8 | não vazar `convite`/listeners ao global |

---

**Próximo no roteiro:** [`sync.explicado.md`](sync.explicado.md) — **Etapa 5**. Saímos do
navegador: como o estado `S` **viaja até o celular** por um backend (token, `fetch`,
resolução de conflitos, o painel de admin). O primeiro contato do painel com a rede de
verdade.
