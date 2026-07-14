const $ = (selector) => document.querySelector(selector);
const controls = {
  apiUrl: $("#api-url"),
  apiSecret: $("#api-secret"),
  budget: $("#budget"),
  minProfit: $("#min-profit"),
  minRoi: $("#min-roi"),
  autoSourcing: $("#auto-sourcing"),
  autoPublish: $("#auto-publish"),
  autoMessages: $("#auto-messages"),
};
const status = $("#status");

function setStatus(message, tone = "") {
  status.textContent = message;
  status.className = tone;
}

async function settingsFromForm() {
  return {
    apiUrl: controls.apiUrl.value.trim().replace(/\/$/, ""),
    apiSecret: controls.apiSecret.value.trim(),
    budget: Number(controls.budget.value || 0),
    minProfit: Number(controls.minProfit.value || 0),
    minRoiPercent: Number(controls.minRoi.value || 0),
    autoSourcing: controls.autoSourcing.checked,
    autoPublish: controls.autoPublish.checked,
    autoMessages: controls.autoMessages.checked,
  };
}

async function saveSettings(showConfirmation = true) {
  const settings = await settingsFromForm();
  if (settings.apiUrl) {
    let origin;
    try {
      origin = `${new URL(settings.apiUrl).origin}/*`;
    } catch {
      throw new Error("L'URL ResaleOS n'est pas valide.");
    }
    const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
    if (!alreadyGranted) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) throw new Error("Autorise uniquement le domaine ResaleOS pour continuer.");
    }
  }
  await chrome.storage.local.set(settings);
  if (showConfirmation) setStatus("Configuration enregistrée.", "success");
  return settings;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get({
    apiUrl: "",
    apiSecret: "",
    budget: 300,
    minProfit: 15,
    minRoiPercent: 40,
    autoSourcing: false,
    autoPublish: false,
    autoMessages: false,
  });
  controls.apiUrl.value = stored.apiUrl;
  controls.apiSecret.value = stored.apiSecret;
  controls.budget.value = stored.budget;
  controls.minProfit.value = stored.minProfit;
  controls.minRoi.value = stored.minRoiPercent;
  controls.autoSourcing.checked = stored.autoSourcing;
  controls.autoPublish.checked = stored.autoPublish;
  controls.autoMessages.checked = stored.autoMessages;
}

async function activeVintedTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/[^/]*vinted\.fr\//i.test(String(tab.url || ""))) {
    throw new Error("Ouvre d'abord la page Vinted concernée.");
  }
  return tab;
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    throw new Error("Recharge l'onglet Vinted pour activer l'extension.");
  }
}

async function callBackground(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Opération impossible.");
  return response;
}

async function fillPackage(payload) {
  if (![1, 2].includes(payload?.schemaVersion) || !payload?.draft) {
    throw new Error("Paquet ResaleOS non reconnu.");
  }
  const tab = await activeVintedTab();
  const hydrated = await callBackground({ type: "RESALEOS_HYDRATE_PACKAGE", payload });
  const settings = await chrome.storage.local.get({ autoPublish: false });
  const stored = await chrome.storage.local.get({ listingPackages: [] });
  const packages = [
    payload,
    ...stored.listingPackages.filter((entry) =>
      payload.jobId ? entry.jobId !== payload.jobId : entry.draft?.title !== payload.draft.title,
    ),
  ].slice(0, 50);
  await chrome.storage.local.set({ latestPackage: payload, listingPackages: packages });
  const response = await sendToTab(tab.id, {
    type: "RESALEOS_FILL_LISTING",
    payload: hydrated.payload,
    autoPublish: settings.autoPublish,
  });
  if (!response?.ok) throw new Error(response?.error || "La page n'a pas pu être remplie.");
  if (response.published && payload.jobId) {
    await callBackground({
      type: "RESALEOS_API",
      path: "/api/automation/package/published",
      method: "POST",
      body: { jobId: payload.jobId },
    });
  }
  const missing = response.missing?.length
    ? ` À compléter : ${response.missing.join(", ")}.`
    : "";
  setStatus(
    `${response.published ? "Annonce publiée" : "Page remplie"} : ${response.filled.join(", ")}.${missing}`,
    response.missing?.length ? "" : "success",
  );
}

$("#save").addEventListener("click", () => void saveSettings());
Object.values(controls).forEach((control) => {
  control.addEventListener("change", () => void saveSettings(false));
});

$("#scan").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await saveSettings(false);
    const tab = await activeVintedTab();
    const extracted = await sendToTab(tab.id, { type: "RESALEOS_EXTRACT_LISTINGS" });
    if (!extracted?.candidates?.length) throw new Error("Aucune annonce détectée sur cette page.");
    const settings = await chrome.storage.local.get();
    const response = await callBackground({
      type: "RESALEOS_API",
      path: "/api/automation/sourcing/rank",
      method: "POST",
      body: {
        candidates: extracted.candidates,
        profile: {
          budget: Number(settings.budget || 300),
          minProfit: Number(settings.minProfit || 15),
          minRoiPercent: Number(settings.minRoiPercent || 40),
          maxRisk: "moderate",
          preferredCategories: [],
          excludedBrands: [],
          notes: "",
        },
        notify: true,
      },
    });
    const buys = response.data.recommendations.filter((item) => item.verdict === "buy");
    setStatus(
      `${extracted.candidates.length} annonces classées · ${buys.length} achat(s) recommandé(s). Détails envoyés sur Telegram.`,
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#latest").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await saveSettings(false);
    const response = await callBackground({ type: "RESALEOS_GET_LATEST_PACKAGE" });
    await fillPackage(response.payload);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#sync").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    const response = await callBackground({ type: "RESALEOS_SYNC_ACTIONS" });
    setStatus(
      `${response.executed} décision(s) exécutée(s), ${response.waiting} en attente de la bonne conversation.`,
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#package-file").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  $("#package-text").value = await file.text();
  setStatus(`${file.name} chargé.`, "success");
});

$("#fill").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await fillPackage(JSON.parse($("#package-text").value));
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

void loadSettings();
