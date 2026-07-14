import { describe, expect, it } from "vitest";

import { sanitizeAuditPayload } from "../../src/lib/database/repositories/audit-repository";

describe("protection du journal d'audit", () => {
  it("remplace les secrets, y compris dans les objets imbriqués", () => {
    const fakeTelegramToken = ["123456789", "abcdefghijklmnopqrstuvwxyzABCDE"].join(":");
    const sanitized = sanitizeAuditPayload({
      action: "test",
      telegramBotToken: fakeTelegramToken,
      nested: {
        authorization: "Bearer valeur-tres-secrete",
        publicValue: "conservable",
      },
      database: "postgresql://user:mot-de-passe@database.example/resaleos",
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyzABCDE");
    expect(serialized).not.toContain("valeur-tres-secrete");
    expect(serialized).not.toContain("mot-de-passe");
    expect(serialized).toContain("conservable");
    expect(serialized).toContain("[REDACTED]");
  });
});
