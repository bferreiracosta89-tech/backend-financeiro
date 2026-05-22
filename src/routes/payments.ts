import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthedRequest } from '../middleware/auth';
import { applyPaymentToDebt } from '../lib/crud';

export const paymentsRouter = Router();

const PAYMENT_TYPES = ['PARCELA','AMORTIZACAO','LIQUIDACAO','PARCIAL','NAO_PAGO'] as const;

const CreateBody = z.object({
  id: z.string().min(1),
  debtId: z.string().min(1),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM'),
  dataPagamento: z.string().default(''),
  valorPago: z.number().nonnegative(),
  tipo: z.enum(PAYMENT_TYPES),
  amortizacaoModo: z.string().optional().default(''), // usado apenas na regra; não persistir no Prisma quando schema não tem campo
  juros: z.number().nonnegative().default(0),
  desconto: z.number().nonnegative().default(0),
  observacao: z.string().default(''),
});


/** GET /payments/by-debt?competencia=YYYY-MM — agrupamento por dívida para controle */
paymentsRouter.get('/by-debt', async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const competencia = req.query.competencia ? String(req.query.competencia) : '';
    // Pagamentos precisam sobreviver visualmente à exclusão da dívida.
    // Por isso esta visão inclui dívidas soft-deletadas quando existe histórico de pagamento.
    const where: any = { userId, deletedAt: null };
    if (competencia) where.competencia = competencia;
    const payments = await prisma.payment.findMany({ where, orderBy: [{ competencia: 'desc' }, { createdAt: 'desc' }] });
    const debtIdsWithHistory = Array.from(new Set(payments.map((p) => p.debtId).filter(Boolean)));
    const debts = await prisma.debt.findMany({
      where: {
        userId,
        OR: [
          { deletedAt: null },
          debtIdsWithHistory.length ? { id: { in: debtIdsWithHistory } } : { id: '__none__' },
        ],
      },
      orderBy: { credor: 'asc' },
    });
    const grouped = debts
      .map((d) => {
        const ps = payments.filter((p) => p.debtId === d.id);
        const deleted = !!d.deletedAt;
        // Dívida excluída mantém histórico, mas não gera nova pendência mensal.
        const previsto = deleted ? 0 : Number(d.parcela || 0);
        const pago = ps.filter((p) => p.tipo !== 'NAO_PAGO').reduce((acc, p) => acc + Number(p.valorPago || 0), 0);
        return {
          debtId: d.id,
          credor: d.credor,
          status: deleted ? 'EXCLUIDA' : d.status,
          deletedAt: d.deletedAt,
          debt: d,
          saldo: d.total,
          parcela: d.parcela,
          qtdParcelas: d.qtdParcelas,
          parcelasPagas: d.parcelasPagas,
          previsto,
          pago,
          restante: Math.max(0, previsto - pago),
          pagamentos: ps,
        };
      })
      .filter((g) => !g.deletedAt || g.pagamentos.length > 0);
    res.json(grouped);
  } catch (e) { next(e); }
});

/** POST /payments/amortize — amortização escolhendo próximas ou últimas parcelas */
paymentsRouter.post('/amortize', async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const debtId = String(req.body?.debtId || req.body?.debt_id || '');
    const valorPago = Number(req.body?.valorPago ?? req.body?.valor_pago ?? 0);
    const competencia = String(req.body?.competencia || new Date().toISOString().slice(0, 7));
    const modo = String(req.body?.modo || req.body?.amortizacao || 'ULTIMAS').toUpperCase();
    if (!debtId || valorPago <= 0) return res.status(400).json({ error: 'Informe dívida e valor da amortização.' });
    const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
    if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });
    const payment = await prisma.payment.create({
      data: {
        userId,
        debtId,
        competencia,
        dataPagamento: String(req.body?.dataPagamento || req.body?.data_pagamento || new Date().toISOString().slice(0, 10)),
        valorPago,
        tipo: 'AMORTIZACAO',
        juros: Number(req.body?.juros || 0),
        desconto: Number(req.body?.desconto || 0),
        observacao: String(req.body?.observacao || `Amortização ${modo === 'PROXIMAS' ? 'das próximas parcelas' : 'das últimas parcelas'}`),
      },
    });
    await applyPaymentToDebt(userId, { ...payment, amortizacaoModo: modo === 'PROXIMAS' ? 'PROXIMAS' : 'ULTIMAS' }, 1);
    const updatedDebt = await prisma.debt.findFirst({ where: { id: debtId, userId } });
    res.status(201).json({ payment, debt: updatedDebt });
  } catch (e) { next(e); }
});

/** GET /payments?debtId=...&competencia=YYYY-MM&since=ISO */
paymentsRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const where: any = { userId: req.userId };
    if (req.query.debtId)      where.debtId      = String(req.query.debtId);
    if (req.query.competencia) where.competencia = String(req.query.competencia);
    if (req.query.since) where.updatedAt = { gt: new Date(String(req.query.since)) };
    if (!req.query.since) where.deletedAt = null;
    const data = await prisma.payment.findMany({ where, orderBy: { competencia: 'desc' } });
    res.json(data);
  } catch (e) { next(e); }
});

/** POST /payments — cria e aplica efeito na dívida */
paymentsRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = CreateBody.parse(req.body);
    // valida que a dívida pertence ao usuário
    const debt = await prisma.debt.findFirst({ where: { id: body.debtId, userId: req.userId } });
    if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });

    const { amortizacaoModo, ...paymentData } = body;
    const payment = await prisma.payment.create({ data: { ...paymentData, userId: req.userId! } });
    await applyPaymentToDebt(req.userId!, { ...payment, amortizacaoModo }, 1);
    res.status(201).json(payment);
  } catch (e) { next(e); }
});

/** DELETE /payments/:id — soft-delete e reverte efeito */
paymentsRouter.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.payment.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    if (existing.deletedAt) return res.json(existing); // já excluído

    const deleted = await prisma.payment.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await applyPaymentToDebt(req.userId!, existing, -1);
    res.json(deleted);
  } catch (e) { next(e); }
});

/**
 * GET /payments/matrix?ano=2026
 * Devolve matriz pronta para a tela mês-a-mês.
 * Resposta: { debts: [...], months: ["2026-01"..."2026-12"], cells: { "debtId|YYYY-MM": payment[] } }
 */
paymentsRouter.get('/matrix', async (req: AuthedRequest, res, next) => {
  try {
    const ano = String(req.query.ano || new Date().getFullYear());
    const months = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i+1).padStart(2,'0')}`);
    const debts = await prisma.debt.findMany({
      where: { userId: req.userId, deletedAt: null },
      orderBy: { credor: 'asc' },
    });
    const payments = await prisma.payment.findMany({
      where: {
        userId: req.userId, deletedAt: null,
        competencia: { startsWith: `${ano}-` },
      },
    });
    const cells: Record<string, any[]> = {};
    for (const p of payments) {
      const key = `${p.debtId}|${p.competencia}`;
      (cells[key] ||= []).push(p);
    }
    res.json({ ano, months, debts, cells });
  } catch (e) { next(e); }
});
