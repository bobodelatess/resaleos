import "dotenv/config";

import { defineConfig } from "prisma/config";

const localDevelopmentUrl =
  "postgresql://resaleos:resaleos_dev@127.0.0.1:5432/resaleos?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Generate/validate and the Next.js build must also work before a database
  // is configured. Runtime access still requires an explicit DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL?.trim() || localDevelopmentUrl,
  },
});
