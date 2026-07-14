import { NextRequest, NextResponse } from "next/server";
import { analyzeGarment } from "@/lib/automation/ai";
import { analyzeRequestSchema } from "@/lib/automation/schemas";
import { hasAutomationAccess } from "@/lib/automation/security";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasAutomationAccess(request)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = analyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requête invalide.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const totalCharacters = parsed.data.images.reduce((sum, image) => sum + image.length, 0);
    if (totalCharacters > 12_000_000) {
      return NextResponse.json(
        { error: "Les images dépassent 12 Mo encodés. Réduis leur nombre ou leur taille." },
        { status: 413 },
      );
    }
    if (
      parsed.data.images.some(
        (image) => !image.startsWith("data:image/") && !image.startsWith("https://"),
      )
    ) {
      return NextResponse.json(
        { error: "Chaque image doit être une data URL ou une URL HTTPS." },
        { status: 400 },
      );
    }

    const analysis = await analyzeGarment({
      images: parsed.data.images.map((data) => ({ data })),
      context: parsed.data.context,
    });
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Garment analysis failed", error);
    return NextResponse.json(
      { error: "Analyse IA indisponible. Vérifie le modèle et les identifiants configurés." },
      { status: 503 },
    );
  }
}
