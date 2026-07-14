function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function visible(element) {
  return element instanceof HTMLElement && !element.hidden && element.offsetParent !== null;
}

function searchableText(element) {
  const id = element.id;
  const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  return normalize([
    element.name,
    element.id,
    element.placeholder,
    element.getAttribute("aria-label"),
    element.getAttribute("data-testid"),
    label?.textContent,
    element.closest("label")?.textContent,
    element.parentElement?.textContent?.slice(0, 180),
  ].filter(Boolean).join(" "));
}

function findControl(selectors, terms) {
  const elements = [...document.querySelectorAll(selectors)].filter(
    (element) => visible(element) && !element.disabled,
  );
  return elements.find((element) => terms.some((term) => searchableText(element).includes(term)));
}

function setFrameworkValue(element, value) {
  if (element.isContentEditable) {
    element.focus();
    element.textContent = String(value);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
    return;
  }
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, String(value));
  else element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
}

const pause = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function fillChoice(terms, value) {
  if (!value) return { found: false, selected: false };
  const control = findControl(
    'button, [role="combobox"], input[role="combobox"], [aria-haspopup="listbox"]',
    terms,
  );
  if (!control) return { found: false, selected: false };
  control.click();
  await pause(250);
  const wanted = normalize(value);
  const options = [...document.querySelectorAll(
    '[role="option"], [role="menuitem"], [data-testid*="option"], [data-testid*="dropdown"] button',
  )].filter(visible);
  const exact = options.find((option) => normalize(option.textContent) === wanted);
  const partial = options.find((option) => {
    const text = normalize(option.textContent);
    return text.includes(wanted) || wanted.includes(text);
  });
  const option = exact || partial;
  if (!option) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { found: true, selected: false };
  }
  option.click();
  await pause(180);
  return { found: true, selected: true };
}

async function dataUrlToFile(dataUrl, index) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `resaleos-${String(index + 1).padStart(2, "0")}.${extension}`, {
    type: blob.type || "image/jpeg",
  });
}

async function fillPhotos(images) {
  const input = document.querySelector(
    'input[type="file"][accept*="image"], input[type="file"][multiple]',
  );
  if (!input || !images?.length) return false;
  const transfer = new DataTransfer();
  const files = await Promise.all(images.slice(0, 8).map(dataUrlToFile));
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await pause(500);
  return true;
}

const CONDITION_LABELS = {
  new_with_tags: "Neuf avec étiquette",
  new_without_tags: "Neuf sans étiquette",
  very_good: "Très bon état",
  good: "Bon état",
  satisfactory: "Satisfaisant",
};

async function maybePublish(missing) {
  if (missing.length) return false;
  const candidates = [...document.querySelectorAll("button")].filter(visible);
  const publish = candidates.find((button) =>
    ["publier", "mettre en ligne", "ajouter"].includes(normalize(button.textContent)),
  );
  if (!publish || publish.disabled || publish.getAttribute("aria-disabled") === "true") return false;
  const initialUrl = location.href;
  publish.click();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await pause(250);
    if (location.href !== initialUrl) return true;
    const visibleError = [...document.querySelectorAll(
      '[role="alert"], [aria-invalid="true"], [data-testid*="error"]',
    )].some((element) => visible(element) && normalize(element.textContent).length > 0);
    if (visibleError) return false;
  }
  return false;
}

async function fillListing(payload, autoPublish) {
  const { draft, images } = payload;
  const filled = [];
  const missing = [];
  const title = findControl("input:not([type=file]):not([type=hidden])", ["titre", "title"]);
  const description = findControl("textarea, [contenteditable=true]", ["description", "decris"])
    || [...document.querySelectorAll("textarea")].find(visible);
  const price = findControl(
    'input:not([type=file]):not([type=hidden])',
    ["prix", "price"],
  );

  if (title) { setFrameworkValue(title, draft.title); filled.push("titre"); } else missing.push("titre");
  if (description) { setFrameworkValue(description, draft.description); filled.push("description"); } else missing.push("description");
  if (price) {
    setFrameworkValue(price, Number(draft.price).toFixed(2).replace(".", ","));
    filled.push("prix");
  } else missing.push("prix");
  if (await fillPhotos(images)) filled.push(`${images.length} photo(s)`); else missing.push("photos");

  const choices = [
    { key: "catégorie", terms: ["categorie", "category"], value: draft.category },
    { key: "marque", terms: ["marque", "brand"], value: draft.brand, optional: !draft.brand },
    { key: "taille", terms: ["taille", "size"], value: draft.size, optional: !draft.size },
    { key: "état", terms: ["etat", "condition"], value: CONDITION_LABELS[draft.condition] },
    { key: "colis", terms: ["colis", "package"], value: draft.packageSize },
  ];
  for (const choice of choices) {
    const result = await fillChoice(choice.terms, choice.value);
    if (result.selected) filled.push(choice.key);
    else if (!choice.optional) missing.push(choice.key);
  }

  const published = autoPublish ? await maybePublish(missing) : false;
  return { ok: true, filled, missing: [...new Set(missing)], published };
}

function closestItemCard(anchor) {
  let node = anchor;
  for (let depth = 0; depth < 7 && node; depth += 1, node = node.parentElement) {
    const text = node.innerText || "";
    if (/\d+(?:[,.]\d{1,2})?\s*€/.test(text) && text.length < 1800) return node;
  }
  return anchor.parentElement;
}

function parsePrice(text) {
  const match = text.match(/(\d{1,5}(?:[,.]\d{1,2})?)\s*€/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function extractListings() {
  const seen = new Set();
  const candidates = [];
  const anchors = [...document.querySelectorAll('a[href*="/items/"]')];
  for (const anchor of anchors) {
    if (candidates.length >= 30) break;
    const url = new URL(anchor.href, location.href);
    const id = url.pathname.match(/\/items\/(\d+)/)?.[1] || url.pathname;
    if (seen.has(id)) continue;
    const card = closestItemCard(anchor);
    const text = String(card?.innerText || anchor.innerText || "").trim();
    const price = parsePrice(text);
    if (price === null) continue;
    const image = card?.querySelector("img") || anchor.querySelector("img");
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const alt = image?.getAttribute("alt")?.trim();
    const title = alt && normalize(alt) !== "image" ? alt : lines.find((line) => !line.includes("€"));
    if (!title) continue;
    seen.add(id);
    const src = image?.currentSrc || image?.src;
    candidates.push({
      id,
      url: url.href,
      title: title.slice(0, 300),
      price,
      shippingPrice: 0,
      buyerProtectionPrice: 0,
      totalPrice: price,
      brand: "",
      size: "",
      condition: "",
      description: text.slice(0, 1200),
      ...(src && /^https?:/i.test(src) ? { imageUrl: src } : {}),
    });
  }
  return candidates;
}

function messagePage() {
  return /\/(inbox|messages?|conversation)/i.test(location.pathname);
}

function conversationSnapshot() {
  const selectors = [
    '[data-testid*="message"]',
    '[class*="message"]',
    '[aria-label*="message" i]',
  ];
  const selector = selectors.join(",");
  const nodes = [...document.querySelectorAll(selector)].filter(
    (element) => visible(element) && !element.querySelector(selector),
  );
  const texts = [];
  for (const node of nodes) {
    const text = String(node.innerText || node.textContent || "").trim();
    if (text.length < 1 || text.length > 2500 || texts.at(-1) === text) continue;
    texts.push(text);
  }
  const selected = texts.slice(-16);
  return {
    conversation: selected.join("\n---\n").slice(-12000),
    buyerMessage: selected.at(-1) || "",
  };
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

let suppressConversationUntil = 0;

async function evaluateVisibleConversation() {
  if (!messagePage() || Date.now() < suppressConversationUntil) return;
  const { latestPackage, listingPackages, autoMessages } = await chrome.storage.local.get({
    latestPackage: null,
    listingPackages: [],
    autoMessages: false,
  });
  if (!autoMessages) return;
  const pageText = normalize(
    [...document.querySelectorAll("h1, h2, [data-testid*='title']")]
      .filter(visible)
      .map((element) => element.textContent)
      .join(" "),
  );
  const matchedPackage = listingPackages.find((entry) => {
    const title = normalize(entry.draft?.title);
    return pageText.length >= 5 && title.length >= 5 &&
      (pageText.includes(title) || title.includes(pageText));
  });
  const itemPackage = matchedPackage ||
    (listingPackages.length <= 1 ? (listingPackages[0] || latestPackage) : null);
  if (!itemPackage?.draft) return;
  const snapshot = conversationSnapshot();
  if (!snapshot.buyerMessage) return;
  const fingerprint = simpleHash(`${location.href}|${snapshot.buyerMessage}`);
  const storageKey = `conversation:${simpleHash(location.href)}`;
  const prior = await chrome.storage.session.get(storageKey);
  if (prior[storageKey] === fingerprint) return;
  await chrome.storage.session.set({ [storageKey]: fingerprint });
  const match = snapshot.buyerMessage.match(/(?:offre|propose|pour|à)\s*(\d+(?:[,.]\d{1,2})?)\s*€/i);
  const payload = {
    itemId: itemPackage.jobId || `vinted-${simpleHash(itemPackage.draft.title)}`,
    itemTitle: itemPackage.draft.title,
    itemFacts: JSON.stringify({
      description: itemPackage.draft.description,
      brand: itemPackage.draft.brand,
      category: itemPackage.draft.category,
      size: itemPackage.draft.size,
      condition: itemPackage.draft.condition,
    }),
    conversationUrl: location.href,
    conversation: snapshot.conversation,
    buyerMessage: snapshot.buyerMessage,
    ...(match ? { detectedOfferPrice: Number(match[1].replace(",", ".")) } : {}),
    policy: {
      acquisitionCost: Number(itemPackage.economics?.acquisitionCost || 0),
      additionalCosts: Number(itemPackage.economics?.additionalCosts || 0),
      askingPrice: Number(itemPackage.draft.price),
      minProfit: Number(itemPackage.economics?.minProfit || 15),
      minRoiPercent: Number(itemPackage.economics?.minRoiPercent || 40),
      autoNegotiate: true,
      sellerNotes: "",
    },
  };
  await chrome.runtime.sendMessage({ type: "RESALEOS_CONVERSATION", payload });
}

function findExactButton(labels, within) {
  const root = within || document;
  return [...root.querySelectorAll("button")].filter(visible).find((button) =>
    labels.includes(normalize(button.textContent)),
  );
}

async function sendBuyerMessage(text) {
  const input = findControl(
    'textarea, input[type="text"], [contenteditable="true"]',
    ["message", "ecrire", "répondre", "repondre"],
  ) || [...document.querySelectorAll("textarea, [contenteditable=true]")].filter(visible).at(-1);
  if (!input) throw new Error("Champ de message introuvable.");
  setFrameworkValue(input, text);
  await pause(150);
  const send = findExactButton(["envoyer", "send"])
    || findControl("button", ["envoyer", "send"]);
  if (!send) throw new Error("Bouton Envoyer introuvable.");
  send.click();
  suppressConversationUntil = Date.now() + 20000;
  await pause(800);
  const snapshot = conversationSnapshot();
  const storageKey = `conversation:${simpleHash(location.href)}`;
  await chrome.storage.session.set({
    [storageKey]: simpleHash(`${location.href}|${snapshot.buyerMessage}`),
  });
}

async function clickOfferButton(label, price) {
  const buttons = [...document.querySelectorAll("button")].filter(visible);
  const matching = buttons.filter((button) => normalize(button.textContent).includes(label));
  const priceText = Number(price).toFixed(0);
  const scoped = matching.find((button) => {
    let parent = button.parentElement;
    for (let depth = 0; depth < 5 && parent; depth += 1, parent = parent.parentElement) {
      if (normalize(parent.innerText).includes(priceText)) return true;
    }
    return false;
  });
  const button = scoped || (matching.length === 1 ? matching[0] : null);
  if (!button) throw new Error(`Bouton ${label} lié à l'offre introuvable.`);
  button.click();
  await pause(300);
  const confirm = findExactButton(["confirmer", "oui, accepter", "confirm"]);
  if (confirm) confirm.click();
}

async function executeOfferAction(action) {
  const executionKey = `executedAction:${action.id}`;
  const alreadyExecuted = await chrome.storage.local.get(executionKey);
  if (alreadyExecuted[executionKey]) {
    return { ok: true, executed: action.decision, alreadyExecuted: true };
  }
  const current = `${location.origin}${location.pathname}`.replace(/\/$/, "");
  const expectedUrl = new URL(action.conversationUrl);
  const expected = `${expectedUrl.origin}${expectedUrl.pathname}`.replace(/\/$/, "");
  if (current !== expected) throw new Error("La conversation ouverte ne correspond pas à l'offre.");
  if (action.decision === "accept_offer") {
    await clickOfferButton("accepter", action.offerPrice);
    await chrome.storage.local.set({ [executionKey]: new Date().toISOString() });
    return { ok: true, executed: "accept_offer" };
  }
  if (action.decision === "decline_offer") {
    try {
      await clickOfferButton("refuser", action.offerPrice);
    } catch {
      await sendBuyerMessage(action.executionText);
    }
    await chrome.storage.local.set({ [executionKey]: new Date().toISOString() });
    return { ok: true, executed: "decline_offer" };
  }
  await sendBuyerMessage(action.executionText);
  await chrome.storage.local.set({ [executionKey]: new Date().toISOString() });
  return { ok: true, executed: "counter_offer" };
}

let monitorTimer;
const observer = new MutationObserver(() => {
  clearTimeout(monitorTimer);
  monitorTimer = setTimeout(() => {
    if (messagePage()) void evaluateVisibleConversation().catch(() => undefined);
    const candidates = extractListings();
    if (candidates.length) {
      void chrome.runtime.sendMessage({ type: "RESALEOS_AUTO_SOURCE", candidates });
    }
  }, 2600);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => {
  if (messagePage()) void evaluateVisibleConversation().catch(() => undefined);
  const candidates = extractListings();
  if (candidates.length) {
    void chrome.runtime.sendMessage({ type: "RESALEOS_AUTO_SOURCE", candidates });
  }
}, 1800);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "RESALEOS_FILL_LISTING") {
        sendResponse(await fillListing(message.payload, Boolean(message.autoPublish)));
        return;
      }
      if (message?.type === "RESALEOS_EXTRACT_LISTINGS") {
        sendResponse({ ok: true, candidates: extractListings() });
        return;
      }
      if (message?.type === "RESALEOS_SEND_MESSAGE") {
        await sendBuyerMessage(message.text);
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "RESALEOS_EXECUTE_ACTION") {
        sendResponse(await executeOfferAction(message.action));
        return;
      }
      sendResponse({ ok: false, error: "Commande inconnue." });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});
