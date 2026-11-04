import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let schemaInitialized = false;

export async function ensureSchema() {
  if (schemaInitialized) return;
  schemaInitialized = true;
  try {
    const cols = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(properties)`)) || [];
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has("buildingSharePercent")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "buildingSharePercent" REAL DEFAULT 80;`
      );
    }
    if (!colNames.has("propertyTransferTax")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "propertyTransferTax" REAL;`
      );
    }
    if (!colNames.has("notaryCosts")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "notaryCosts" REAL;`
      );
    }
    if (!colNames.has("landRegisterCosts")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "landRegisterCosts" REAL;`
      );
    }
    if (!colNames.has("brokerCosts")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "brokerCosts" REAL;`
      );
    }
    if (!colNames.has("otherAncillaryCosts")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "otherAncillaryCosts" REAL;`
      );
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "property_investments" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "propertyId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "amount" REAL NOT NULL,
        "amountNet" REAL,
        "date" DATETIME NOT NULL,
        "craftsman" TEXT,
        "category" TEXT NOT NULL DEFAULT 'SANIERUNG',
        "isCapitalized" BOOLEAN NOT NULL DEFAULT 1,
        "relevantFor15Percent" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "property_investments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
  } catch (err) {
    console.warn("Schema auto-ensure notice:", err);
  }
}

// Auto-trigger ensureSchema on module load
ensureSchema().catch(() => {});

