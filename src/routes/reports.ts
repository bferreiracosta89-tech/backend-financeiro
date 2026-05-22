import { Router } from "express";
import { prisma } from "../db/prisma";
import { AuthedRequest } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.get("/irpf/:year", async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const year = req.params.year;
    const [income, debts, payments, expenses, agreements] = await Promise.all([
      prisma.income.findUnique({ where: { userId } }),
      prisma.debt.findMany({ where: { userId } }),
      prisma.payment.findMany({ where: { userId, competencia: { startsWith: year } } }),
      prisma.expense.findMany({ where: { userId, data: { startsWith: year } } }),
      (prisma as any).agreement?.findMany({ where: { userId } }) ?? [],
    ]);
    res.json({ year, income, debts, payments, expenses, agreements });
  } catch (e) { next(e); }
});

reportsRouter.get("/legal-dossier", async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const [income, minExist, debts, payments, negotiations, legal] = await Promise.all([
      prisma.income.findUnique({ where: { userId } }),
      prisma.minExistencial.findUnique({ where: { userId } }),
      prisma.debt.findMany({ where: { userId } }),
      prisma.payment.findMany({ where: { userId } }),
      prisma.negotiation.findMany({ where: { userId } }),
      prisma.legalPlan.findUnique({ where: { userId } }),
    ]);
    const renda = income?.liquido ?? 0;
    const totalParcelas = debts.reduce((a, d) => a + (d.status !== "QUITADO" ? d.parcela : 0), 0);
    const minTotal = minExist ? Object.entries(minExist).reduce((acc, [k, v]) => typeof v === "number" && !["id", "userId"].includes(k) ? acc + v : acc, 0) : 0;
    const comprometimento = renda > 0 ? (totalParcelas / renda) * 100 : 0;
    res.json({ income, minExist, legal, debts, payments, negotiations, summary: { renda, totalParcelas, minTotal, comprometimento, elegivelSuperendividamento: comprometimento >= 35 } });
  } catch (e) { next(e); }
});
