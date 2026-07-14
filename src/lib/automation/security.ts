import type { NextRequest } from "next/server";

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function hasAutomationAccess(request: NextRequest): boolean {
  const expected = process.env.RESALE_AUTOMATION_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const custom = request.headers.get("x-resale-secret");
  const provided = bearer || custom || "";
  return timingSafeEqual(provided, expected);
}

export function hasTelegramAccess(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const provided = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return timingSafeEqual(provided, expected);
}
