import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("schéma de la mémoire centrale", () => {
  it("contient tous les modèles demandés", async () => {
    const schema = await readFile(
      new URL("../../prisma/schema.prisma", import.meta.url),
      "utf8",
    );

    for (const model of [
      "SourcingProfile",
      "SourcingCandidate",
      "InventoryItem",
      "ListingJob",
      "ListingPhoto",
      "ListingDraft",
      "MarketplaceListing",
      "Conversation",
      "Message",
      "OfferAction",
      "Sale",
      "AuditEvent",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("déduplique les annonces et sépare les références Telegram des URL publiques", async () => {
    const schema = await readFile(
      new URL("../../prisma/schema.prisma", import.meta.url),
      "utf8",
    );

    expect(schema).toContain("@@unique([marketplace, externalId])");
    expect(schema).toMatch(/sourceReference\s+String/);
    expect(schema).toMatch(/publicUrl\s+String\?/);
    expect(schema).toContain("@@unique([conversationId, externalId])");
  });
});
