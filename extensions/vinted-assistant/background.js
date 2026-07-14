const DEFAULTS = {
  apiUrl: "",
  apiSecret: "",
  budget: 300,
  minProfit: 15,
  minRoiPercent: 40,
  autoSourcing: false,
  autoPublish: false,
  autoMessages: false,
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set(current);
  chrome.alarms.create("resaleos-sync", { periodInMinutes: 1 });
});

async function api(path, { method = "GET", body } = {}) {
  const settings = await chrome.storage.local.get(DEFAULTS);
  if (!settings.apiUrl || !settings.apiSecret) {
    throw new Error("Configure l'URL ResaleOS et le secret dans l'extension.");
  }
  const response = await fetch(`${settings.apiUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${settings.apiSecret}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `ResaleOS a répondu ${response.status}.`);
  return data;
}

async function urlToDataUrl(url) {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Photo inaccessible (${response.status}).`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function hydratePackage(payload) {
  const urls = payload.images || [];
  return { ...payload, images: await Promise.all(urls.map(urlToDataUrl)), imageUrls: urls };
}

function comparableUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value;
  }
}

async function syncActions() {
  const { actions } = await api("/api/automation/actions/pending");
  const tabs = await chrome.tabs.query({ url: ["https://*.vinted.fr/*"] });
  let executed = 0;
  let waiting = 0;
  for (const action of actions) {
    const tab = tabs.find(
      (candidate) => comparableUrl(candidate.url || "") === comparableUrl(action.conversationUrl),
    );
    if (!tab?.id) {
      waiting += 1;
      continue;
    }
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "RESALEOS_EXECUTE_ACTION",
        action,
      });
      if (!response?.ok) throw new Error(response?.error || "Exécution impossible.");
      await api("/api/automation/actions/pending", {
        method: "POST",
        body: { id: action.id, ok: true },
      });
      executed += 1;
    } catch (error) {
      await api("/api/automation/actions/pending", {
        method: "POST",
        body: {
          id: action.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  return { executed, waiting };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resaleos-sync") void syncActions().catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "RESALEOS_API") {
        sendResponse({
          ok: true,
          data: await api(message.path, { method: message.method, body: message.body }),
        });
        return;
      }

      if (message?.type === "RESALEOS_GET_LATEST_PACKAGE") {
        const payload = await api("/api/automation/package/latest");
        sendResponse({ ok: true, payload });
        return;
      }

      if (message?.type === "RESALEOS_HYDRATE_PACKAGE") {
        sendResponse({ ok: true, payload: await hydratePackage(message.payload) });
        return;
      }

      if (message?.type === "RESALEOS_SYNC_ACTIONS") {
        sendResponse({ ok: true, ...(await syncActions()) });
        return;
      }

      if (message?.type === "RESALEOS_CONVERSATION") {
        const settings = await chrome.storage.local.get(DEFAULTS);
        if (!settings.autoMessages) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        const result = await api("/api/automation/negotiation/evaluate", {
          method: "POST",
          body: message.payload,
        });
        if (result.execution?.mode === "auto_reply" && sender.tab?.id) {
          const reply = await chrome.tabs.sendMessage(sender.tab.id, {
            type: "RESALEOS_SEND_MESSAGE",
            text: result.execution.text,
          });
          if (!reply?.ok) throw new Error(reply?.error || "Réponse non envoyée.");
        }
        sendResponse({ ok: true, result });
        return;
      }

      if (message?.type === "RESALEOS_AUTO_SOURCE") {
        const settings = await chrome.storage.local.get(DEFAULTS);
        if (!settings.autoSourcing || !message.candidates?.length) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        const fingerprint = message.candidates.map(({ id }) => id).join("|");
        const key = `sourceFingerprint:${sender.tab?.id || "unknown"}`;
        const previous = await chrome.storage.session.get(key);
        if (previous[key] === fingerprint) {
          sendResponse({ ok: true, skipped: true });
          return;
        }
        await chrome.storage.session.set({ [key]: fingerprint });
        const result = await api("/api/automation/sourcing/rank", {
          method: "POST",
          body: {
            candidates: message.candidates,
            profile: {
              budget: Number(settings.budget),
              minProfit: Number(settings.minProfit),
              minRoiPercent: Number(settings.minRoiPercent),
              maxRisk: "moderate",
              preferredCategories: [],
              excludedBrands: [],
              notes: "",
            },
            notify: true,
          },
        });
        sendResponse({ ok: true, result });
        return;
      }

      sendResponse({ ok: false, error: "Commande inconnue." });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});
