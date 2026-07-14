import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAutomationAccess } from "@/lib/automation/security";
import { markListingPublished } from "@/lib/automation/workflow-store";

const requestSchema = z.object({ jobId: z.string().uuid() });

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const { jobId } = requestSchema.parse(await request.json());
    const job = await markListingPublished(jobId);
    return NextResponse.json({ ok: true, publishedAt: job.publishedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publication invalide." },
      { status: 400 },
    );
  }
}
