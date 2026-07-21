# Horizonte — Painel de Estudos (ENEM / UFRGS)

PWA de estudos **offline-first, sem frameworks** (vanilla JS puro), com sincronização
multi-dispositivo via Cloudflare (Pages + Functions + D1 + Worker de push).
Feito para preparação ENEM/vestibular UFRGS, mas a arquitetura serve para qualquer
painel pessoal de estudo.

> Todos os nomes e dados pessoais foram substituídos por personagens fictícios
> (**Alex**, o titular; **Bia**, a convidada). Os dados de provas são públicos (ENEM/UFRGS).

## O que tem dentro

| Módulo | O que faz |
|---|---|
| `painel/` | O app em si: HTML + JS vanilla, PWA instalável, funciona 100% offline |
| `painel/*-data.js` | Dados gerados: banco de questões oficiais classificadas por tópico, frequência por assunto, edital interativo, leituras obrigatórias, redações nota mil, rubricas de correção |
| `functions/` | API (Cloudflare Pages Functions) para sync de estado entre dispositivos |
| `worker-push/` | Worker de notificações push (Web Push + VAPID) |
| `pipeline/` | Scripts que baixam/classificam provas e geram os `*-data.js` |
| `pipeline/verificar/` | Probes headless (CDP) que validam o painel: offline, largura, visual |
| `infra/schema.sql` | Schema do banco D1 (perfis, estado, sync) |
| `docs/estudo/` | **Material didático completo**: cada arquivo do código explicado linha a linha |

## Destaques de arquitetura

- **Zero dependências no front.** Sem build, sem bundler: `<script src>` e pronto.
- **Offline-first de verdade.** Service worker com cache versionado; o painel abre
  em modo avião, e o sync reconcilia depois (last-write-wins por chave).
- **Dois perfis, um deploy.** O mesmo código serve o painel completo (com cofre
  Obsidian local) e o "painel-presente" (`--kit`), uma versão-presente publicada
  para outra pessoa, sem cofre — a detecção é em runtime (`semCofre()`).
- **Dados como código.** O pipeline transforma PDFs/provas em `*-data.js` commitados:
  o front nunca depende de API para conteúdo, só para sync.

## Como rodar

```bash
# 1. Local: qualquer servidor estático resolve
npx serve painel

# 2. Deploy (Cloudflare Pages + D1)
#    - crie um banco D1 e cole o id em wrangler.toml (SEU-DATABASE-ID-AQUI)
#    - aplique infra/schema.sql
npx wrangler pages deploy painel

# 3. Push (opcional) — ver docs/ATIVAR-PUSH.md (gera par VAPID e sobe o worker)
```

## Trilha de estudo (docs/estudo)

Se você quer **aprender** com este projeto, comece por:

1. `docs/estudo/ROTEIRO.md` — ordem de leitura sugerida
2. `docs/estudo/ARQUITETURA.md` — visão geral e diagramas
3. `docs/estudo/*.explicado.md` — cada arquivo-fonte comentado em profundidade
4. `docs/estudo/EXERCICIOS.md` + `LABORATORIO.md` — para praticar em cima do código

## Licença

MIT — direitos autorais reservados ao autor, uso, cópia e modificação liberados
(ver `LICENSE`).
