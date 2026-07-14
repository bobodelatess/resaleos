-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "SourcingCandidateStatus" AS ENUM ('DISCOVERED', 'WATCHING', 'RECOMMENDED', 'PURCHASED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'VERY_GOOD', 'GOOD', 'SATISFACTORY');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ORDERED', 'RECEIVED', 'LISTED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingJobStatus" AS ENUM ('ANALYZING', 'NEEDS_MORE_PHOTOS', 'GENERATING_IMAGES', 'AUDITING_IMAGES', 'NEEDS_IMAGE_REVIEW', 'AWAITING_LISTING_APPROVAL', 'APPROVED_FOR_PUBLISH', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingPhotoType" AS ENUM ('ORIGINAL', 'GENERATED');

-- CreateEnum
CREATE TYPE "ListingPhotoRole" AS ENUM ('HERO', 'FRONT', 'BACK', 'DETAIL');

-- CreateEnum
CREATE TYPE "PackageSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'REMOVED');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('BUYER', 'SELLER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'OFFER', 'EVENT');

-- CreateEnum
CREATE TYPE "OfferActionStatus" AS ENUM ('AWAITING_USER', 'READY_FOR_EXTENSION', 'EXECUTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfferDecision" AS ENUM ('ACCEPT_OFFER', 'COUNTER_OFFER', 'DECLINE_OFFER');

-- CreateTable
CREATE TABLE "SourcingProfile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maximumBudget" DECIMAL(12,2) NOT NULL,
    "minimumProfit" DECIMAL(12,2) NOT NULL,
    "minimumRoiPercent" DECIMAL(7,2) NOT NULL,
    "maximumRisk" "RiskLevel" NOT NULL DEFAULT 'MODERATE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SourcingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingCandidate" (
    "id" UUID NOT NULL,
    "marketplace" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "shippingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "buyerProtectionPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    "condition" "ItemCondition",
    "description" TEXT,
    "imageUrl" TEXT,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SourcingCandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
    "rawData" JSONB,
    "sourcingProfileId" UUID,

    CONSTRAINT "SourcingCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "size" TEXT,
    "condition" "ItemCondition" NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "additionalCosts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ORDERED',
    "storageLocation" TEXT,
    "purchasedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3),
    "listedAt" TIMESTAMPTZ(3),
    "soldAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceCandidateId" UUID,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingJob" (
    "id" UUID NOT NULL,
    "chatId" TEXT NOT NULL,
    "status" "ListingJobStatus" NOT NULL DEFAULT 'ANALYZING',
    "context" TEXT NOT NULL,
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "additionalCosts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumProfit" DECIMAL(12,2) NOT NULL,
    "minimumRoiPercent" DECIMAL(7,2) NOT NULL,
    "analysis" JSONB,
    "imageAudit" JSONB,
    "error" TEXT,
    "regenerationCount" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "inventoryItemId" UUID,

    CONSTRAINT "ListingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" UUID NOT NULL,
    "listingJobId" UUID NOT NULL,
    "type" "ListingPhotoType" NOT NULL,
    "role" "ListingPhotoRole",
    "sourceReference" TEXT NOT NULL,
    "publicUrl" TEXT,
    "fidelityScore" DECIMAL(5,2),
    "passed" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingDraft" (
    "id" UUID NOT NULL,
    "listingJobId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "packageSize" "PackageSize" NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "size" TEXT,
    "condition" "ItemCondition" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ListingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "marketplace" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "askingPrice" DECIMAL(12,2) NOT NULL,
    "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "removedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "marketplaceListingId" UUID NOT NULL,
    "marketplace" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "buyerIdentifier" TEXT,
    "lastMessageAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "externalId" TEXT,
    "sender" "MessageSender" NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "offeredPrice" DECIMAL(12,2),
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "rawData" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferAction" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID,
    "status" "OfferActionStatus" NOT NULL DEFAULT 'AWAITING_USER',
    "decision" "OfferDecision",
    "offerPrice" DECIMAL(12,2) NOT NULL,
    "floorPrice" DECIMAL(12,2) NOT NULL,
    "askingPrice" DECIMAL(12,2) NOT NULL,
    "suggestedCounterPrice" DECIMAL(12,2),
    "executionText" TEXT,
    "executionAttempts" INTEGER NOT NULL DEFAULT 0,
    "executionError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OfferAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "marketplaceListingId" UUID,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "platformFees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingCosts" DECIMAL(12,2),
    "netProfit" DECIMAL(12,2) NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingProfile_active_updatedAt_idx" ON "SourcingProfile"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "SourcingCandidate_sourcingProfileId_status_lastSeenAt_idx" ON "SourcingCandidate"("sourcingProfileId", "status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SourcingCandidate_status_lastSeenAt_idx" ON "SourcingCandidate"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourcingCandidate_marketplace_externalId_key" ON "SourcingCandidate"("marketplace", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sourceCandidateId_key" ON "InventoryItem"("sourceCandidateId");

-- CreateIndex
CREATE INDEX "InventoryItem_status_updatedAt_idx" ON "InventoryItem"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_brand_category_idx" ON "InventoryItem"("brand", "category");

-- CreateIndex
CREATE INDEX "ListingJob_status_updatedAt_idx" ON "ListingJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ListingJob_chatId_createdAt_idx" ON "ListingJob"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingJob_inventoryItemId_idx" ON "ListingJob"("inventoryItemId");

-- CreateIndex
CREATE INDEX "ListingPhoto_listingJobId_type_createdAt_idx" ON "ListingPhoto"("listingJobId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListingDraft_listingJobId_key" ON "ListingDraft"("listingJobId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_inventoryItemId_status_idx" ON "MarketplaceListing"("inventoryItemId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_updatedAt_idx" ON "MarketplaceListing"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_marketplace_externalId_key" ON "MarketplaceListing"("marketplace", "externalId");

-- CreateIndex
CREATE INDEX "Conversation_marketplaceListingId_lastMessageAt_idx" ON "Conversation"("marketplaceListingId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_marketplace_externalId_key" ON "Conversation"("marketplace", "externalId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_externalId_key" ON "Message"("conversationId", "externalId");

-- CreateIndex
CREATE INDEX "OfferAction_status_updatedAt_idx" ON "OfferAction"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferAction_conversationId_createdAt_idx" ON "OfferAction"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "OfferAction_messageId_idx" ON "OfferAction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_inventoryItemId_key" ON "Sale"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_marketplaceListingId_key" ON "Sale"("marketplaceListingId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "SourcingCandidate" ADD CONSTRAINT "SourcingCandidate_sourcingProfileId_fkey" FOREIGN KEY ("sourcingProfileId") REFERENCES "SourcingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_sourceCandidateId_fkey" FOREIGN KEY ("sourceCandidateId") REFERENCES "SourcingCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingJob" ADD CONSTRAINT "ListingJob_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingJobId_fkey" FOREIGN KEY ("listingJobId") REFERENCES "ListingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingDraft" ADD CONSTRAINT "ListingDraft_listingJobId_fkey" FOREIGN KEY ("listingJobId") REFERENCES "ListingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_marketplaceListingId_fkey" FOREIGN KEY ("marketplaceListingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferAction" ADD CONSTRAINT "OfferAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferAction" ADD CONSTRAINT "OfferAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_marketplaceListingId_fkey" FOREIGN KEY ("marketplaceListingId") REFERENCES "MarketplaceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
