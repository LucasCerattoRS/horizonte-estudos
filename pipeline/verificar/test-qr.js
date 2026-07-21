/* test-qr.js — prova que o painel/qr.js gera QR que um LEITOR DE VERDADE consegue ler.

   Por que assim: comparar a matriz com outra biblioteca (tentei com o segno) é rígido
   demais — o padrão admite mais de um preenchimento válido depois do terminador, e as
   duas implementações divergem aí sem que nenhuma esteja errada. O que importa é o
   decodificador: gero o PNG e mando o OpenCV ler de volta. Se voltar o texto exato,
   o QR presta; se eu quebrar a máscara, o ECC ou o zigue-zague, ele para de ler.

   Uso:  pipeline/.venv/bin/pip install opencv-python-headless   (só p/ teste)
         node pipeline/verificar/test-qr.js
*/
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const VENV = path.join(RAIZ, "pipeline", ".venv", "bin", "python");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "qrtest-"));

const win = {};
new Function("window", fs.readFileSync(path.join(RAIZ, "painel", "qr.js"), "utf8"))(win);
const QR = win.QR;

/* PNG mínimo em escala de cinza, sem dependência (zlib do próprio Node) */
function png(mat, escala, margem) {
  const zlib = require("zlib");
  const lado = (mat.size + margem * 2) * escala;
  const linhas = Buffer.alloc((lado + 1) * lado, 0xff);
  for (let y = 0; y < lado; y++) {
    linhas[y * (lado + 1)] = 0;                                  // filtro "none"
    for (let x = 0; x < lado; x++) {
      const mx = Math.floor(x / escala) - margem, my = Math.floor(y / escala) - margem;
      const dentro = mx >= 0 && my >= 0 && mx < mat.size && my < mat.size;
      linhas[y * (lado + 1) + 1 + x] = (dentro && mat.mods[my * mat.size + mx]) ? 0x00 : 0xff;
    }
  }
  const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (tipo, dados) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(corpo));
    return Buffer.concat([len, corpo, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bits, escala de cinza
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(linhas)), chunk("IEND", Buffer.alloc(0))]);
}

const DECODE = `
import sys, json, cv2
det = cv2.QRCodeDetector()
out = []
for p in json.loads(sys.argv[1]):
    img = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    txt, pts, _ = det.detectAndDecode(img)
    out.append(txt)
print(json.dumps(out))
`;

// casos: do mais curto ao limite, cobrindo TODAS as versões que o gerador usa (1–10),
// incluindo a URL real de login e acentos (UTF-8 multi-byte).
const base = "https://painel-alex.pages.dev/painel/#token=";
const casos = [
  "oi",
  base + "a".repeat(48),                                  // a URL real de login (token de 48 hex)
  "https://painel-alex.pages.dev/painel/",
  "acentuação: é ç ã õ — teste UTF-8",
  ...[8, 20, 36, 56, 78, 100, 116, 146, 174, 200].map(n => ("x".repeat(300)).slice(0, n)),
];

const arqs = [], vers = [];
casos.forEach((txt, i) => {
  const m = QR.matrix(txt);
  vers.push(m.version);
  const p = path.join(TMP, `q${i}.png`);
  fs.writeFileSync(p, png(m, 8, 4));                       // 8px por módulo + zona quieta de 4
  arqs.push(p);
});

const lidos = JSON.parse(execFileSync(VENV, ["-c", DECODE, JSON.stringify(arqs)], { encoding: "utf8" }));

let ok = 0; const falhas = [];
casos.forEach((txt, i) => {
  if (lidos[i] === txt) ok++;
  else falhas.push(`v${vers[i]} (${txt.length} chars): leu ${JSON.stringify(lidos[i].slice(0, 40))}`);
});
console.log(`casos: ${casos.length} | lidos corretamente pelo OpenCV: ${ok} | falhas: ${falhas.length}`);
console.log(`versões exercitadas: ${[...new Set(vers)].sort((a, b) => a - b).join(", ")}`);
falhas.forEach(f => console.log("  ✗ " + f));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(falhas.length ? 1 : 0);
