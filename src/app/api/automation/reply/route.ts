import { NextRequest, NextResponse } from "next/server";
import { draftBuyerReply } from "@/lib/automation/ai";
import { replyRequestSchema } from "@/lib/automation/schemas";
import { hasAutomationAccess } from "@/lib/automation/security";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const parsed = replyRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requête invalide.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ reply: await draftBuyerReply(parsed.data) });
  } catch (error) {
    console.error("Buyer reply generation failed", error);
    return NextResponse.json({ error: "Génération de réponse indisponible." }, { status: 503 });
  }
}
