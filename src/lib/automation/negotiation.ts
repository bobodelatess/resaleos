import { assessNegotiation } from "./ai";
import type { NegotiationRequest } from "./schemas";
import { createOfferAction, type OfferAction } from "./workflow-store";

export type NegotiationExecution =
  | {
      mode: "auto_reply";
      action: "reply" | "counter" | "decline";
      text: string;
    }
  | {
      mode: "needs_user";
      actionId: string;
    }
  | {
      mode: "needs_physical_check";
      text: string;
    }
  | {
      mode: "manual_review";
      text: string;
    };

export interface NegotiationResult {
  floorPrice: number;
  offerPrice: number | null;
  execution: NegotiationExecution;
  action?: OfferAction;
  assessment: Awaited<ReturnType<typeof assessNegotiation>>;
}

export function calculateFloorPrice(request: NegotiationRequest): number {
  const totalCost = request.policy.acquisitionCost + request.policy.additionalCosts;
  const profitFloor = totalCost + request.policy.minProfit;
  const roiFloor = totalCost * (1 + request.policy.minRoiPercent / 100);
  return Math.ceil(Math.max(profitFloor, roiFloor) * 100) / 100;
}

function boundedCounter(
  floorPrice: number,
  askingPrice: number,
  suggested: number | null,
): number {
  const midpoint = floorPrice + Math.max(0, askingPrice - floorPrice) * 0.45;
  return Math.round(
    Math.min(askingPrice, Math.max(floorPrice, suggested ?? midpoint)) * 100,
  ) / 100;
}

export async function evaluateNegotiation(
  request: NegotiationRequest,
): Promise<NegotiationResult> {
  const floorPrice = calculateFloorPrice(request);
  const assessment = await assessNegotiation(request, floorPrice);
  const offerPrice = request.detectedOfferPrice ?? assessment.detectedOfferPrice;

  if (offerPrice !== null && offerPrice !== undefined) {
    if (request.policy.acquisitionCost <= 0) {
      return {
        floorPrice,
        offerPrice,
        assessment,
        execution: {
          mode: "manual_review",
          text: "Coût d'achat manquant : aucune offre ne peut être acceptée ou contre-proposée automatiquement.",
        },
      };
    }
    const counter = boundedCounter(
      floorPrice,
      request.policy.askingPrice,
      assessment.suggestedCounterPrice,
    );
    if (offerPrice >= floorPrice) {
      const action = await createOfferAction({
        itemId: request.itemId,
        itemTitle: request.itemTitle,
        conversationUrl: request.conversationUrl,
        listingUrl: request.listingUrl,
        buyerMessage: request.buyerMessage,
        offerPrice,
        floorPrice,
        askingPrice: request.policy.askingPrice,
        suggestedCounterPrice: counter,
        assessment,
      });
      return {
        floorPrice,
        offerPrice,
        assessment,
        action,
        execution: { mode: "needs_user", actionId: action.id },
      };
    }

    if (request.policy.autoNegotiate) {
      const veryLow = offerPrice < floorPrice * 0.65;
      return {
        floorPrice,
        offerPrice,
        assessment,
        execution: veryLow
          ? {
              mode: "auto_reply",
              action: "decline",
              text: `Merci pour votre offre. Je ne peux pas descendre à ce prix. Mon meilleur prix est ${counter.toFixed(0)} €.`,
            }
          : {
              mode: "auto_reply",
              action: "counter",
              text: `Merci pour votre offre. Je peux vous le proposer à ${counter.toFixed(0)} €.`,
            },
      };
    }
  }

  if (assessment.needsPhysicalCheck) {
    return {
      floorPrice,
      offerPrice: offerPrice ?? null,
      assessment,
      execution: {
        mode: "needs_physical_check",
        text:
          assessment.draftReply ||
          "Je vérifie ce point directement sur l'article et je reviens vers vous rapidement.",
      },
    };
  }

  if (
    assessment.factualAnswerPossible &&
    assessment.confidence >= 0.82 &&
    assessment.draftReply.trim()
  ) {
    return {
      floorPrice,
      offerPrice: offerPrice ?? null,
      assessment,
      execution: {
        mode: "auto_reply",
        action: "reply",
        text: assessment.draftReply.trim(),
      },
    };
  }

  return {
    floorPrice,
    offerPrice: offerPrice ?? null,
    assessment,
    execution: {
      mode: "manual_review",
      text:
        assessment.draftReply ||
        "Je dois vérifier ce point avant de vous répondre précisément.",
    },
  };
}
