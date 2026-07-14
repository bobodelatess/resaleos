import { z } from "zod";

export const itemConditionSchema = z.enum([
  "new_with_tags",
  "new_without_tags",
  "very_good",
  "good",
  "satisfactory",
]);

export const riskLevelSchema = z.enum(["low", "moderate", "high"]);

export const garmentAnalysisSchema = z.object({
  identification: z.object({
    title: z.string().min(3).max(100).describe("Titre factuel en français"),
    brand: z.string().max(80).describe("Chaîne vide si la marque n'est pas lisible"),
    model: z.string().max(100).describe("Chaîne vide si le modèle n'est pas identifiable"),
    category: z.string().min(2).max(80),
    size: z.string().max(40).describe("Chaîne vide si la taille n'est pas lisible"),
    condition: itemConditionSchema,
    colors: z.array(z.string().max(40)).max(5),
    materials: z.array(z.string().max(60)).max(6),
  }),
  inspection: z.object({
    visibleFacts: z.array(z.string().max(220)).max(12),
    visibleDefects: z.array(z.string().max(220)).max(12),
    labelsRead: z.array(z.string().max(180)).max(10),
    needsVerification: z.array(z.string().max(220)).max(10),
    authenticityWarning: z.string().max(500),
  }),
  resale: z
    .object({
      priceLow: z.number().min(0).max(100000),
      expectedPrice: z.number().min(0).max(100000),
      priceHigh: z.number().min(0).max(100000),
      probability30d: z.number().min(0).max(1),
      estimatedDaysToSell: z.number().int().min(1).max(730),
      confidence: z.number().min(0).max(1),
      rationale: z.string().min(10).max(800),
    })
    .refine(
      ({ priceLow, expectedPrice, priceHigh }) =>
        priceLow <= expectedPrice && expectedPrice <= priceHigh,
      { message: "Les prix doivent respecter priceLow <= expectedPrice <= priceHigh." },
    ),
  sourcing: z.object({
    riskLevel: riskLevelSchema,
    riskReasons: z.array(z.string().max(220)).max(8),
    questionsForSeller: z.array(z.string().max(220)).max(8),
  }),
  listing: z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(20).max(3000),
    price: z.number().min(0).max(100000),
    packageSize: z.enum(["Petit", "Moyen", "Grand"]),
  }),
  photoPlan: z.object({
    keepOriginals: z.array(z.number().int().min(1).max(8)).max(8),
    missingShots: z.array(z.string().max(180)).max(8),
    safeEdits: z.array(z.string().max(180)).max(8),
  }),
  overallConfidence: z.number().min(0).max(1),
});

export const buyerReplySchema = z.object({
  reply: z.string().min(1).max(1200),
  intent: z.enum([
    "information",
    "measurements",
    "condition",
    "negotiation",
    "shipping",
    "other",
  ]),
  confidence: z.number().min(0).max(1),
  needsHuman: z.boolean(),
  warnings: z.array(z.string().max(220)).max(6),
});

export const analyzeRequestSchema = z.object({
  images: z.array(z.string()).min(1).max(8),
  context: z.string().max(6000).optional().default(""),
});

export const replyRequestSchema = z.object({
  item: garmentAnalysisSchema,
  conversation: z.string().min(1).max(8000),
  policy: z.string().max(2000).optional().default(""),
});

export type GarmentAnalysis = z.infer<typeof garmentAnalysisSchema>;
export type BuyerReply = z.infer<typeof buyerReplySchema>;
