# Pipeline — geradores locais (sem IA)

> A **coprodução Gemini → Claude** (o antigo `coproducao.py` + os scripts que chamavam a
> API) foi **removida em 2026-07-14** junto com o resto da IA do projeto. O que sobrou
> aqui são geradores **determinísticos e offline**: leem fonte no repo e emitem os
> `*-data.js` do painel ou o cofre Obsidian. Nenhum usa chave de LLM.
> Os scripts apagados vivem no commit `0911258` (`git show 0911258:pipeline/<arquivo>`).

## Regenerar (idempotente — edite a fonte e rode)
```bash
node   pipeline/gerar_cofre.cjs          # cofre-obsidian/* a partir de edital-data.js
node   pipeline/gerar_notas_web.cjs      # notas-data.js (leitura no painel, sem Obsidian)
node   pipeline/injetar_recursos.cjs     # recursos por tópico
python3 pipeline/gerar_gabaritos.py      # gabaritos-data.js (UFRGS, dos HTMLs de gabarito)
python3 pipeline/gerar_gabaritos_enem.py # gabaritos-enem-data.js (ENEM, lê PDFs *_GB_* com pdftotext)
python3 pipeline/cruzar_questoes.py      # banco-questoes-data.js (questões × gabaritos oficiais)
python3 pipeline/gerar_frequencia.py     # frequencia-data.js (incidência "o que mais cai")
```

## Aquisição / importação (rodadas pontuais)
```bash
python3 pipeline/baixar_provas_enem.py   # baixa provas ENEM do INEP (download.inep.gov.br)
python3 pipeline/importar_redacoes.py    # importa o corpus de redações (gitignored, só-Linux)
python3 pipeline/transcrever_cartilhas.py# transcreve cartilhas de redação para o painel
```

## Validação e verificação
- `validar_questoes.py` — barreira de schema do banco (`need()`, faixas numéricas); falha = investigar, não afrouxar.
- `auditar_painel.js` e `verificar/` — auditoria headless do painel (driver CDP + sondas). Ver `verificar/README.md`.

> **Só o Python** precisa de venv (`cd pipeline && python3 -m venv .venv && source .venv/bin/activate`);
> nenhum pacote de LLM é necessário. Os `.cjs`/`.js` rodam com Node puro.
> Convenções e armadilhas de cada gerador: ver o `CLAUDE.md` da raiz.
