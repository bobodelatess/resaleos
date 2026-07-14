export type OpportunityStatus =
  | "watching"
  | "ordered"
  | "received"
  | "listed"
  | "sold"
  | "skipped";

export type Decision = "buy" | "negotiate" | "skip";

export type ItemCondition =
  | "new_with_tags"
  | "new_without_tags"
  | "very_good"
  | "good"
  | "satisfactory";

export type RiskLevel = "low" | "moderate" | "high";

export interface ListingDraft {
  title: string;
  description: string;
  price: number;
  packageSize: "Petit" | "Moyen" | "Grand";
}

export interface Opportunity {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: "Vinted" | "Brocante" | "Friperie" | "Autre";
  sourceUrl: string;
  title: string;
  brand: string;
  model: string;
  category: string;
  size: string;
  condition: ItemCondition;
  description: string;
  purchasePrice: number;
  protectionFee: number;
  inboundShipping: number;
  preparationCost: number;
  riskReserve: number;
  expectedSalePrice: number;
  salePriceLow: number;
  salePriceHigh: number;
  probability30d: number;
  estimatedDaysToSell: number;
  riskLevel: RiskLevel;
  status: OpportunityStatus;
  notes: string;
  images: string[];
  sku: string;
  storageBin: string;
  listingDraft: ListingDraft | null;
  listedAt: string;
  soldAt: string;
  actualSalePrice: number | null;
  extraSaleCosts: number;
}

export interface Settings {
  buyerProtectionRate: number;
  buyerProtectionFixed: number;
  defaultShipping: number;
  defaultPreparation: number;
  defaultRiskReserve: number;
  minimumProfit: number;
  minimumRoi: number;
  minimumProbability30d: number;
  targetHoldingDays: number;
  negotiationBuffer: number;
}

export interface AppState {
  version: 1;
  settings: Settings;
  opportunities: Opportunity[];
}

export interface OpportunityMetrics {
  acquisitionCost: number;
  expectedProfit: number;
  lowProfit: number;
  highProfit: number;
  roi: number;
  maxBuyPrice: number;
  negotiationTarget: number;
  capitalEfficiency: number;
  score: number;
  decision: Decision;
}

