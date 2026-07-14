import type { ItemCondition, ListingDraft, Opportunity } from "./types";

export const conditionLabels: Record<ItemCondition, string> = {
  new_with_tags: "Neuf avec étiquette",
  new_without_tags: "Neuf sans étiquette",
  very_good: "Très bon état",
  good: "Bon état",
  satisfactory: "Satisfaisant",
};

export function generateSku(item: Opportunity, index = 1): string {
  const brand = (item.brand || "ART")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(3, "X");
  const model = (item.model || item.category || "ITEM")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(3, "X");
  return `${brand}-${model}-${String(index).padStart(4, "0")}`;
}

export function generateListing(item: Opportunity): ListingDraft {
  const titleParts = [item.brand, item.model, item.category, item.size]
    .map((part) => part.trim())
    .filter(Boolean);
  const title = titleParts.join(" · ").slice(0, 100);
  const condition = conditionLabels[item.condition];
  const notes = item.notes.trim();
  const observedDescription = item.description.trim();

  const lines = [
    title || item.title,
    "",
    `État : ${condition}.`,
    item.size ? `Taille : ${item.size}.` : "",
    observedDescription ? `Description : ${observedDescription}` : "",
    notes ? `À noter : ${notes}` : "",
    "",
    "Photos de l’article réel. Les éventuels défauts visibles sont montrés et décrits.",
  ].filter((line) => line !== "");

  return {
    title: title || item.title || "Article de seconde main",
    description: lines.join("\n"),
    price: item.expectedSalePrice,
    packageSize: "Moyen",
  };
}

export function extractHints(text: string): {
  brand?: string;
  size?: string;
  condition?: ItemCondition;
} {
  const normalized = text.toLowerCase();
  const brands = [
    "Carhartt",
    "Levi's",
    "Levis",
    "Nike",
    "Adidas",
    "New Balance",
    "Patagonia",
    "Ralph Lauren",
    "The North Face",
    "Lacoste",
    "Zara",
    "Uniqlo",
  ];
  const brand = brands.find((candidate) =>
    normalized.includes(candidate.toLowerCase()),
  );
  const sizeMatch = text.match(
    /(?:taille\s*[:\-]?\s*)?(XXS|XS|S|M|L|XL|XXL|\d{2}(?:[,.]\d)?(?:\s*\/\s*\d{1,2})?|W\d{2}\s*L\d{2})\b/i,
  );

  let condition: ItemCondition | undefined;
  if (/neuf.*étiquette/i.test(text)) condition = "new_with_tags";
  else if (/neuf/i.test(text)) condition = "new_without_tags";
  else if (/très bon/i.test(text)) condition = "very_good";
  else if (/bon état/i.test(text)) condition = "good";
  else if (/satisfaisant/i.test(text)) condition = "satisfactory";

  return {
    brand: brand === "Levis" ? "Levi's" : brand,
    size: sizeMatch?.[1]?.toUpperCase(),
    condition,
  };
}

