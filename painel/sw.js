/* ============================================================
   SERVICE WORKER — o que torna o painel um app instalável e
   offline de verdade (PWA, camada B do ESTUDO-MOBILE.md).
   Só roda no site publicado (https) ou em localhost; em file://
   o navegador nem registra — o modo "abre a pasta" segue igual.

   Regras de cache (a ordem importa):
   1. /api/*  → NUNCA cacheia. É o estado do servidor (D1); resposta velha
      aqui significaria mostrar progresso errado ou perfil desatualizado.
   2. Qualquer coisa de OUTRA origem (Gemini, YouTube, Google) → passa direto.
      Resposta de IA cacheada seria mentira; e cachear terceiro é ruído.
   3. Navegação (abrir o app) → rede primeiro (pra pegar versão nova e o
      redirect do Cloudflare Access quando a sessão expira), caindo pro
      index.html do cache quando não há rede. É assim que o app abre offline.
   4. Resto (app.js, *-data.js, ícones, PDFs de prova) → cache primeiro,
      revalidando por baixo (stale-while-revalidate). É o que faz a 2ª
      abertura ser instantânea mesmo com os 4,4 MB do banco de questões.

   Trocar de versão: suba CACHE_V. O SW novo assume na hora (skipWaiting +
   clients.claim) e apaga os caches antigos.
   ============================================================ */
const CACHE_V = "horizonte-v30";

/* Shell mínimo — o que precisa existir pro app abrir sem rede. Os arquivos de
   dados grandes NÃO entram aqui (senão a instalação baixaria 5,8 MB antes de o app
   sequer abrir): quem cuida deles é o aquecer() logo abaixo, em segundo plano. */
const SHELL = [
  "./",
  "./index.html",
  // app.js foi fatiado (2026-07-16): os 8 são código do app e <script src> trava o
  // parser se faltar offline — todos entram na casca (não nos DADOS aquecidos depois).
  "./app-core.js",
  "./app-edital.js",
  "./app-analise.js",
  "./app-plano.js",
  "./app-banco.js",
  "./app-redacao.js",
  "./app-painel.js",
  "./app.js",
  "./qr.js",               // gerador do QR de login — também é <script src>, trava o parser se faltar
  "./sync.js",             // idem (achado nesta sessão: faltava — <script src>, mesma regra do topo)
  "./push.js",             // idem — avisos de revisão (push.js)
  "./edital-data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

/* Os DADOS (o conteúdo do app: 3831 questões, notas, gabaritos, leituras…).
   Ficam fora do install de propósito, mas são AQUECIDOS assim que o SW assume.
   Por quê: a 1ª visita não passa pelo SW (a página que o registra não é
   controlada por ele), então a regra 4 não cacheia nada dela. Quem abrisse o app
   UMA vez e ficasse sem rede achava a casca vazia — 0 questões, 0 leituras — que
   é exatamente o que a mensagem de offline promete evitar. Medido em 14/07 com o
   servidor morto: boot de 7s e todos os dados AUSENTES. */
const DADOS = [
  "./fases-data.js",
  "./notas-data.js",
  "./relacoes-data.js",
  "./gabaritos-data.js",
  "./gabaritos-enem-data.js",
  "./frequencia-data.js",
  "./redacao-data.js",
  "./redacoes-notamil-data.js",
  "./rubricas-redacao-data.js",
  "./propostas-ufrgs-data.js",
  "./textos-modelo-data.js",
  "./recursos-data.js",
  "./leituras-data.js",
  "./banco-questoes-data.js",
  "./sync.js",
  // Os dois OPCIONAIS: o index.html carrega, mas eles podem não existir neste site
  // (perfil-seed.js só no da Bia; redacoes-corpus.js é do Alex e nunca é publicado).
  "./perfil-seed.js",
  "./redacoes-corpus.js",
];

/* Um por vez e sem pressa: roda em segundo plano, DEPOIS de o app já estar de pé,
   então não pode competir por banda com a página. Os bytes vêm do cache HTTP do
   navegador (o Pages manda ETag + must-revalidate → 304), não da rede de novo. */
async function aquecer() {
  const c = await caches.open(CACHE_V);
  for (const u of DADOS) {
    if (await c.match(u)) continue;                       // a regra 4 já pegou
    try {
      const r = await fetch(u);
      // O 404 dos opcionais entra no cache DE PROPÓSITO. Sem ele, offline o <script>
      // fica ~4s pendurado tentando a rede (medido em 14/07: 4052ms cada) e, como
      // <script src> trava o parser, o app inteiro esperava 8s por dois arquivos que
      // não existem. Cacheado, o 404 chega na hora — offline falha igual a online.
      if (cacheavel(r) || (r.status === 404 && r.type === "basic")) await c.put(u, r);
    } catch { /* sem rede: a próxima visita online aquece */ }
  }
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_V);
    // addAll falha inteiro se UM arquivo faltar (ex.: perfil-seed.js só existe
    // no site da Bia) — por isso cada um por si.
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE_V).map(n => caches.delete(n)));
    await self.clients.claim();   // controla a página primeiro…
    await aquecer();              // …e só então baixa o conteúdo (waitUntil segura o SW vivo)
  })());
});

const cacheavel = r => r && r.status === 200 && r.type === "basic";

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // regra 2: terceiros passam direto
  if (url.pathname.includes("/api/")) return;           // regra 1: estado do servidor, nunca

  // regra 3: navegação — rede primeiro, cache como rede de segurança
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (cacheavel(net)) (await caches.open(CACHE_V)).put("./index.html", net.clone());
        return net;
      } catch {
        const c = await caches.open(CACHE_V);
        return (await c.match("./index.html")) || (await c.match("./")) ||
          new Response("<h1>Offline</h1><p>Abra o app uma vez com internet para ele funcionar offline.</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 });
      }
    })());
    return;
  }

  // regra 4: recursos — cache primeiro, revalidando por baixo
  e.respondWith((async () => {
    const c = await caches.open(CACHE_V);
    const hit = await c.match(req);
    const rede = fetch(req).then(res => {
      if (cacheavel(res)) c.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await rede) || new Response("", { status: 504 });
  })());
});

/* Push de revisão (SM-2 avisa quando vence — ver painel/push.js + worker-push/).
   O payload vem do worker-push (JSON: title/body/data.url); mostra a notificação
   e, no clique, foca uma aba já aberta (navegando pro hash) ou abre uma nova. */
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Revisão pendente";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Você tem tópicos vencidos na fila de revisão.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "revisao-sm2",       // notificação nova com a mesma tag SUBSTITUI a anterior, não empilha
    renotify: true,
    data: { url: data.url || "./#revisao" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./#revisao", self.location.href).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) {
      if (c.url.split("#")[0] === url.split("#")[0] && "focus" in c) {
        c.navigate(url).catch(() => {});
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
