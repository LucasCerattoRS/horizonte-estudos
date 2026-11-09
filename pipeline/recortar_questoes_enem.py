#!/usr/bin/env python3
"""Recorta cada questão do ENEM do caderno azul oficial (INEP) e gera o índice do painel.

O banco (painel/banco-questoes-data.js) traz o texto-base como RESUMO; a prova real só
existe no caderno. Este script põe ao lado de cada questão a imagem dela no PDF oficial:
texto-base, figuras, enunciado e alternativas exatamente como impressos.

Como acha a questão: os cadernos do INEP são PDFs digitais, então os cabeçalhos
"Questão NN" têm coordenadas de texto (pypdfium2). Cada página tem 2 colunas; a questão
vai do seu cabeçalho até o próximo, seguindo coluna -> coluna -> página. Para numa
página de redação/rascunho e num título de seção ("Questões de 01 a 05 (opção espanhol)").
Nas questões 1–5 (91–95 em 2016) o 1º conjunto é inglês e o 2º, espanhol.

Conferência automática: o texto dentro do recorte tem de conter o começo do enunciado e
das alternativas A e E do banco. O que falhar vai para o relatório e não entra no índice.

Saída:
  painel/provas/enem/<ano>/<id>.webp   (cinza; colorido só quando o recorte tem cor)
  painel/provas-img-data.js            (const PROVAS_IMG = {id: "provas/enem/…webp"})

Uso:
  python3 pipeline/baixar_provas_enem.py           # traz os cadernos do INEP
  python3 pipeline/recortar_questoes_enem.py [pasta-dos-pdfs]
Requer: pypdfium2, Pillow (com WebP), numpy. Opcional: rapidocr_onnxruntime (confere os
cadernos cuja fonte não tem mapa de caracteres, como 2016, 2017 e 2021).
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from PIL import Image

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

BASE = Path(__file__).resolve().parent.parent
PDFS = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "pesquisa" / "provas-antigas" / "enem"
BANCO = BASE / "painel" / "banco-questoes-data.js"
SAIDA = BASE / "painel" / "provas" / "enem"
INDICE = BASE / "painel" / "provas-img-data.js"
RELATORIO = BASE / "pipeline" / "recortes-enem-relatorio.txt"

# Nome do caderno azul por ano e dia (o INEP mudou o padrão ao longo dos anos).
CADERNOS = {
    "2016": {1: "CAD_ENEM_2016_DIA_1_01_AZUL.pdf", 2: "CAD_ENEM_2016_DIA_2_07_AZUL.pdf"},
    "2017": {1: "cad_1_prova_azul_5112017.pdf", 2: "cad_7_prova_azul_12112017.pdf"},
}
for _ano in range(2018, 2026):
    CADERNOS[str(_ano)] = {1: f"{_ano}_PV_impresso_D1_CD1.pdf", 2: f"{_ano}_PV_impresso_D2_CD7.pdf"}

try:   # opcional: confere por leitura da imagem quando o texto do PDF é ilegível
    from rapidocr_onnxruntime import RapidOCR
    OCR = RapidOCR()
except ImportError:
    OCR = None

ESCALA = 2.6                # ~190 dpi: coluna com ~700 px de largura
CABECALHO = re.compile(r"quest\s*.\s*o\s*(\d{1,3})(?!\d)", re.I)
SECAO = re.compile(r"quest.es\s+de\s+\d", re.I)
PARADA = re.compile(r"PROPOSTA DE REDA|INSTRU..ES PARA A REDA|RASCUNHO", re.I)
# Cadernos cuja camada de texto não serve nem para POSIÇÃO (caixas dos caracteres
# erradas, palavras coladas): cabeçalhos, topo e rodapé vêm da leitura da imagem.
# 2016 e 2017 também: lá a caixa de um caractere às vezes cai em outra coluna.
LAYOUT_POR_OCR = {"2016", "2017", "2021"}
MEIO = (.497, .503)          # vão entre as colunas (fração da largura)
VAO = (.493, .501)           # faixa sempre branca entre as colunas (2016–2025): tinta nela = coluna única
MARGEM_X = (.035, .965)
FAIXA_X = {"L": (MARGEM_X[0], MEIO[0]), "R": (MEIO[1], MARGEM_X[1]), "F": MARGEM_X}


def carregar_banco():
    m = re.search(r"const BANCO_QUESTOES = (\[.*\]);", BANCO.read_text(encoding="utf-8"), re.S)
    return [q for q in json.loads(m.group(1)) if q["exame"] == "ENEM"]


def achou(s, txt):
    """Algum pedaço de 14 letras de s (início, meio ou fim) está no texto do recorte."""
    s = norm(s)
    if len(s) < 6:
        return s in txt
    k = min(14, len(s))
    return any(s[i:i + k] in txt for i in {0, max(0, len(s) // 2 - k // 2), len(s) - k})


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


class Caderno:
    """Páginas, regiões de leitura e marcos (cabeçalhos e títulos de seção) de um PDF.

    Cada página vira uma lista de regiões na ordem de leitura: faixas de coluna única
    ("F", onde o texto atravessa o meio da página) intercaladas com faixas de duas
    colunas ("L" e depois "R"). Uma questão corre do seu cabeçalho até o marco seguinte,
    região após região."""

    def __init__(self, path, por_ocr=False):
        self.pdf = pdfium.PdfDocument(str(path))
        self.paginas = []
        self.marcos = []   # (página, região, y, número ou None, rótulo da seção)
        self.por_ocr = por_ocr
        for pi in range(len(self.pdf)):
            if por_ocr:
                self._pagina_por_ocr(pi); continue
            pg = self.pdf[pi]; w, h = pg.get_size()
            # As caixas dos caracteres vêm no espaço do MediaBox; a página renderizada é o
            # CropBox, que em 2018, 2024 e 2025 começa 21–35 pt para dentro.
            cx0, _, _, cy1 = pg.get_cropbox()
            X = lambda v: (v - cx0) / w
            Y = lambda v: (cy1 - v) / h
            tp = pg.get_textpage(); texto = tp.get_text_range()
            self._nova_pagina(pg, tp, (cx0, cy1), texto)
            for rx, num in ((CABECALHO, True), (SECAO, False)):
                for m in rx.finditer(texto):
                    if num and texto[m.start():m.start() + 5].lower() != "quest":
                        continue
                    if num and SECAO.match(texto, m.start()):
                        continue
                    # A caixa de UM caractere às vezes vem errada (fonte sem métrica);
                    # a mediana das caixas do cabeçalho inteiro não.
                    caixas = [tp.get_charbox(k) for k in range(m.start(), m.end())]
                    caixas = [cx for cx in caixas if cx[3] > 0 and cx[2] > cx[0]]
                    if not caixas:
                        continue
                    l = float(np.median([cx[0] for cx in caixas]))
                    t = float(np.median([cx[3] for cx in caixas]))
                    rotulo = texto[m.start():m.start() + 60].lower() if not num else ""
                    self._marco(pi, X(l), Y(t) - .002, int(m.group(1)) if num else None, rotulo)
        self._ordenar()

    def _pagina_por_ocr(self, pi):
        pg = self.pdf[pi]
        im = np.asarray(pg.render(scale=1.6).to_pil().convert("RGB"))
        H, W = im.shape[:2]
        linhas = []
        for caixa, txt, _ in (OCR(im)[0] or []):
            xs = [pt[0] / W for pt in caixa]; ys = [pt[1] / H for pt in caixa]
            linhas.append((min(xs), max(xs), min(ys), max(ys), txt))
        self._nova_pagina(pg, None, None, " ".join(l[-1] for l in linhas))
        for x1, _, y1, _, txt in linhas:
            if SECAO.match(txt):
                self._marco(pi, x1, y1 - .004, None, txt.lower())
            else:
                # O OCR lê "QUESTÃO 06" como "QUESTA006" ou "Questao06".
                m = re.match(r"\s*quest\s*[aã]?\s*[o0]\s*(\d{1,3})\s*$", txt, re.I)
                if m:
                    self._marco(pi, x1, y1 - .004, int(m.group(1)), "")

    def _nova_pagina(self, pg, tp, orig, texto):
        w, h = pg.get_size()
        im = np.asarray(pg.render(scale=2).to_pil().convert("L")) < 160
        H, W = im.shape
        # Cabeçalho e rodapé da página (logotipo, código de barras, "Página N") são em boa
        # parte desenho, não texto: o limite vem da tinta acima de 9% e abaixo de 95% — ou,
        # em 2016–2017, do fio de largura de página que separa o rodapé (~.93).
        tinta = np.flatnonzero(im[:, int(.03 * W):int(.97 * W)].any(1)) / H
        fio = np.flatnonzero(im.sum(1) > .75 * W) / H
        cima = tinta[tinta < .09]
        baixo = np.concatenate([tinta[tinta > .95], fio[fio > .88]])
        topo = (cima.max() + .004) if len(cima) else .05
        base = (baixo.min() - .004) if len(baixo) else .965
        # Faixas de coluna única: linhas de pixels com tinta no vão entre as colunas,
        # juntando as vizinhas.
        cruza = np.flatnonzero(im[:, int(VAO[0] * W):int(VAO[1] * W)].sum(1) > 2) / H
        zonas = []
        for y in cruza:
            if not (topo <= y < base):
                continue
            if zonas and y - zonas[-1][1] < .06:   # figura larga tem brancos no vão; não a fatia
                zonas[-1][1] = y
            else:
                zonas.append([y, y])
        zonas = [z for z in zonas if z[1] - z[0] > .008]   # um risco solto não faz coluna única
        regioes, y = [], topo
        for z1, z2 in zonas:
            z1, z2 = max(topo, z1 - .006), min(base, z2 + .006)
            if z1 - y > .015:
                regioes += [("L", y, z1), ("R", y, z1)]
            regioes.append(("F", max(y, z1), z2)); y = z2
        if base - y > .015:
            regioes += [("L", y, base), ("R", y, base)]
        self.paginas.append({"w": w, "h": h, "tp": tp, "orig": orig, "topo": topo, "base": base,
                             "regioes": regioes, "parada": bool(PARADA.search(texto))})

    def _marco(self, pi, x, y, num, rotulo):
        lado = "L" if x < .5 else "R"
        regs = self.paginas[pi]["regioes"]
        # O fio do cabeçalho atravessa a página nas edições de coluna única, então a faixa
        # "F" começa logo abaixo do topo do texto "QUESTÃO NN": uma folga de .02 a alcança.
        k = next((k for k, (c, y1, y2) in enumerate(regs) if c == "F" and y1 - .02 <= y < y2), None)
        if k is None:
            k = next((k for k, (c, y1, y2) in enumerate(regs) if c == lado and y1 - .02 <= y < y2), None)
        if k is None:   # acima do topo: a primeira região daquele lado
            k = next((k for k, r in enumerate(regs) if r[0] in ("F", lado)), 0)
        self.marcos.append((pi, k, y, num, rotulo))

    def _ordenar(self):
        self.marcos.sort(key=lambda k: (k[0], k[1], k[2]))
        nums = [k[3] for k in self.marcos if k[3] is not None]
        self.fora_de_ordem = {b for a, b in zip(nums, nums[1:]) if b < a and not (b == 1 or b == 91)}

    def lingua(self, i):
        """'ing' ou 'esp': o título de seção mais recente antes do marco i."""
        for k in range(i, -1, -1):
            rot = self.marcos[k][4]
            if "ingl" in rot:
                return "ing"
            if "espanh" in rot:
                return "esp"
        return None

    def trechos(self, i):
        """Faixas (página, coluna, y1, y2) da questão do marco i até o marco seguinte."""
        p, k, y = self.marcos[i][:3]
        fim = self.marcos[i + 1] if i + 1 < len(self.marcos) else None
        out = []
        while True:
            regs = self.paginas[p]["regioes"]
            if k < len(regs):
                c, r1, r2 = regs[k]
                y1 = y if not out and y else r1   # 1º trecho: desde o cabeçalho, mesmo um pouco acima da faixa
                if fim and fim[0] == p and fim[1] == k:
                    if fim[2] - y1 > .02:
                        out.append((p, c, y1, fim[2]))
                    break
                if c == "F" and fim and fim[0] == p and y1 < fim[2] < r2:
                    r2 = fim[2]   # faixa de largura inteira: o próximo cabeçalho a encerra
                if r2 - y1 > .02:
                    out.append((p, c, y1, r2))
                k += 1
            if k >= len(regs):
                p, k = p + 1, 0
                if p >= len(self.paginas) or self.paginas[p]["parada"]:
                    break
            if len(out) >= 12:   # duas colunas viram dois trechos por faixa
                break
            y = 0
        return out

    def texto(self, faixas):
        if self.por_ocr:
            return ""
        partes = []
        for p, c, y1, y2 in faixas:
            pag = self.paginas[p]; w, h = pag["w"], pag["h"]; cx0, cy1 = pag["orig"]
            x1, x2 = FAIXA_X[c]
            partes.append(pag["tp"].get_text_bounded(left=cx0 + x1 * w, bottom=cy1 - h * y2,
                                                     right=cx0 + x2 * w, top=cy1 - h * y1))
        return " ".join(partes)

    def imagem(self, faixas):
        blocos = []
        for p, c, y1, y2 in faixas:
            pg = self.pdf[p]; w, h = pg.get_size()
            x1, x2 = FAIXA_X[c]
            y1, y2 = max(0., y1), min(1., y2)
            im = pg.render(scale=ESCALA, crop=(x1 * w, (1 - y2) * h, (1 - x2) * w, y1 * h)).to_pil()
            im = aparar(im.convert("RGB"))
            if im is not None:
                blocos.append(im)
        if not blocos:
            return None
        largura = max(b.width for b in blocos); vao = 18
        out = Image.new("RGB", (largura, sum(b.height for b in blocos) + vao * (len(blocos) - 1)), "white")
        yy = 0
        for b in blocos:
            out.paste(b, (0, yy)); yy += b.height + vao
        return out


def aparar(im, folga=8):
    tinta = np.asarray(im.convert("L")) < 200
    linhas = np.flatnonzero(tinta.sum(1)); cols = np.flatnonzero(tinta.sum(0))
    if not len(linhas):
        return None
    return im.crop((max(0, cols[0] - folga), max(0, linhas[0] - folga),
                    min(im.width, cols[-1] + folga), min(im.height, linhas[-1] + folga)))


def tem_cor(im):
    a = np.asarray(im.resize((im.width // 4, im.height // 4))).astype(int)
    sat = a.max(2) - a.min(2)
    return (sat > 40).mean() > .002


def main():
    banco = carregar_banco()
    por_id = {q["id"]: q for q in banco}
    indice, falhas = {}, []
    for ano, dias in sorted(CADERNOS.items()):
        for dia, nome in dias.items():
            arq = PDFS / nome
            if not arq.exists():
                falhas.append(f"{ano} D{dia}: caderno ausente ({nome})"); continue
            cad = Caderno(arq, por_ocr=ano in LAYOUT_POR_OCR and OCR is not None)
            if cad.fora_de_ordem:
                falhas.append(f"{ano} D{dia}: cabeçalhos fora de ordem {sorted(cad.fora_de_ordem)}")
            for i, (p, c, y, n, _) in enumerate(cad.marcos):
                if n is None or n in cad.fora_de_ordem:
                    continue
                # Em 2016 as línguas estrangeiras abriram o 2º dia (91–95); o 1º dia era CH.
                le = (91 <= n <= 95) if ano == "2016" else n <= 5
                if le:
                    ids = [f"enem_{ano}_{cad.lingua(i)}_{n}"]
                else:
                    ids = [k for k, q in por_id.items() if q["ano"] == ano and q["numero"] == n
                           and q["disciplina"] not in ("ing", "esp")]
                if not ids or ids[0] not in por_id:
                    continue
                qid = ids[0]; q = por_id[qid]
                faixas = cad.trechos(i)
                im = cad.imagem(faixas)
                if im is None:
                    falhas.append(f"{qid}: recorte em branco"); continue
                bruto = cad.texto(faixas)
                if cad.por_ocr:
                    bruto = " ".join(t for _, t, _ in (OCR(np.asarray(im))[0] or []))
                checar = [q["enunciado"], q["alternativas"][0]["texto"], q["alternativas"][-1]["texto"]]
                # O recorte não pode conter o cabeçalho de outra questão.
                outro = [k for k in CABECALHO.findall(bruto) if int(k) != n]
                faltam = [s[:40] for s in checar if not achou(s, norm(bruto))]
                if len(faltam) > 1 and OCR and not cad.por_ocr:
                    # Cadernos com fonte sem mapa de caracteres (2016, 2017, 2021): o texto
                    # extraído vira lixo, mas a imagem está certa. Confere lendo a imagem.
                    lido = norm(" ".join(t for _, t, _ in (OCR(np.asarray(im))[0] or [])))
                    faltam = [s[:40] for s in checar if not achou(s, lido)]
                if len(faltam) > 1 or outro:
                    falhas.append(f"{qid}: recorte sem {faltam}, outros cabeçalhos {outro}"); continue
                if not tem_cor(im):
                    im = im.convert("L")
                destino = SAIDA / ano / f"{qid}.webp"
                destino.parent.mkdir(parents=True, exist_ok=True)
                im.save(destino, "WEBP", quality=60 if im.mode == "RGB" else 55, method=6)
                indice[qid] = destino.relative_to(BASE / "painel").as_posix()
            print(f"{ano} D{dia}: {sum(1 for k in indice if k.startswith(f'enem_{ano}_'))} recortes até aqui")
    sem = sorted(set(por_id) - set(indice))
    INDICE.write_text(
        "/* GERADO por pipeline/recortar_questoes_enem.py — NÃO EDITAR À MÃO.\n"
        "   Imagem de cada questão no caderno oficial (INEP, caderno azul): texto-base,\n"
        "   figuras, enunciado e alternativas como impressos. */\n"
        f"const PROVAS_IMG = {json.dumps(dict(sorted(indice.items())), ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8")
    RELATORIO.write_text(
        f"Recortes ENEM: {len(indice)} de {len(por_id)} questões do banco.\n\n"
        "Falhas na conferência automática (não entraram no índice):\n" + "\n".join(falhas) +
        "\n\nQuestões do banco sem recorte:\n" + "\n".join(sem) + "\n", encoding="utf-8")
    print(f"{len(indice)} recortes; {len(falhas)} falhas; relatório em {RELATORIO.relative_to(BASE)}")


if __name__ == "__main__":
    main()
