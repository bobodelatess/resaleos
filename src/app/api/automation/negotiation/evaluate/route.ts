import { NextRequest, NextResponse } from "next/server";
import { evaluateNegotiation } from "@/lib/automation/negotiation";
import { negotiationRequestSchema } from "@/lib/automation/schemas";
import { hasAutomationAccess } from "@/lib/automation/security";
import { sendNegotiationNotification } from "@/lib/automation/telegram";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const body = negotiationRequestSchema.parse(await request.json());
    const result = await evaluateNegotiation(body);
    if (result.execution.mode !== "auto_reply") {
      await sendNegotiationNotification(body, result);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Negotiation evaluation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analyse indisponible." },
      { status: 503 },
    );
  }
}
