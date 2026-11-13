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
    if (!colNames.has("hausgeld")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "hausgeld" REAL;`
      );
    }
    if (!colNames.has("hausgeldDetails")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "hausgeldDetails" TEXT;`
      );
    }
    if (!colNames.has("unitDetails")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "properties" ADD COLUMN "unitDetails" TEXT;`
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

    // Initiales Hausgeld für bestehende Wohnungen setzen, sofern noch nicht initialisiert
    const hausgeldSeedCheck = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "app_settings" WHERE "key" = 'hausgeld_seeded' LIMIT 1;`
    )) || [];
    if (hausgeldSeedCheck.length === 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "hausgeld" = 210
        WHERE "hausgeld" IS NULL
          AND (LOWER("address") LIKE '%siemen%' OR LOWER("name") LIKE '%siemen%')
          AND (LOWER(COALESCE("floor", '')) = 'eg' OR LOWER("name") LIKE '%eg%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "hausgeld" = 590,
            "hausgeldDetails" = '{"WE5":{"hausgeld":250},"WE6":{"hausgeld":340}}'
        WHERE "hausgeld" IS NULL
          AND (LOWER("address") LIKE '%siemen%' OR LOWER("name") LIKE '%siemen%')
          AND (LOWER(COALESCE("floor", '')) LIKE '%2%' OR LOWER("name") LIKE '%2.og%' OR LOWER("name") LIKE '%2og%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "hausgeld" = 178
        WHERE "hausgeld" IS NULL
          AND (LOWER("address") LIKE '%dortmunder%' OR LOWER("name") LIKE '%schwerte%');
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "hausgeld" = 195
        WHERE "hausgeld" IS NULL
          AND (LOWER("address") LIKE '%bockum%' OR LOWER("name") LIKE '%bockum%');
      `);
      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO "app_settings" ("key", "value", "updatedAt")
        VALUES ('hausgeld_seeded', '1', CURRENT_TIMESTAMP);
      `);
    }

    // Untereinheiten für Verbundwohnungen initialisieren
    const unitDetailsSeedCheck = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "app_settings" WHERE "key" = 'unit_details_seeded_v1' LIMIT 1;`
    )) || [];
    if (unitDetailsSeedCheck.length === 0) {
      const siemensUnitDetails = JSON.stringify({
        WE5: {
          key: "WE5",
          unitNumber: "WE05",
          name: "Siemensstraße 28 2.OG links",
          floor: "2.OG links",
          sqm: 42,
          rentSqm: 41,
          purchasePrice: 52500,
          purchasedAt: "2023-02-22",
          possessionAt: "2023-04-01",
          coldRent: 290,
          heating: 90,
          operatingCosts: 170,
          utilities: 260,
          warmRent: 550,
          hausgeld: 215,
          maintenanceReserve: 18.97,
          totalWeg: 233.97
        },
        WE6: {
          key: "WE6",
          unitNumber: "WE06",
          name: "Siemensstraße 28 2.OG rechts",
          floor: "2.OG rechts",
          sqm: 55,
          rentSqm: 55,
          purchasePrice: 62500,
          purchasedAt: "2023-02-28",
          possessionAt: "2023-04-01",
          coldRent: 341,
          heating: 130,
          operatingCosts: 210,
          utilities: 340,
          warmRent: 681,
          hausgeld: 613,
          maintenanceReserve: 24.85,
          totalWeg: 637.85
        }
      });
      const siemensHausgeldDetails = JSON.stringify({
        WE5: { hausgeld: 215, maintenanceReserve: 18.97, total: 233.97 },
        WE6: { hausgeld: 613, maintenanceReserve: 24.85, total: 637.85 }
      });
      await prisma.$executeRawUnsafe(`
        UPDATE "properties"
        SET "unitDetails" = ?,
            "hausgeldDetails" = ?,
            "hausgeld" = 828,
            "maintenanceReserve" = 43.82
        WHERE (LOWER("address") LIKE '%siemen%' OR LOWER("name") LIKE '%siemen%')
          AND (LOWER(COALESCE("floor", '')) LIKE '%2%' OR LOWER("name") LIKE '%2.og%' OR LOWER("name") LIKE '%2og%');
      `, siemensUnitDetails, siemensHausgeldDetails);
      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO "app_settings" ("key", "value", "updatedAt")
        VALUES ('unit_details_seeded_v1', '1', CURRENT_TIMESTAMP);
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

