import { NextRequest, NextResponse } from "next/server";
import { rankSourcingCandidates } from "@/lib/automation/ai";
import { sourcingRequestSchema } from "@/lib/automation/schemas";
import { hasAutomationAccess } from "@/lib/automation/security";
import { sendSourcingRecommendations } from "@/lib/automation/telegram";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const body = sourcingRequestSchema.parse(await request.json());
    const ranking = await rankSourcingCandidates(body);
    if (body.notify) await sendSourcingRecommendations(body.candidates, ranking);
    return NextResponse.json(ranking);
  } catch (error) {
    console.error("Sourcing ranking failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Classement indisponible." },
      { status: 503 },
    );
  }
}
