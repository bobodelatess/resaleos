import { analyzeGarment, draftBuyerReply, type AutomationImage } from "./ai";
import {
  appendPhoto,
  getSession,
  resetSession,
  saveAnalysis,
  setContext,
} from "./session-store";
import type { GarmentAnalysis } from "./schemas";

interface TelegramPhotoSize {
  file_id: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN n'est pas configuré.");
  return token;
}

async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(body.description || `Telegram a répondu ${response.status}.`);
  }
  return body.result;
}

export async function sendTelegramText(chatId: string, text: string): Promise<void> {
  const chunks = text.match(/[\s\S]{1,3900}/g) || [text];
  for (const chunk of chunks) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    });
  }
}

async function downloadTelegramPhoto(fileId: string): Promise<AutomationImage> {
  const file = await telegramApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram n'a pas fourni le chemin de la photo.");
  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken()}/${file.file_path}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Téléchargement Telegram impossible (${response.status}).`);
  const mediaType = response.headers.get("content-type") || "image/jpeg";
  return { data: new Uint8Array(await response.arrayBuffer()), mediaType };
}

function formatAnalysis(analysis: GarmentAnalysis): string {
  const id = analysis.identification;
  const resale = analysis.resale;
  const inspection = analysis.inspection;
  const sourcing = analysis.sourcing;
  return [
    "ANNONCE PRÊTE À VÉRIFIER",
    "",
    analysis.listing.title,
    `${analysis.listing.price.toFixed(0)} € · colis ${analysis.listing.packageSize.toLowerCase()}`,
    "",
    analysis.listing.description,
    "",
    "ANALYSE",
    `Marque : ${id.brand || "à vérifier"}`,
    `Modèle : ${id.model || "à vérifier"}`,
    `Catégorie : ${id.category}`,
    `Taille : ${id.size || "à vérifier"}`,
    `Prix prudent / attendu / haut : ${resale.priceLow.toFixed(0)} / ${resale.expectedPrice.toFixed(0)} / ${resale.priceHigh.toFixed(0)} €`,
    `Confiance prix : ${Math.round(resale.confidence * 100)} %`,
    `Risque : ${sourcing.riskLevel}`,
    inspection.visibleDefects.length
      ? `Défauts visibles : ${inspection.visibleDefects.join(" ; ")}`
      : "Défauts visibles : aucun détecté sur les photos fournies (à contrôler physiquement)",
    inspection.needsVerification.length
      ? `À vérifier : ${inspection.needsVerification.join(" ; ")}`
      : "",
    analysis.photoPlan.missingShots.length
      ? `Photos manquantes : ${analysis.photoPlan.missingShots.join(" ; ")}`
      : "",
    "",
    "Contrôle l'article réel avant publication. L'IA ne certifie ni l'authenticité ni les défauts hors champ.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function analyzeTelegramSession(chatId: string): Promise<void> {
  const session = await getSession(chatId);
  if (!session.photos.length) {
    await sendTelegramText(chatId, "Aucune photo reçue. Envoie 1 à 8 photos, puis /go.");
    return;
  }

  try {
    const images = await Promise.all(session.photos.map(downloadTelegramPhoto));
    const analysis = await analyzeGarment({ images, context: session.context });
    await saveAnalysis(chatId, analysis);
    await sendTelegramText(chatId, formatAnalysis(analysis));
  } catch (error) {
    console.error("Telegram garment analysis failed", error);
    await sendTelegramText(
      chatId,
      "L'analyse a échoué. Vérifie la configuration IA puis relance /go. Les photos de cette session sont conservées.",
    );
  }
}

export async function replyFromTelegramSession(
  chatId: string,
  conversation: string,
): Promise<void> {
  const session = await getSession(chatId);
  if (!session.analysis) {
    await sendTelegramText(chatId, "Lance d'abord une analyse avec /go.");
    return;
  }
  try {
    const draft = await draftBuyerReply({
      item: session.analysis,
      conversation,
      policy: "Ne confirme aucune remise ni délai d'envoi sans validation humaine.",
    });
    await sendTelegramText(
      chatId,
      [
        "RÉPONSE À COPIER",
        "",
        draft.reply,
        "",
        draft.needsHuman ? "Validation humaine nécessaire avant envoi." : "Brouillon prêt à vérifier.",
        ...draft.warnings.map((warning) => `Attention : ${warning}`),
      ].join("\n"),
    );
  } catch (error) {
    console.error("Telegram buyer reply failed", error);
    await sendTelegramText(chatId, "Impossible de générer la réponse pour le moment.");
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;
  const chatId = String(message.chat.id);
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID?.trim();
  if (allowedChatId && chatId !== allowedChatId) return;

  const text = message.text?.trim() || "";
  const command = text.split(/\s+/, 1)[0]?.toLowerCase().replace(/@[^\s]+$/, "");

  if (command === "/start" || command === "/help") {
    await sendTelegramText(
      chatId,
      [
        "ResaleOS — assistant photo → annonce",
        "",
        "1. /new pour commencer un article",
        "2. Envoie 1 à 8 photos du vêtement",
        "3. Envoie un texte libre : prix d'achat, taille, défauts, mesures…",
        "4. /go pour générer l'analyse et l'annonce",
        "5. /reply suivi du message de l'acheteur pour préparer une réponse",
        "",
        "/status affiche le nombre de photos conservées.",
      ].join("\n"),
    );
    return;
  }

  if (command === "/new") {
    await resetSession(chatId);
    await sendTelegramText(chatId, "Nouvel article ouvert. Envoie maintenant 1 à 8 photos.");
    return;
  }

  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    const count = await appendPhoto(chatId, largest.file_id);
    if (message.caption?.trim()) await setContext(chatId, message.caption.trim());
    await sendTelegramText(
      chatId,
      `Photo ${count}/8 enregistrée.${message.caption ? " Contexte enregistré." : ""} Envoie la suite ou /go.`,
    );
    return;
  }

  if (command === "/status") {
    const session = await getSession(chatId);
    await sendTelegramText(
      chatId,
      `${session.photos.length} photo(s) · contexte ${session.context ? "présent" : "absent"} · analyse ${session.analysis ? "disponible" : "non lancée"}.`,
    );
    return;
  }

  if (command === "/go") {
    await sendTelegramText(chatId, "Analyse en cours… Je t'envoie l'annonce dès qu'elle est prête.");
    await analyzeTelegramSession(chatId);
    return;
  }

  if (command === "/reply") {
    const conversation = text.replace(/^\/reply(?:@\S+)?\s*/i, "").trim();
    if (!conversation) {
      await sendTelegramText(chatId, "Utilise : /reply puis colle le message de l'acheteur.");
      return;
    }
    await replyFromTelegramSession(chatId, conversation);
    return;
  }

  if (text) {
    await setContext(chatId, text);
    await sendTelegramText(chatId, "Contexte enregistré. Envoie d'autres photos ou lance /go.");
  }
}
