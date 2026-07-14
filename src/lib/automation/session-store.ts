import type { GarmentAnalysis } from "./schemas";

interface MemorySession {
  photos: string[];
  context: string;
  analysis?: GarmentAnalysis;
  expiresAt: number;
}

const globalMemory = globalThis as typeof globalThis & {
  resaleSessions?: Map<string, MemorySession>;
};
const memory = globalMemory.resaleSessions ?? new Map<string, MemorySession>();
globalMemory.resaleSessions = memory;

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 2;

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis<T>(command: Array<string | number>): Promise<T> {
  const config = redisConfig();
  if (!config) throw new Error("Redis n'est pas configuré.");
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || body.error) {
    throw new Error(body.error || `Redis a répondu ${response.status}.`);
  }
  return body.result as T;
}

function baseKey(chatId: string): string {
  return `resaleos:telegram:${chatId}`;
}

function memorySession(chatId: string): MemorySession {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Upstash Redis est requis en production pour les sessions de messagerie.",
    );
  }
  const current = memory.get(chatId);
  if (current && current.expiresAt > Date.now()) return current;
  const fresh: MemorySession = {
    photos: [],
    context: "",
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  memory.set(chatId, fresh);
  return fresh;
}

export async function resetSession(chatId: string): Promise<void> {
  if (redisConfig()) {
    const key = baseKey(chatId);
    await redis(["DEL", `${key}:photos`, `${key}:context`, `${key}:analysis`]);
    return;
  }
  memory.delete(chatId);
}

export async function appendPhoto(chatId: string, fileId: string): Promise<number> {
  if (redisConfig()) {
    const key = `${baseKey(chatId)}:photos`;
    await redis(["RPUSH", key, fileId]);
    await redis(["LTRIM", key, -8, -1]);
    await redis(["EXPIRE", key, SESSION_TTL_SECONDS]);
    return redis<number>(["LLEN", key]);
  }
  const session = memorySession(chatId);
  session.photos = [...session.photos, fileId].slice(-8);
  session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  return session.photos.length;
}

export async function setContext(chatId: string, context: string): Promise<void> {
  const trimmed = context.trim().slice(0, 6000);
  if (redisConfig()) {
    await redis(["SET", `${baseKey(chatId)}:context`, trimmed, "EX", SESSION_TTL_SECONDS]);
    return;
  }
  const session = memorySession(chatId);
  session.context = trimmed;
  session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
}

export async function getSession(chatId: string): Promise<{
  photos: string[];
  context: string;
  analysis?: GarmentAnalysis;
}> {
  if (redisConfig()) {
    const key = baseKey(chatId);
    const [photos, context, analysis] = await Promise.all([
      redis<string[]>(["LRANGE", `${key}:photos`, 0, -1]),
      redis<string | null>(["GET", `${key}:context`]),
      redis<string | null>(["GET", `${key}:analysis`]),
    ]);
    return {
      photos: photos || [],
      context: context || "",
      analysis: analysis ? (JSON.parse(analysis) as GarmentAnalysis) : undefined,
    };
  }
  const session = memorySession(chatId);
  return {
    photos: session.photos,
    context: session.context,
    analysis: session.analysis,
  };
}

export async function saveAnalysis(chatId: string, analysis: GarmentAnalysis): Promise<void> {
  if (redisConfig()) {
    await redis([
      "SET",
      `${baseKey(chatId)}:analysis`,
      JSON.stringify(analysis),
      "EX",
      SESSION_TTL_SECONDS,
    ]);
    return;
  }
  const session = memorySession(chatId);
  session.analysis = analysis;
  session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
}
