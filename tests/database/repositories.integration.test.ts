import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InventoryItemStatus,
  ItemCondition,
  ListingJobStatus,
  MarketplaceListingStatus,
  MessageSender,
  MessageType,
  OfferActionStatus,
  SourcingCandidateStatus,
} from "../../src/generated/prisma/enums";
import {
  createAuditRepository,
} from "../../src/lib/database/repositories/audit-repository";
import {
  createInventoryRepository,
} from "../../src/lib/database/repositories/inventory-repository";
import {
  createListingJobRepository,
} from "../../src/lib/database/repositories/listing-job-repository";
import {
  createOfferActionRepository,
} from "../../src/lib/database/repositories/offer-action-repository";
import {
  createSourcingRepository,
} from "../../src/lib/database/repositories/sourcing-repository";
import {
  disconnectDatabase,
  getPrismaClient,
} from "../../src/lib/database/prisma";

const databaseTestsEnabled =
  process.env.RUN_DATABASE_TESTS === "true" && Boolean(process.env.DATABASE_URL);

describe.runIf(databaseTestsEnabled)("repositories avec PostgreSQL", () => {
  const marker = `vitest-${randomUUID()}`;
  let database!: ReturnType<typeof getPrismaClient>;
  let inventory!: ReturnType<typeof createInventoryRepository>;
  let listingJobs!: ReturnType<typeof createListingJobRepository>;
  let sourcing!: ReturnType<typeof createSourcingRepository>;
  let offerActions!: ReturnType<typeof createOfferActionRepository>;
  let audit!: ReturnType<typeof createAuditRepository>;

  let fixtureInventoryId: string;
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    database = getPrismaClient();
    inventory = createInventoryRepository(database);
    listingJobs = createListingJobRepository(database);
    sourcing = createSourcingRepository(database);
    offerActions = createOfferActionRepository(database);
    audit = createAuditRepository(database);

    const item = await database.inventoryItem.create({
      data: {
        sku: `${marker}-fixture`,
        title: "Article support des tests",
        category: "Test",
        condition: ItemCondition.GOOD,
        purchasePrice: 10,
        status: InventoryItemStatus.RECEIVED,
        purchasedAt: new Date(),
      },
    });
    fixtureInventoryId = item.id;

    const listing = await database.marketplaceListing.create({
      data: {
        inventoryItemId: item.id,
        marketplace: marker,
        askingPrice: 30,
        status: MarketplaceListingStatus.ACTIVE,
        publishedAt: new Date(),
      },
    });

    const conversation = await database.conversation.create({
      data: {
        marketplaceListingId: listing.id,
        marketplace: marker,
        externalId: `${marker}-conversation`,
        url: "https://example.invalid/conversation",
      },
    });
    conversationId = conversation.id;

    const message = await database.message.create({
      data: {
        conversationId: conversation.id,
        externalId: `${marker}-message`,
        sender: MessageSender.BUYER,
        type: MessageType.OFFER,
        content: "Je propose 22 €.",
        offeredPrice: 22,
      },
    });
    messageId = message.id;
  });

  afterAll(async () => {
    await database.auditEvent.deleteMany({ where: { source: marker } });
    await database.offerAction.deleteMany({ where: { conversation: { marketplace: marker } } });
    await database.message.deleteMany({ where: { conversation: { marketplace: marker } } });
    await database.conversation.deleteMany({ where: { marketplace: marker } });
    await database.marketplaceListing.deleteMany({ where: { marketplace: marker } });
    await database.listingJob.deleteMany({
      where: { inventoryItem: { sku: { startsWith: marker } } },
    });
    await database.inventoryItem.deleteMany({ where: { sku: { startsWith: marker } } });
    await database.sourcingCandidate.deleteMany({ where: { marketplace: marker } });
    await database.sourcingProfile.deleteMany({ where: { name: { startsWith: marker } } });
    await disconnectDatabase();
  });

  it("crée puis relit un article d'inventaire", async () => {
    const created = await inventory.create({
      sku: `${marker}-inventory`,
      title: "Inventaire de test",
      category: "Test",
      condition: ItemCondition.VERY_GOOD,
      purchasePrice: 15,
      additionalCosts: 2,
      status: InventoryItemStatus.ORDERED,
      purchasedAt: new Date(),
    });

    const found = await inventory.findById(created.id);

    expect(found?.sku).toBe(`${marker}-inventory`);
    expect(found?.purchasePrice.toNumber()).toBe(15);
  });

  it("refuse deux candidats ayant la même marketplace et le même identifiant", async () => {
    const profile = await sourcing.createProfile({
      name: `${marker}-profile`,
      category: "Test",
      brands: [],
      sizes: [],
      colors: [],
      maximumBudget: 50,
      minimumProfit: 15,
      minimumRoiPercent: 30,
    });
    const candidate = {
      marketplace: marker,
      externalId: `${marker}-candidate`,
      url: "https://example.invalid/candidate",
      title: "Candidat de test",
      price: 20,
      shippingPrice: 4,
      buyerProtectionPrice: 2,
      totalPrice: 26,
      status: SourcingCandidateStatus.DISCOVERED,
      sourcingProfile: { connect: { id: profile.id } },
    } as const;

    await sourcing.createCandidate(candidate);

    await expect(sourcing.createCandidate(candidate)).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("crée et relit un job d'annonce", async () => {
    const created = await listingJobs.create({
      chatId: `${marker}-chat`,
      status: ListingJobStatus.ANALYZING,
      context: "Contexte de test sans appel Telegram.",
      acquisitionCost: 10,
      additionalCosts: 2,
      minimumProfit: 15,
      minimumRoiPercent: 40,
      inventoryItem: { connect: { id: fixtureInventoryId } },
    });

    const found = await listingJobs.findById(created.id);

    expect(found?.status).toBe(ListingJobStatus.ANALYZING);
    expect(found?.inventoryItem?.id).toBe(fixtureInventoryId);
  });

  it("crée et relit une décision d'offre", async () => {
    const created = await offerActions.create({
      conversation: { connect: { id: conversationId } },
      message: { connect: { id: messageId } },
      status: OfferActionStatus.AWAITING_USER,
      offerPrice: 22,
      floorPrice: 20,
      askingPrice: 30,
      suggestedCounterPrice: 27,
    });

    const found = await offerActions.findById(created.id);

    expect(found?.conversationId).toBe(conversationId);
    expect(found?.messageId).toBe(messageId);
  });

  it("n'enregistre jamais les secrets dans AuditEvent", async () => {
    const fakeTelegramToken = ["123456789", "abcdefghijklmnopqrstuvwxyzABCDE"].join(":");
    const fakeApiKey = ["sk", "super-secret-value"].join("-");
    const saved = await audit.create({
      entityType: "InventoryItem",
      entityId: fixtureInventoryId,
      action: "TEST_SECRET_FILTER",
      source: marker,
      payload: {
        telegramBotToken: fakeTelegramToken,
        nested: { apiKey: fakeApiKey, visible: "ok" },
      },
    });
    const serialized = JSON.stringify(saved.payload);

    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyzABCDE");
    expect(serialized).not.toContain("sk-super-secret-value");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("ok");
  });
});
