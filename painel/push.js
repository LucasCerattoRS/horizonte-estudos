/* push.js — notificações push da fila de revisão SM-2 ("avisa quando vence").
   Camada OPCIONAL sobre o sync (V2, ver sync.js): reusa Sync.token/Sync.apiBase.
   Sem token / sem sync ativo → o botão nem aparece (não há a quem autenticar).
   Carregado DEPOIS de sync.js (compartilha o escopo global, mesmo padrão dos outros módulos).

   Como funciona:
   - Clique no botão → pede permissão do navegador (TEM de ser dentro do clique;
     no boot o iOS nega silenciosamente) → assina no PushManager do navegador →
     manda a assinatura pro servidor (POST /api/push, guarda endpoint+chaves no D1).
   - 1×/dia, um Worker separado (worker-push/, Cron Trigger — Pages Functions não
     tem cron) lê a fila SM-2 de cada perfil inscrito e dispara quem tiver revisão
     vencida. Ver worker-push/src/index.js e docs/ATIVAR-PUSH.md.
   - Desativar: DELETE /api/push (endpoint) + unsubscribe() local.
   - Backend V2 já existe (Pages Functions + D1); este arquivo só cuida do lado
     do navegador (permissão, assinatura, toggle de UI). Nada aqui trava o boot
     se o navegador não suportar Push (guard `supported()`).
*/
(function () {
  "use strict";

  // Chave pública VAPID (não é segredo — só a privada é). Gerar com:
  //   npx @pushforge/builder vapid
  // e colar o "Public Key" aqui. Sem isso, o botão de inscrição avisa e não faz nada.
  const VAPID_PUBLIC_KEY = "COLE_AQUI_A_CHAVE_PUBLICA_VAPID";
  const FLAG_KEY = "painelUFRGS_push_on"; // só um espelho local p/ 1º paint do botão (a verdade é pushManager.getSubscription())

  function urlBase64ToUint8Array(base64) {
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  function supported() {
    return (
      /^https?:$/.test(location.protocol) && // file:// nunca (mesma guarda do registro do SW)
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Sync !== "undefined" &&
      Sync.ativo() // sem token/sync não há servidor pra guardar a assinatura
    );
  }

  async function currentSub() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return null;
      return await reg.pushManager.getSubscription();
    } catch (e) {
      return null;
    }
  }

  async function subscribe() {
    if (!supported()) return false;
    if (VAPID_PUBLIC_KEY.startsWith("COLE_AQUI")) {
      alert("Aviso de revisão ainda não configurado neste site (falta a chave VAPID). Ver docs/ATIVAR-PUSH.md.");
      return false;
    }
    const perm = await Notification.requestPermission(); // TEM de ser a 1ª coisa após o clique (iOS)
    if (perm !== "granted") return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const j = sub.toJSON();
      const res = await fetch(Sync.apiBase() + "/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + Sync.token },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
      });
      if (!res.ok) { try { await sub.unsubscribe(); } catch (e) {} return false; }
      try { localStorage.setItem(FLAG_KEY, "1"); } catch (e) {}
      return true;
    } catch (e) {
      console.warn("push subscribe falhou", e);
      return false;
    } finally {
      render();
    }
  }

  async function unsubscribe() {
    const sub = await currentSub();
    if (sub) {
      const endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch (e) {}
      try {
        await fetch(Sync.apiBase() + "/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + Sync.token },
          body: JSON.stringify({ endpoint }),
        });
      } catch (e) {}
    }
    try { localStorage.removeItem(FLAG_KEY); } catch (e) {}
    render();
  }

  async function toggle() {
    const on = !!(await currentSub());
    if (on) await unsubscribe();
    else await subscribe();
  }

  async function render() {
    const btn = document.getElementById("pushBtn");
    if (!btn) return;
    if (!supported()) { btn.style.display = "none"; return; }
    btn.style.display = "";
    const on = !!(await currentSub());
    btn.textContent = on ? "🔔 Avisos ativados" : "🔔 Avise-me quando vencer";
    btn.classList.toggle("on", on);
    btn.title = on
      ? "Clique para desativar o aviso de revisão"
      : "Recebe um aviso (1×/dia) quando houver revisão vencida na fila";
  }

  window.Push = { subscribe, unsubscribe, toggle, render, supported };
  document.addEventListener("DOMContentLoaded", render);
})();
