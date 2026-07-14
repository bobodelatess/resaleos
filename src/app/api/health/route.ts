import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "resaleos",
    aiConfigured: Boolean(process.env.RESALE_AI_MODEL),
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    durableSessionsConfigured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
    ),
    imageProcessorConfigured: Boolean(process.env.RESALE_IMAGE_PROCESSOR_URL),
  });
}
