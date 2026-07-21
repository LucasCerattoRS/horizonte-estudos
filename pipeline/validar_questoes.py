#!/usr/bin/env python3
"""Valida a estrutura do banco de questões extraído (pesquisa/analise/questoes/*.json).

Roda depois de cada lote do extrair_questoes.py. Checa, por arquivo:
  • n_questoes coerente com len(questoes);
  • números únicos e contínuos (denuncia buracos e duplicatas);
  • objetivas com exatamente 5 alternativas A–E (UFRGS) e enunciado não-vazio;
  • disciplina dentro do enum do extrator; assunto presente;
  • redação sem alternativas.
E, por ano, o panorama: total de questões, arquivos, disciplinas.

Uso:
  python3 pipeline/validar_questoes.py            # tudo
  python3 pipeline/validar_questoes.py --ano 2016 # um ano
Sai com código 1 se houver ERROs (avisos não derrubam).
"""

import argparse
import collections
import json
import sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

BASE = Path(__file__).resolve().parent.parent
DIR_Q = BASE / "pesquisa" / "analise" / "questoes"

DISCIPLINAS = {
    "portugues", "literatura", "historia", "geografia", "matematica",
    "fisica", "quimica", "biologia", "ingles", "espanhol", "redacao",
    "filosofia", "sociologia", "artes", "outro",
}
LETRAS = ["A", "B", "C", "D", "E"]


def validar_arquivo(caminho: Path) -> tuple[list[str], list[str], dict]:
    """(erros, avisos, resumo) de um JSON de prova."""
    erros, avisos = [], []
    d = json.loads(caminho.read_text(encoding="utf-8"))
    qs = d.get("questoes", [])

    if d.get("n_questoes") != len(qs):
        erros.append(f"n_questoes={d.get('n_questoes')} ≠ len(questoes)={len(qs)}")
    if not qs:
        erros.append("0 questões")
        return erros, avisos, {"n": 0, "disc": {}}

    numeros = [q.get("numero") for q in qs]
    vistos = collections.Counter(numeros)
    dups = sorted(n for n, c in vistos.items() if c > 1)
    if dups:
        erros.append(f"números duplicados: {dups}")
    ints = sorted(n for n in numeros if isinstance(n, int))
    if ints:
        buracos = sorted(set(range(ints[0], ints[-1] + 1)) - set(ints))
        if buracos:
            # Buraco pode ser legítimo (ex.: questões de outra LEM no mesmo caderno),
            # mas quase sempre é questão perdida na extração → ERRO p/ inspecionar.
            erros.append(f"numeração {ints[0]}–{ints[-1]} com buracos: {buracos}")

    disc = collections.Counter()
    for q in qs:
        n = q.get("numero", "?")
        tipo = q.get("tipo", "objetiva")
        d_ = q.get("disciplina", "?")
        disc[d_] += 1
        if d_ not in DISCIPLINAS:
            erros.append(f"Q{n}: disciplina fora do enum: {d_!r}")
        if not (q.get("assunto") or "").strip():
            avisos.append(f"Q{n}: sem assunto")
        if len((q.get("enunciado") or "").strip()) < 10:
            avisos.append(f"Q{n}: enunciado suspeito (<10 chars)")
        alts = q.get("alternativas") or []
        if tipo == "objetiva":
            letras = [str(a.get("letra", "")).strip().upper().rstrip(")").rstrip(".")
                      for a in alts]
            if len(alts) != 5:
                erros.append(f"Q{n}: {len(alts)} alternativas (esperado 5)")
            elif letras != LETRAS:
                avisos.append(f"Q{n}: letras fora do padrão A–E: {letras}")
            vazias = [a for a in alts if not (a.get("texto") or "").strip()]
            if vazias:
                erros.append(f"Q{n}: alternativa(s) com texto vazio")
        elif tipo == "redacao" and alts:
            avisos.append(f"Q{n}: redação com alternativas ({len(alts)})")
    return erros, avisos, {"n": len(qs), "disc": dict(disc)}


def main() -> None:
    ap = argparse.ArgumentParser(description="Valida o banco de questões extraído.")
    ap.add_argument("--ano", help="filtrar por ano (ex.: 2016)")
    ap.add_argument("--exame", default=None, help="filtrar por exame (ufrgs/enem)")
    ap.add_argument("--verboso", action="store_true", help="listar todos os avisos")
    args = ap.parse_args()

    arquivos = sorted(DIR_Q.glob("*.json"))
    if args.exame:
        arquivos = [a for a in arquivos if a.name.startswith(f"{args.exame}_")]
    if args.ano:
        arquivos = [a for a in arquivos if f"_{args.ano}_" in a.name]
    if not arquivos:
        sys.exit(f"Nenhum JSON em {DIR_Q} com esses filtros.")

    total_err = 0
    por_ano = collections.Counter()
    disc_total = collections.Counter()
    print(f"Validando {len(arquivos)} arquivos em {DIR_Q.relative_to(BASE)}\n")
    for arq in arquivos:
        try:
            erros, avisos, resumo = validar_arquivo(arq)
        except (json.JSONDecodeError, OSError) as e:
            print(f"✖ {arq.name}: ilegível: {e}")
            total_err += 1
            continue
        ano = arq.stem.split("_")[1] if "_" in arq.stem else "?"
        por_ano[ano] += resumo["n"]
        disc_total.update(resumo["disc"])
        status = "✖" if erros else ("⚠" if avisos else "✔")
        print(f"{status} {arq.name}: {resumo['n']} q  {resumo['disc']}")
        for e in erros:
            print(f"    ERRO: {e}")
        mostrar = avisos if args.verboso else avisos[:3]
        for a in mostrar:
            print(f"    aviso: {a}")
        if not args.verboso and len(avisos) > 3:
            print(f"    … +{len(avisos)-3} avisos (use --verboso)")
        total_err += len(erros)

    print("\n=== TOTAIS ===")
    for ano in sorted(por_ano):
        print(f"  {ano}: {por_ano[ano]} questões")
    print(f"  geral: {sum(por_ano.values())} questões")
    print("  disciplinas:", dict(disc_total.most_common()))
    if total_err:
        print(f"\n✖ {total_err} erro(s) estruturais — inspecionar/reextrair (--forcar/--texto).")
        sys.exit(1)
    print("\n✔ Banco estruturalmente OK.")


if __name__ == "__main__":
    main()
