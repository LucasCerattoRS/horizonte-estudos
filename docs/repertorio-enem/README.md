# Repertório ENEM — Material de Fonte

Material bruto de repertório/redação, movido de `Desktop/Projetos Pessoais/Cache/Repertório ENEM/`
em 10/08/2026. Complementa os dados já curados do painel (não duplica):

- `painel/rubricas-redacao-data.js` já tem a matriz de referência **resumida** por banca.
- Os dois arquivos aqui são **fonte completa**, não resumo:

| Arquivo | O que é | Onde pode alimentar o painel |
|---|---|---|
| `Manual Oficial de Correção da Redação do ENEM (INEP).md` | Manual normativo completo do INEP (as 5 competências, critérios de correção detalhados) | Fonte primária para expandir/conferir `rubricas-redacao-data.js` |
| `Ilha das Flores — Do Tomate ao Lixão...md` | Análise de repertório sociocultural (curta-metragem clássico de redação ENEM: liberdade × dinheiro) | Candidato a entrada em `redacoes-notamil-data.js` ou numa futura aba de repertório |

Nenhuma integração no app foi feita ainda — os arquivos estão aqui como fonte pronta para quando
o pipeline (`pipeline/`) for adaptado para consumir repertório, não só provas oficiais.
