#!/usr/bin/env python3
"""Gera painel/frequencia-data.js — incidência real por tópico do edital.

Lê painel/banco-questoes-data.js (questões com id_topico injetado pelo
cruzar_questoes.py a partir de pesquisa/analise/classificacao.json) e resolve
cada id ("disc.eixo.topico") para o NOME do tópico no edital-data.js — a chave
que o painel usa é (discId, nomeDoTópico), igual ao resto do app.js.

Saída: const FREQUENCIA = { fonte, geradoEm, anos, classificadas, total,
  porDisc: { his: { total, topicos: { "Nome do tópico": {n, tid} } }, ... } }

Uso: python3 pipeline/gerar_frequencia.py   (idempotente; roda após classificar+cruzar)
"""

import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

BASE = Path(__file__).resolve().parent.parent
BANCO = BASE / "painel" / "banco-questoes-data.js"
OUT = BASE / "painel" / "frequencia-data.js"


def nomes_topicos():
    """{tid: (disc, nomeTopico)} a partir do edital-data.js real."""
    res = subprocess.run(
        ["node", "-e",
         "const {DISCIPLINAS}=require('./painel/edital-data.js');"
         "console.log(JSON.stringify(DISCIPLINAS))"],
        capture_output=True, text=True, cwd=str(BASE), encoding="utf-8")
    if res.returncode != 0:
        sys.exit(f"ERRO ao ler edital-data.js: {res.stderr}")
    mapa = {}
    for d in json.loads(res.stdout):
        for ei, eixo in enumerate(d["eixos"]):
            for ti, tp in enumerate(eixo["topicos"]):
                mapa[f"{d['id']}.{ei}.{ti}"] = (d["id"], tp["nome"])
    return mapa


def main():
    m = re.search(r"const BANCO_QUESTOES = (\[.*?\]);", BANCO.read_text(encoding="utf-8"), re.DOTALL)
    if not m:
        sys.exit("ERRO: rode pipeline/cruzar_questoes.py antes.")
    banco = json.loads(m.group(1))
    mapa = nomes_topicos()

    # Cada concurso tem a SUA incidência: somar UFRGS+ENEM num número só esconde
    # exatamente a diferença que interessa (o ENEM 2026 vem antes do vestibular).
    # "TODOS" fica como visão agregada, mas nunca é o padrão da aba.
    exames = {}
    invalidos = 0
    for q in banco:
        tid = q.get("id_topico")
        if not tid:
            continue
        if tid not in mapa:
            invalidos += 1
            continue
        disc, nome = mapa[tid]
        for chave in (q["exame"], "TODOS"):
            e = exames.setdefault(chave, {"classificadas": 0, "total": 0, "anos": set(),
                                          "porDisc": {}})
            e["classificadas"] += 1
            d = e["porDisc"].setdefault(disc, {"total": 0, "topicos": {}})
            d["total"] += 1
            t = d["topicos"].setdefault(nome, {"n": 0, "tid": tid})
            t["n"] += 1

    for q in banco:
        for chave in (q["exame"], "TODOS"):
            if chave in exames:
                exames[chave]["total"] += 1
                exames[chave]["anos"].add(q["ano"])
    for e in exames.values():
        e["anos"] = sorted(e["anos"])

    classificadas = exames.get("TODOS", {}).get("classificadas", 0)
    dados = {
        "fonte": "banco de questões oficiais (gabarito cruzado), classificado por tópico do edital",
        "geradoEm": datetime.date.today().isoformat(),
        "anos": sorted({q["ano"] for q in banco}),
        "total": len(banco),
        "classificadas": classificadas,
        "porExame": exames,
        # compat: visão agregada, usada se o painel antigo não conhecer `porExame`
        "porDisc": exames.get("TODOS", {}).get("porDisc", {}),
    }
    js = ("/* GERADO por pipeline/gerar_frequencia.py — NÃO EDITAR À MÃO.\n"
          "   Incidência real por tópico do edital, derivada do banco de questões.\n"
          "   Fluxo: classificar_questoes.py -> cruzar_questoes.py -> este script. */\n"
          "const FREQUENCIA = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
          + ";\nif (typeof module !== \"undefined\") module.exports = { FREQUENCIA };\n")
    OUT.write_text(js, encoding="utf-8")
    for k in sorted(exames):
        e = exames[k]
        print(f"  {k:6s} {e['classificadas']:5d} classificadas · {len(e['porDisc'])} disciplinas "
              f"· anos {e['anos'][0]}–{e['anos'][-1]}")
    print(f"{classificadas}/{len(banco)} questões classificadas"
          + (f" | AVISO: {invalidos} id_topico inválidos (reclassificar)" if invalidos else ""))
    print(f"OK -> {OUT.relative_to(BASE)}")


if __name__ == "__main__":
    main()
