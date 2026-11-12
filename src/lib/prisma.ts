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
    if (!colNames.has("unitNumber")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "unitNumber" TEXT;`
      );
    }

    // Standard-Wohneinheiten einmalig setzen, sofern noch nicht initialisiert
    const seedCheck = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "app_settings" WHERE "key" = 'unit_numbers_seeded' LIMIT 1;`
    )) || [];
    if (seedCheck.length === 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "unitNumber" = 'WE1'
        WHERE ("unitNumber" IS NULL OR TRIM("unitNumber") = '')
          AND (LOWER("address") LIKE '%siemen%' OR LOWER("name") LIKE '%siemen%')
          AND (LOWER(COALESCE("floor", '')) = 'eg' OR LOWER("name") LIKE '%eg%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "unitNumber" = 'WE5, WE6'
        WHERE ("unitNumber" IS NULL OR TRIM("unitNumber") = '')
          AND (LOWER("address") LIKE '%siemen%' OR LOWER("name") LIKE '%siemen%')
          AND (LOWER(COALESCE("floor", '')) LIKE '%2%' OR LOWER("name") LIKE '%2.og%' OR LOWER("name") LIKE '%2og%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "unitNumber" = 'WE6'
        WHERE ("unitNumber" IS NULL OR TRIM("unitNumber") = '')
          AND (LOWER("address") LIKE '%dortmunder%' OR LOWER("name") LIKE '%schwerte%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "unitNumber" = 'Whg. 1'
        WHERE ("unitNumber" IS NULL OR TRIM("unitNumber") = '')
          AND (LOWER("address") LIKE '%bockum%' OR LOWER("name") LIKE '%bockum%');
      `);
      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO "app_settings" ("key", "value", "updatedAt")
        VALUES ('unit_numbers_seeded', '1', CURRENT_TIMESTAMP);
      `);
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

    // Tenants: isCurrent & propertyId multi-tenant support (Vormieter)
    const tenantCols = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(tenants)`)) || [];
    const tenantColNames = new Set(tenantCols.map((c) => c.name));

    if (!tenantColNames.has("isCurrent")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "tenants" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT 1;`
      );
    }

    // Drop unique index on propertyId so apartments can have former & current tenants
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "tenants_propertyId_key";`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tenants_propertyId_idx" ON "tenants"("propertyId");`);

    // Payments: Split-Buchungen support (parentPaymentId, isSplit)
    const paymentCols = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(payments)`)) || [];
    const paymentColNames = new Set(paymentCols.map((c) => c.name));

    if (!paymentColNames.has("parentPaymentId")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "payments" ADD COLUMN "parentPaymentId" TEXT;`
      );
    }
    if (!paymentColNames.has("isSplit")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "payments" ADD COLUMN "isSplit" BOOLEAN NOT NULL DEFAULT 0;`
      );
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payments_parentPaymentId_idx" ON "payments"("parentPaymentId");`);
  } catch (err) {
    console.warn("Schema auto-ensure notice:", err);
  }
}

// Auto-trigger ensureSchema on module load
ensureSchema().catch(() => {});

