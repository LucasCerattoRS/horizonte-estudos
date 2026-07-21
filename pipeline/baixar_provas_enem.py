#!/usr/bin/env python3
"""Baixa as PROVAS (PV) do ENEM 2016–2021 do INEP, completando o acervo local.

Os gabaritos (GB) desses anos já foram baixados em 2026-07-08; faltam os cadernos
de prova, sem os quais não dá para extrair as questões.

TLS: o servidor do INEP não envia o certificado intermediário (RNP ICPEdu, emitido
pela raiz GlobalSign R46). Em vez de desligar a verificação, buscamos o intermediário
pela extensão AIA do certificado do servidor e o anexamos ao bundle do sistema.

Uso:
    python3 pipeline/baixar_provas_enem.py            # baixa o que falta
    python3 pipeline/baixar_provas_enem.py --listar   # só mostra o que existe/falta
"""

import argparse
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DESTINO = BASE / "pesquisa" / "provas-antigas" / "enem"
HOST = "download.inep.gov.br"
UA = "Mozilla/5.0 (X11; Linux x86_64) horizonte-estudos/1.0"

# Candidatos por ano e dia. A nomenclatura do INEP muda de era em era; tentamos em
# ordem e ficamos com o primeiro que responder 200. Caderno azul: D1=CD1, D2=CD7.
RAIZ = f"https://{HOST}"
CANDIDATOS = {
    "2021": {
        1: [f"{RAIZ}/enem/provas_e_gabaritos/2021_PV_impresso_D1_CD1.pdf"],
        2: [f"{RAIZ}/enem/provas_e_gabaritos/2021_PV_impresso_D2_CD7.pdf"],
    },
    "2020": {
        1: [f"{RAIZ}/enem/provas_e_gabaritos/2020_PV_impresso_D1_CD1.pdf"],
        2: [f"{RAIZ}/enem/provas_e_gabaritos/2020_PV_impresso_D2_CD7.pdf"],
    },
    "2019": {
        1: [f"{RAIZ}/educacao_basica/enem/provas/2019/2019_PV_impresso_D1_CD1.pdf"],
        2: [f"{RAIZ}/educacao_basica/enem/provas/2019/2019_PV_impresso_D2_CD7.pdf"],
    },
    "2018": {
        1: [
            f"{RAIZ}/educacao_basica/enem/provas/2018/2018_PV_impresso_D1_CD1.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2018/cad_1_prova_azul_5112018.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2018/ENEM_2018_DIA_1_CADERNO_1_AZUL.pdf",
        ],
        2: [
            f"{RAIZ}/educacao_basica/enem/provas/2018/2018_PV_impresso_D2_CD7.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2018/cad_7_prova_azul_11112018.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2018/ENEM_2018_DIA_2_CADERNO_7_AZUL.pdf",
        ],
    },
    "2017": {
        1: [f"{RAIZ}/educacao_basica/enem/provas/2017/cad_1_prova_azul_5112017.pdf"],
        2: [
            f"{RAIZ}/educacao_basica/enem/provas/2017/cad_7_prova_azul_12112017.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2017/cad_5_prova_azul_12112017.pdf",
        ],
    },
    "2016": {
        1: [
            f"{RAIZ}/educacao_basica/enem/provas/2016/CAD_ENEM_2016_DIA_1_01_AZUL.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2016/PROVA_ENEM_2016_DIA_1_01_AZUL.pdf",
        ],
        2: [
            f"{RAIZ}/educacao_basica/enem/provas/2016/CAD_ENEM_2016_DIA_2_07_AZUL.pdf",
            f"{RAIZ}/educacao_basica/enem/provas/2016/PROVA_ENEM_2016_DIA_2_07_AZUL.pdf",
        ],
    },
}


def contexto_tls() -> ssl.SSLContext:
    """Bundle do sistema + intermediário do INEP obtido pela extensão AIA."""
    ctx = ssl.create_default_context()
    ctx.load_default_certs()
    der = subprocess.run(
        ["openssl", "s_client", "-connect", f"{HOST}:443", "-servername", HOST],
        input=b"", capture_output=True, timeout=30,
    ).stdout.decode("utf-8", "replace")
    texto = subprocess.run(
        ["openssl", "x509", "-noout", "-text"], input=der.encode(),
        capture_output=True, timeout=30,
    ).stdout.decode("utf-8", "replace")
    m = re.search(r"CA Issuers - URI:(\S+)", texto)
    if not m:
        sys.exit("Não achei a URI do certificado intermediário (extensão AIA).")
    with urllib.request.urlopen(m.group(1), timeout=30) as r:
        inter_der = r.read()
    pem = subprocess.run(
        ["openssl", "x509", "-inform", "DER"], input=inter_der,
        capture_output=True, timeout=30,
    ).stdout
    with tempfile.NamedTemporaryFile("wb", suffix=".pem", delete=False) as f:
        f.write(pem)
        caminho = f.name
    ctx.load_verify_locations(cafile=caminho)  # verificação ATIVA, só completa a cadeia
    return ctx


def nome_local(ano: str, dia: int) -> Path:
    cd = "CD1" if dia == 1 else "CD7"
    return DESTINO / f"{ano}_PV_impresso_D{dia}_{cd}.pdf"


def baixar(url: str, destino: Path, ctx: ssl.SSLContext) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=ctx, timeout=180) as r:
        if r.status != 200:
            return 0
        dados = r.read()
    if not dados.startswith(b"%PDF"):
        return 0
    destino.write_bytes(dados)
    return len(dados)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--listar", action="store_true", help="só relatar, não baixar")
    args = ap.parse_args()

    faltando = [
        (ano, dia)
        for ano in sorted(CANDIDATOS)
        for dia in (1, 2)
        if not nome_local(ano, dia).exists()
    ]
    if not faltando:
        print("Todas as provas ENEM 2016–2021 já estão em disco.")
        return
    print(f"Faltam {len(faltando)} cadernos: " + ", ".join(f"{a}/D{d}" for a, d in faltando))
    if args.listar:
        return

    ctx = contexto_tls()
    ok = falhas = 0
    for ano, dia in faltando:
        destino = nome_local(ano, dia)
        for url in CANDIDATOS[ano][dia]:
            try:
                n = baixar(url, destino, ctx)
            except Exception as e:  # noqa: BLE001 — queremos tentar o próximo candidato
                print(f"  {ano}/D{dia}: {url.split('/')[-1]} -> {type(e).__name__}")
                continue
            if n:
                print(f"✓ {ano}/D{dia}: {destino.name} ({n // 1024} KB)")
                ok += 1
                break
        else:
            print(f"✗ {ano}/D{dia}: nenhum candidato serviu — descobrir a URL na página do INEP")
            falhas += 1
    print(f"\n{ok} baixados, {falhas} pendentes de descoberta de URL.")


if __name__ == "__main__":
    main()
