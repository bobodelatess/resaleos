import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ListingJobStatus } from "@/generated/prisma/enums";

import { getPrismaClient } from "../prisma";

export interface ListingJobListOptions {
  status?: ListingJobStatus;
  inventoryItemId?: string;
  chatId?: string;
  limit?: number;
}

export function createListingJobRepository(client?: PrismaClient) {
  const database = () => client ?? getPrismaClient();

  return {
    create(data: Prisma.ListingJobCreateInput) {
      return database().listingJob.create({ data });
    },

    findById(id: string) {
      return database().listingJob.findUnique({
        where: { id },
        include: {
          inventoryItem: true,
          photos: { orderBy: { createdAt: "asc" } },
          draft: true,
        },
      });
    },

    update(id: string, data: Prisma.ListingJobUpdateInput) {
      return database().listingJob.update({ where: { id }, data });
    },

    list(options: ListingJobListOptions = {}) {
      return database().listingJob.findMany({
        where: {
          status: options.status,
          inventoryItemId: options.inventoryItemId,
          chatId: options.chatId,
        },
        include: { draft: true },
        orderBy: { updatedAt: "desc" },
        take: Math.min(Math.max(options.limit ?? 50, 1), 100),
      });
    },

    addPhoto(data: Prisma.ListingPhotoUncheckedCreateInput) {
      return database().listingPhoto.create({ data });
    },

    upsertDraft(
      listingJobId: string,
      data: Omit<Prisma.ListingDraftUncheckedCreateInput, "id" | "listingJobId">,
    ) {
      return database().listingDraft.upsert({
        where: { listingJobId },
        create: { ...data, listingJobId },
        update: data,
      });
    },
  };
}

export const listingJobRepository = createListingJobRepository();
