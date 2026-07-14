import type { Prisma } from "@/generated/prisma/client";
import {
  InventoryItemStatus,
  ItemCondition as PrismaItemCondition,
  ListingJobStatus as PrismaListingJobStatus,
  OfferActionStatus as PrismaOfferActionStatus,
  OfferDecision as PrismaOfferDecision,
  PackageSize,
  RiskLevel as PrismaRiskLevel,
} from "@/generated/prisma/enums";
import type {
  ListingJobStatus as LegacyListingJobStatus,
  OfferActionStatus as LegacyOfferActionStatus,
  OfferDecision as LegacyOfferDecision,
} from "@/lib/automation/workflow-store";
import type {
  ItemCondition,
  Opportunity,
  OpportunityStatus,
  RiskLevel,
} from "@/lib/types";

const conditions: Record<ItemCondition, PrismaItemCondition> = {
  new_with_tags: PrismaItemCondition.NEW_WITH_TAGS,
  new_without_tags: PrismaItemCondition.NEW_WITHOUT_TAGS,
  very_good: PrismaItemCondition.VERY_GOOD,
  good: PrismaItemCondition.GOOD,
  satisfactory: PrismaItemCondition.SATISFACTORY,
};

const risks: Record<RiskLevel, PrismaRiskLevel> = {
  low: PrismaRiskLevel.LOW,
  moderate: PrismaRiskLevel.MODERATE,
  high: PrismaRiskLevel.HIGH,
};

const listingJobStatuses: Record<LegacyListingJobStatus, PrismaListingJobStatus> = {
  analyzing: PrismaListingJobStatus.ANALYZING,
  needs_more_photos: PrismaListingJobStatus.NEEDS_MORE_PHOTOS,
  generating_images: PrismaListingJobStatus.GENERATING_IMAGES,
  auditing_images: PrismaListingJobStatus.AUDITING_IMAGES,
  needs_image_review: PrismaListingJobStatus.NEEDS_IMAGE_REVIEW,
  awaiting_listing_approval: PrismaListingJobStatus.AWAITING_LISTING_APPROVAL,
  approved_for_publish: PrismaListingJobStatus.APPROVED_FOR_PUBLISH,
  published: PrismaListingJobStatus.PUBLISHED,
  failed: PrismaListingJobStatus.FAILED,
};

const offerActionStatuses: Record<LegacyOfferActionStatus, PrismaOfferActionStatus> = {
  awaiting_user: PrismaOfferActionStatus.AWAITING_USER,
  ready_for_extension: PrismaOfferActionStatus.READY_FOR_EXTENSION,
  executed: PrismaOfferActionStatus.EXECUTED,
  rejected: PrismaOfferActionStatus.REJECTED,
  failed: PrismaOfferActionStatus.FAILED,
};

const offerDecisions: Record<LegacyOfferDecision, PrismaOfferDecision> = {
  accept_offer: PrismaOfferDecision.ACCEPT_OFFER,
  counter_offer: PrismaOfferDecision.COUNTER_OFFER,
  decline_offer: PrismaOfferDecision.DECLINE_OFFER,
};

export function itemConditionToPrisma(condition: ItemCondition): PrismaItemCondition {
  return conditions[condition];
}

export function riskLevelToPrisma(risk: RiskLevel): PrismaRiskLevel {
  return risks[risk];
}

export function opportunityStatusToInventoryStatus(
  status: OpportunityStatus,
): InventoryItemStatus {
  switch (status) {
    case "ordered":
      return InventoryItemStatus.ORDERED;
    case "received":
      return InventoryItemStatus.RECEIVED;
    case "listed":
      return InventoryItemStatus.LISTED;
    case "sold":
      return InventoryItemStatus.SOLD;
    case "watching":
    case "skipped":
      throw new Error(
        `Le statut « ${status} » décrit une opportunité, pas un article acheté.`,
      );
  }
}

export function packageSizeToPrisma(
  size: "Petit" | "Moyen" | "Grand",
): PackageSize {
  return {
    Petit: PackageSize.SMALL,
    Moyen: PackageSize.MEDIUM,
    Grand: PackageSize.LARGE,
  }[size];
}

export function listingJobStatusToPrisma(
  status: LegacyListingJobStatus,
): PrismaListingJobStatus {
  return listingJobStatuses[status];
}

export function offerActionStatusToPrisma(
  status: LegacyOfferActionStatus,
): PrismaOfferActionStatus {
  return offerActionStatuses[status];
}

export function offerDecisionToPrisma(
  decision: LegacyOfferDecision,
): PrismaOfferDecision {
  return offerDecisions[decision];
}

function optionalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Prepares a legacy browser opportunity for a future, explicit migration.
 * It never writes data by itself.
 */
export function opportunityToInventoryCreateInput(
  opportunity: Opportunity,
  sourceCandidateId?: string,
): Prisma.InventoryItemCreateInput {
  const status = opportunityStatusToInventoryStatus(opportunity.status);
  const createdAt = optionalDate(opportunity.createdAt) ?? new Date();

  return {
    sku: opportunity.sku,
    title: opportunity.title,
    brand: opportunity.brand || undefined,
    category: opportunity.category,
    size: opportunity.size || undefined,
    condition: itemConditionToPrisma(opportunity.condition),
    purchasePrice: opportunity.purchasePrice,
    additionalCosts:
      opportunity.protectionFee +
      opportunity.inboundShipping +
      opportunity.preparationCost +
      opportunity.riskReserve,
    status,
    storageLocation: opportunity.storageBin || undefined,
    purchasedAt: createdAt,
    receivedAt:
      status === InventoryItemStatus.RECEIVED ? optionalDate(opportunity.updatedAt) : undefined,
    listedAt: optionalDate(opportunity.listedAt),
    soldAt: optionalDate(opportunity.soldAt),
    createdAt,
    ...(sourceCandidateId
      ? { sourceCandidate: { connect: { id: sourceCandidateId } } }
      : {}),
  };
}
