import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUtilityStatementPdf } from "@/lib/utility-statement-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyIdHint = formData.get("propertyId") as string | null;
    const subUnitKeyHint = formData.get("subUnitKey") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Keine PDF-Datei hochgeladen" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lade alle Immobilien & Mieter aus der Datenbank
    const properties = await prisma.property.findMany({
      include: {
        tenants: {
          where: { isCurrent: true },
        },
      },
    });

    const parsed = await parseUtilityStatementPdf(buffer, properties);

    // Property-Zuordnung bestimmen (entweder durch Parser erkannt oder durch Hint übersteuert)
    const activePropertyId = (propertyIdHint && propertyIdHint !== "AUTO")
      ? propertyIdHint
      : (parsed.matchedPropertyId || properties[0]?.id);

    const activeProperty = properties.find((p) => p.id === activePropertyId);

    // Untereinheit bestimmen (z.B. WE5 oder WE6 bei Siemensstr. 2.OG)
    let activeSubUnitKey = (subUnitKeyHint && subUnitKeyHint !== "AUTO")
      ? subUnitKeyHint
      : parsed.matchedSubUnitKey;

    let subUnitDetails: any = null;
    let targetSqm = parsed.sqm || activeProperty?.sqm || 0;
    let tenantName = activeProperty?.tenants[0]
      ? `${activeProperty.tenants[0].firstName} ${activeProperty.tenants[0].lastName}`
      : "Mieter";
    let monthlyPrepayment = activeProperty?.tenants[0]?.utilities || 0;

    if (activeProperty?.unitDetails) {
      try {
        const uObj = typeof activeProperty.unitDetails === "string"
          ? JSON.parse(activeProperty.unitDetails)
          : activeProperty.unitDetails;

        // Falls noch keine Untereinheit gewählt, nimm die erste oder die gematchte
        if (!activeSubUnitKey || !uObj[activeSubUnitKey]) {
          activeSubUnitKey = Object.keys(uObj)[0];
        }

        if (activeSubUnitKey && uObj[activeSubUnitKey]) {
          subUnitDetails = uObj[activeSubUnitKey];
          targetSqm = subUnitDetails.sqm || subUnitDetails.rentSqm || targetSqm;

          // Monatliche Vorauszahlung der Untereinheit (z.B. WE5 = 170 BK + 90 Hz = 260 €)
          const subUtils = Number(subUnitDetails.utilities) ||
            ((Number(subUnitDetails.operatingCosts) || 0) + (Number(subUnitDetails.heating) || 0));
          if (subUtils > 0) {
            monthlyPrepayment = subUtils;
          }
        }
      } catch (err) {
        console.warn("Error parsing unitDetails:", err);
      }
    }

    const annualPrepayments = Math.round(monthlyPrepayment * 12 * 100) / 100;
    const balance = Math.round((annualPrepayments - parsed.totalCosts) * 100) / 100;

    return NextResponse.json({
      success: true,
      period: parsed.period,
      sqm: targetSqm,
      propertyId: activePropertyId,
      subUnitKey: activeSubUnitKey || null,
      subUnitDetails,
      tenantName,
      monthlyPrepayment,
      annualPrepayments,
      items: parsed.items,
      totalCosts: parsed.totalCosts,
      balance,
      hasPropertyTax: parsed.hasPropertyTax,
      detectedAddress: parsed.detectedAddress,
      detectedUnit: parsed.detectedUnit,
      rawTextPreview: parsed.rawTextPreview,
    });
  } catch (err: any) {
    console.error("Error parsing utility PDF:", err);
    return NextResponse.json(
      { error: err.message || "Fehler beim Verarbeiten der PDF-Datei" },
      { status: 500 }
    );
  }
}
