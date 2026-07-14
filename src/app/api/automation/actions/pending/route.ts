import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAutomationAccess } from "@/lib/automation/security";
import { sendOfferExecutionFailure } from "@/lib/automation/telegram";
import {
  acknowledgeOfferAction,
  listReadyOfferActions,
} from "@/lib/automation/workflow-store";

const acknowledgeSchema = z.object({
  id: z.string().uuid(),
  ok: z.boolean(),
  error: z.string().max(1000).optional().default(""),
});

export async function GET(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  return NextResponse.json({ actions: await listReadyOfferActions() });
}

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const body = acknowledgeSchema.parse(await request.json());
    const action = await acknowledgeOfferAction(body.id, body.ok, body.error);
    if (action.status === "failed") await sendOfferExecutionFailure(action);
    return NextResponse.json(action);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Accusé de réception invalide." },
      { status: 400 },
    );
  }
}
