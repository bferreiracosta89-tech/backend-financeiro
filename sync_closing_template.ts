import { Router } from "express";
import { prisma } from "../lib/prisma";
import { cleanForPrisma } from "../utils/mapper";

export const syncRouter = Router();

type EntityConfig = {
  key: string;
  model: any;
  singleton?: boolean;
};

const entities = (prisma: any): EntityConfig[] => [
  { key: "income", model: prisma.income, singleton: true },
  { key: "minExist", model: prisma.minExistencial, singleton: true },
  { key: "legal", model: prisma.legalPlan, singleton: true },
  { key: "debts", model: prisma.debt },
  { key: "expenses", model: prisma.expense },
  { key: "accounts", model: prisma.account },
  { key: "negotiations", model: prisma.negotiation },
  { key: "reminders", model: prisma.reminder },
  { key: "payments", model: prisma.payment },
  { key: "agreements", model: prisma.agreement },
  { key: "legalAgreements", model: prisma.legalAgreement },
  { key: "taxReports", model: prisma.taxReport },
];

async function upsertSyncMap(userId: string, entity: string, localId: string, serverId: string) {
  if (!prisma.syncMap) return;

  await prisma.syncMap.upsert({
    where: {
      userId_entity_localId: {
        userId,
        entity,
        localId,
      },
    },
    update: { serverId },
    create: { userId, entity, localId, serverId },
  });
}

async function getServerId(userId: string, entity: string, localId: string) {
  if (!prisma.syncMap) return null;
  const found = await prisma.syncMap.findUnique({
    where: {
      userId_entity_localId: {
        userId,
        entity,
        localId,
      },
    },
  });
  return found?.serverId || null;
}

syncRouter.post("/", async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const push = req.body?.push || {};
    const now = new Date();

    const syncMap: any[] = [];

    for (const cfg of entities(prisma)) {
      const data = push[cfg.key];

      if (!data) continue;

      if (cfg.singleton) {
        const clean = cleanForPrisma(data);
        delete clean.id;

        await cfg.model.upsert({
          where: { userId },
          update: clean,
          create: { ...clean, userId },
        });

        continue;
      }

      if (!Array.isArray(data)) continue;

      for (const item of data) {
        const clean = cleanForPrisma(item);
        const localId = String(item.id);

        let serverId = item.serverId || await getServerId(userId, cfg.key, localId);

        if (item.deletedAt || item.deleted_at || item.syncStatus === "DELETED") {
          if (serverId) {
            await cfg.model.update({
              where: { id: serverId },
              data: { deletedAt: now },
            }).catch(() => {});
          }
          continue;
        }

        delete clean.id;

        if (serverId) {
          await cfg.model.update({
            where: { id: serverId },
            data: clean,
          }).catch(async () => {
            const created = await cfg.model.create({ data: { ...clean, userId } });
            serverId = created.id;
          });
        } else {
          const created = await cfg.model.create({ data: { ...clean, userId } });
          serverId = created.id;
        }

        if (serverId) {
          await upsertSyncMap(userId, cfg.key, localId, serverId);
          syncMap.push({ entity: cfg.key, localId, serverId });
        }
      }
    }

    const pull: any = {};

    for (const cfg of entities(prisma)) {
      if (cfg.singleton) {
        pull[cfg.key] = await cfg.model.findUnique?.({ where: { userId } }).catch(() => null);
      } else {
        pull[cfg.key] = await cfg.model.findMany?.({
          where: {
            userId,
            OR: [{ deletedAt: null }, { deletedAt: undefined }],
          },
        }).catch(() => []);
      }
    }

    res.json({
      now: now.toISOString(),
      pull,
      syncMap,
    });
  } catch (err) {
    next(err);
  }
});