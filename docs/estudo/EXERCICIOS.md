# 🎓 EXERCÍCIOS — teste o que você aprendeu

> Perguntas do **básico ao avançado**. Cada resposta fica **oculta** — pense primeiro, depois
> clique em *"▸ resposta"* para conferir. As respostas **explicam** (não só afirmam) e apontam
> para onde estudar mais. Não é prova: é fixação.
>
> Sugestão: só clique depois de **escrever** ou **dizer em voz alta** a sua resposta.

---

## Nível 1 — Fundamentos (JavaScript e DOM)

**1.1** Por que o painel usa `<script>` globais carregados em ordem, e **não** `import`/`export`
(ES modules)?

<details><summary>▸ resposta</summary>

Porque o painel abre por **`file://`**, cuja origem é **"opaca"**; o navegador **bloqueia**
`import` entre arquivos locais por segurança (CORS). Então tudo é `<script>` global carregado em
ordem — a **ordem no `index.html` é o grafo de dependências**. É a "restrição-mãe" do projeto. →
[app-core](app-core.explicado.md) §0, [index-html](index-html.explicado.md) C.4.
</details>

**1.2** Qual a diferença entre `a || b` e `a ?? b`? Dê um caso do painel onde usar o errado seria
um bug.

<details><summary>▸ resposta</summary>

`a || b` cai em `b` quando `a` é **falsy** (inclui `0`, `""`); `a ?? b` só quando `a` é
**`null`/`undefined`**. No banco, ordenar por "pior primeiro" usa `qAccuracy(a) ?? 101`: um acerto
legítimo de **`0%`** precisa passar, mas `|| 101` o trocaria por 101 (fim da lista) — bug. Já
`simEP[pv] || 500` usa `||` de propósito (0 não é escala válida). → [app-banco](app-banco.explicado.md) §1b.
</details>

**1.3** O que `.filter(Boolean)` faz numa lista, e por que funciona?

<details><summary>▸ resposta</summary>

Remove os itens **falsy** (`""`, `null`, `0`, `undefined`). Funciona porque `Boolean` como função
de filtro deixa passar só o *truthy*. Usado ao parsear tags digitadas
(`split(",").map(trim).filter(Boolean)`) para descartar entradas vazias. → [app-banco](app-banco.explicado.md) §1a.
</details>

**1.4** Ao montar HTML com template literals e `innerHTML`, por que passar o texto por `esc()`?

<details><summary>▸ resposta</summary>

Porque `innerHTML` **interpreta** o texto como HTML. Sem escapar, um dado com `<script>` seria
**executado** (XSS). `esc` troca `<`, `&`, etc. por entidades, tornando o dado texto inerte. Regra:
**escape toda interpolação de dado em `innerHTML`**. → [app-edital](app-edital.explicado.md) §3d.
</details>

**1.5** No `cycleStatus`, o status vai 0→1→2→0. Como uma linha garante esse ciclo?

<details><summary>▸ resposta</summary>

`(status + 1) % 3`. O resto da divisão por 3 sempre cai em `{0,1,2}` e "dá a volta" sozinho
(`2+1=3 → 3%3=0`). É o idioma clássico de ciclar dentro de um intervalo. → [app-edital](app-edital.explicado.md) §4.
</details>

---

## Nível 2 — Padrões do app

**2.1** Descreva o "ciclo de vida" de qualquer interação que muda dados no painel.

<details><summary>▸ resposta</summary>

**Muta `S` → `save()` → re-renderiza** (a tela afetada, explicitamente). Não há reatividade
automática; o re-render é chamado à mão. Esquecer o re-render deixa a tela desatualizada mostrando
dado velho. → [app-edital](app-edital.explicado.md) §4, [FLUXOGRAMA](FLUXOGRAMA.md) §2.
</details>

**2.2** `renderEdital` apaga tudo (`innerHTML=""`) e recria. Como ele evita fechar um card de
disciplina que o usuário tinha aberto?

<details><summary>▸ resposta</summary>

**Antes** de apagar, captura num `Set` os ids dos cards com classe `.open`; **depois** de recriar,
reaplica `.open` a quem estava no `Set`. É o padrão "render idempotente que preserva estado de
UI" — o que frameworks fazem por baixo (reconciliação). → [app-edital](app-edital.explicado.md) §3a.
</details>

**2.3** O que a convenção "default = ausência de atributo" significa nos 3 eixos de tema, e que
vantagem traz?

<details><summary>▸ resposta</summary>

O valor **padrão** (escuro / literária / lateral) **não** recebe `data-*` no `<html>`; só os
desvios (`data-theme="claro"`) recebem. Vantagem: o DOM fica limpo, o caminho comum (o padrão) não
faz trabalho nenhum, e o boot pré-paint só escreve quando há desvio salvo. O `:root{}` base **é** o
padrão. → [index-html](index-html.explicado.md) A.2, B.2.
</details>

**2.4** Por que muitos arquivos começam com `const _X = typeof X !== "undefined" ? X : []`?

<details><summary>▸ resposta</summary>

É um **guarda com fallback**: se o `*-data.js` correspondente não carregou (ou é opcional, como o
kit), a variável vira `[]`/`{}` em vez de estourar `ReferenceError`. O `typeof` é o único teste de
existência seguro para uma global que pode não existir. Base da **degradação graciosa**. →
[app-analise](app-analise.explicado.md) §0, [dados](dados.explicado.md).
</details>

**2.5** Um `<select>` de disciplinas é preenchido uma vez com `if(sel && !sel.dataset.done){ … }`.
Que padrão é esse e por que guardar a flag no DOM?

<details><summary>▸ resposta</summary>

É "setup único separado do re-render": opções fixas não precisam ser recriadas a cada render.
Guardar a flag **no DOM** (`data-done="1"`) faz ela sobreviver naturalmente enquanto o elemento
existir, sem uma variável JS paralela. → [app-analise](app-analise.explicado.md) §4a.
</details>

**2.6** O que é `semCofre()` e dê dois lugares onde ele muda o comportamento.

<details><summary>▸ resposta</summary>

Detecta que o painel roda **sem** o cofre Obsidian (o "painel-presente" da Bia, sem o app
instalado), pela presença de `PERFIL_SEED`. Muda o comportamento: (1) o `openNote` **esconde** o
link `obsidian://` morto e mostra o leitor de notas web; (2) `canaisDe` **filtra** os atalhos do
cofre nos Recursos. É degradação graciosa por contexto. → [app-edital](app-edital.explicado.md) §2, §9.
</details>

---

## Nível 3 — Algoritmos e sistemas

**3.1** Você respondeu 2 questões de um tópico e acertou as 2. Por que o `riscoDe` **não** devolve
risco 0? Explique o mecanismo.

<details><summary>▸ resposta</summary>

Porque usa **encolhimento bayesiano**: `(erros + prior×peso) / (resp + peso)` com `prior=.55`,
`peso=3`. Com 2 acertos: `(0 + 1.65)/(2+3) = .33` — desce, mas não a 0, porque 2 respostas são
amostra pequena demais para "provar" domínio. Só com muitas respostas a amostra **afoga** o prior.
É a mesma matemática do "1 avaliação 5★ não vence mil 4.8★". → [app-banco](app-banco.explicado.md) §3.
</details>

**3.2** Por que a média do argumento é **harmônica** e não aritmética? O que isso modela?

<details><summary>▸ resposta</summary>

A harmônica (`Σw / Σ(w/x)`) **pune notas baixas** desproporcionalmente: uma prova fraca derruba o
resultado (se um `x→0`, o termo `w/x→∞` e a média→0). Modela a realidade do vestibular — **não
adianta gabaritar uma e zerar outra**. A aritmética deixaria a boa compensar a ruim. →
[app-painel](app-painel.explicado.md) §1b.
</details>

**3.3** No `sync.js`, por que `nextTs()` faz `Math.max(Date.now(), lastTs+1)` em vez de só
`Date.now()`?

<details><summary>▸ resposta</summary>

Para o timestamp ser **estritamente crescente** (relógio lógico monotônico, à la Lamport):
`Date.now()` empata no mesmo milissegundo e pode **recuar** (ajuste de relógio/fuso). O `max(…,
last+1)` garante que "quem escreveu depois" seja sempre identificável, resolvendo empates e
corridas. → [sync](sync.explicado.md) §2.
</details>

**3.4** O que impede que `applyRemote` (que chama `save()`) entre num laço infinito
pull→save→push→pull?

<details><summary>▸ resposta</summary>

A **guarda de reentrância** `Sync._applying`. Antes de aplicar o remoto, marca `_applying=true`; o
`onSaved` (disparado pelo `save`) sai imediatamente enquanto essa flag está ligada, então **não**
agenda um push em resposta ao próprio merge. Depois, `snap()` redefine o baseline para o estado já
mesclado. → [sync](sync.explicado.md) §5.
</details>

**3.5** Como cliente e servidor garantem que o estado **converge** sem uma fila de envio
persistente?

<details><summary>▸ resposta</summary>

Os **dois lados** aplicam a **mesma** regra: *last-write-wins por seção* (grava só se o `ts` de
entrada é maior). Some a isso o **merge por id** (união que não perde itens de aparelhos
distintos). Como reenviar é inofensivo (o mais velho é ignorado) e o merge sempre converge, o
próprio `ts` no `localStorage` "lembra" o que falta subir — não precisa de fila. → [sync](sync.explicado.md) §4,
[functions-state](functions-state.explicado.md) §6.
</details>

**3.6** No QR, por que a multiplicação em GF(256) vira uma **soma** de tabelas?

<details><summary>▸ resposta</summary>

Porque existe um elemento gerador (o 2) cujas potências percorrem todos os valores não-nulos: todo
número é `2ᵏ`. Então `2ᵃ × 2ᵇ = 2ᵃ⁺ᵇ` → multiplicar = **somar expoentes** e consultar o antilog
(a mesma ideia da régua de cálculo/logaritmo). As tabelas `LOG`/`EXP` fazem isso em O(1). →
[qr](qr.explicado.md) §1.
</details>

**3.7** Por que os codewords de um QR são **intercalados** entre blocos?

<details><summary>▸ resposta</summary>

Para transformar um dano **concentrado** (um borrão numa região) em erros **esparsos e pequenos**,
dentro do que o Reed-Solomon de cada bloco consegue corrigir. Se os bytes de um bloco ficassem
juntos, o borrão destruiria um bloco inteiro. É a técnica geral contra *burst error* (também em
CDs). → [qr](qr.explicado.md) §4.
</details>

---

## Nível 4 — Integração e armadilhas

**4.1** O PWA testa `if(!/^https?:$/.test(location.protocol)) return;`. Por que não basta checar
`if("serviceWorker" in navigator)`?

<details><summary>▸ resposta</summary>

Porque em **`file://`** o `"serviceWorker" in navigator` é **`true`** (a API existe), mas
**qualquer chamada lança `SecurityError`** (origem opaca). *Feature detection* aqui **mente**; a
guarda tem de ser **por protocolo**. Mesma pegadinha nas sondas de verificação. → [app.js](app.explicado.md) §8,
[pipeline](pipeline.explicado.md) §8.
</details>

**4.2** Uma sonda headless abre o app, corta a rede com a emulação do CDP, faz um `fetch` de dentro
da página e recebe **200**. Isso prova que o offline funciona? Por quê?

<details><summary>▸ resposta</summary>

**Não.** Dois furos: (1) a emulação de offline do CDP **já mentiu** antes (não bloqueou o fetch); o
teste honesto é **matar o servidor**. (2) Mesmo com a rede no chão, um `fetch` de dentro do app
atravessa o **service worker** e responde **200 do cache** — parece vivo. Quem atesta a morte é o
**Node** (um `http.get` de fora → `ECONNREFUSED`), nunca a página. → [pipeline](pipeline.explicado.md) §8.
</details>

**4.3** Por que o `sw.js` cacheia **de propósito** o `404` de `perfil-seed.js`?

<details><summary>▸ resposta</summary>

Porque esse arquivo pode **não existir** neste site, e o `index.html` o carrega como
`<script src>`. Offline, buscar um arquivo inexistente deixa o `<script>` **pendurado ~4s**
tentando a rede — e `<script src>` **trava o parser**, então o app inteiro esperava. Cacheando o
404, o "não existe" chega **na hora**: offline falha igual a online. Cachear um erro é
contraintuitivo, mas o 404 **é** a resposta correta. → [sw](sw.explicado.md) §6.
</details>

**4.4** O `test-qr.js` verifica o QR mandando o OpenCV **lê-lo de volta**, em vez de comparar a
matriz de módulos com outra biblioteca. Por quê?

<details><summary>▸ resposta</summary>

Porque o padrão QR admite **mais de um** preenchimento válido depois do terminador — duas libs
corretas **divergem** ali sem erro. Então comparar matrizes daria "falha" para dois QRs igualmente
válidos. A verificação certa testa **a propriedade que importa** (dá para ler?), não a **igualdade**
com uma referência arbitrária. Princípio geral de teste. → [qr](qr.explicado.md) topo, [pipeline](pipeline.explicado.md) §9.
</details>

**4.5** A rubrica de uma banca mudou de escala (de /10 para /20). Uma redação antiga guardou
`9/10`. Por que exibir "9 numa escala 20" (=45%) estaria errado, e como o painel resolve?

<details><summary>▸ resposta</summary>

Errado porque o aluno tirou **90%**, não 45%: a escala mudou, mas o desempenho não. O painel guarda
`r.max` (a escala **da época**) junto de `r.nota`, e compara sempre pela **fração**, reprojetando
na escala atual: `9 × 20/10 = 18/20` (90%). **A proporção é invariante; o valor cru não** — guarde
o suficiente para renormalizar. → [app-analise](app-analise.explicado.md) §3c.
</details>

**4.6** No `init()`, por que o deep-link por hash é filtrado por `/^[a-z-]+$/` antes de
`$("#tab-"+h)`?

<details><summary>▸ resposta</summary>

Porque o `location.hash` pode conter **qualquer coisa** — inclusive o `#token=abc` do login por QR.
Sem o filtro, `$("#tab-token=abc")` seria um **seletor CSS inválido**, `querySelector` lançaria e o
`init` **inteiro** morreria (página não carrega). A regex só aceita nomes de aba plausíveis; é
**parsing defensivo de entrada não confiável**. → [app.js](app.explicado.md) §5.
</details>

---

## Desafio — perguntas de síntese

**D.1** Cite **três** manifestações da "barreira de dados" em camadas diferentes do sistema, e o
princípio comum.

<details><summary>▸ resposta</summary>

(1) **Painel:** dados extraídos só entram via geradores com validação; `esc`/`mdLite` desarmam HTML.
(2) **Servidor:** *prepared statements* (`bind ?`) impedem SQL injection; valida o corpo (400).
(3) **Pipeline:** validador estrito + allowlist de fontes; downloads não são executados. **Princípio
comum:** entrada externa é **dado não-confiável**, validado numa **fronteira** antes de cruzar para
o lado confiável. → [CONCEITOS](CONCEITOS.md) §9.
</details>

**D.2** Explique como uma única mudança em `edital-data.js` se propaga por: o Mapa do Edital, o
simulador Argumento, e o cofre Obsidian.

<details><summary>▸ resposta</summary>

`edital-data.js` é a **fonte única da verdade**. (1) O **Mapa** percorre `DISCIPLINAS` a cada render
→ o tópico novo aparece. (2) O **Argumento** usa `CURSOS[c].pesos[disc.prova]` (chave estrangeira)
→ o peso já vale. (3) O **cofre** é **gerado** por `node pipeline/gerar_cofre.cjs`, que lê o mesmo
`edital-data.js` → após regenerar, a nota existe. Um arquivo, três consumidores — o oposto de
espalhar a lista por N telas. → [edital-data](edital-data.explicado.md), [dados](dados.explicado.md).
</details>

**D.3** O `sync.js` detecta "o que mudou" para subir, mas **não** tem código dentro de
`cycleStatus`, `saveRed`, etc. Como?

<details><summary>▸ resposta</summary>

Pelo **shadow diff**: `save()` (chamado por **todos** os mutadores) dispara `Sync.onSaved()`, que
compara o `JSON.stringify` de cada seção com um **retrato** (`shadow`); as que mudaram ganham
timestamp novo e agendam push (com debounce). Assim **uma** função central cobre todos os
mutadores — e um mutador novo que chame `save()` sincroniza de graça. → [sync](sync.explicado.md) §3.
</details>

**D.4** Por que quase toda decisão de arquitetura (dado em `.js`, globais em ordem, guardas por
protocolo, PWA opcional) decorre de **uma** escolha?

<details><summary>▸ resposta</summary>

A escolha: **rodar sem build, sem npm, direto por `file://`** (100% offline, sem servidor). Dela
decorre: sem ESM (origem opaca) → globais em ordem; sem `fetch` de JSON local → dado embutido em
`.js`; `file://` sem service worker → guardas por protocolo e PWA só no site. É a "restrição-mãe"
que dá coerência ao projeto inteiro. → [CONCEITOS](CONCEITOS.md) §12, [app-core](app-core.explicado.md) §0.
</details>

---

## Como usar depois de acertar tudo

Responder "por quê" é metade do caminho — a outra metade é **fazer**: siga para o
**[LABORATORIO.md](LABORATORIO.md)** (prever saídas, caçar bug plantado, estender o app).

Depois dele, **volte ao código real** e tente o inverso: abra um `painel/app-*.js` e, para
cada função, diga em voz alta *o quê / como / por quê* **sem** olhar o `.explicado.md`. É o
teste final de que o material cumpriu seu papel: você não precisa mais dele.

*Fim do material de estudo. Volte ao [ROTEIRO.md](ROTEIRO.md) para revisar a ordem, ou ao
[README.md](README.md) para o índice.*
