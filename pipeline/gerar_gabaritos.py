#!/usr/bin/env python3
"""Gera painel/gabaritos-data.js a partir dos HTMLs de gabarito UFRGS (2016-2026).

Duas eras de formato:
  ANTIGA (2016-2020, páginas oficiais ufrgs.br/vestibular/cvAAAA/gabaritos/,
  charset windows-1252): blocos "Nome" + pares NN X, 25 questões/disciplina com
  numeração global por dia (fis 1-25, lit 26-50, LEM 51-75; port 1-25; bio 1-25,
  qui 26-50, geo 51-75; his 1-25, mat 26-50). A página duplica o conteúdo
  (desktop/mobile) — blocos repetidos devem ser idênticos. Italiano/Francês/
  Alemão são ignorados (o painel só usa ing/esp).

  NOVA (2022-2026, fisicanet), varia por ano:
  - 2022/2023: blocos sequenciais  "Nome" 01A 02B ...
  - 2024:      "Nome" 01 02 ... 15  A B ... E   (números, depois letras)
  - 2025/2026: tabela intercalada  [num,letra]x5 por linha, header no meio
Questão anulada aparece como "**" ou "ANULADA" -> null no JSON.

Uso:  python3 pipeline/gerar_gabaritos.py
Idempotente: sobrescreve painel/gabaritos-data.js (arquivo gerado, não editar à mão).
"""
import html
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "pesquisa/provas-antigas/ufrgs/gabaritos"
OUT = BASE / "painel/gabaritos-data.js"

# nome no HTML -> (chave, nome exibido, disciplina do painel)
NOMES = {
    "Português": ("port", "Português", "port"),
    "Língua Portuguesa": ("port", "Português", "port"),
    "Literatura": ("lit", "Literatura", "lit"),
    "Literatura em Língua Portuguesa": ("lit", "Literatura", "lit"),
    "Literatura de Língua Portuguesa": ("lit", "Literatura", "lit"),
    "História": ("his", "História", "his"),
    "Matemática": ("mat", "Matemática", "mat"),
    "Geografia": ("geo", "Geografia", "geo"),
    "Física": ("fis", "Física", "fis"),
    "Química": ("qui", "Química", "qui"),
    "Biologia": ("bio", "Biologia", "bio"),
    "Inglês": ("ing", "Inglês", "lem"),
    "Espanhol": ("esp", "Espanhol", "lem"),
}
ORDEM = ["port", "lit", "his", "geo", "mat", "ing", "esp", "fis", "qui", "bio"]

# línguas oferecidas no vestibular antigo que o painel não usa
NOMES_IGNORAR = {"Italiano", "Francês", "Alemão"}

# era ANTIGA: início da numeração de cada disciplina (25 consecutivas por dia)
INICIO_ANTIGO = {"fis": 1, "lit": 26, "ing": 51, "esp": 51, "port": 1,
                 "bio": 1, "qui": 26, "geo": 51, "his": 1, "mat": 26}

# chave -> termo no nome do arquivo PDF da prova
PDF_TERMO = {
    "port": "Portugues", "lit": "Literatura", "his": "Historia", "geo": "Geografia",
    "mat": "Matematica", "ing": "Ingles", "esp": "Espanhol", "fis": "Fisica",
    "qui": "Quimica", "bio": "Biologia",
}


def pdf_da_prova(ano, chave):
    """PDF que contém a prova (p/ fis/qui/bio/geo pode haver 2 versões de língua; usa a 1ª)."""
    cands = sorted(SRC.parent.glob(f"UFRGS-{ano}-Prova-Dia-*.pdf"))
    if chave in ("ing", "esp"):
        cands = [c for c in cands if PDF_TERMO[chave] in c.name]
    else:
        cands = [c for c in cands if PDF_TERMO[chave] in c.name] or \
                [c for c in cands if "Espanhol" in c.name]
        cands = cands[:1] if cands else []
    return cands[0].name if cands else None

RE_NUMLET = re.compile(r"^(\d{2})\s*([A-E]|\*\*|ANULADA)$")
RE_NUM = re.compile(r"^(\d{2})$")
RE_LET = re.compile(r"^([A-E]|\*\*|ANULADA)$")


def tokenizar(path):
    b = path.read_bytes()
    try:
        raw = b.decode("utf-8")          # era NOVA (fisicanet)
    except UnicodeDecodeError:
        raw = b.decode("windows-1252")   # era ANTIGA (ufrgs.br/vestibular)
    txt = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S)
    txt = re.sub(r"<[^>]+>", "\n", txt)
    linhas = [html.unescape(l).strip() for l in txt.split("\n")]
    return [l for l in linhas if l]


def blocos(linhas):
    """Agrupa em (nomes_do_header, tokens_de_resposta)."""
    out, nomes, resp = [], [], []
    for l in linhas:
        if l in NOMES:
            if resp:
                out.append((nomes, resp))
                nomes, resp = [], []
            nomes.append(l)
        elif nomes and (RE_NUMLET.match(l) or RE_NUM.match(l) or RE_LET.match(l)):
            resp.append(l)
        # linha "** ANULADA" (legenda) etc.: ignorada — validação pega se faltar algo
    if nomes and resp:
        out.append((nomes, resp))
    return out


def parse_bloco(nomes, resp):
    """-> lista de (nome_html, num:int, letra|None)."""
    k = len(nomes)
    numlets = [RE_NUMLET.match(t) for t in resp]
    if all(numlets):  # 2022/2023: "01A" sequencial (k==1 esperado)
        return [(nomes[0], int(m.group(1)), m.group(2)) for m in numlets]
    nums = [t for t in resp if RE_NUM.match(t)]
    lets = [t for t in resp if RE_LET.match(t)]
    if k == 1 and resp[: len(nums)] == nums:  # 2024: números depois letras
        if len(nums) != len(lets):
            raise ValueError(f"{nomes}: {len(nums)} números x {len(lets)} letras")
        return [(nomes[0], int(n), l) for n, l in zip(nums, lets)]
    # 2025/2026: pares (num, letra) intercalados por coluna, linha a linha
    pares, i = [], 0
    while i < len(resp) - 1:
        if RE_NUM.match(resp[i]) and RE_LET.match(resp[i + 1]):
            pares.append((int(resp[i]), resp[i + 1]))
            i += 2
        else:
            raise ValueError(f"{nomes}: token inesperado {resp[i]!r} na posição {i}")
    return [(nomes[p % k], num, let) for p, (num, let) in enumerate(pares)]


def parse_ano_antigo(path):
    """Era 2016-2020: blocos de nome único + pares NN X; conteúdo duplicado na página."""
    provas = {}
    nome, resp = None, []

    def fechar():
        nonlocal nome, resp
        if nome and resp:
            pares, i = [], 0
            while i < len(resp):
                m = RE_NUMLET.match(resp[i])
                if m:
                    pares.append((int(m.group(1)), m.group(2)))
                    i += 1
                elif RE_NUM.match(resp[i]) and i + 1 < len(resp) and RE_LET.match(resp[i + 1]):
                    pares.append((int(resp[i]), resp[i + 1]))
                    i += 2
                else:
                    raise ValueError(f"{path.name}/{nome}: token inesperado {resp[i]!r}")
            chave, exib, disc = NOMES[nome]
            q = {}
            for num, let in pares:
                v = None if let in ("**", "ANULADA") else let
                if num in q and q[num] != v:
                    raise ValueError(f"{path.name}/{exib}: questão {num} divergente ({q[num]} x {v})")
                q[num] = v
            if chave in provas and provas[chave]["q"] != q:
                raise ValueError(f"{path.name}/{exib}: bloco repetido divergente")
            provas.setdefault(chave, {"nome": exib, "disc": disc, "q": q})
        nome, resp = None, []

    for l in tokenizar(path):
        if l in NOMES:
            fechar()
            nome = l
        elif l in NOMES_IGNORAR:
            fechar()
        elif nome and (RE_NUMLET.match(l) or RE_NUM.match(l) or RE_LET.match(l)):
            resp.append(l)
        elif resp:      # linha estranha DEPOIS de respostas = fim do bloco
            fechar()
        # linha estranha antes das respostas (ex. nota "questão N modificada"): ignora
    fechar()

    if set(provas) != set(ORDEM):
        raise ValueError(f"{path.name}: provas {sorted(provas)} != esperado {sorted(ORDEM)}")
    for chave, p in provas.items():
        ns = sorted(p["q"])
        ini = INICIO_ANTIGO[chave]
        if ns != list(range(ini, ini + 25)):
            raise ValueError(f"{path.name}/{p['nome']}: numeração {ns[:3]}...{ns[-3:]} ({len(ns)}q, esperado {ini}-{ini + 24})")
    return {c: provas[c] for c in ORDEM}


def pdf_da_prova_antiga(ano, chave):
    """PDFs de 2016-2020 vivem em ufrgs/<ano>/ com nomes variados por ano."""
    pasta = SRC.parent / ano
    pdfs = [p.name for p in sorted(pasta.glob("*.pdf")) if "comentada" not in p.name.lower()]

    def acha(pred):
        r = [n for n in pdfs if pred(n.lower())]
        return f"{ano}/{r[0]}" if r else None

    if chave == "ing":
        return acha(lambda n: "ingles" in n or "-ing." in n or "ing.pdf" in n.replace("-", ""))
    if chave in ("fis", "lit", "esp"):
        return acha(lambda n: "esp" in n)
    if chave == "port":
        return acha(lambda n: "2o" in n or "dia-2" in n or "portugues" in n or n.startswith("lp"))
    if chave in ("bio", "qui", "geo"):
        return acha(lambda n: "3o" in n or "dia-3" in n or "bio" in n)
    if chave in ("his", "mat"):
        return acha(lambda n: "4o" in n or "dia-4" in n or "his" in n)
    return None


def parse_ano(path):
    provas = {}
    for nomes, resp in blocos(tokenizar(path)):
        for nome_html, num, let in parse_bloco(nomes, resp):
            chave, exib, disc = NOMES[nome_html]
            p = provas.setdefault(chave, {"nome": exib, "disc": disc, "q": {}})
            if num in p["q"]:
                raise ValueError(f"{path.name}/{exib}: questão {num} duplicada")
            p["q"][num] = None if let in ("**", "ANULADA") else let
    # validação: 10 provas x 15 questões consecutivas
    if set(provas) != set(ORDEM):
        raise ValueError(f"{path.name}: provas {sorted(provas)} != esperado")
    for chave, p in provas.items():
        ns = sorted(p["q"])
        if len(ns) != 15 or ns != list(range(ns[0], ns[0] + 15)):
            raise ValueError(f"{path.name}/{p['nome']}: numeração {ns}")
    return {c: provas[c] for c in ORDEM}


def main():
    dados = {}
    for f in sorted(SRC.glob("ufrgs-*-gabaritos.html")):
        ano = re.search(r"(\d{4})", f.name).group(1)
        antigo = ano <= "2020"
        dados[ano] = parse_ano_antigo(f) if antigo else parse_ano(f)
        for chave, p in dados[ano].items():
            p["pdf"] = pdf_da_prova_antiga(ano, chave) if antigo else pdf_da_prova(ano, chave)
        anuladas = sum(1 for p in dados[ano].values() for v in p["q"].values() if v is None)
        print(f"  {ano}: {sum(len(p['q']) for p in dados[ano].values())} respostas"
              + (f" ({anuladas} anulada{'s' * (anuladas > 1)})" if anuladas else ""))
    js = ("/* GERADO por pipeline/gerar_gabaritos.py — NÃO EDITAR À MÃO.\n"
          "   Fonte: pesquisa/provas-antigas/ufrgs/gabaritos/*.html\n"
          "   Questão anulada = null (conta como acerto na correção). */\n"
          "const GABARITOS_UFRGS = "
          + json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
          + ";\nif (typeof module !== \"undefined\") module.exports = { GABARITOS_UFRGS };\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"OK -> {OUT.relative_to(BASE)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    try:
        main()
    except ValueError as e:
        sys.exit(f"ERRO: {e}")
