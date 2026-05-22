import { Router } from "express";
import { prisma } from "../db/prisma";
import { AuthedRequest } from "../middleware/auth";

export const taxReportsRouter = Router();

taxReportsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const items = await prisma.taxReport.findMany({
      where: { userId: req.userId! },
      orderBy: { ano: "desc" },
    });
    res.json(items.filter((x) => !x.deletedAt));
  } catch (e) {
    next(e);
  }
});

taxReportsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const data = req.body || {};

    const saved = await prisma.taxReport.upsert({
      where: {
        userId_ano: {
          userId: req.userId!,
          ano: Number(data.ano),
        },
      },
      update: {
        rendimentos: Number(data.rendimentos || 0),
        dividasDeclaraveis: Number(
          data.dividasDeclaraveis || data.dividas_declaraveis || 0,
        ),
        pagamentosEfetuados: Number(
          data.pagamentosEfetuados || data.pagamentos_efetuados || 0,
        ),
        jurosPagos: Number(data.jurosPagos || data.juros_pagos || 0),
        descontosObtidos: Number(
          data.descontosObtidos || data.descontos_obtidos || 0,
        ),
        bancos: data.bancos || "",
        observacao: data.observacao || "",
        deletedAt: null,
      },
      create: {
        userId: req.userId!,
        ano: Number(data.ano),
        rendimentos: Number(data.rendimentos || 0),
        dividasDeclaraveis: Number(
          data.dividasDeclaraveis || data.dividas_declaraveis || 0,
        ),
        pagamentosEfetuados: Number(
          data.pagamentosEfetuados || data.pagamentos_efetuados || 0,
        ),
        jurosPagos: Number(data.jurosPagos || data.juros_pagos || 0),
        descontosObtidos: Number(
          data.descontosObtidos || data.descontos_obtidos || 0,
        ),
        bancos: data.bancos || "",
        observacao: data.observacao || "",
        deletedAt: null,
      },
    });

    res.json(saved);
  } catch (e) {
    next(e);
  }
});


taxReportsRouter.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.taxReport.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "TaxReport não encontrado" });

    const data = req.body || {};
    const saved = await prisma.taxReport.update({
      where: { id: existing.id },
      data: {
        ano: Number(data.ano || existing.ano),
        rendimentos: Number(data.rendimentos || 0),
        dividasDeclaraveis: Number(data.dividasDeclaraveis || data.dividas_declaraveis || 0),
        pagamentosEfetuados: Number(data.pagamentosEfetuados || data.pagamentos_efetuados || 0),
        jurosPagos: Number(data.jurosPagos || data.juros_pagos || 0),
        descontosObtidos: Number(data.descontosObtidos || data.descontos_obtidos || 0),
        bancos: data.bancos || "",
        observacao: data.observacao || "",
        deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      },
    });

    res.json(saved);
  } catch (e) {
    next(e);
  }
});

taxReportsRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.taxReport.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: "TaxReport não encontrado" });

    const saved = await prisma.taxReport.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    res.json(saved);
  } catch (e) {
    next(e);
  }
});
