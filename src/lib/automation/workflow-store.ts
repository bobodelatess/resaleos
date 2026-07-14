import type {
  GarmentAnalysis,
  ImageAudit,
  ListingPackage,
  NegotiationAssessment,
} from "./schemas";
import { redisCommand, redisConfig } from "./session-store";

export type ListingJobStatus =
  | "analyzing"
  | "needs_more_photos"
  | "generating_images"
  | "auditing_images"
  | "needs_image_review"
  | "awaiting_listing_approval"
  | "approved_for_publish"
  | "published"
  | "failed";

export interface JobEconomics {
  acquisitionCost: number;
  additionalCosts: number;
  minProfit: number;
  minRoiPercent: number;
}

export interface GeneratedListingImage {
  role: "hero" | "front" | "back" | "detail";
  url: string;
  fidelityScore?: number;
  passed?: boolean;
  notes?: string;
}

export interface ListingJob {
  id: string;
  chatId: string;
  createdAt: string;
  updatedAt: string;
  status: ListingJobStatus;
  rawPhotoFileIds: string[];
  context: string;
  economics: JobEconomics;
  analysis?: GarmentAnalysis;
  generatedImages: GeneratedListingImage[];
  imageAudit?: ImageAudit;
  approvedAt?: string;
  publishedAt?: string;
  error?: string;
  regenerationCount: number;
}

export type OfferDecision = "accept_offer" | "counter_offer" | "decline_offer";
export type OfferActionStatus =
  | "awaiting_user"
  | "ready_for_extension"
  | "executed"
  | "rejected"
  | "failed";

export interface OfferAction {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: OfferActionStatus;
  itemId: string;
  itemTitle: string;
  conversationUrl: string;
  listingUrl?: string;
  buyerMessage: string;
  offerPrice: number;
  floorPrice: number;
  askingPrice: number;
  suggestedCounterPrice: number;
  assessment: NegotiationAssessment;
  decision?: OfferDecision;
  executionText?: string;
  executionError?: string;
}

const STORE_TTL_SECONDS = 60 * 60 * 24 * 14;
const globalStore = globalThis as typeof globalThis & {
  resaleJobs?: Map<string, ListingJob>;
  resaleActions?: Map<string, OfferAction>;
  resaleLatestJobByChat?: Map<string, string>;
  resaleLatestApprovedJobId?: string;
};
const jobs = globalStore.resaleJobs ?? new Map<string, ListingJob>();
const actions = globalStore.resaleActions ?? new Map<string, OfferAction>();
const latestByChat = globalStore.resaleLatestJobByChat ?? new Map<string, string>();
globalStore.resaleJobs = jobs;
globalStore.resaleActions = actions;
globalStore.resaleLatestJobByChat = latestByChat;

function jobKey(id: string): string {
  return `resaleos:job:${id}`;
}

function actionKey(id: string): string {
  return `resaleos:offer:${id}`;
}

async function putJson(key: string, value: unknown): Promise<void> {
  if (redisConfig()) {
    await redisCommand(["SET", key, JSON.stringify(value), "EX", STORE_TTL_SECONDS]);
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Upstash Redis est requis en production pour le moteur autonome.");
  }
}

async function getJson<T>(key: string): Promise<T | undefined> {
  if (!redisConfig()) return undefined;
  const raw = await redisCommand<string | null>(["GET", key]);
  return raw ? (JSON.parse(raw) as T) : undefined;
}

export function economicsFromContext(context: string): JobEconomics {
  const parse = (patterns: RegExp[], fallback: number): number => {
    for (const pattern of patterns) {
      const match = context.match(pattern);
      if (match?.[1]) return Number(match[1].replace(",", "."));
    }
    return fallback;
  };
  return {
    acquisitionCost: parse(
      [/(?:achat|achete|acheté|cout|coût)\s*(?::|=|à)?\s*(\d+(?:[,.]\d{1,2})?)/i],
      0,
    ),
    additionalCosts: parse(
      [/(?:frais|nettoyage|réparation|reparation)\s*(?::|=)?\s*(\d+(?:[,.]\d{1,2})?)/i],
      0,
    ),
    minProfit: parse(
      [/(?:profit|min marge|marge min)\s*(?::|=)?\s*(\d+(?:[,.]\d{1,2})?)/i],
      Number(process.env.RESALE_DEFAULT_MIN_PROFIT || 15),
    ),
    minRoiPercent: parse(
      [/(?:roi|min roi)\s*(?::|=)?\s*(\d+(?:[,.]\d{1,2})?)/i],
      Number(process.env.RESALE_DEFAULT_MIN_ROI || 40),
    ),
  };
}

export async function createListingJob({
  chatId,
  rawPhotoFileIds,
  context,
}: {
  chatId: string;
  rawPhotoFileIds: string[];
  context: string;
}): Promise<ListingJob> {
  const now = new Date().toISOString();
  const job: ListingJob = {
    id: crypto.randomUUID(),
    chatId,
    createdAt: now,
    updatedAt: now,
    status: "analyzing",
    rawPhotoFileIds,
    context,
    economics: economicsFromContext(context),
    generatedImages: [],
    regenerationCount: 0,
  };
  await saveListingJob(job);
  await setLatestJobForChat(chatId, job.id);
  return job;
}

export async function saveListingJob(job: ListingJob): Promise<void> {
  const updated = { ...job, updatedAt: new Date().toISOString() };
  jobs.set(job.id, updated);
  await putJson(jobKey(job.id), updated);
}

export async function getListingJob(id: string): Promise<ListingJob | undefined> {
  return (await getJson<ListingJob>(jobKey(id))) ?? jobs.get(id);
}

export async function setLatestJobForChat(chatId: string, id: string): Promise<void> {
  latestByChat.set(chatId, id);
  if (redisConfig()) {
    await redisCommand([
      "SET",
      `resaleos:latest-job:${chatId}`,
      id,
      "EX",
      STORE_TTL_SECONDS,
    ]);
  }
}

export async function getLatestJobForChat(chatId: string): Promise<ListingJob | undefined> {
  const id = redisConfig()
    ? await redisCommand<string | null>(["GET", `resaleos:latest-job:${chatId}`])
    : latestByChat.get(chatId);
  return id ? getListingJob(id) : undefined;
}

export async function approveListingJob(id: string): Promise<ListingJob> {
  const job = await getListingJob(id);
  if (!job) throw new Error("Article introuvable ou expiré.");
  if (job.status !== "awaiting_listing_approval") {
    throw new Error("Cet article n'est pas prêt à être approuvé.");
  }
  job.status = "approved_for_publish";
  job.approvedAt = new Date().toISOString();
  await saveListingJob(job);
  globalStore.resaleLatestApprovedJobId = id;
  if (redisConfig()) {
    await redisCommand(["SET", "resaleos:latest-approved-job", id, "EX", STORE_TTL_SECONDS]);
  }
  return job;
}

export function jobToListingPackage(job: ListingJob): ListingPackage {
  if (!job.analysis || !job.approvedAt || !job.generatedImages.length) {
    throw new Error("Le paquet de publication n'est pas complet.");
  }
  return {
    schemaVersion: 2,
    jobId: job.id,
    approvedAt: job.approvedAt,
    draft: {
      ...job.analysis.listing,
      brand: job.analysis.identification.brand,
      category: job.analysis.identification.category,
      size: job.analysis.identification.size,
      condition: job.analysis.identification.condition,
    },
    images: job.generatedImages.filter(({ passed }) => passed).map(({ url }) => url),
    economics: job.economics,
  };
}

export async function getLatestApprovedPackage(): Promise<ListingPackage | undefined> {
  const id = redisConfig()
    ? await redisCommand<string | null>(["GET", "resaleos:latest-approved-job"])
    : globalStore.resaleLatestApprovedJobId;
  if (!id) return undefined;
  const job = await getListingJob(id);
  if (!job || job.status !== "approved_for_publish") return undefined;
  return jobToListingPackage(job);
}

export async function markListingPublished(id: string): Promise<ListingJob> {
  const job = await getListingJob(id);
  if (!job) throw new Error("Article introuvable.");
  if (job.status !== "approved_for_publish") {
    throw new Error("L'article n'était pas en attente de publication.");
  }
  job.status = "published";
  job.publishedAt = new Date().toISOString();
  await saveListingJob(job);
  return job;
}

export async function saveOfferAction(action: OfferAction): Promise<void> {
  const updated = { ...action, updatedAt: new Date().toISOString() };
  actions.set(action.id, updated);
  await putJson(actionKey(action.id), updated);
  if (redisConfig()) {
    await redisCommand(["ZADD", "resaleos:offers", Date.now(), action.id]);
    await redisCommand(["EXPIRE", "resaleos:offers", STORE_TTL_SECONDS]);
  }
}

export async function getOfferAction(id: string): Promise<OfferAction | undefined> {
  return (await getJson<OfferAction>(actionKey(id))) ?? actions.get(id);
}

export async function createOfferAction(
  input: Omit<OfferAction, "id" | "createdAt" | "updatedAt" | "status">,
): Promise<OfferAction> {
  const now = new Date().toISOString();
  const action: OfferAction = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "awaiting_user",
  };
  await saveOfferAction(action);
  return action;
}

export async function decideOfferAction(
  id: string,
  decision: OfferDecision,
): Promise<OfferAction> {
  const action = await getOfferAction(id);
  if (!action) throw new Error("Offre introuvable ou expirée.");
  if (action.status !== "awaiting_user") throw new Error("Cette offre a déjà été traitée.");
  action.decision = decision;
  action.status = "ready_for_extension";
  action.executionText =
    decision === "counter_offer"
      ? `Merci pour votre offre. Je peux vous le proposer à ${action.suggestedCounterPrice.toFixed(0)} €.`
      : decision === "decline_offer"
        ? "Merci pour votre offre, mais je préfère la décliner pour le moment."
        : "";
  await saveOfferAction(action);
  return action;
}

export async function listReadyOfferActions(): Promise<OfferAction[]> {
  if (redisConfig()) {
    const ids = await redisCommand<string[]>(["ZREVRANGE", "resaleos:offers", 0, 49]);
    const loaded = await Promise.all((ids || []).map(getOfferAction));
    return loaded.filter(
      (action): action is OfferAction => action?.status === "ready_for_extension",
    );
  }
  return [...actions.values()].filter(({ status }) => status === "ready_for_extension");
}

export async function acknowledgeOfferAction(
  id: string,
  ok: boolean,
  error = "",
): Promise<OfferAction> {
  const action = await getOfferAction(id);
  if (!action) throw new Error("Action introuvable.");
  action.status = ok ? "executed" : "failed";
  action.executionError = error.slice(0, 1000);
  await saveOfferAction(action);
  return action;
}
