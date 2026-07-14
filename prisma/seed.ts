import {
  InventoryItemStatus,
  ItemCondition,
  RiskLevel,
  SourcingCandidateStatus,
} from "../src/generated/prisma/enums";
import {
  disconnectDatabase,
  getPrismaClient,
} from "../src/lib/database/prisma";

const DEMO_PROFILE_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_CANDIDATE_ID = "00000000-0000-4000-8000-000000000102";
const DEMO_INVENTORY_ID = "00000000-0000-4000-8000-000000000103";

async function seed() {
  const database = getPrismaClient();

  const profile = await database.sourcingProfile.upsert({
    where: { id: DEMO_PROFILE_ID },
    create: {
      id: DEMO_PROFILE_ID,
      name: "DÉMO — Vestes faciles à revendre",
      category: "Vestes",
      brands: ["Patagonia", "The North Face"],
      sizes: ["M", "L"],
      colors: ["Noir", "Bleu marine"],
      maximumBudget: 45,
      minimumProfit: 20,
      minimumRoiPercent: 40,
      maximumRisk: RiskLevel.MODERATE,
    },
    update: {
      active: true,
      maximumBudget: 45,
      minimumProfit: 20,
      minimumRoiPercent: 40,
    },
  });

  const candidate = await database.sourcingCandidate.upsert({
    where: {
      marketplace_externalId: {
        marketplace: "demo-marketplace",
        externalId: "demo-candidate-001",
      },
    },
    create: {
      id: DEMO_CANDIDATE_ID,
      marketplace: "demo-marketplace",
      externalId: "demo-candidate-001",
      url: "https://example.invalid/demo-candidate-001",
      title: "DÉMO — Veste technique noire",
      price: 28,
      shippingPrice: 4.5,
      buyerProtectionPrice: 2.2,
      totalPrice: 34.7,
      brand: "Marque de démonstration",
      size: "M",
      condition: ItemCondition.VERY_GOOD,
      description: "Donnée fictive créée par le seed de développement.",
      status: SourcingCandidateStatus.PURCHASED,
      rawData: { demo: true },
      sourcingProfile: { connect: { id: profile.id } },
    },
    update: {
      lastSeenAt: new Date(),
      status: SourcingCandidateStatus.PURCHASED,
      sourcingProfile: { connect: { id: profile.id } },
    },
  });

  const inventoryItem = await database.inventoryItem.upsert({
    where: { sku: "DEMO-0001" },
    create: {
      id: DEMO_INVENTORY_ID,
      sku: "DEMO-0001",
      title: "DÉMO — Veste technique noire",
      brand: "Marque de démonstration",
      category: "Vestes",
      size: "M",
      condition: ItemCondition.VERY_GOOD,
      purchasePrice: 34.7,
      additionalCosts: 0,
      status: InventoryItemStatus.RECEIVED,
      storageLocation: "DÉMO-A1",
      purchasedAt: new Date("2026-01-10T10:00:00.000Z"),
      receivedAt: new Date("2026-01-14T10:00:00.000Z"),
      sourceCandidate: { connect: { id: candidate.id } },
    },
    update: {
      status: InventoryItemStatus.RECEIVED,
      sourceCandidate: { connect: { id: candidate.id } },
    },
  });

  console.log(
    `Données de démonstration créées : ${profile.name}, ${candidate.title}, ${inventoryItem.sku}.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Le seed de démonstration a échoué.", error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
