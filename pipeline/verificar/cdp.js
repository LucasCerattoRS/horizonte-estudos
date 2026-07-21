/* Driver CDP mínimo (sem npm): sobe o Chromium do cache do Playwright, conecta pelo
   DevTools Protocol com o WebSocket nativo do Node e expõe goto/eval/screenshot/touch.
   Uso: const {open} = require("./cdp.js"); const p = await open({mobile:true}); */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* Acha o Chromium: CHROME= (Windows aponta p/ msedge.exe) vence; senão pega o mais
   novo baixado pelo Playwright (`npx playwright install chromium`, sem root) — assim
   a verificação funciona nesta máquina sem depender de um número de versão fixo. */
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const caches = [
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
    path.join(process.env.LOCALAPPDATA || "", "ms-playwright"),
  ];
  const subs = process.platform === "win32" ? [["chrome-win", "chrome.exe"]]
    : process.platform === "darwin" ? [["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]]
    : [["chrome-linux64", "chrome"], ["chrome-linux", "chrome"]];
  let best = null, bestN = -1;
  for (const dir of caches) {
    let ents; try { ents = fs.readdirSync(dir); } catch { continue; }
    for (const e of ents) {
      const m = /^chromium-(\d+)$/.exec(e);
      if (!m || +m[1] <= bestN) continue;
      for (const s of subs) {
        const bin = path.join(dir, e, ...s);
        if (fs.existsSync(bin)) { best = bin; bestN = +m[1]; break; }
      }
    }
  }
  return best || path.join(os.homedir(), ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
}
const CHROME = findChrome();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url){
  return new Promise((res, rej) => http.get(url, r => {
    let b = ""; r.on("data", c => b += c); r.on("end", () => res(b));
  }).on("error", rej));
}

async function open(opt = {}){
  const port = 9222 + Math.floor(Math.random() * 500);
  const args = [
    "--headless=new", `--remote-debugging-port=${port}`, "--no-sandbox",
    "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--user-data-dir=/tmp/cdp-${port}`,
    `--window-size=${opt.mobile ? "390,844" : "1400,1000"}`,
    "about:blank",
  ];
  const proc = spawn(CHROME, args, { stdio: "ignore" });
  let ws = null;
  for (let i = 0; i < 60 && !ws; i++){
    await sleep(150);
    try { ws = JSON.parse(await get(`http://127.0.0.1:${port}/json/list`))
      .find(t => t.type === "page").webSocketDebuggerUrl; } catch { /* subindo */ }
  }
  if (!ws) { proc.kill(); throw new Error("Chromium não subiu"); }

  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pend = new Map(); const errors = []; const logs = [];
  sock.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      errors.push(m.params.args.map(a => a.value ?? a.description).join(" "));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      logs.push(m.params.entry.text);
  };
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params }));
  });

  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  if (opt.mobile) {
    // Celular DE VERDADE: largura real (o headless trava o viewport em 500px sem isto),
    // toque, e as media features hover:none/pointer:coarse — sem elas, uma janela estreita
    // ainda reporta hover:hover e some com bugs que só aparecem no dedo.
    await send("Emulation.setDeviceMetricsOverride", {
      width: opt.width || 390, height: opt.height || 844,
      deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Emulation.setEmulatedMedia", { features: [
      { name: "hover", value: "none" }, { name: "pointer", value: "coarse" } ] });
  }

  const p = {
    errors, logs,
    send,          // canal CDP cru — p/ domínios que o eval não alcança (ex.: CSS.getPlatformFontsForNode,
                   // que diz qual fonte o navegador REALMENTE usou, não a pilha que você pediu)
    async goto(url){
      await send("Page.navigate", { url });
      await sleep(opt.wait || 1400);
    },
    async eval(expr){
      const r = await send("Runtime.evaluate",
        { expression: `(async function(){${expr}})()`, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
      return r.result?.result?.value;
    },
    async shot(path){
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      require("fs").writeFileSync(path, Buffer.from(r.result.data, "base64"));
    },
    async shotClip(clip){
      const r = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
      return Buffer.from(r.result.data, "base64");
    },
    async setOffline(v){
      await send("Network.enable");
      await send("Network.emulateNetworkConditions", { offline: v, latency: 0,
        downloadThroughput: v ? 0 : -1, uploadThroughput: v ? 0 : -1 });
    },
    /* No Windows, proc.kill() mata só o processo-pai do Chromium: os ~30 filhos
       (renderer/GPU/utility) ficam vivos. Em 14/07 uma sessão terminou com 260
       msedge.exe pendurados. taskkill /T derruba a árvore inteira. */
    /* Windows deixa lixo: proc.kill() mata só o pai, e nem `taskkill /T` pega tudo
       (o Chromium re-parenteia os filhos). Em 14/07 uma sessão terminou com 260
       msedge.exe vivos. Solução: matar pelo --user-data-dir, que é único por sessão
       (cdp-<porta>) — preciso, e nunca encosta no navegador de verdade do Alex.
       Síncrono de propósito: o Node sai logo depois e levaria o matador junto. */
    close(){
      sock.close();
      if (process.platform !== "win32") return proc.kill();
      require("child_process").spawnSync("powershell", ["-NoProfile", "-Command",
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' or Name='chrome.exe'" |` +
        ` Where-Object { $_.CommandLine -like '*cdp-${port}*' } |` +
        ` ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
        { stdio: "ignore" });
    },
  };
  return p;
}

module.exports = { open, sleep };
