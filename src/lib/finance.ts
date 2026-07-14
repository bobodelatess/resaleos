import type {
  Decision,
  Opportunity,
  OpportunityMetrics,
  Settings,
} from "./types";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function protectionFee(price: number, settings: Settings): number {
  return roundMoney(
    Math.max(0, price) * settings.buyerProtectionRate +
      settings.buyerProtectionFixed,
  );
}

export function acquisitionCost(item: Opportunity): number {
  return roundMoney(
    item.purchasePrice +
      item.protectionFee +
      item.inboundShipping +
      item.preparationCost,
  );
}

export function expectedProfit(item: Opportunity): number {
  return roundMoney(
    item.expectedSalePrice - acquisitionCost(item) - item.riskReserve,
  );
}

export function realizedProfit(item: Opportunity): number | null {
  if (item.actualSalePrice === null) return null;
  return roundMoney(
    item.actualSalePrice - acquisitionCost(item) - item.extraSaleCosts,
  );
}

export function maxBuyPrice(item: Opportunity, settings: Settings): number {
  const numerator =
    item.expectedSalePrice -
    item.inboundShipping -
    item.preparationCost -
    item.riskReserve -
    settings.minimumProfit -
    settings.buyerProtectionFixed;
  return roundMoney(
    Math.max(0, numerator / (1 + settings.buyerProtectionRate)),
  );
}

function recommendation(
  item: Opportunity,
  settings: Settings,
  profit: number,
  roi: number,
  maxPrice: number,
  lowProfit: number,
): Decision {
  const clearsTargets =
    profit >= settings.minimumProfit &&
    roi >= settings.minimumRoi &&
    item.probability30d >= settings.minimumProbability30d &&
    item.estimatedDaysToSell <= settings.targetHoldingDays * 1.35 &&
    item.riskLevel !== "high";

  if (clearsTargets && lowProfit >= 0) return "buy";

  const salvageable =
    maxPrice > 0 &&
    maxPrice < item.purchasePrice &&
    item.probability30d >= Math.max(0.35, settings.minimumProbability30d - 0.2) &&
    item.riskLevel !== "high";

  return salvageable ? "negotiate" : "skip";
}

export function opportunityMetrics(
  item: Opportunity,
  settings: Settings,
): OpportunityMetrics {
  const cost = acquisitionCost(item);
  const profit = expectedProfit(item);
  const lowProfit = roundMoney(
    item.salePriceLow - cost - item.riskReserve,
  );
  const highProfit = roundMoney(
    item.salePriceHigh - cost - item.riskReserve,
  );
  const roi = cost > 0 ? roundMoney((profit / cost) * 100) : 0;
  const maxPrice = maxBuyPrice(item, settings);
  const negotiationTarget = roundMoney(
    Math.max(
      1,
      Math.min(
        maxPrice,
        item.purchasePrice * (1 - settings.negotiationBuffer / 100),
      ),
    ),
  );
  const capitalEfficiency =
    cost > 0 && item.estimatedDaysToSell > 0
      ? roundMoney((profit / cost / item.estimatedDaysToSell) * 100)
      : 0;

  const profitScore = Math.min(1, Math.max(0, profit / (settings.minimumProfit * 2)));
  const roiScore = Math.min(1, Math.max(0, roi / Math.max(1, settings.minimumRoi * 2)));
  const speedScore = Math.min(
    1,
    Math.max(0, 1 - item.estimatedDaysToSell / Math.max(1, settings.targetHoldingDays * 2)),
  );
  const riskPenalty =
    item.riskLevel === "low" ? 0 : item.riskLevel === "moderate" ? 0.12 : 0.38;
  const score = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        (profitScore * 0.34 +
          roiScore * 0.23 +
          item.probability30d * 0.26 +
          speedScore * 0.17 -
          riskPenalty) *
          100,
      ),
    ),
  );

  return {
    acquisitionCost: cost,
    expectedProfit: profit,
    lowProfit,
    highProfit,
    roi,
    maxBuyPrice: maxPrice,
    negotiationTarget,
    capitalEfficiency,
    score,
    decision: recommendation(item, settings, profit, roi, maxPrice, lowProfit),
  };
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace(".", ",")} %`;
}

export function decisionLabel(decision: Decision): string {
  if (decision === "buy") return "Acheter";
  if (decision === "negotiate") return "Négocier";
  return "Ignorer";
}

