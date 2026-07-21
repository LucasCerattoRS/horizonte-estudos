#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
importar_redacoes.py — corpus de redações corrigidas (humanas) → painel.

Lê os dumps copy-paste do staging (gitignorado):
  pesquisa/redacoes-usuario/_raw/aprovatotal-corrigidas.txt  (35 colagens, AT)
  pesquisa/redacoes-usuario/_raw/glau-corrigidas.txt         (40 colagens, Glau)

Gera (ambos gitignorados — redações pessoais NÃO vão pro Git):
  pesquisa/redacoes-usuario/corpus.json   — corpus estruturado (a validação IA usa)
  painel/redacoes-corpus.js               — const REDACOES_CORPUS=[...] no formato
                                            de S.redacoes; o app mescla por id.

Escalas (a Análise do painel usa a escala da rubrica de cada banca):
  AT:   ENEM 0–1000 (nativo) · FUVEST 0–50 → /5 · UNESP 0–28 → obs · Gêneros zerada.
  Glau: a rubrica escolhida por correção é inferida da magnitude da nota e dos
        blocos "Sua nota nessa competência: X de N pontos" presentes no dump:
        /100 c/ critérios A(30) B(30) C(40) = rubrica estilo UFRGS/COPERSE → ufrgs
        /1000 (múltiplos de 20)             = ENEM                        → enem
        /50  (cluster 36–49)                = FUVEST                      → fuvest
        /20  (notas com vírgula 17,5–19,0)  = rubrica não identificada    → glau

Uso:  python3 pipeline/importar_redacoes.py [--diag]
"""
import hashlib, json, re, sys, unicodedata
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW  = BASE / "pesquisa/redacoes-usuario/_raw"
OUT_JSON = BASE / "pesquisa/redacoes-usuario/corpus.json"
OUT_JS   = BASE / "painel/redacoes-corpus.js"
DIAG = "--diag" in sys.argv
DATA_IMPORT = "2026-07-12"   # Glau: o dump não traz datas — ordem preservada pelo id

BANCAS_AT = "ENEM|FUVEST|UNESP|UNICAMP|UFPR|GÊNEROS TEXTUAIS|UFRGS"
# anotações inline expandidas na colagem (thumb_up/…): fim do corpo
AT_FIM_CORPO = re.compile(r"\n(?:Competência \d|thumb_up\b|thumb_down\b|Total \d)")

def sha(s): return hashlib.sha1(s.encode("utf-8")).hexdigest()[:6]
def iso(d): dd, mm, yy = d.split("/"); return f"{yy}-{mm}-{dd}"
def num(s): return float(s.replace(",", "."))

def clean(t):
    t = unicodedata.normalize("NFC", t)
    return re.sub(r"[ \t]+\n", "\n", t.replace("\r\n", "\n")).strip()

# ---------------------------------------------------------------- Aprova Total
def parse_aprovatotal(txt):
    """Delimitador: 'BANCA: tema' com 'Corrigida em' logo abaixo."""
    delim = re.compile(
        rf"({BANCAS_AT}): ?([^\n]*)\n+(?=Corrigida em \d{{2}}/\d{{2}}/\d{{4}})")
    marks = list(delim.finditer(txt))
    regs = []
    for i, m in enumerate(marks):
        fim = marks[i + 1].start() if i + 1 < len(marks) else len(txt)
        r = parse_at_bloco(m.group(1), m.group(2).strip(), txt[m.end():fim])
        if r: regs.append(r)
    return dedup_at(regs)

def parse_at_bloco(banca, tema, bloco):
    m = re.match(
        r"Corrigida em (\d{2}/\d{2}/\d{4})\nNota final\n([\d.,]+)\n+"
        r"Comentário final\n+(.*?)(?:\nTítulo\n([^\n]*)\n)?"
        r"((?:\n|.)*?)\nRedação\n(?:Clique nas marcações[^\n]*\n)?(.*)",
        bloco, re.S)
    if not m:
        print(f"  !! AT: bloco não parseou ({banca}: {tema[:40]})"); return None
    data, nota, com_final, titulo, meio, corpo = m.groups()
    corte = AT_FIM_CORPO.search(corpo)
    if corte: corpo = corpo[:corte.start()]
    # comentários por competência: blocos "Comentário\n<texto>" (podem ser vazios)
    coments = [c.strip() for c in
               re.split(r"\nComentário\n", "\n" + (meio or ""))[1:]]
    return dict(origem="aprovatotal", banca=banca, tema=tema, data=iso(data),
                nota=num(nota), titulo=(titulo or "").strip(),
                comentario_final=com_final.strip(), comentarios=coments,
                texto=clean(corpo))

def dedup_at(regs):
    """Colagens repetidas: mesma data+banca+nota+tema → fica a cópia mais limpa."""
    grupos = {}
    for r in regs:
        grupos.setdefault((r["data"], r["banca"], r["nota"], r["tema"]), []).append(r)
    out = []
    for g in grupos.values():
        g.sort(key=lambda r: ("thumb_" in r["texto"], len(r["texto"])))
        out.append(g[0])
    out.sort(key=lambda r: r["data"], reverse=True)
    return out

# ------------------------------------------------------------------------ Glau
EMOJI_SEC = re.compile(r"^[\U0001F300-\U0001FAFF☀-➿]️? ?[A-ZÁÉÍÓÚÂÊÔÃÕÇ]")
SEC_STATS = re.compile(r"pontuação|token|palavra|frase|estatística", re.I)

def glau_escala(nota_raw, tem_abc):
    n = num(nota_raw)
    if tem_abc or ("," not in nota_raw and 50 < n <= 100): return 100
    if n > 100: return 1000
    if "," in nota_raw: return 20
    return 50

def parse_glau(txt):
    lines = txt.split("\n")
    anchors = [i for i, l in enumerate(lines) if l.strip() == "nota final"
               and re.fullmatch(r"\d{1,4}([.,]\d)?", lines[i - 1].strip())]
    regs, prev_end = [], 0
    for k, a in enumerate(anchors):
        nxt = anchors[k + 1] - 1 if k + 1 < len(anchors) else len(lines)
        depois = [l.strip() for l in lines[a + 1:nxt]]
        antes  = [l.strip() for l in lines[prev_end:a - 1]]
        seg = "\n".join(depois)

        # critérios A/B/C (só alguns registros têm): "Sua nota nessa competência: X de N pontos"
        abc = [(num(x), int(t)) for x, t in
               re.findall(r"Sua nota nessa competência: ([\d,\.]+) de (\d+) pontos", seg)]

        # corpo = linhas longas antes da nota que reaparecem depois (corpo anotado é
        # repetido na página); fallback: run de linhas longas imediatamente acima.
        dep_set = {l for l in depois if len(l) > 120}
        corpo = _corpo(antes, dep_set) or _corpo(antes, None)

        praise = next((l for l in depois[:4] if l and len(l) < 60
                       and re.search(r"Mandou|Parabéns|🎉|🥳", l)), "")
        desvios = _desvios(depois)
        secoes = _secoes(depois, set(corpo))

        nota_raw = lines[a - 1].strip()
        regs.append(dict(origem="glau", nota=num(nota_raw),
                         escala=glau_escala(nota_raw, bool(abc)),
                         abc=abc, praise=praise, desvios=desvios, secoes=secoes,
                         texto="\n".join(corpo)))
        prev_end = a + 1
    return dedup_glau(regs)

def _corpo(antes, dep_set):
    corpo, j = [], len(antes) - 1
    while j >= 0:
        l = antes[j]
        if not l: j -= 1; continue
        if len(l) > 120 and (dep_set is None or l in dep_set):
            corpo.insert(0, l); j -= 1
        else:
            break
    return corpo

def _desvios(depois):
    out, dentro = [], False
    for l in depois:
        if re.fullmatch(r"\d+ desvios?", l): dentro = True; continue
        if not dentro or not l: continue
        if l == "Logomarca da Glau" or EMOJI_SEC.match(l) or len(l) > 120: break
        out.append(l)
    return out

def _secoes(depois, corpo_set):
    # feedback real da Glau = 1–2 parágrafos por seção; o que vem depois disso
    # na página é coletânea da proposta / repetição — não entra.
    secoes, cur = [], None
    for l in depois:
        if EMOJI_SEC.match(l):
            cur = [l, []]; secoes.append(cur); continue
        if cur is not None and l and len(l) > 40 and l not in corpo_set \
           and l != "Logomarca da Glau" and len(cur[1]) < 2:
            cur[1].append(l)
    out, vistos = [], set()
    for t, ps in secoes:
        if not ps or SEC_STATS.search(t) or len(" ".join(ps)) < 80: continue
        if t in vistos: continue
        vistos.add(t)
        out.append((t, " ".join(ps)[:700]))
    return out[:8]

def dedup_glau(regs):
    """Mesma redação colada mais de uma vez: fica a cópia com mais conteúdo."""
    grupos = {}
    for i, r in enumerate(regs):
        r["_seq"] = i + 1
        grupos.setdefault((sha(r["texto"]), r["nota"]), []).append(r)
    out = []
    for g in grupos.values():
        g.sort(key=lambda r: (len(r["secoes"]), len(r["abc"]), len(r["desvios"])),
               reverse=True)
        out.append(g[0])
    out.sort(key=lambda r: r["_seq"])
    return out

# --------------------------------------------------------- painel (S.redacoes)
GLAU_ABC = [("adeq", "Tema (critério A)", 30),
            ("arg",  "Estrutura — gênero e coerência (critério B)", 30),
            ("lang", "Expressão — coesão e modalidade (critério C)", 40)]

def rec_glau(r):
    e, n = r["escala"], r["nota"]
    coment = f"Correção humana Glau — {n:g}/{e}."
    if r["praise"]: coment += f" {r['praise']}"
    if r["desvios"]:
        coment += (f" Desvios apontados ({len(r['desvios'])}): "
                   + "; ".join(dict.fromkeys(r["desvios"])) + ".")
    coment += "".join(f"\n\n{t}: {b}" for t, b in r["secoes"])
    tema = " ".join(r["texto"].split()[:10]) + "…"
    base = dict(id=f"glau-{r['_seq']:02d}-{sha(r['texto'])}", date=DATA_IMPORT,
                tema=tema, texto=r["texto"], comentarioIA=coment, fonte="humana")
    if e == 1000:  # rubrica ENEM da Glau
        return dict(banca="enem", tipo="enem", nota=int(n), max=1000,
                    obs="import Glau (rubrica ENEM; dump sem data)", **base)
    if e == 100:   # rubrica A/B/C 30/30/40 — estilo UFRGS/COPERSE
        crits = [dict(id=cid, nota=round(x / t * 10, 1),
                      comentario=f"Glau: {x:g}/{t} pontos no {nome}.")
                 for (cid, nome, t), (x, _) in zip(GLAU_ABC, r["abc"])] or None
        return dict(banca="ufrgs", tipo="ufrgs", nota=round(n / 10, 1), max=10,
                    criterios=crits,
                    obs=f"import Glau (critérios A/B/C, nota original {n:g}/100; sem data)",
                    **base)
    if e == 50:    # rubrica FUVEST da Glau
        return dict(banca="fuvest", tipo="fuvest", nota=round(n / 5, 1), max=10,
                    obs=f"import Glau (rubrica FUVEST, nota original {n:g}/50; sem data)",
                    **base)
    # escala /20 — rubrica não identificada; balde neutro Glau
    return dict(banca="glau", tipo="glau", nota=round(n / 2, 1), max=10,
                obs=f"import Glau (nota original {n:g}/20, rubrica não identificada; sem data)",
                **base)

def rec_at(r):
    base = dict(id=f"at-{r['data']}-{sha(r['texto'])}", date=r["data"],
                tema=r["tema"], texto=r["texto"], fonte="humana",
                comentarioIA=r["comentario_final"])
    b, nota = r["banca"], r["nota"]
    if b == "ENEM":
        crits = [dict(id=f"c{i+1}", nota="—", comentario=c)
                 for i, c in enumerate(r["comentarios"][:5]) if c]
        return dict(banca="enem", tipo="enem", nota=int(nota), max=1000,
                    criterios=crits or None,
                    obs="correção humana Aprova Total (sem nota por competência no export)",
                    **base)
    if b == "FUVEST":
        return dict(banca="fuvest", tipo="fuvest", nota=round(nota / 5, 1), max=10,
                    obs=f"correção humana Aprova Total — nota original {nota:g}/50", **base)
    if b == "UNESP":
        return dict(tipo="unesp", nota=round(nota / 28 * 10, 1), max=10,
                    obs=f"correção humana Aprova Total (UNESP) — nota original {nota:g}/28",
                    **base)
    tipo = {"GÊNEROS TEXTUAIS": "generos"}.get(b, b.lower())
    return dict(tipo=tipo, nota=round(nota, 1), max=10,
                obs=f"correção humana Aprova Total ({b}) — nota original {nota:g}", **base)

def main():
    at = parse_aprovatotal(clean((RAW / "aprovatotal-corrigidas.txt").read_text(encoding="utf-8")))
    gl = parse_glau((RAW / "glau-corrigidas.txt").read_text(encoding="utf-8"))

    print(f"AT: {len(at)} únicas | bancas:", dict(Counter(r["banca"] for r in at)))
    print(f"Glau: {len(gl)} únicas | escalas:", dict(Counter(r["escala"] for r in gl)))

    if DIAG:
        for r in at:
            avisa = "" if 800 < len(r["texto"]) < 7000 else "  << CORPO SUSPEITO"
            print(f"  AT {r['data']} {r['banca']:8} nota {r['nota']:>6g} "
                  f"corpo {len(r['texto']):>5}c coment {sum(1 for c in r['comentarios'] if c)}"
                  f"{avisa} | {r['tema'][:45]}")
        for r in gl:
            avisa = "" if 800 < len(r["texto"]) < 7000 else "  << CORPO SUSPEITO"
            print(f"  GL {r['_seq']:02d} nota {r['nota']:>5g}/{r['escala']:<4} "
                  f"corpo {len(r['texto']):>5}c desv {len(r['desvios']):>2} "
                  f"sec {len(r['secoes'])} abc {len(r['abc'])}{avisa} | {r['texto'][:42]}")

    OUT_JSON.write_text(json.dumps(at + gl, ensure_ascii=False, indent=1), encoding="utf-8")

    recs = [rec_at(r) for r in at] + [rec_glau(r) for r in gl]
    recs = [{k: v for k, v in r.items() if v is not None} for r in recs]
    js = ("/* GERADO por pipeline/importar_redacoes.py — NÃO EDITAR NEM COMMITAR\n"
          "   (redações pessoais; gitignorado). O app mescla por id no boot. */\n"
          "const REDACOES_CORPUS = " + json.dumps(recs, ensure_ascii=False, indent=1) + ";\n")
    OUT_JS.write_text(js, encoding="utf-8")
    print(f"→ {OUT_JSON.relative_to(BASE)} ({len(at) + len(gl)} registros)")
    print(f"→ {OUT_JS.relative_to(BASE)} ({len(recs)} registros pro painel)")

if __name__ == "__main__":
    main()
