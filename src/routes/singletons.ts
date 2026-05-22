import { Router } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

export const singletonsRouter = Router();

// INCOME ----------------------------------------------------------
singletonsRouter.get('/income', async (req: AuthedRequest, res, next) => {
  try {
    const data = await prisma.income.findUnique({ where: { userId: req.userId! } });
    res.json(data);
  } catch (e) { next(e); }
});
singletonsRouter.put('/income', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body || {};
    const data = await prisma.income.upsert({
      where: { userId: req.userId! },
      update: b,
      create: { ...b, userId: req.userId! },
    });
    res.json(data);
  } catch (e) { next(e); }
});

// MIN EXISTENCIAL --------------------------------------------------
singletonsRouter.get('/minexist', async (req: AuthedRequest, res, next) => {
  try {
    const data = await prisma.minExistencial.findUnique({ where: { userId: req.userId! } });
    res.json(data);
  } catch (e) { next(e); }
});
singletonsRouter.put('/minexist', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body || {};
    const data = await prisma.minExistencial.upsert({
      where: { userId: req.userId! },
      update: b,
      create: { ...b, userId: req.userId! },
    });
    res.json(data);
  } catch (e) { next(e); }
});

// LEGAL PLAN -------------------------------------------------------
singletonsRouter.get('/legal', async (req: AuthedRequest, res, next) => {
  try {
    const data = await prisma.legalPlan.findUnique({ where: { userId: req.userId! } });
    res.json(data);
  } catch (e) { next(e); }
});
singletonsRouter.put('/legal', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body || {};
    const data = await prisma.legalPlan.upsert({
      where: { userId: req.userId! },
      update: b,
      create: { ...b, userId: req.userId! },
    });
    res.json(data);
  } catch (e) { next(e); }
});
