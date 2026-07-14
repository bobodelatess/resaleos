function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function searchableText(element) {
  const id = element.id;
  const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  return normalize([
    element.name,
    element.id,
    element.placeholder,
    element.getAttribute("aria-label"),
    label?.textContent,
    element.closest("label")?.textContent,
    element.parentElement?.textContent?.slice(0, 180),
  ].filter(Boolean).join(" "));
}

function findControl(selectors, terms) {
  const elements = [...document.querySelectorAll(selectors)].filter(
    (element) => !element.disabled && element.offsetParent !== null,
  );
  return elements.find((element) => terms.some((term) => searchableText(element).includes(term)));
}

function setFrameworkValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, String(value));
  else element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
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
  const input = document.querySelector('input[type="file"][accept*="image"], input[type="file"][multiple]');
  if (!input || !images?.length) return false;
  const transfer = new DataTransfer();
  const files = await Promise.all(images.slice(0, 8).map(dataUrlToFile));
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "RESALEOS_FILL_LISTING") return false;

  void (async () => {
    try {
      const { draft, images } = message.payload;
      const filled = [];
      const title = findControl("input:not([type=file]):not([type=hidden])", ["titre", "title"]);
      const description = findControl("textarea", ["description", "decris", "décris"])
        || document.querySelector("textarea");
      const price = findControl('input:not([type=file]):not([type=hidden])', ["prix", "price"]);

      if (title) { setFrameworkValue(title, draft.title); filled.push("titre"); }
      if (description) { setFrameworkValue(description, draft.description); filled.push("description"); }
      if (price) { setFrameworkValue(price, Number(draft.price).toFixed(2).replace(".", ",")); filled.push("prix"); }
      if (await fillPhotos(images)) filled.push(`${images.length} photo(s)`);

      sendResponse({ ok: true, filled });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});
