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
    readyForGeneration: z.boolean(),
    keepOriginals: z.array(z.number().int().min(1).max(8)).max(8),
    missingShots: z.array(z.string().max(180)).max(8),
    safeEdits: z.array(z.string().max(180)).max(8),
    blockers: z.array(z.string().max(220)).max(8),
  }),
  overallConfidence: z.number().min(0).max(1),
});

export const sourcingCandidateSchema = z.object({
  id: z.string().min(1).max(240),
  url: z.string().url(),
  title: z.string().min(1).max(300),
  price: z.number().min(0).max(100000),
  shippingPrice: z.number().min(0).max(10000).optional().default(0),
  buyerProtectionPrice: z.number().min(0).max(10000).optional().default(0),
  totalPrice: z.number().min(0).max(100000).optional(),
  brand: z.string().max(100).optional().default(""),
  size: z.string().max(60).optional().default(""),
  condition: z.string().max(100).optional().default(""),
  description: z.string().max(2500).optional().default(""),
  imageUrl: z.string().url().optional(),
});

export const sourcingProfileSchema = z.object({
  budget: z.number().min(0).max(100000).default(300),
  minProfit: z.number().min(0).max(100000).default(15),
  minRoiPercent: z.number().min(0).max(10000).default(40),
  maxRisk: riskLevelSchema.default("moderate"),
  preferredCategories: z.array(z.string().max(100)).max(20).default([]),
  excludedBrands: z.array(z.string().max(100)).max(50).default([]),
  notes: z.string().max(2000).default(""),
});

export const sourcingRequestSchema = z.object({
  candidates: z.array(sourcingCandidateSchema).min(1).max(30),
  profile: sourcingProfileSchema.optional().default({
    budget: 300,
    minProfit: 15,
    minRoiPercent: 40,
    maxRisk: "moderate",
    preferredCategories: [],
    excludedBrands: [],
    notes: "",
  }),
  notify: z.boolean().optional().default(true),
});

export const sourcingRecommendationSchema = z.object({
  candidateId: z.string().min(1).max(240),
  rank: z.number().int().min(1).max(30),
  verdict: z.enum(["buy", "watch", "skip"]),
  estimatedResaleLow: z.number().min(0).max(100000),
  estimatedResaleExpected: z.number().min(0).max(100000),
  estimatedResaleHigh: z.number().min(0).max(100000),
  maximumBuyPrice: z.number().min(0).max(100000),
  expectedProfit: z.number().min(-100000).max(100000),
  expectedRoiPercent: z.number().min(-10000).max(10000),
  saleProbability30d: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().max(240)).min(1).max(6),
  risks: z.array(z.string().max(240)).max(6),
  checksBeforeBuying: z.array(z.string().max(240)).max(6),
});

export const sourcingRankingSchema = z.object({
  marketCaveat: z.string().min(10).max(600),
  recommendations: z.array(sourcingRecommendationSchema).min(1).max(30),
});

export const imageAuditSchema = z.object({
  overallPassed: z.boolean(),
  summary: z.string().min(5).max(700),
  images: z.array(
    z.object({
      role: z.enum(["hero", "front", "back", "detail"]),
      passed: z.boolean(),
      fidelityScore: z.number().min(0).max(1),
      garmentChanged: z.boolean(),
      defectsPreserved: z.boolean(),
      changedElements: z.array(z.string().max(220)).max(10),
      notes: z.string().max(500),
    }),
  ).min(1).max(8),
});

export const negotiationPolicySchema = z.object({
  acquisitionCost: z.number().min(0).max(100000),
  additionalCosts: z.number().min(0).max(100000).default(0),
  askingPrice: z.number().min(0).max(100000),
  minProfit: z.number().min(0).max(100000).default(15),
  minRoiPercent: z.number().min(0).max(10000).default(40),
  autoNegotiate: z.boolean().default(true),
  sellerNotes: z.string().max(2000).default(""),
});

export const negotiationRequestSchema = z.object({
  itemId: z.string().min(1).max(240),
  itemTitle: z.string().min(1).max(300),
  itemFacts: z.string().max(6000).default(""),
  listingUrl: z.string().url().optional(),
  conversationUrl: z.string().url(),
  conversation: z.string().min(1).max(12000),
  buyerMessage: z.string().min(1).max(3000),
  detectedOfferPrice: z.number().min(0).max(100000).optional(),
  policy: negotiationPolicySchema,
});

export const negotiationAssessmentSchema = z.object({
  intent: z.enum([
    "offer",
    "condition_question",
    "measurement_question",
    "shipping_question",
    "availability",
    "other",
  ]),
  detectedOfferPrice: z.number().min(0).max(100000).nullable(),
  confidence: z.number().min(0).max(1),
  needsPhysicalCheck: z.boolean(),
  factualAnswerPossible: z.boolean(),
  draftReply: z.string().max(1200),
  suggestedCounterPrice: z.number().min(0).max(100000).nullable(),
  rationale: z.string().min(5).max(700),
  warnings: z.array(z.string().max(220)).max(8),
});

export const listingPackageSchema = z.object({
  schemaVersion: z.literal(2),
  jobId: z.string().uuid(),
  approvedAt: z.string().datetime(),
  draft: z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(20).max(3000),
    price: z.number().min(0).max(100000),
    packageSize: z.enum(["Petit", "Moyen", "Grand"]),
    brand: z.string().max(80),
    category: z.string().max(80),
    size: z.string().max(40),
    condition: itemConditionSchema,
  }),
  images: z.array(z.string().url()).min(1).max(8),
  economics: z.object({
    acquisitionCost: z.number().min(0).max(100000),
    additionalCosts: z.number().min(0).max(100000),
    minProfit: z.number().min(0).max(100000),
    minRoiPercent: z.number().min(0).max(10000),
  }),
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
export type SourcingCandidate = z.infer<typeof sourcingCandidateSchema>;
export type SourcingProfile = z.infer<typeof sourcingProfileSchema>;
export type SourcingRanking = z.infer<typeof sourcingRankingSchema>;
export type ImageAudit = z.infer<typeof imageAuditSchema>;
export type NegotiationRequest = z.infer<typeof negotiationRequestSchema>;
export type NegotiationAssessment = z.infer<typeof negotiationAssessmentSchema>;
export type ListingPackage = z.infer<typeof listingPackageSchema>;
