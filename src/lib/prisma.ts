import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var goupSportPrisma: PrismaClient | undefined;
}

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  if (!globalThis.goupSportPrisma) {
    const adapter = new PrismaPg(process.env.DATABASE_URL);
    globalThis.goupSportPrisma = new PrismaClient({ adapter });
  }

  return globalThis.goupSportPrisma;
}
