import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as typeof globalThis & {
  resaleOsPrisma?: PrismaClient;
};

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL n'est pas configurée. Copiez .env.example vers .env.local avant d'utiliser PostgreSQL.",
    );
  }

  return databaseUrl;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: requireDatabaseUrl(),
    max: 10,
  });

  return new PrismaClient({ adapter });
}

/**
 * Returns one reusable Prisma client per Node.js process. It is deliberately
 * lazy so a missing DATABASE_URL never breaks `next build`.
 */
export function getPrismaClient(): PrismaClient {
  globalDatabase.resaleOsPrisma ??= createPrismaClient();
  return globalDatabase.resaleOsPrisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (!globalDatabase.resaleOsPrisma) return;

  await globalDatabase.resaleOsPrisma.$disconnect();
  delete globalDatabase.resaleOsPrisma;
}
