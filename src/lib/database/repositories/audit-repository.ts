import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import { getPrismaClient } from "../prisma";

const sensitiveKey =
  /(token|secret|password|authorization|cookie|api[-_]?key|database[-_]?url|connection[-_]?string)/i;
const sensitiveValuePatterns = [
  /^Bearer\s+\S+$/i,
  /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/,
  /\b(?:sk|gh[pousr]|xox[baprs])-[A-Za-z0-9_-]{10,}\b/i,
];

type SafeJson =
  | string
  | number
  | boolean
  | null
  | SafeJson[]
  | { [key: string]: SafeJson };

function safePrimitive(value: unknown): SafeJson {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  return sensitiveValuePatterns.some((pattern) => pattern.test(text))
    ? "[REDACTED]"
    : text;
}

export function sanitizeAuditPayload(value: unknown): SafeJson {
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload);

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : sanitizeAuditPayload(nestedValue),
      ]),
    );
  }

  return safePrimitive(value);
}

export interface CreateAuditEventInput {
  entityType: string;
  entityId: string;
  action: string;
  source: string;
  payload?: unknown;
}

export interface AuditEventListOptions {
  entityType?: string;
  entityId?: string;
  action?: string;
  limit?: number;
}

export function createAuditRepository(client?: PrismaClient) {
  const database = () => client ?? getPrismaClient();

  return {
    create(input: CreateAuditEventInput) {
      const payload =
        input.payload === undefined
          ? undefined
          : (sanitizeAuditPayload(input.payload) as Prisma.InputJsonValue);

      return database().auditEvent.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          source: input.source,
          ...(payload === undefined ? {} : { payload }),
        },
      });
    },

    findById(id: string) {
      return database().auditEvent.findUnique({ where: { id } });
    },

    list(options: AuditEventListOptions = {}) {
      return database().auditEvent.findMany({
        where: {
          entityType: options.entityType,
          entityId: options.entityId,
          action: options.action,
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(options.limit ?? 100, 1), 200),
      });
    },
  };
}

export const auditRepository = createAuditRepository();
