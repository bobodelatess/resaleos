import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prepareMarketplaceImages } from "@/lib/automation/image-processor";
import { hasAutomationAccess } from "@/lib/automation/security";

const requestSchema = z.object({
  images: z.array(z.string()).min(1).max(8),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    const body = requestSchema.parse(await request.json());
    return NextResponse.json({ images: await prepareMarketplaceImages(body.images) });
  } catch (error) {
    console.error("Image preparation failed", error);
    return NextResponse.json(
      { error: "Traitement d'images indisponible ou réponse invalide." },
      { status: 503 },
    );
  }
}
