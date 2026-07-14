import { databaseConfigured, getPrismaClient } from "./prisma";

export interface DatabaseHealth {
  databaseConfigured: boolean;
  databaseReachable: boolean;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!databaseConfigured()) {
    return {
      databaseConfigured: false,
      databaseReachable: false,
    };
  }

  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return {
      databaseConfigured: true,
      databaseReachable: true,
    };
  } catch {
    return {
      databaseConfigured: true,
      databaseReachable: false,
    };
  }
}
