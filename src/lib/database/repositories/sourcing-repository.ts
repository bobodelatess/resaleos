import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SourcingCandidateStatus } from "@/generated/prisma/enums";

import { getPrismaClient } from "../prisma";

export interface SourcingCandidateListOptions {
  sourcingProfileId?: string;
  marketplace?: string;
  status?: SourcingCandidateStatus;
  limit?: number;
}

export type UpsertSourcingCandidateInput = Omit<
  Prisma.SourcingCandidateUncheckedCreateInput,
  "id" | "firstSeenAt" | "lastSeenAt"
> & {
  firstSeenAt?: Date;
  lastSeenAt?: Date;
};

export function createSourcingRepository(client?: PrismaClient) {
  const database = () => client ?? getPrismaClient();

  return {
    createProfile(data: Prisma.SourcingProfileCreateInput) {
      return database().sourcingProfile.create({ data });
    },

    findProfileById(id: string) {
      return database().sourcingProfile.findUnique({ where: { id } });
    },

    updateProfile(id: string, data: Prisma.SourcingProfileUpdateInput) {
      return database().sourcingProfile.update({ where: { id }, data });
    },

    listProfiles(active?: boolean) {
      return database().sourcingProfile.findMany({
        where: { active },
        orderBy: { updatedAt: "desc" },
      });
    },

    createCandidate(data: Prisma.SourcingCandidateCreateInput) {
      return database().sourcingCandidate.create({ data });
    },

    upsertCandidate(data: UpsertSourcingCandidateInput) {
      const { marketplace, externalId, firstSeenAt, lastSeenAt, ...mutableData } = data;
      const now = new Date();

      return database().sourcingCandidate.upsert({
        where: { marketplace_externalId: { marketplace, externalId } },
        create: {
          marketplace,
          externalId,
          firstSeenAt: firstSeenAt ?? now,
          lastSeenAt: lastSeenAt ?? now,
          ...mutableData,
        },
        update: {
          ...mutableData,
          lastSeenAt: lastSeenAt ?? now,
        },
      });
    },

    findCandidateById(id: string) {
      return database().sourcingCandidate.findUnique({
        where: { id },
        include: { sourcingProfile: true, inventoryItem: true },
      });
    },

    findCandidateByExternalId(marketplace: string, externalId: string) {
      return database().sourcingCandidate.findUnique({
        where: { marketplace_externalId: { marketplace, externalId } },
      });
    },

    updateCandidate(id: string, data: Prisma.SourcingCandidateUpdateInput) {
      return database().sourcingCandidate.update({ where: { id }, data });
    },

    listCandidates(options: SourcingCandidateListOptions = {}) {
      return database().sourcingCandidate.findMany({
        where: {
          sourcingProfileId: options.sourcingProfileId,
          marketplace: options.marketplace,
          status: options.status,
        },
        orderBy: { lastSeenAt: "desc" },
        take: Math.min(Math.max(options.limit ?? 50, 1), 100),
      });
    },
  };
}

export const sourcingRepository = createSourcingRepository();
