import {
  analyzeGarment,
  auditGeneratedImages,
  draftBuyerReply,
  type AutomationImage,
} from "./ai";
import {
  createListingImages,
  uploadListingImages,
} from "./image-generation";
import type { NegotiationResult } from "./negotiation";
import {
  appendPhoto,
  getSession,
  resetSession,
  saveAnalysis,
  setContext,
} from "./session-store";
import type {
  GarmentAnalysis,
  NegotiationRequest,
  SourcingCandidate,
  SourcingRanking,
} from "./schemas";
import {
  approveListingJob,
  createListingJob,
  decideOfferAction,
  getLatestJobForChat,
  getListingJob,
  saveListingJob,
  type ListingJob,
  type OfferDecision,
} from "./workflow-store";

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

interface TelegramCallbackQuery {
  id: string;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

type InlineKeyboard = Array<Array<{ text: string; callback_data: string }>>;

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN n'est pas configuré.");
  return token;
}

function configuredChatId(): string | undefined {
  return process.env.TELEGRAM_ALLOWED_CHAT_ID?.trim() || undefined;
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

export async function sendTelegramText(
  chatId: string,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const chunks = text.match(/[\s\S]{1,3900}/g) || [text];
  for (const [index, chunk] of chunks.entries()) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
      ...(keyboard && index === chunks.length - 1
        ? { reply_markup: { inline_keyboard: keyboard } }
        : {}),
    });
  }
}

async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string,
): Promise<void> {
  await telegramApi("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption.slice(0, 1000),
  });
}

export async function downloadTelegramPhoto(fileId: string): Promise<AutomationImage> {
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
  return [
    "ANALYSE DE L'ARTICLE",
    "",
    analysis.listing.title,
    `${analysis.listing.price.toFixed(0)} € · colis ${analysis.listing.packageSize.toLowerCase()}`,
    `Marque : ${id.brand || "à vérifier"}`,
    `Taille : ${id.size || "à vérifier"}`,
    `Prix prudent / attendu / haut : ${resale.priceLow.toFixed(0)} / ${resale.expectedPrice.toFixed(0)} / ${resale.priceHigh.toFixed(0)} €`,
    `Confiance prix : ${Math.round(resale.confidence * 100)} %`,
    inspection.visibleDefects.length
      ? `Défauts visibles : ${inspection.visibleDefects.join(" ; ")}`
      : "Défauts visibles : aucun détecté sur les vues reçues",
    inspection.needsVerification.length
      ? `À vérifier : ${inspection.needsVerification.join(" ; ")}`
      : "",
    analysis.photoPlan.missingShots.length
      ? `Photos à reprendre : ${analysis.photoPlan.missingShots.join(" ; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function listingKeyboard(jobId: string): InlineKeyboard {
  return [
    [
      { text: "✅ Approuver et publier", callback_data: `listing:approve:${jobId}` },
      { text: "🔄 Régénérer", callback_data: `listing:regen:${jobId}` },
    ],
    [{ text: "📷 Reprendre les photos", callback_data: `listing:redo:${jobId}` }],
  ];
}

async function generateAuditAndPresent(
  job: ListingJob,
  references?: AutomationImage[],
): Promise<void> {
  const photos =
    references ?? (await Promise.all(job.rawPhotoFileIds.map(downloadTelegramPhoto)));
  if (!job.analysis) throw new Error("L'analyse de l'article manque.");

  job.status = "generating_images";
  job.error = undefined;
  await saveListingJob(job);
  await sendTelegramText(
    job.chatId,
    "Création des trois photos d'annonce avec GPT Image 2… Cela peut prendre jusqu'à deux minutes.",
  );

  const generated = await createListingImages({ references: photos, analysis: job.analysis });
  job.status = "auditing_images";
  await saveListingJob(job);
  const audit = await auditGeneratedImages({
    originals: photos,
    generated: generated.map((image) => ({
      role: image.role,
      data: image.bytes,
      mediaType: image.mediaType,
    })),
  });
  job.imageAudit = audit;

  if (!audit.overallPassed) {
    job.status = "needs_image_review";
    job.generatedImages = [];
    await saveListingJob(job);
    await sendTelegramText(
      job.chatId,
      [
        "⛔ PUBLICATION BLOQUÉE PAR LE CONTRÔLE PHOTO",
        audit.summary,
        ...audit.images
          .filter(({ passed }) => !passed)
          .map(({ role, changedElements, notes }) =>
            `${role} : ${[...changedElements, notes].filter(Boolean).join(" ; ")}`,
          ),
        "Aucune de ces images n'a été libérée vers Vinted.",
      ].join("\n"),
      [
        [{ text: "🔄 Nouvelle génération", callback_data: `listing:regen:${job.id}` }],
        [{ text: "📷 Reprendre les photos", callback_data: `listing:redo:${job.id}` }],
      ],
    );
    return;
  }

  const uploaded = await uploadListingImages(job.id, generated);
  job.generatedImages = uploaded.map(({ role, url }) => {
    const report = audit.images.find((entry) => entry.role === role);
    return {
      role,
      url,
      fidelityScore: report?.fidelityScore,
      passed: report?.passed ?? false,
      notes: report?.notes,
    };
  });
  job.status = "awaiting_listing_approval";
  await saveListingJob(job);

  for (const image of job.generatedImages) {
    await sendTelegramPhoto(
      job.chatId,
      image.url,
      `${image.role.toUpperCase()} · fidélité ${Math.round((image.fidelityScore || 0) * 100)} %`,
    );
  }
  await sendTelegramText(
    job.chatId,
    [
      "ANNONCE PRÊTE",
      "",
      job.analysis.listing.title,
      `${job.analysis.listing.price.toFixed(0)} €`,
      "",
      job.analysis.listing.description,
      "",
      `Coût d'achat détecté : ${job.economics.acquisitionCost.toFixed(2)} €${
        job.economics.acquisitionCost === 0
          ? " — attention, renseigne-le pour sécuriser les négociations"
          : ""
      }`,
      "Après approbation, l'extension récupère ce paquet et remplit Vinted.",
    ].join("\n"),
    listingKeyboard(job.id),
  );
}

export async function analyzeTelegramSession(chatId: string): Promise<void> {
  const session = await getSession(chatId);
  if (!session.photos.length) {
    await sendTelegramText(chatId, "Aucune photo reçue. Envoie 1 à 8 photos, puis /go.");
    return;
  }

  const job = await createListingJob({
    chatId,
    rawPhotoFileIds: session.photos,
    context: session.context,
  });
  try {
    const images = await Promise.all(session.photos.map(downloadTelegramPhoto));
    const analysis = await analyzeGarment({ images, context: session.context });
    job.analysis = analysis;
    await saveAnalysis(chatId, analysis);
    await sendTelegramText(chatId, formatAnalysis(analysis));

    if (!analysis.photoPlan.readyForGeneration) {
      job.status = "needs_more_photos";
      await saveListingJob(job);
      await sendTelegramText(
        chatId,
        [
          "Il manque des vues pour produire des photos fidèles.",
          ...analysis.photoPlan.blockers.map((blocker) => `• ${blocker}`),
          "Envoie les vues demandées puis relance /go.",
        ].join("\n"),
      );
      return;
    }
    await generateAuditAndPresent(job, images);
  } catch (error) {
    console.error("Telegram listing workflow failed", error);
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    await saveListingJob(job);
    await sendTelegramText(
      chatId,
      `Le traitement a échoué : ${job.error}. Les photos de la session sont conservées.`,
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
      policy: "Ne confirme aucune remise ni délai d'envoi sans information factuelle.",
    });
    await sendTelegramText(
      chatId,
      [
        "RÉPONSE PROPOSÉE",
        draft.reply,
        draft.needsHuman ? "Une vérification humaine est nécessaire." : "Réponse factuelle prête.",
        ...draft.warnings.map((warning) => `Attention : ${warning}`),
      ].join("\n\n"),
    );
  } catch (error) {
    console.error("Telegram buyer reply failed", error);
    await sendTelegramText(chatId, "Impossible de générer la réponse pour le moment.");
  }
}

export async function sendSourcingRecommendations(
  candidates: SourcingCandidate[],
  ranking: SourcingRanking,
): Promise<void> {
  const chatId = configuredChatId();
  if (!chatId) return;
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const top = ranking.recommendations
    .filter(({ verdict }) => verdict !== "skip")
    .slice(0, 5);
  await sendTelegramText(
    chatId,
    [
      "MEILLEURES OPPORTUNITÉS VISIBLES",
      top.length ? "" : "Aucun achat recommandé dans cette page.",
      ...top.flatMap((recommendation) => {
        const candidate = byId.get(recommendation.candidateId);
        if (!candidate) return [];
        const total =
          candidate.totalPrice ??
          candidate.price + candidate.shippingPrice + candidate.buyerProtectionPrice;
        return [
          `#${recommendation.rank} ${recommendation.verdict === "buy" ? "ACHETER" : "SURVEILLER"} — ${candidate.title}`,
          `Coût ${total.toFixed(2)} € · revente attendue ${recommendation.estimatedResaleExpected.toFixed(0)} € · profit ${recommendation.expectedProfit.toFixed(0)} € · ROI ${recommendation.expectedRoiPercent.toFixed(0)} %`,
          `Pourquoi : ${recommendation.reasons.join(" ; ")}`,
          recommendation.risks.length ? `Risques : ${recommendation.risks.join(" ; ")}` : "",
          candidate.url,
          "",
        ];
      }),
      ranking.marketCaveat,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
}

export async function sendNegotiationNotification(
  request: NegotiationRequest,
  result: NegotiationResult,
): Promise<void> {
  const chatId = configuredChatId();
  if (!chatId) return;
  if (result.execution.mode === "needs_user" && result.action) {
    const action = result.action;
    await sendTelegramText(
      chatId,
      [
        "💶 OFFRE INTÉRESSANTE À DÉCIDER",
        request.itemTitle,
        `Offre : ${action.offerPrice.toFixed(2)} €`,
        `Plancher : ${action.floorPrice.toFixed(2)} € · prix affiché : ${action.askingPrice.toFixed(2)} €`,
        `Message : ${request.buyerMessage}`,
        result.assessment.rationale,
      ].join("\n"),
      [[
        { text: "✅ Accepter", callback_data: `offer:accept:${action.id}` },
        { text: `↗️ ${action.suggestedCounterPrice.toFixed(0)} €`, callback_data: `offer:counter:${action.id}` },
        { text: "❌ Refuser", callback_data: `offer:decline:${action.id}` },
      ]],
    );
    return;
  }

  await sendTelegramText(
    chatId,
    [
      result.execution.mode === "needs_physical_check"
        ? "🔎 VÉRIFICATION PHYSIQUE NÉCESSAIRE"
        : "MESSAGE À CONTRÔLER",
      request.itemTitle,
      request.buyerMessage,
      `Réponse proposée : ${
        "text" in result.execution
          ? result.execution.text
          : "Décision humaine requise dans Telegram."
      }`,
    ].join("\n"),
  );
}

async function handleListingCallback(
  chatId: string,
  callbackId: string,
  action: string,
  jobId: string,
): Promise<void> {
  const job = await getListingJob(jobId);
  if (!job || job.chatId !== chatId) throw new Error("Article introuvable.");

  if (action === "approve") {
    await approveListingJob(jobId);
    await telegramApi("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Annonce approuvée",
    });
    await sendTelegramText(
      chatId,
      "✅ Annonce approuvée. L'extension ResaleOS peut maintenant la récupérer, remplir Vinted et publier si l'option correspondante est activée.",
    );
    return;
  }

  if (action === "regen") {
    if (job.regenerationCount >= 2) {
      throw new Error("Deux régénérations ont déjà été tentées. Reprends les photos réelles.");
    }
    job.regenerationCount += 1;
    await saveListingJob(job);
    await telegramApi("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Nouvelle génération lancée",
    });
    await generateAuditAndPresent(job);
    return;
  }

  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: "Envoie de nouvelles photos après /new",
  });
  await sendTelegramText(
    chatId,
    "Utilise /new, reprends les vues demandées et indique le coût d'achat dans la légende, par exemple : achat 24 €, aucun défaut supplémentaire.",
  );
}

async function handleOfferCallback(
  chatId: string,
  callbackId: string,
  action: string,
  offerId: string,
): Promise<void> {
  const decisionByAction: Record<string, OfferDecision> = {
    accept: "accept_offer",
    counter: "counter_offer",
    decline: "decline_offer",
  };
  const decision = decisionByAction[action];
  if (!decision) throw new Error("Décision inconnue.");
  const offer = await decideOfferAction(offerId, decision);
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: "Décision enregistrée",
  });
  await sendTelegramText(
    chatId,
    `Décision enregistrée pour ${offer.itemTitle}. L'extension l'exécutera dès que la conversation Vinted correspondante sera ouverte.`,
  );
}

async function handleCallback(query: TelegramCallbackQuery): Promise<void> {
  const chatId = query.message ? String(query.message.chat.id) : "";
  const allowed = configuredChatId();
  if (!chatId || (allowed && chatId !== allowed) || !query.data) return;
  const [scope, action, id] = query.data.split(":");
  try {
    if (scope === "listing") {
      await handleListingCallback(chatId, query.id, action, id);
    } else if (scope === "offer") {
      await handleOfferCallback(chatId, query.id, action, id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action impossible.";
    await telegramApi("answerCallbackQuery", {
      callback_query_id: query.id,
      text: message.slice(0, 180),
      show_alert: true,
    });
  }
}

async function appendSessionContext(chatId: string, value: string): Promise<void> {
  const session = await getSession(chatId);
  await setContext(chatId, [session.context, value.trim()].filter(Boolean).join("\n"));
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  const message = update.message;
  if (!message) return;
  const chatId = String(message.chat.id);
  const allowedChatId = configuredChatId();
  if (allowedChatId && chatId !== allowedChatId) return;

  const text = message.text?.trim() || "";
  const command = text.split(/\s+/, 1)[0]?.toLowerCase().replace(/@[^\s]+$/, "");

  if (command === "/start" || command === "/help") {
    await sendTelegramText(
      chatId,
      [
        "ResaleOS — agent achat → annonce → négociation",
        "",
        "1. /new",
        "2. Envoie 3 à 8 photos : face, dos, étiquette, taille et défauts",
        "3. Ajoute en légende : achat 24 €, taille M, défaut…",
        "4. /go : analyse, photos d'annonce, contrôle de fidélité",
        "5. Approuve avec le bouton reçu",
        "",
        "L'extension classe aussi les annonces visibles et gère les messages. Les offres rentables arrivent ici avec Accepter / Contre-proposer / Refuser.",
        "",
        "/status affiche l'étape en cours. /reply reste disponible pour un message manuel.",
      ].join("\n"),
    );
    return;
  }

  if (command === "/new") {
    await resetSession(chatId);
    await sendTelegramText(
      chatId,
      "Nouvel article ouvert. Envoie les photos réelles ; elles servent de preuve et ne seront jamais remplacées si le contrôle de fidélité échoue.",
    );
    return;
  }

  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    const count = await appendPhoto(chatId, largest.file_id);
    if (message.caption?.trim()) await appendSessionContext(chatId, message.caption.trim());
    await sendTelegramText(
      chatId,
      `Photo ${count}/8 enregistrée.${message.caption ? " Contexte ajouté." : ""} Envoie la suite ou /go.`,
    );
    return;
  }

  if (command === "/status") {
    const [session, job] = await Promise.all([
      getSession(chatId),
      getLatestJobForChat(chatId),
    ]);
    await sendTelegramText(
      chatId,
      `${session.photos.length} photo(s) · contexte ${session.context ? "présent" : "absent"} · dernière étape ${job?.status || "aucune"}.`,
    );
    return;
  }

  if (command === "/go") {
    await sendTelegramText(
      chatId,
      "Analyse lancée. Si les vues sont suffisantes, les images et leur audit s'enchaînent automatiquement.",
    );
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
    await appendSessionContext(chatId, text);
    await sendTelegramText(chatId, "Contexte ajouté. Envoie d'autres photos ou lance /go.");
  }
}
