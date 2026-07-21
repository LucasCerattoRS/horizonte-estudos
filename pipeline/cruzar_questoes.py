#!/usr/bin/env python3
"""Cruza as questões extraídas com os gabaritos oficiais e compila o banco do painel.

Lê pesquisa/analise/questoes/*.json + painel/gabaritos-data.js (+ ENEM quando
houver questões), anexa a resposta oficial a cada questão e gera
painel/banco-questoes-data.js (const BANCO_QUESTOES) para o frontend corrigir
simulados automaticamente.

Decisões:
  • A disciplina do gabarito vem da FAIXA NUMÉRICA do caderno, não do rótulo do
    extrator (imune a classificações erradas tipo "artes" no meio de his/lit).
    Era antiga UFRGS: dia1 fis 1-25, lit 26-50, LEM 51-75; dia2 port 1-25;
    dia3 bio 1-25, qui 26-50, geo 51-75; dia4 his 1-25, mat 26-50.
  • Dedup: fis/lit se repetem entre os cadernos de inglês e espanhol do mesmo
    ano — a chave id (exame_ano_disc_num) fica com a 1ª ocorrência; a repetida
    é comparada (início do enunciado) e descartada.
  • Anulada = gabarito null (mesma convenção do painel: conta como acerto).
  • Chaves extras da questão (ex. futuro id_topico do classificador) são
    preservadas — rode este script de novo após classificar.

Uso:  python3 pipeline/cruzar_questoes.py
Sai com código 1 se houver ERROs (questão sem gabarito / fora da faixa).
"""

import json
import re
import sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

BASE = Path(__file__).resolve().parent.parent
DIR_Q = BASE / "pesquisa" / "analise" / "questoes"
OUT = BASE / "painel" / "banco-questoes-data.js"
SIDECAR = BASE / "pesquisa" / "analise" / "classificacao.json"   # gerado por classificar_questoes.py


def carregar_const(path, nome):
    """Extrai o objeto JSON de um `const NOME = {...};` gerado pelo pipeline."""
    if not path.exists():
        return {}
    m = re.search(rf"const {nome} = (\{{.*?\}});", path.read_text(encoding="utf-8"), re.DOTALL)
    if not m:
        sys.exit(f"ERRO: não achei `const {nome}` em {path.name}")
    return json.loads(m.group(1))


# Rótulos que o extrator devolve → códigos do gabarito. O Gemini às vezes inventa
# rótulos ("artes", "sociologia"); esses são ignorados aqui e resolvidos pela faixa.
COD_DISC = {
    "portugues": "port", "literatura": "lit", "historia": "his", "matematica": "mat",
    "geografia": "geo", "biologia": "bio", "quimica": "qui", "fisica": "fis",
    "ingles": "ing", "espanhol": "esp",
}


def faixas_ufrgs(questoes, gab_ano):
    """[(ini, fim, disc)] do caderno, lido do PRÓPRIO gabarito daquele ano.

    A UFRGS mudou o caderno em 2022: blocos de 25 questões viraram blocos de 15
    (10 disciplinas × 15 = 150). Em vez de codificar cada era, derivamos as faixas dos
    intervalos que o gabarito já registra, restritos às disciplinas presentes no caderno
    (sem isso, `lit` e `fis` colidiriam — ambas ocupam 16-30 em dias diferentes).
    """
    presentes = {COD_DISC[d] for q in questoes
                 if (d := q.get("disciplina")) in COD_DISC}
    faixas = []
    for disc in presentes:
        nums = [int(n) for n in gab_ano.get(disc, {}).get("q", {})]
        if nums:
            faixas.append((min(nums), max(nums), disc))
    return sorted(faixas)


def disc_enem(num, disciplina, ano):
    """Área/chave do gabarito ENEM pela numeração do caderno azul (por era)."""
    if ano == "2016":   # pré-reforma: D1 = CH+CN, D2 = LC (LE em 91-95) + MT
        faixas = ((1, 45, "CH"), (46, 90, "CN"), (91, 135, "LC"), (136, 180, "MT"))
        le = (91, 95)
    else:
        faixas = ((1, 45, "LC"), (46, 90, "CH"), (91, 135, "CN"), (136, 180, "MT"))
        le = (1, 5)
    if le[0] <= num <= le[1]:
        return "LC", ("ing" if disciplina == "ingles" else "esp")
    for ini, fim, area in faixas:
        if ini <= num <= fim:
            return area, None
    return None, None


def main():
    gab_ufrgs = carregar_const(BASE / "painel" / "gabaritos-data.js", "GABARITOS_UFRGS")
    gab_enem = carregar_const(BASE / "painel" / "gabaritos-enem-data.js", "GABARITOS_ENEM")
    classif = json.loads(SIDECAR.read_text(encoding="utf-8")) if SIDECAR.exists() else {}

    arquivos = sorted(DIR_Q.glob("*.json"))
    if not arquivos:
        sys.exit(f"ERRO: nenhum JSON em {DIR_Q}")

    banco = {}          # id -> questão
    erros, avisos = [], []
    n_dup = n_red = 0

    for arq in arquivos:
        dados = json.loads(arq.read_text(encoding="utf-8"))
        exame, ano = dados.get("exame"), str(dados.get("ano"))
        qs = dados.get("questoes", [])
        faixas = faixas_ufrgs(qs, gab_ufrgs.get(ano, {})) if exame == "ufrgs" else None

        for q in qs:
            num = q.get("numero")
            if q.get("tipo") == "redacao" or not num:
                n_red += 1
                continue

            if exame == "ufrgs":
                disc = next((d for i, f, d in faixas if i <= num <= f), None)
                if not disc:
                    erros.append(f"{arq.name} q{num}: fora das faixas do caderno")
                    continue
                gab = gab_ufrgs.get(ano, {}).get(disc, {}).get("q", {})
                resp = gab.get(str(num), "?")
            elif exame == "enem":
                area, lem = disc_enem(num, q.get("disciplina"), ano)
                if not area:
                    erros.append(f"{arq.name} q{num}: numeração fora do caderno ENEM")
                    continue
                bloco = gab_enem.get(ano, {}).get(area, {})
                gab = bloco.get(lem, {}) if lem else bloco.get("q", {})
                resp = gab.get(str(num), "?")
                disc = lem or area
            else:
                erros.append(f"{arq.name}: exame desconhecido {exame!r}")
                break

            if resp == "?":
                erros.append(f"{arq.name} q{num} ({disc}): sem gabarito p/ {exame} {ano}")
                continue

            uid = f"{exame}_{ano}_{disc}_{num}"
            if uid in banco:                      # fis/lit repetidas no outro caderno LEM
                n_dup += 1
                a = (banco[uid].get("enunciado") or "")[:50]
                b = (q.get("enunciado") or "")[:50]
                if a != b:
                    avisos.append(f"{uid}: duplicata com enunciado divergente ({arq.name})")
                continue

            item = dict(q)                        # preserva chaves extras
            if item.get("disciplina") not in (None, disc):
                item["disciplina_bruta"] = item["disciplina"]
            item.update(id=uid, exame=exame.upper(), ano=ano, disciplina=disc, gabarito=resp)
            if uid in classif:
                item["id_topico"] = classif[uid]
            banco[uid] = item

    # validação de cobertura: todo nº do gabarito tem questão extraída?
    anos_extraidos = {q["ano"] for q in banco.values() if q["exame"] == "UFRGS"}
    for ano in sorted(anos_extraidos):
        for disc, p in gab_ufrgs.get(ano, {}).items():
            faltam = [n for n in p["q"] if f"ufrgs_{ano}_{disc}_{n}" not in banco]
            if faltam:
                avisos.append(f"{ano}/{disc}: {len(faltam)} questão(ões) do gabarito sem extração: {faltam}")

    lista = sorted(banco.values(), key=lambda q: (q["exame"], q["ano"], q["disciplina"], q["numero"]))
    js = ("/* GERADO por pipeline/cruzar_questoes.py — NÃO EDITAR À MÃO.\n"
          "   Questões extraídas (pesquisa/analise/questoes/) cruzadas com o gabarito\n"
          "   oficial. gabarito null = questão anulada (conta como acerto). */\n"
          "const BANCO_QUESTOES = "
          + json.dumps(lista, ensure_ascii=False, separators=(",", ":"))
          + ";\nif (typeof module !== \"undefined\") module.exports = { BANCO_QUESTOES };\n")
    OUT.write_text(js, encoding="utf-8")

    por_ano = {}
    for q in lista:
        por_ano[(q["exame"], q["ano"])] = por_ano.get((q["exame"], q["ano"]), 0) + 1
    for (ex, ano), n in sorted(por_ano.items()):
        print(f"  {ex} {ano}: {n} questões")
    anuladas = sum(1 for q in lista if q["gabarito"] is None)
    print(f"Banco: {len(lista)} questões únicas | dup. LEM removidas: {n_dup} | "
          f"redações ignoradas: {n_red} | anuladas: {anuladas}")
    for a in avisos:
        print(f"AVISO: {a}")
    for e in erros:
        print(f"ERRO: {e}")
    print(f"OK -> {OUT.relative_to(BASE)} ({OUT.stat().st_size / 1024:.0f} KB)")
    if erros:
        sys.exit(1)


if __name__ == "__main__":
    main()
