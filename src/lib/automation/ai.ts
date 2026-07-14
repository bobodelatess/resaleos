import { generateText, Output } from "ai";
import {
  buyerReplySchema,
  garmentAnalysisSchema,
  type BuyerReply,
  type GarmentAnalysis,
} from "./schemas";
import { BUYER_REPLY_SYSTEM, GARMENT_ANALYSIS_SYSTEM } from "./prompts";

export interface AutomationImage {
  data: string | Uint8Array | ArrayBuffer | URL;
  mediaType?: string;
}

function modelId(): string {
  return process.env.RESALE_AI_MODEL?.trim() || "openai/gpt-5.4";
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
