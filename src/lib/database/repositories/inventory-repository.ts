import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { InventoryItemStatus } from "@/generated/prisma/enums";

import { getPrismaClient } from "../prisma";

export interface InventoryListOptions {
  status?: InventoryItemStatus;
  search?: string;
  limit?: number;
}

export function createInventoryRepository(client?: PrismaClient) {
  const database = () => client ?? getPrismaClient();

  return {
    create(data: Prisma.InventoryItemCreateInput) {
      return database().inventoryItem.create({
        data,
        include: { sourceCandidate: true },
      });
    },

    findById(id: string) {
      return database().inventoryItem.findUnique({
        where: { id },
        include: {
          sourceCandidate: true,
          listingJobs: { orderBy: { createdAt: "desc" } },
          marketplaceListings: { orderBy: { createdAt: "desc" } },
          sale: true,
        },
      });
    },

    findBySku(sku: string) {
      return database().inventoryItem.findUnique({ where: { sku } });
    },

    update(id: string, data: Prisma.InventoryItemUpdateInput) {
      return database().inventoryItem.update({ where: { id }, data });
    },

    list(options: InventoryListOptions = {}) {
      const search = options.search?.trim();
      const where: Prisma.InventoryItemWhereInput = {
        status: options.status,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      return database().inventoryItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: Math.min(Math.max(options.limit ?? 50, 1), 100),
      });
    },
  };
}

export const inventoryRepository = createInventoryRepository();
