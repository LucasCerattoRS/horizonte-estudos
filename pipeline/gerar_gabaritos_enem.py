#!/usr/bin/env python3
"""
gerar_gabaritos_enem.py — gera painel/gabaritos-enem-data.js (const GABARITOS_ENEM)
a partir dos gabaritos oficiais do ENEM (INEP).

Fonte:  pesquisa/provas-antigas/enem/AAAA_GB_impresso_D{1,2}_CD{1,7}.pdf
Requer: pdftotext (poppler-utils)  ->  sudo dnf install poppler-utils

Layout INEP (caderno AZUL; CD1 no 1º dia, CD7 no 2º dia), 2 colunas por dia:
  D1: LINGUAGENS (1-45, sendo 1-5 Inglês/Espanhol) | CIÊNCIAS HUMANAS (46-90)
  D2: CIÊNCIAS DA NATUREZA (91-135)                | MATEMÁTICA (136-180)
Questões anuladas aparecem como "Anulado" -> null (conta como acerto, igual ao UFRGS).

NÃO edite painel/gabaritos-enem-data.js à mão — rode este script.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENEM_DIR = ROOT / "pesquisa" / "provas-antigas" / "enem"
OUT = ROOT / "painel" / "gabaritos-enem-data.js"
YEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]

# resposta: letra, "Anulado", ou marcação de anulada estilo 2020 ("*" / "*C" + rodapé)
ANS = r"(?:\*?[A-E]|\*|[Aa]nulad\w*)"
RE_LE = re.compile(rf"^\s*([1-5])\s+({ANS})\s+({ANS})\s+(\d+)\s+({ANS})\s*$")  # Q1-5: num c1 c2 rnum rans
RE_2 = re.compile(rf"^\s*(\d+)\s+({ANS})\s+(\d+)\s+({ANS})\s*$")               # normal: lnum lans rnum rans
RE_1 = re.compile(rf"^\s*(\d+)\s+({ANS})\s*$")                                 # linha com par único
# 2016 (layout irregular, colunas desalinhadas): runs "número + 1..2 respostas"
RE_RUN = re.compile(rf"\b(\d{{1,3}})\b((?:\s+{ANS}\b)+)")
RE_ANS = re.compile(ANS)


def norm(tok):
    """'Anulado'/'Anulada'/'*'/'*C' -> None; senão a letra."""
    return None if tok.startswith("*") or tok.lower().startswith("anulad") else tok


def extract_text(pdf: Path, raw: bool = False) -> str:
    return subprocess.run(
        ["pdftotext", "-raw" if raw else "-layout", str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout


def le_order(text: str):
    """Ordem física das colunas de língua estrangeira: ('ing','esp') ou ('esp','ing')."""
    for line in text.splitlines():
        up = line.upper()
        if "INGL" in up and "ESPANHOL" in up:
            return ("esp", "ing") if up.index("ESPANHOL") < up.index("INGL") else ("ing", "esp")
    return ("ing", "esp")


def parse_day(text: str, dia: int):
    """left/right: num->ans; f1/f2: num->ans nas 2 colunas de língua (só D1)."""
    left, right, f1, f2 = {}, {}, {}, {}
    for line in text.splitlines():
        if dia == 1:
            m = RE_LE.match(line)
            if m:
                n = int(m.group(1))
                f1[n] = norm(m.group(2))
                f2[n] = norm(m.group(3))
                right[int(m.group(4))] = norm(m.group(5))
                continue
        m = RE_2.match(line)
        if m:
            left[int(m.group(1))] = norm(m.group(2))
            right[int(m.group(3))] = norm(m.group(4))
            continue
        m = RE_1.match(line)  # coluna da direita ausente na linha (ex. 2020 q113)
        if m:
            n = int(m.group(1))
            (left if (dia == 1 and n <= 45) or (dia == 2 and n <= 135) else right)[n] = norm(m.group(2))
    return left, right, f1, f2


def need(got: dict, lo: int, hi: int, label: str, year: str):
    exp = set(range(lo, hi + 1))
    if set(got) != exp:
        miss = sorted(exp - set(got))
        extra = sorted(set(got) - exp)
        sys.exit(f"ERRO {year} {label}: faltando={miss} extra={extra}")


def qmap(d):
    return {str(k): d[k] for k in sorted(d)}


def build_2016():
    """ENEM 2016 (pré-reforma): D1 = CH 1-45 + CN 46-90; D2 = LC 91-135 (com
    Inglês/Espanhol nas 91-95, 2 colunas) + MT 136-180. Colunas desalinhadas no
    PDF -> parser por runs 'número + respostas' classificados pela faixa."""
    d1 = extract_text(ENEM_DIR / "2016_GB_impresso_D1_CD1.pdf")
    d2 = extract_text(ENEM_DIR / "2016_GB_impresso_D2_CD7.pdf")

    def runs(text):
        out = []
        for line in text.splitlines():
            for m in RE_RUN.finditer(line):
                out.append((int(m.group(1)), [norm(t) for t in RE_ANS.findall(m.group(2))]))
        return out

    ch, cn, lc, mt, f1, f2 = {}, {}, {}, {}, {}, {}
    for num, ans in runs(d1):
        alvo = ch if num <= 45 else cn
        alvo[num] = ans[0]
    for num, ans in runs(d2):
        if 91 <= num <= 95 and len(ans) == 2:
            f1[num], f2[num] = ans
        elif num <= 135:
            lc[num] = ans[0]
        else:
            mt[num] = ans[0]

    o = le_order(d2)
    ing = f1 if o[0] == "ing" else f2
    esp = f2 if o[0] == "ing" else f1

    need(ch, 1, 45, "Ciências Humanas", "2016")
    need(cn, 46, 90, "Ciências da Natureza", "2016")
    need(ing, 91, 95, "Inglês(91-95)", "2016")
    need(esp, 91, 95, "Espanhol(91-95)", "2016")
    need(lc, 96, 135, "Linguagens(96-135)", "2016")
    need(mt, 136, 180, "Matemática", "2016")

    pdf1, pdf2 = "2016_PV_impresso_D1_CD1.pdf", "2016_PV_impresso_D2_CD7.pdf"
    pdf1 = pdf1 if (ENEM_DIR / pdf1).exists() else None
    pdf2 = pdf2 if (ENEM_DIR / pdf2).exists() else None
    return {
        "LC": {"nome": "Linguagens e Códigos", "area": "LC", "dia": 2, "le": True,
               "caderno": "Azul (Caderno 7)", "pdf": pdf2,
               "q": qmap(lc), "ing": qmap(ing), "esp": qmap(esp)},
        "CH": {"nome": "Ciências Humanas", "area": "CH", "dia": 1,
               "caderno": "Azul (Caderno 1)", "pdf": pdf1, "q": qmap(ch)},
        "CN": {"nome": "Ciências da Natureza", "area": "CN", "dia": 1,
               "caderno": "Azul (Caderno 1)", "pdf": pdf1, "q": qmap(cn)},
        "MT": {"nome": "Matemática", "area": "MT", "dia": 2,
               "caderno": "Azul (Caderno 7)", "pdf": pdf2, "q": qmap(mt)},
    }


def build_year(year: str):
    if year == "2016":
        return build_2016()
    d1_pdf = ENEM_DIR / f"{year}_GB_impresso_D1_CD1.pdf"
    d2_pdf = ENEM_DIR / f"{year}_GB_impresso_D2_CD7.pdf"
    d1, d2 = extract_text(d1_pdf), extract_text(d2_pdf)

    l1, r1, f1, f2 = parse_day(d1, 1)
    l2, r2, _, _ = parse_day(d2, 2)

    # o -layout às vezes desloca uma resposta (ex. 2020 q158); completa via -raw
    for pdf, dia, left, right, span_l, span_r in (
        (d1_pdf, 1, l1, r1, range(6, 46), range(46, 91)),
        (d2_pdf, 2, l2, r2, range(91, 136), range(136, 181)),
    ):
        lr, rr, _, _ = parse_day(extract_text(pdf, raw=True), dia)
        for k, v in lr.items():
            if k in span_l:
                left.setdefault(k, v)
        for k, v in rr.items():
            if k in span_r:
                right.setdefault(k, v)

    # mapeia colunas de língua p/ ing/esp conforme o cabeçalho
    o = le_order(d1)
    ing = f1 if o[0] == "ing" else f2
    esp = f2 if o[0] == "ing" else f1

    need(ing, 1, 5, "Inglês(1-5)", year)
    need(esp, 1, 5, "Espanhol(1-5)", year)
    need(l1, 6, 45, "Linguagens(6-45)", year)
    need(r1, 46, 90, "Ciências Humanas", year)
    need(l2, 91, 135, "Ciências da Natureza", year)
    need(r2, 136, 180, "Matemática", year)

    # link só se a prova existir localmente (gabaritos 2016-2021 vieram antes das provas)
    pdf1 = f"{year}_PV_impresso_D1_CD1.pdf"
    pdf2 = f"{year}_PV_impresso_D2_CD7.pdf"
    pdf1 = pdf1 if (ENEM_DIR / pdf1).exists() else None
    pdf2 = pdf2 if (ENEM_DIR / pdf2).exists() else None
    return {
        "LC": {"nome": "Linguagens e Códigos", "area": "LC", "dia": 1, "le": True,
               "caderno": "Azul (Caderno 1)", "pdf": pdf1,
               "q": qmap(l1), "ing": qmap(ing), "esp": qmap(esp)},
        "CH": {"nome": "Ciências Humanas", "area": "CH", "dia": 1,
               "caderno": "Azul (Caderno 1)", "pdf": pdf1, "q": qmap(r1)},
        "CN": {"nome": "Ciências da Natureza", "area": "CN", "dia": 2,
               "caderno": "Azul (Caderno 7)", "pdf": pdf2, "q": qmap(l2)},
        "MT": {"nome": "Matemática", "area": "MT", "dia": 2,
               "caderno": "Azul (Caderno 7)", "pdf": pdf2, "q": qmap(r2)},
    }


def main():
    if not ENEM_DIR.exists():
        sys.exit(f"ERRO: {ENEM_DIR} não existe")
    data = {}
    for y in YEARS:
        data[y] = build_year(y)
        anul = []
        for area, p in data[y].items():
            anul += [f"{area}:{n}" for n, v in p["q"].items() if v is None]
        print(f"  {y}: 180 questões OK · anuladas: {', '.join(anul) or 'nenhuma'}")

    head = (
        "/* GERADO por pipeline/gerar_gabaritos_enem.py — NÃO edite à mão.\n"
        "   Gabaritos oficiais ENEM (INEP), caderno AZUL (CD1 no 1º dia, CD7 no 2º dia).\n"
        "   Fonte: pesquisa/provas-antigas/enem/*_GB_*.pdf\n"
        "   Estrutura: GABARITOS_ENEM[ano][area] = {nome, area, dia, caderno, pdf, q:{questão:letra|null}}\n"
        "   null = questão ANULADA (conta como acerto). Área LC traz ing/esp p/ as questões 1-5.\n"
        "   Correção assume o caderno AZUL — mesma numeração dos PDFs *_PV_*_CD1/CD7. */\n"
    )
    js = head + "const GABARITOS_ENEM = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js += 'if (typeof module !== "undefined") module.exports = { GABARITOS_ENEM };\n'
    OUT.write_text(js, encoding="utf-8")
    print(f"OK -> {OUT.relative_to(ROOT)}  ({len(js)} bytes)")


if __name__ == "__main__":
    main()
