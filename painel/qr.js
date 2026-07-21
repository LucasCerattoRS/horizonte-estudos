/* qr.js — gerador de QR Code (modo byte, ECC M, versões 1–10). Zero dependência:
   o painel não tem build nem CDN, e precisa funcionar em file:// e offline.
   Só existe para o "login por QR" do sync.js (levar o token até o celular sem digitar).

   Verificado por DECODIFICAÇÃO: pipeline/verificar/test-qr.js gera os PNGs e manda o
   OpenCV ler de volta (14 casos, versões 1–10, incluindo a URL real de login e UTF-8).
   Comparar a matriz com outra lib (tentei com o segno) NÃO serve: o padrão admite mais
   de um preenchimento válido depois do terminador, e as duas divergem aí sem erro.

   API:  QR.matrix(texto) -> { size, mods }   mods[y*size+x] = 0|1
         QR.draw(canvas, texto, escala, margem)
*/
(function () {
  "use strict";

  /* ---------- GF(256), o corpo finito do Reed-Solomon (x^8+x^4+x^3+x^2+1) ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  function rsGen(deg) {                       // polinômio gerador, grau `deg` (coef. do maior p/ o menor)
    let p = [1];
    for (let i = 0; i < deg; i++) {
      const q = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); }
      p = q;
    }
    return p;
  }
  function rsEcc(data, ecLen) {               // resto da divisão = os codewords de correção
    const gen = rsGen(ecLen), res = new Uint8Array(ecLen);
    for (const b of data) {
      const f = b ^ res[0];
      res.copyWithin(0, 1); res[ecLen - 1] = 0;
      for (let i = 0; i < ecLen; i++) res[i] ^= mul(gen[i + 1], f);
    }
    return res;
  }

  /* ---------- tabelas (só ECC M, versões 1–10: cobre ~200 caracteres, de sobra p/ a URL) ---------- */
  const TOTAL_CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];  // codewords totais por versão
  const EC_PER_BLK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];       // ECC por bloco (nível M)
  const N_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                   // blocos (nível M)
  const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                 [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const ECL_BITS = 0;                          // indicador de nível M no format info (00)
  const MAXV = 10;

  const size = v => v * 4 + 17;
  const dataCw = v => TOTAL_CW[v] - EC_PER_BLK[v] * N_BLOCKS[v];
  const countBits = v => (v < 10 ? 8 : 16);    // modo byte: 8 bits até a v9, 16 da v10 em diante

  /* ---------- bitstream ---------- */
  function encodeData(bytes, v) {
    const bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);                                  // modo byte
    put(bytes.length, countBits(v));
    bytes.forEach(b => put(b, 8));
    const cap = dataCw(v) * 8;
    if (bits.length > cap) return null;          // não cabe nesta versão
    put(0, Math.min(4, cap - bits.length));      // terminador
    while (bits.length % 8) bits.push(0);        // fecha o byte
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let i = 0; cw.length < dataCw(v); i++) cw.push(i % 2 ? 0x11 : 0xec);   // preenchimento
    return cw;
  }

  // Divide em blocos, calcula ECC de cada um e INTERCALA (é assim que o padrão espalha o dano).
  function interleave(cw, v) {
    const nb = N_BLOCKS[v], ec = EC_PER_BLK[v], total = dataCw(v);
    const curto = Math.floor(total / nb), nCurtos = nb - (total % nb);
    const dat = [], ecc = [];
    let p = 0;
    for (let i = 0; i < nb; i++) {
      const len = curto + (i < nCurtos ? 0 : 1);
      const blk = cw.slice(p, p + len); p += len;
      dat.push(blk); ecc.push(rsEcc(blk, ec));
    }
    const out = [];
    for (let i = 0; i < curto + 1; i++) dat.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ec; i++) ecc.forEach(b => out.push(b[i]));
    return out;
  }

  /* ---------- matriz ---------- */
  function novaMatriz(v) {
    const n = size(v);
    const m = { n, mods: new Uint8Array(n * n), res: new Uint8Array(n * n) };  // res = módulo reservado (função)
    const set = (x, y, val, reservado) => { m.mods[y * n + x] = val; m.res[y * n + x] = reservado ? 1 : 0; };

    const finder = (cx, cy) => {               // olho 7x7 + separador
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const borda = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const centro = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        const dentro = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        set(x, y, dentro && (borda || centro) ? 1 : 0, true);
      }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);

    for (let i = 8; i < n - 8; i++) {          // linhas de tempo
      const bit = i % 2 === 0 ? 1 : 0;
      set(i, 6, bit, true); set(6, i, bit, true);
    }

    const al = ALIGN[v];                        // padrões de alinhamento (nunca sobre os olhos)
    for (const cy of al) for (const cx of al) {
      if ((cx <= 8 && cy <= 8) || (cx <= 8 && cy >= n - 9) || (cx >= n - 9 && cy <= 8)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(cx + dx, cy + dy, (Math.abs(dx) === 2 || Math.abs(dy) === 2 || (dx === 0 && dy === 0)) ? 1 : 0, true);
    }

    for (let i = 0; i < 9; i++) {               // áreas do format info (preenchidas depois)
      if (i !== 6) { set(i, 8, 0, true); set(8, i, 0, true); }
    }
    for (let i = 0; i < 8; i++) { set(n - 1 - i, 8, 0, true); set(8, n - 1 - i, 0, true); }
    set(8, n - 8, 1, true);                     // módulo escuro, sempre 1

    if (v >= 7) {                               // bloco de versão (18 bits, BCH)
      let d = v;
      for (let i = 0; i < 12; i++) d = (d << 1) ^ ((d >>> 11) * 0x1f25);
      const vbits = (v << 12) | d;
      for (let i = 0; i < 18; i++) {
        const bit = (vbits >>> i) & 1, a = Math.floor(i / 3), b = i % 3;
        set(a, n - 11 + b, bit, true); set(n - 11 + b, a, bit, true);
      }
    }
    return m;
  }

  function colocarDados(m, cw) {                // zigue-zague de baixo p/ cima, 2 colunas por vez
    const n = m.n; let i = 0;
    for (let dir = n - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;                    // SÓ a coluna 6 é pulada (linha de tempo);
      const up = ((dir + 1) & 2) === 0;          // as demais seguem o passo normal de 2 em 2
      for (let k = 0; k < n; k++) {
        const y = up ? n - 1 - k : k;
        for (const x of [dir, dir - 1]) {
          if (m.res[y * n + x]) continue;
          const bit = i < cw.length * 8 ? (cw[i >> 3] >>> (7 - (i & 7))) & 1 : 0;
          m.mods[y * n + x] = bit; i++;
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ];

  function aplicarMascara(m, k) {
    const n = m.n, f = MASKS[k];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (!m.res[y * n + x] && f(x, y)) m.mods[y * n + x] ^= 1;
  }

  function formatInfo(m, mask) {
    const n = m.n;
    let d = (ECL_BITS << 3) | mask;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((d << 10) | r) ^ 0x5412;
    const set = (x, y, b) => { m.mods[y * n + x] = b; };
    for (let i = 0; i < 15; i++) {
      const bit = (bits >>> i) & 1;
      // cópia 1: coluna 8 descendo, depois linha 8 indo p/ a esquerda (em volta do olho ↖)
      if (i < 6) set(8, i, bit);
      else if (i === 6) set(8, 7, bit);
      else if (i === 7) set(8, 8, bit);
      else if (i === 8) set(7, 8, bit);
      else set(14 - i, 8, bit);
      // cópia 2: linha 8 à direita (olho ↗) e coluna 8 embaixo (olho ↙)
      if (i < 8) set(n - 1 - i, 8, bit);
      else set(8, n - 15 + i, bit);
    }
    m.mods[(n - 8) * n + 8] = 1;                 // módulo escuro
  }

  /* penalidades do padrão — escolhem a máscara que menos confunde o leitor */
  function penalidade(m) {
    const n = m.n, at = (x, y) => m.mods[y * n + x];
    let p = 0;
    for (let y = 0; y < n; y++) for (const linha of [true, false]) {
      let run = 1, prev = linha ? at(0, y) : at(y, 0);
      for (let i = 1; i < n; i++) {
        const c = linha ? at(i, y) : at(y, i);
        if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else { run = 1; prev = c; }
      }
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const s = at(x, y) + at(x + 1, y) + at(x, y + 1) + at(x + 1, y + 1);
      if (s === 0 || s === 4) p += 3;
    }
    const alvo = [1, 0, 1, 1, 1, 0, 1];
    const casa = (arr, i) => alvo.every((v, k) => arr[i + k] === v);
    for (let i = 0; i < n; i++) {
      const lin = [], col = [];
      for (let j = 0; j < n; j++) { lin.push(at(j, i)); col.push(at(i, j)); }
      for (const arr of [lin, col]) for (let j = 0; j + 7 <= n; j++) {
        if (!casa(arr, j)) continue;
        const antes = arr.slice(Math.max(0, j - 4), j), depois = arr.slice(j + 7, j + 11);
        if (antes.length === 4 && antes.every(v => v === 0)) p += 40;
        if (depois.length === 4 && depois.every(v => v === 0)) p += 40;
      }
    }
    let escuros = 0; for (let i = 0; i < n * n; i++) escuros += m.mods[i];
    p += Math.floor(Math.abs(escuros * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  function utf8(s) {
    const out = [];
    for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0));
    return out;
  }

  const QR = {
    /* mask: use apenas para teste (força uma máscara). Em produção, a melhor é escolhida. */
    matrix(texto, mask) {
      const bytes = utf8(texto);
      let v = 0, cw = null;
      for (let i = 1; i <= MAXV; i++) { cw = encodeData(bytes, i); if (cw) { v = i; break; } }
      if (!v) throw new Error("QR: texto longo demais (máx. ~200 caracteres)");
      const dados = interleave(cw, v);
      let melhor = null, melhorP = Infinity;
      const tentar = k => {
        const m = novaMatriz(v);
        colocarDados(m, dados);
        aplicarMascara(m, k);
        formatInfo(m, k);
        return m;
      };
      if (mask !== undefined) { melhor = tentar(mask); }
      else for (let k = 0; k < 8; k++) {
        const m = tentar(k), p = penalidade(m);
        if (p < melhorP) { melhorP = p; melhor = m; }
      }
      return { size: melhor.n, mods: melhor.mods, version: v };
    },

    draw(canvas, texto, escala, margem) {
      const q = QR.matrix(texto);
      escala = escala || 5; margem = margem === undefined ? 4 : margem;
      const lado = (q.size + margem * 2) * escala;
      canvas.width = lado; canvas.height = lado;
      const g = canvas.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, lado, lado);   // fundo SEMPRE branco: leitor precisa de contraste
      g.fillStyle = "#000";
      for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++)
        if (q.mods[y * q.size + x]) g.fillRect((x + margem) * escala, (y + margem) * escala, escala, escala);
      return q;
    },
  };
  window.QR = QR;
})();
