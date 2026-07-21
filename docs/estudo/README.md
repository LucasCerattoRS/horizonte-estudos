# 📚 Material de Estudo — o código do Horizonte Estudos, explicado

Este diretório transforma o próprio painel em **material didático**. A ideia: você já
tem um projeto real e funcionando; aqui a gente o disseca para você **entender de verdade**
como ele funciona — linha por linha, com o conceito de programação por trás de cada escolha.

> **Regra de ouro:** nada aqui altera o comportamento do app. São **arquivos-espelho** de
> leitura. O código original em `painel/` fica intocado (você pediu assim).

## Como usar
1. Leia o **[ROTEIRO.md](ROTEIRO.md)** primeiro — ele diz **em que ordem** ler, do mais
   fundamental ao mais avançado, para aprender de forma progressiva.
2. Para cada arquivo de código `foo.js`, existe um `foo.explicado.md` aqui com o código em
   pedaços pequenos + explicação (o QUÊ, o COMO, o PORQUÊ), notas de sintaxe, o "conceito por
   trás", alternativas com trade-offs e as armadilhas.
3. Ao final, use **EXERCICIOS.md** para se testar (perguntas com gabarito oculto).

## Convenção
`painel/app-core.js`  →  `docs/estudo/app-core.explicado.md`

## Decisões deliberadas (não são promessas esquecidas)
- **Sem comentários `// [ESTUDO]` no fonte.** Eram opcionais no pedido original; a decisão
  foi concentrar **toda** a didática nos espelhos e manter `painel/` intocado (a regra de
  ouro acima). Motivo reforçado pela auditoria: comentário didático no fonte é dívida — o
  caso SM-2 mostrou um comentário desatualizado **propagando erro** para a documentação.
- **Os `*-data.js` compartilham um espelho só (`dados.explicado.md`).** São 17 arquivos com
  meia dúzia de schemas parecidos; um espelho por arquivo repetiria a mesma explicação 17
  vezes. A exceção é `edital-data.js` (o schema mais rico), que tem espelho próprio.

## Camada conceitual (transversal)
| Arquivo | O que é |
|---|---|
| [ARQUITETURA.md](ARQUITETURA.md) | **Comece por aqui:** o mapa (execução, estado, pastas) + as decisões de arquitetura (mini-ADRs). |
| [ROTEIRO.md](ROTEIRO.md) | A ordem de leitura recomendada, em etapas. |
| [CONCEITOS.md](CONCEITOS.md) | Todos os conceitos de programação do projeto, explicados do zero, por tema. |
| [GLOSSARIO.md](GLOSSARIO.md) | Termos técnicos em ordem alfabética. |
| [FLUXOGRAMA.md](FLUXOGRAMA.md) | Os principais fluxos em diagrama (mermaid) + texto. |
| [EXERCICIOS.md](EXERCICIOS.md) | Perguntas de revisão (básico→avançado) com respostas ocultas. |
| [LABORATORIO.md](LABORATORIO.md) | Exercícios **práticos**: prever saída, bug plantado, estender o app (com gabarito). |

## Progresso da documentação (arquivos-espelho)
Marca o que já foi escrito. `[x]` = pronto · `[ ]` = a fazer.

**Fundação e dados**
- [x] `app-core.explicado.md` — helpers, estado, perfis, navegação, aparência, curso ⭐ **comece aqui**
- [x] `edital-data.explicado.md` — o schema dos dados (CURSOS, DISCIPLINAS)
- [x] `dados.explicado.md` — o formato dos demais `*-data.js` (visão de conjunto)

**As abas (uma fatia de app.js cada)**
- [x] `app-edital.explicado.md` — aba Mapa do Edital
- [x] `app-painel.explicado.md` — aba Painel (hero, Trilha, Foco) + simulador Argumento
- [x] `app-plano.explicado.md` — aba Cronograma (repetição espaçada SM-2)
- [x] `app-analise.explicado.md` — aba Análise (incidência × acerto) + Recursos
- [x] `app-banco.explicado.md` — aba Questões (banco + provas oficiais + correção)
- [x] `app-redacao.explicado.md` — aba Redação (wizard, rubricas, nota manual)

**Boot, sincronização e PWA**
- [x] `app.explicado.md` — o boot (`mergeCorpus`/`init`) + registro do PWA
- [x] `sync.explicado.md` — sincronização entre aparelhos + login por QR
- [x] `qr.explicado.md` — o gerador de QR code, do zero
- [x] `sw.explicado.md` — o service worker (offline)
- [x] `index-html.explicado.md` — a casca: HTML + CSS (3 eixos de tema) + boot pré-paint *(em partes)*

**Backend e ferramentas (opcional/avançado)**
- [x] `functions-state.explicado.md` — o endpoint serverless (Cloudflare + D1)
- [x] `pipeline.explicado.md` — os geradores de dados e as sondas de verificação

---
*Material **completo**: 16 arquivos-espelho (toda a base de código) + 6 docs transversais
(ARQUITETURA · CONCEITOS · GLOSSÁRIO · FLUXOGRAMA · EXERCÍCIOS · LABORATÓRIO). Última
atualização: 2026-07-20 (pós-auditoria).*
