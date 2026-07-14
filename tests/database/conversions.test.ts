import { describe, expect, it } from "vitest";

import {
  InventoryItemStatus,
  ItemCondition,
  ListingJobStatus,
  OfferActionStatus,
  OfferDecision,
  PackageSize,
} from "../../src/generated/prisma/enums";
import {
  itemConditionToPrisma,
  listingJobStatusToPrisma,
  offerActionStatusToPrisma,
  offerDecisionToPrisma,
  opportunityStatusToInventoryStatus,
  opportunityToInventoryCreateInput,
  packageSizeToPrisma,
} from "../../src/lib/database/conversions";
import type { Opportunity } from "../../src/lib/types";

describe("conversions entre le stockage actuel et Prisma", () => {
  it("convertit les états déjà utilisés par les workflows", () => {
    expect(itemConditionToPrisma("very_good")).toBe(ItemCondition.VERY_GOOD);
    expect(listingJobStatusToPrisma("needs_image_review")).toBe(
      ListingJobStatus.NEEDS_IMAGE_REVIEW,
    );
    expect(offerActionStatusToPrisma("ready_for_extension")).toBe(
      OfferActionStatus.READY_FOR_EXTENSION,
    );
    expect(offerDecisionToPrisma("counter_offer")).toBe(
      OfferDecision.COUNTER_OFFER,
    );
    expect(packageSizeToPrisma("Moyen")).toBe(PackageSize.MEDIUM);
  });

  it("refuse de transformer une simple opportunité en article acheté", () => {
    expect(() => opportunityStatusToInventoryStatus("watching")).toThrow(
      "pas un article acheté",
    );
  });

  it("prépare un article acheté sans écrire dans la base", () => {
    const opportunity: Opportunity = {
      id: "legacy-1",
      createdAt: "2026-01-10T10:00:00.000Z",
      updatedAt: "2026-01-14T10:00:00.000Z",
      source: "Vinted",
      sourceUrl: "https://example.invalid/item",
      title: "Veste test",
      brand: "Test",
      model: "Modèle",
      category: "Vestes",
      size: "M",
      condition: "very_good",
      description: "Article de test",
      purchasePrice: 20,
      protectionFee: 1.2,
      inboundShipping: 4,
      preparationCost: 2,
      riskReserve: 0.8,
      expectedSalePrice: 50,
      salePriceLow: 40,
      salePriceHigh: 55,
      probability30d: 75,
      estimatedDaysToSell: 12,
      riskLevel: "low",
      status: "received",
      notes: "",
      images: [],
      sku: "TEST-LEGACY-1",
      storageBin: "A1",
      listingDraft: null,
      listedAt: "",
      soldAt: "",
      actualSalePrice: null,
      extraSaleCosts: 0,
    };

    const converted = opportunityToInventoryCreateInput(opportunity);

    expect(converted.status).toBe(InventoryItemStatus.RECEIVED);
    expect(converted.additionalCosts).toBe(8);
    expect(converted.condition).toBe(ItemCondition.VERY_GOOD);
    expect(converted.receivedAt).toEqual(new Date(opportunity.updatedAt));
  });
});
