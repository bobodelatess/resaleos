import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { OfferActionStatus } from "@/generated/prisma/enums";

import { getPrismaClient } from "../prisma";

export interface OfferActionListOptions {
  conversationId?: string;
  status?: OfferActionStatus;
  limit?: number;
}

export function createOfferActionRepository(client?: PrismaClient) {
  const database = () => client ?? getPrismaClient();

  return {
    create(data: Prisma.OfferActionCreateInput) {
      return database().offerAction.create({ data });
    },

    findById(id: string) {
      return database().offerAction.findUnique({
        where: { id },
        include: { conversation: true, message: true },
      });
    },

    update(id: string, data: Prisma.OfferActionUpdateInput) {
      return database().offerAction.update({ where: { id }, data });
    },

    list(options: OfferActionListOptions = {}) {
      return database().offerAction.findMany({
        where: {
          conversationId: options.conversationId,
          status: options.status,
        },
        orderBy: { updatedAt: "desc" },
        take: Math.min(Math.max(options.limit ?? 50, 1), 100),
      });
    },
  };
}

export const offerActionRepository = createOfferActionRepository();
