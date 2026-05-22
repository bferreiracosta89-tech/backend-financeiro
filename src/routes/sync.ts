import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { AuthedRequest } from "../middleware/auth";
import { cleanForPrisma, isLocalId } from "../utils/mapper";
import { applyDomainEffects } from "../lib/crud";

export const syncRouter = Router();

const PluralItem = z.object({ id: z.string().min(1) }).passthrough();
const Body = z.object({
  since: z.string().nullish(),
  push: z
    .object({
      income: z.record(z.any()).optional(),
      minExist: z.record(z.any()).optional(),
      legal: z.record(z.any()).optional(),
      debts: z.array(PluralItem).optional(),
      cardPurchases: z.array(PluralItem).optional(),
      expenses: z.array(PluralItem).optional(),
      accounts: z.array(PluralItem).optional(),
      negotiations: z.array(PluralItem).optional(),
      reminders: z.array(PluralItem).optional(),
      payments: z.array(PluralItem).optional(),
      agreements: z.array(PluralItem).optional(),
      legalAgreements: z.array(PluralItem).optional(),
      paymentAlerts: z.array(PluralItem).optional(),
      taxReports: z.array(PluralItem).optional(),
    })
    .default({}),
});

const PLURAL_MODELS = [
  ["debts", "debt"],
  ["accounts", "account"],
  ["cardPurchases", "cardPurchase"],
  ["expenses", "expense"],
  ["negotiations", "negotiation"],
  ["agreements", "agreement"],
  ["legalAgreements", "legalAgreement"],
  ["payments", "payment"],
  ["reminders", "reminder"],
  ["paymentAlerts", "paymentAlert"],
  ["taxReports", "taxReport"],
] as const;

function pascal(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function modelMeta(modelName: string): any | null {
  const models = (prisma as any)._runtimeDataModel?.models || {};
  return models[pascal(modelName)] || models[modelName] || null;
}

function scalarFieldSet(modelName: string): Set<string> {
  const meta = modelMeta(modelName);
  const fields = meta?.fields || [];
  return new Set(
    fields
      .filter((f: any) => f.kind === "scalar" || f.kind === "enum")
      .map((f: any) => f.name),
  );
}

function relationFieldSet(modelName: string): Set<string> {
  const meta = modelMeta(modelName);
  const fields = meta?.fields || [];
  return new Set(
    fields.filter((f: any) => f.kind === "object").map((f: any) => f.name),
  );
}

function keepOnlyPrismaScalars(modelName: string, data: any) {
  const allowed = scalarFieldSet(modelName);
  if (!allowed.size) return data;

  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) delete data[key];
  }

  return data;
}

function normalizeNulls(data: any) {
  for (const key of Object.keys(data)) {
    if (data[key] === "null" || data[key] === "undefined") data[key] = null;
  }
  return data;
}

async function mapLocalRelationId(entity: string, userId: string, value: any) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "null" ||
    value === "undefined"
  ) {
    return null;
  }

  const raw = String(value);
  if (!isLocalId(raw)) return raw;

  const mapped = await prisma.syncMap.findFirst({
    where: { userId, entity, localId: raw },
  });

  return mapped?.serverId ?? null;
}

const RELATION_MODEL: Record<string, string> = {
  debts: "debt",
  accounts: "account",
  cardPurchases: "cardPurchase",
  payments: "payment",
  expenses: "expense",
  negotiations: "negotiation",
  agreements: "agreement",
  legalAgreements: "legalAgreement",
};

async function relationExists(entity: string, userId: string, serverId: string | null) {
  if (!serverId) return false;
  const modelName = RELATION_MODEL[entity];
  const model = modelName ? (prisma as any)[modelName] : null;
  if (!model?.findFirst) return true;
  const found = await model.findFirst({ where: { id: serverId, userId, deletedAt: null } }).catch(() => null);
  return !!found;
}

async function addRelationConnect(
  clean: any,
  modelName: string,
  relationName: string,
  scalarName: string,
  serverId: string | null,
) {
  if (!serverId) return;

  const relations = relationFieldSet(modelName);
  const scalars = scalarFieldSet(modelName);

  if (relations.has(relationName)) {
    clean[relationName] = { connect: { id: serverId } };
  } else if (scalars.has(scalarName)) {
    clean[scalarName] = serverId;
  }
}

async function normalizeRelations(
  entity: string,
  modelName: string,
  userId: string,
  raw: any,
  clean: any,
) {
  const relationMap: Array<{
    rawFields: string[];
    relation: string;
    scalar: string;
    relatedEntity: string;
    requiredFor?: string[];
  }> = [
    {
      rawFields: ["debtId", "debt_id"],
      relation: "debt",
      scalar: "debtId",
      relatedEntity: "debts",
      requiredFor: ["payments", "cardPurchases", "reminders", "paymentAlerts"],
    },
    {
      rawFields: ["accountId", "account_id"],
      relation: "account",
      scalar: "accountId",
      relatedEntity: "accounts",
    },
    {
      rawFields: ["cardPurchaseId", "card_purchase_id"],
      relation: "cardPurchase",
      scalar: "cardPurchaseId",
      relatedEntity: "cardPurchases",
    },
  ];

  for (const rel of relationMap) {
    let value: any = undefined;
    for (const field of rel.rawFields) {
      if (raw[field] !== undefined) value = raw[field];
      delete clean[field];
    }

    if (value === undefined) continue;

    const serverId = await mapLocalRelationId(rel.relatedEntity, userId, value);
    const isRequired = rel.requiredFor?.includes(entity) ?? false;

    if (!serverId) {
      if (isRequired) return false;
      delete clean[rel.scalar];
      delete clean[rel.relation];
      continue;
    }

    const exists = await relationExists(rel.relatedEntity, userId, serverId);
    if (!exists) {
      // Relação opcional inexistente no servidor: não conecta para não derrubar o sync.
      // Ex.: gasto local apontando para conta local ainda não mapeada/removida.
      if (isRequired) return false;
      delete clean[rel.scalar];
      delete clean[rel.relation];
      continue;
    }

    await addRelationConnect(
      clean,
      modelName,
      rel.relation,
      rel.scalar,
      serverId,
    );
  }

  return true;
}

function num(v: any) { return Number(v || 0); }
function intFrom(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const n = Number.parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
function debtStatusByBalance(baseStatus: string, total: number, qtdParcelas: number, parcelasPagas: number) {
  if (total <= 0) return 'QUITADO';
  if (qtdParcelas > 0 && parcelasPagas >= qtdParcelas) return 'QUITADO';
  return baseStatus;
}
function normalizeDebtClean(modelName: string, clean: any) {
  if (modelName !== 'debt') return clean;
  const total = num(clean.total ?? clean.valorTotal);
  const valorTotal = num(clean.valorTotal ?? clean.total);
  const qtdParcelas = intFrom(clean.qtdParcelas, 0);
  const parcelasPagas = Math.max(0, intFrom(clean.parcelasPagas, 0));
  return {
    ...clean,
    total,
    valorTotal: valorTotal > 0 ? valorTotal : total,
    qtdParcelas,
    parcelasPagas,
    status: debtStatusByBalance(String(clean.status || 'PAGAR'), total, qtdParcelas, parcelasPagas),
  };
}


async function sanitizeNestedConnects(modelName: string, userId: string, clean: any) {
  const checks: Array<{ relation: string; entity: string }> = [
    { relation: 'account', entity: 'accounts' },
    { relation: 'debt', entity: 'debts' },
    { relation: 'cardPurchase', entity: 'cardPurchases' },
  ];
  for (const c of checks) {
    const id = clean?.[c.relation]?.connect?.id;
    if (!id) continue;
    const exists = await relationExists(c.entity, userId, String(id));
    if (!exists) delete clean[c.relation];
  }
  return clean;
}

function buildPrismaData(modelName: string, rawData: any) {
  const raw = normalizeNulls({ ...rawData });
  let clean = keepOnlyPrismaScalars(modelName, { ...raw });

  delete clean.id;
  delete clean.serverId;
  clean = normalizeDebtClean(modelName, clean);

  return { raw, clean };
}

async function pushSingleton(
  name: string,
  modelName: string,
  model: any,
  userId: string,
  data: any,
) {
  if (!data) return;

  const existing = await model.findUnique({ where: { userId } });
  if (
    existing &&
    data.updatedAt &&
    new Date(data.updatedAt) < new Date(existing.updatedAt)
  ) {
    return;
  }

  const { clean } = buildPrismaData(modelName, cleanForPrisma(name, data));
  delete clean.deletedAt;

  await model.upsert({
    where: { userId },
    update: clean,
    create: { ...clean, user: { connect: { id: userId } } },
  });
}

async function resolveServerId(entity: string, userId: string, item: any) {
  if (item.serverId) return String(item.serverId);
  if (!isLocalId(item.id)) return String(item.id);

  const map = await prisma.syncMap.findFirst({
    where: { userId, entity, localId: String(item.id) },
  });

  return map?.serverId ?? null;
}

async function rememberMapping(
  entity: string,
  userId: string,
  localId: string,
  serverId: string,
) {
  if (!isLocalId(localId)) return;

  await prisma.syncMap.upsert({
    where: { userId_entity_localId: { userId, entity, localId } },
    update: { serverId },
    create: { userId, entity, localId, serverId },
  });
}

async function pushPlural(
  name: string,
  modelName: string,
  model: any,
  userId: string,
  items: any[],
  syncMap: any[],
) {
  for (const item of items) {
    const localId = String(item.id);
    const mappedInput = cleanForPrisma(name, item);
    const { raw, clean } = buildPrismaData(modelName, mappedInput);

    const canPersist = await normalizeRelations(
      name,
      modelName,
      userId,
      raw,
      clean,
    );
    await sanitizeNestedConnects(modelName, userId, clean);
    if (!canPersist) continue;

    const serverId = await resolveServerId(name, userId, item);
    const existing = serverId
      ? await model.findFirst({ where: { id: serverId, userId } })
      : null;

    if (existing) {
      if (
        item.updatedAt &&
        new Date(item.updatedAt) < new Date(existing.updatedAt)
      ) {
        continue;
      }

      const before = existing;
      const updated = await model.update({ where: { id: existing.id }, data: clean });
      await applyDomainEffects(modelName, userId, before, updated, !!updated.deletedAt);
      await rememberMapping(name, userId, localId, existing.id);
      syncMap.push({ entity: name, localId, serverId: existing.id });
    } else {
      if (name === "taxReports") {
        const ano = Number(clean.ano || item.ano || 0);
        if (!ano) continue;
        delete clean.id;
        delete clean.deletedAt;

        const saved = await prisma.taxReport.upsert({
          where: { userId_ano: { userId, ano } },
          update: clean,
          create: { ...clean, ano, user: { connect: { id: userId } } },
        });
        await rememberMapping(name, userId, localId, saved.id);
        syncMap.push({ entity: name, localId, serverId: saved.id });
        continue;
      }

      const createData = isLocalId(localId)
        ? { ...clean, user: { connect: { id: userId } } }
        : { ...clean, id: localId, user: { connect: { id: userId } } };

      const created = await model.create({ data: createData });
      await applyDomainEffects(modelName, userId, null, created, !!created.deletedAt);
      await rememberMapping(name, userId, localId, created.id);
      syncMap.push({ entity: name, localId, serverId: created.id });
    }
  }
}

syncRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const { since, push } = Body.parse(req.body);
    const userId = req.userId!;
    const sinceDate = since ? new Date(since) : null;
    const now = new Date();
    const syncMap: any[] = [];

    await pushSingleton("income", "income", prisma.income, userId, push.income);
    await pushSingleton(
      "minExistencial",
      "minExistencial",
      prisma.minExistencial,
      userId,
      push.minExist,
    );
    await pushSingleton(
      "legalPlan",
      "legalPlan",
      prisma.legalPlan,
      userId,
      push.legal,
    );

    for (const [key, modelName] of PLURAL_MODELS) {
      const model = (prisma as any)[modelName];
      if (!model) continue;
      const items = (push as any)[key];
      if (items?.length) {
        await pushPlural(key, modelName, model, userId, items, syncMap);
      }
    }

    const income = await prisma.income.findUnique({ where: { userId } });
    const minExist = await prisma.minExistencial.findUnique({
      where: { userId },
    });
    const legal = await prisma.legalPlan.findUnique({ where: { userId } });

    const pull: any = { income, minExist, legal };
    for (const [key, modelName] of PLURAL_MODELS) {
      const model = (prisma as any)[modelName];
      if (!model) continue;
      const where: any = { userId };
      if (sinceDate) where.updatedAt = { gt: sinceDate };
      pull[key] = await model.findMany({
        where,
        orderBy: { updatedAt: "asc" },
      });
    }

    res.json({ now: now.toISOString(), syncMap, pull });
  } catch (e) {
    next(e);
  }
});
