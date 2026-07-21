#!/usr/bin/env python3
"""Transcreve as cartilhas "Redação a Mil" para JSON estruturado — SEM API.

As cartilhas (pesquisa/redacoes-notamil/*.pdf) têm camada de texto (Poliedro/Lucas
Felpi): dá para extrair com pdftotext, custo zero. Cada edição traz um tema (ENEM do
ano) e ~11 redações nota 1000, cada uma com nome do autor, espelho (imagem, ignorada)
e transcrição (o texto que queremos).

Estratégia de parsing (sem LLM, portanto auditável):
  • o Sumário lista os autores → usamos os nomes como delimitadores de bloco;
  • o texto de cada redação vem após "Transcrição" e vai até o próximo autor ou seção
    ("Análise", "Comentário", "Espelho", "Agradecimentos");
  • linhas só com número de página e ruído de rodapé são descartadas.

Saída: painel/redacoes-notamil-data.js (const REDACOES_NOTAMIL) + relatório no stdout.

Uso:  python3 pipeline/transcrever_cartilhas.py [--dir <pasta>] [--dry-run]
"""

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DIR_CARTILHAS = BASE / "pesquisa" / "redacoes-notamil"
OUT = BASE / "painel" / "redacoes-notamil-data.js"

SECOES = ("Espelho", "Transcrição", "Transcricao", "Análise", "Analise",
          "Comentário", "Comentario", "Agradecimentos", "Sumário", "Sumario")
# Ruído de rodapé/cabeçalho que aparece solto entre parágrafos.
RUIDO = re.compile(r"Reprodução/Inep|bit\.ly|QR Code|Poliedro|Redação a Mil|"
                   r"Sob nenhuma hipótese|revendido", re.I)
# Zero-width e afins que o PDF injeta nos nomes (ex.: "Amanda Chagas​").
INVISIVEIS = dict.fromkeys(map(ord, "​‌‍﻿\xad"), None)


def limpa(txt: str) -> str:
    # NFKC desfaz ligaduras tipográficas do PDF (ﬁ→fi, ﬂ→fl) além de normalizar.
    return unicodedata.normalize("NFKC", txt).translate(INVISIVEIS).strip()


def tema_do_arquivo(nome: str) -> str:
    """Tema legível a partir do nome do PDF (fallback p/ edições sem 'Tema:')."""
    m = re.search(r"20\d{2}_(.+?)\.pdf$", nome)
    return m.group(1).replace("-", " ").strip() if m else ""


def texto_pdf(pdf: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", str(pdf), "-"],
                       capture_output=True, timeout=180)
    return r.stdout.decode("utf-8", "replace")


def extrai_tema(linhas: list[str]) -> str:
    for i, ln in enumerate(linhas):
        if ln.strip().rstrip(":").strip().lower() == "tema":
            for prox in linhas[i + 1:i + 4]:
                p = limpa(prox).strip('“”"')
                if p:
                    return p
    return ""


def nome_autor(linha: str) -> str | None:
    """Nome limpo de uma linha 'Nome [NN anos | Cidade - UF] [pág]', ou None.

    Serve às duas eras: com metadados colados (2018: 'André Bahia 18 anos | ...')
    e sem (2019: 'Alana Miranda Delﬁno' sozinha, ou 'Nome .... 12' no sumário).
    """
    s = limpa(linha)
    s = re.sub(r"\s*\([^)]*\)", "", s)                 # tira "(ela/dela)"
    s = re.split(r"\s+\d+\s*anos|\s*\|", s)[0]          # corta nos metadados
    s = re.sub(r"\s+\d+\s*$", "", s).strip()            # tira nº de página final
    toks = s.split()
    if 2 <= len(toks) <= 6 and re.fullmatch(r"[A-Za-zÀ-ÿ.'\- ]+", s):
        if not s.lstrip().startswith(SECOES):
            return s
    return None


def autores_do_sumario(linhas: list[str]) -> list[str]:
    """Nomes listados no Sumário, preservando a ordem."""
    try:
        ini = next(i for i, ln in enumerate(linhas)
                   if limpa(ln).lower().startswith(("sumário", "sumario")))
    except StopIteration:
        return []
    autores = []
    for ln in linhas[ini + 1:]:
        low = limpa(ln).lower()
        if low.startswith(("análise geral", "analise geral", "agradecim")):
            break
        cand = nome_autor(ln)
        if cand and cand not in autores:
            autores.append(cand)
    return autores


def corpo_apos_sumario(linhas: list[str]) -> list[str]:
    """Descarta o índice: começa após o 2º 'Tema:' ou a última linha do sumário."""
    idxs = [i for i, ln in enumerate(linhas)
            if limpa(ln).rstrip(":").lower() == "tema"]
    return linhas[idxs[-1]:] if idxs else linhas


# Fim da redação dentro do bloco do autor: as edições 2020+ trazem análise do
# Poliedro depois da transcrição — não é do candidato, então cortamos aqui.
FIM_REDACAO = ("análise", "analise", "comentário", "comentario")
METADADOS = re.compile(r"^\s*\d+\s*anos|@|Foto:|^\s*\d+\s*$", re.I)


def transcricoes(linhas: list[str], autores: list[str]) -> dict[str, str]:
    """Texto de cada autor: por bloco (autor → próximo autor), robusto às duas eras.

    Dentro do bloco: começa após 'Transcrição' se houver (senão logo após a linha do
    autor) e termina na análise do Poliedro, se existir. Sem depender do rótulo
    'Transcrição', que só existe a partir de 2020.
    """
    corpo = corpo_apos_sumario(linhas)
    setau = set(autores)
    # marca onde cada autor começa no corpo
    marcos = [(i, nome_autor(ln)) for i, ln in enumerate(corpo)]
    marcos = [(i, n) for i, n in marcos if n in setau]

    res = {}
    for k, (ini, nome) in enumerate(marcos):
        fim = marcos[k + 1][0] if k + 1 < len(marcos) else len(corpo)
        bloco = corpo[ini + 1:fim]
        # recorta início (após 'Transcrição') e fim (antes da análise)
        t = next((j for j, ln in enumerate(bloco)
                  if limpa(ln).lower() in ("transcrição", "transcricao")), None)
        trecho = bloco[t + 1:] if t is not None else bloco
        corte = next((j for j, ln in enumerate(trecho)
                      if limpa(ln).lower().rstrip(":") in FIM_REDACAO), len(trecho))
        buf = [limpa(ln) for ln in trecho[:corte]]
        buf = [ln for ln in buf if ln and not METADADOS.match(ln) and not RUIDO.search(ln)
               and limpa(ln).lower() != "espelho"]
        texto = re.sub(r"\s{2,}", " ", " ".join(buf)).strip().strip('“”"')
        if len(texto) > 400:
            res[nome] = texto
    return res


def processa(pdf: Path) -> dict:
    ano_m = re.search(r"(20\d{2})", pdf.name)
    linhas = texto_pdf(pdf).splitlines()
    autores = autores_do_sumario(linhas)
    txts = transcricoes(linhas, autores)
    redacoes = [{"autor": a, "texto": t} for a, t in txts.items()]
    return {
        "arquivo": pdf.name,
        "ano": int(ano_m.group(1)) if ano_m else None,
        "banca": "ENEM",
        "tema": extrai_tema(linhas) or tema_do_arquivo(pdf.name),
        "n_autores_sumario": len(autores),
        "redacoes": redacoes,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(DIR_CARTILHAS))
    ap.add_argument("--dry-run", action="store_true", help="não grava o .js")
    args = ap.parse_args()

    pdfs = sorted(Path(args.dir).glob("*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF em {args.dir}")

    cartilhas, total = [], 0
    for pdf in pdfs:
        c = processa(pdf)
        total += len(c["redacoes"])
        falta = c["n_autores_sumario"] - len(c["redacoes"])
        alerta = f"  ⚠ {falta} do sumário sem transcrição" if falta > 0 else ""
        print(f"  {c['ano']} · {len(c['redacoes'])}/{c['n_autores_sumario']} redações · "
              f"“{c['tema'][:50]}”{alerta}")
        cartilhas.append(c)

    print(f"\nTotal: {total} redações nota-1000 em {len(cartilhas)} cartilhas.")
    if args.dry_run:
        return
    js = ("/* GERADO por pipeline/transcrever_cartilhas.py — NÃO EDITAR À MÃO.\n"
          "   Redações nota-1000 (coletânea Redação a Mil), transcritas dos PDFs sem API. */\n"
          "const REDACOES_NOTAMIL = "
          + json.dumps(cartilhas, ensure_ascii=False, separators=(",", ":"))
          + ";\nif (typeof module !== \"undefined\") module.exports = { REDACOES_NOTAMIL };\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"OK -> {OUT.relative_to(BASE)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
