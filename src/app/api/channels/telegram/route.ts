import { after, NextRequest, NextResponse } from "next/server";
import { hasTelegramAccess } from "@/lib/automation/security";
import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/automation/telegram";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasTelegramAccess(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const update = (await request.json()) as TelegramUpdate;
    after(async () => {
      try {
        await handleTelegramUpdate(update);
      } catch (error) {
        console.error("Telegram background processing failed", error);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed", error);
    // Un 200 évite une boucle de relivraison Telegram sur une erreur métier.
    return NextResponse.json({ ok: true });
  }
}
