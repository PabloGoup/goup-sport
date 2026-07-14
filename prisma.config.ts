import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://goup_sport:goup_sport_dev@localhost:5433/goup_sport?schema=public",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
