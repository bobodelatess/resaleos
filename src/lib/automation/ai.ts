import { generateText, Output } from "ai";
import {
  buyerReplySchema,
  garmentAnalysisSchema,
  imageAuditSchema,
  negotiationAssessmentSchema,
  sourcingRankingSchema,
  type BuyerReply,
  type GarmentAnalysis,
  type ImageAudit,
  type NegotiationAssessment,
  type NegotiationRequest,
  type SourcingCandidate,
  type SourcingProfile,
  type SourcingRanking,
} from "./schemas";
import {
  BUYER_REPLY_SYSTEM,
  GARMENT_ANALYSIS_SYSTEM,
  IMAGE_AUDIT_SYSTEM,
  NEGOTIATION_SYSTEM,
  SOURCING_SYSTEM,
} from "./prompts";

export interface AutomationImage {
  data: string | Uint8Array | ArrayBuffer | URL;
  mediaType?: string;
}

function modelId(): string {
  return process.env.RESALE_AI_MODEL?.trim() || "openai/gpt-5.6";
}

export async function analyzeGarment({
  images,
  context = "",
}: {
  images: AutomationImage[];
  context?: string;
}): Promise<GarmentAnalysis> {
  if (images.length < 1 || images.length > 8) {
    throw new Error("L'analyse nécessite entre 1 et 8 images.");
  }

  const { output } = await generateText({
    model: modelId(),
    output: Output.object({
      schema: garmentAnalysisSchema,
      name: "garment_resale_analysis",
      description: "Analyse factuelle d'un vêtement et brouillon d'annonce de seconde main",
    }),
    system: GARMENT_ANALYSIS_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: context.trim()
              ? `Analyse les photos ensemble. Contexte fourni par l'opérateur :\n${context.trim()}`
              : "Analyse les photos ensemble. Aucun contexte supplémentaire n'a été fourni.",
          },
          ...images.map((image) => ({
            type: "image" as const,
            image: image.data,
            mediaType: image.mediaType,
          })),
        ],
      },
    ],
  });

  return output;
}

export async function draftBuyerReply({
  item,
  conversation,
  policy = "",
}: {
  item: GarmentAnalysis;
  conversation: string;
  policy?: string;
}): Promise<BuyerReply> {
  const { output } = await generateText({
    model: modelId(),
    output: Output.object({
      schema: buyerReplySchema,
      name: "buyer_reply_draft",
      description: "Brouillon factuel de réponse à un acheteur",
    }),
    system: BUYER_REPLY_SYSTEM,
    prompt: [
      `Fiche article :\n${JSON.stringify(item)}`,
      `Conversation :\n${conversation}`,
      policy.trim() ? `Règles commerciales de l'opérateur :\n${policy.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return output;
}

export async function rankSourcingCandidates({
  candidates,
  profile,
}: {
  candidates: SourcingCandidate[];
  profile: SourcingProfile;
}): Promise<SourcingRanking> {
  const normalized = candidates.map((candidate) => ({
    ...candidate,
    totalPrice:
      candidate.totalPrice ??
      candidate.price + candidate.shippingPrice + candidate.buyerProtectionPrice,
  }));
  const { output } = await generateText({
    model: modelId(),
    output: Output.object({
      schema: sourcingRankingSchema,
      name: "sourcing_ranking",
      description: "Classement prudent d'annonces d'achat-revente visibles",
    }),
    system: SOURCING_SYSTEM,
    prompt: `Profil :\n${JSON.stringify(profile)}\n\nCandidats :\n${JSON.stringify(normalized)}`,
  });

  const candidateIds = new Set(normalized.map(({ id }) => id));
  const candidateById = new Map(normalized.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  const recommendations = output.recommendations
    .filter(({ candidateId }) => candidateIds.has(candidateId) && !seen.has(candidateId))
    .map((recommendation) => {
      seen.add(recommendation.candidateId);
      return recommendation;
    })
    .sort((left, right) => left.rank - right.rank)
    .map((recommendation, index) => {
      const candidate = candidateById.get(recommendation.candidateId);
      const cost = candidate?.totalPrice ?? Number.POSITIVE_INFINITY;
      const expectedProfit = recommendation.estimatedResaleExpected - cost;
      const expectedRoiPercent = cost > 0 ? (expectedProfit / cost) * 100 : -10000;
      const maximumFromProfit = recommendation.estimatedResaleExpected - profile.minProfit;
      const maximumFromRoi =
        recommendation.estimatedResaleExpected / (1 + profile.minRoiPercent / 100);
      const maximumBuyPrice = Math.max(
        0,
        Math.min(recommendation.maximumBuyPrice, maximumFromProfit, maximumFromRoi),
      );
      const thresholdsPassed =
        cost <= profile.budget &&
        cost <= maximumBuyPrice &&
        expectedProfit >= profile.minProfit &&
        expectedRoiPercent >= profile.minRoiPercent;
      return {
        ...recommendation,
        rank: index + 1,
        verdict:
          recommendation.verdict === "buy" && !thresholdsPassed
            ? ("watch" as const)
            : recommendation.verdict,
        maximumBuyPrice: Math.round(maximumBuyPrice * 100) / 100,
        expectedProfit: Math.round(expectedProfit * 100) / 100,
        expectedRoiPercent: Math.round(expectedRoiPercent * 10) / 10,
      };
    });

  if (!recommendations.length) {
    throw new Error("Le classement IA ne correspond à aucun candidat fourni.");
  }
  return { ...output, recommendations };
}

export async function auditGeneratedImages({
  originals,
  generated,
}: {
  originals: AutomationImage[];
  generated: Array<AutomationImage & { role: "hero" | "front" | "back" | "detail" }>;
}): Promise<ImageAudit> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: AutomationImage["data"]; mediaType?: string }
  > = [{ type: "text", text: "PHOTOS RÉELLES DE RÉFÉRENCE" }];

  originals.forEach((image, index) => {
    content.push({ type: "text", text: `Référence réelle ${index + 1}` });
    content.push({ type: "image", image: image.data, mediaType: image.mediaType });
  });
  content.push({ type: "text", text: "IMAGES PRÉPARÉES À AUDITER" });
  generated.forEach((image) => {
    content.push({ type: "text", text: `Rôle : ${image.role}` });
    content.push({ type: "image", image: image.data, mediaType: image.mediaType });
  });

  const { output } = await generateText({
    model: modelId(),
    output: Output.object({
      schema: imageAuditSchema,
      name: "listing_image_fidelity_audit",
      description: "Contrôle de fidélité entre photos réelles et images d'annonce",
    }),
    system: IMAGE_AUDIT_SYSTEM,
    messages: [{ role: "user", content }],
  });

  const auditedRoles = new Set(output.images.map(({ role }) => role));
  const allRolesAudited = generated.every(({ role }) => auditedRoles.has(role));
  return {
    ...output,
    overallPassed:
      output.overallPassed && allRolesAudited && output.images.every(({ passed }) => passed),
  };
}

export async function assessNegotiation(
  request: NegotiationRequest,
  floorPrice: number,
): Promise<NegotiationAssessment> {
  const { output } = await generateText({
    model: modelId(),
    output: Output.object({
      schema: negotiationAssessmentSchema,
      name: "negotiation_assessment",
      description: "Analyse factuelle d'un message acheteur et proposition de réponse",
    }),
    system: NEGOTIATION_SYSTEM,
    prompt: [
      `Article : ${request.itemTitle}`,
      `Faits : ${request.itemFacts || "aucun fait supplémentaire"}`,
      `Politique : ${JSON.stringify(request.policy)}`,
      `Plancher déterministe : ${floorPrice.toFixed(2)} €`,
      `Conversation :\n${request.conversation}`,
      `Dernier message acheteur :\n${request.buyerMessage}`,
      request.detectedOfferPrice !== undefined
        ? `Prix détecté par l'extension : ${request.detectedOfferPrice.toFixed(2)} €`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return output;
}
