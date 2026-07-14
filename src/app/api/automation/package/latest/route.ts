import { NextRequest, NextResponse } from "next/server";
import { hasAutomationAccess } from "@/lib/automation/security";
import { getLatestApprovedPackage } from "@/lib/automation/workflow-store";

export async function GET(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  const listingPackage = await getLatestApprovedPackage();
  if (!listingPackage) {
    return NextResponse.json(
      { error: "Aucune annonce approuvée n'attend l'extension." },
      { status: 404 },
    );
  }
  return NextResponse.json(listingPackage);
}
