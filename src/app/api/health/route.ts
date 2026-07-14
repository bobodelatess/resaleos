import { NextResponse } from "next/server";

export function GET() {
  const redis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  const imageGeneration = Boolean(
    process.env.OPENAI_API_KEY &&
      (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
  );
  return NextResponse.json({
    ok: true,
    service: "resaleos",
    textModel: process.env.RESALE_AI_MODEL || "openai/gpt-5.6",
    imageModel: process.env.RESALE_IMAGE_MODEL || "gpt-image-2",
    aiGatewayConfigured: Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
    ),
    imageGenerationConfigured: imageGeneration,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    durableSessionsConfigured: redis,
    autonomousWorkflowReady: Boolean(
      redis && imageGeneration && process.env.TELEGRAM_BOT_TOKEN,
    ),
    legacyImageProcessorConfigured: Boolean(process.env.RESALE_IMAGE_PROCESSOR_URL),
  });
}
