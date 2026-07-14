const fileInput = document.querySelector("#package-file");
const textInput = document.querySelector("#package-text");
const fillButton = document.querySelector("#fill");
const status = document.querySelector("#status");

function setStatus(message, tone = "") {
  status.textContent = message;
  status.className = tone;
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  textInput.value = await file.text();
  setStatus(`${file.name} chargé.`, "success");
});

fillButton.addEventListener("click", async () => {
  fillButton.disabled = true;
  try {
    const payload = JSON.parse(textInput.value);
    if (payload?.schemaVersion !== 1 || !payload?.draft) {
      throw new Error("Paquet ResaleOS non reconnu.");
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !String(tab.url || "").includes("vinted.fr")) {
      throw new Error("Ouvre d'abord une page Vinted dans l'onglet actif.");
    }
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "RESALEOS_FILL_LISTING",
      payload,
    });
    if (!response?.ok) throw new Error(response?.error || "La page n'a pas pu être remplie.");
    const filled = response.filled?.join(", ") || "aucun champ";
    setStatus(`Rempli : ${filled}. Vérifie les autres champs.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    fillButton.disabled = false;
  }
});
