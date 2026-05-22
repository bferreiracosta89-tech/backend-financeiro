import { Router } from 'express';
import { prisma } from '../db/prisma';
import { AuthedRequest } from '../middleware/auth';

export const paymentsSummaryRouter = Router();

/**
 * GET /payments/summary?competencia=YYYY-MM
 *
 * Para o mês informado, retorna:
 *   - totalPrevisto: soma das parcelas das dívidas ativas
 *   - totalPago: soma de PARCELA + PARCIAL + LIQUIDACAO + AMORTIZACAO no mês
 *   - debts: por dívida, status no mês { previsto, pago, situacao }
 *
 * Situações possíveis:
 *   PAGO        — pagou ≥ parcela cheia
 *   PARCIAL     — pagou algo menor que a parcela
 *   ATRASADO    — mês passou e não tem PARCELA nem PARCIAL nem NAO_PAGO nem LIQUIDACAO
 *   NAO_PAGO    — declarou NAO_PAGO
 *   PENDENTE    — mês corrente ainda em aberto
 *   QUITADO     — dívida já quitada
 */
paymentsSummaryRouter.get('/summary', async (req: AuthedRequest, res, next) => {
  try {
    const comp = String(req.query.competencia || '');
    if (!comp.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }
    const userId = req.userId!;

    const debts = await prisma.debt.findMany({
      where: { userId, deletedAt: null },
      orderBy: { credor: 'asc' },
    });
    const payments = await prisma.payment.findMany({
      where: { userId, deletedAt: null, competencia: comp },
    });

    const now = new Date();
    const compYear  = parseInt(comp.split('-')[0], 10);
    const compMonth = parseInt(comp.split('-')[1], 10);
    const isFutureOrCurrent =
      compYear > now.getFullYear() ||
      (compYear === now.getFullYear() && compMonth >= (now.getMonth() + 1));

    const activeForPanel = ['PAGAR', 'NEGOCIAR', 'NEGOCIADA', 'ACORDADO', 'JUDICIAL'];
    const payableDebts = debts.filter((d) =>
      activeForPanel.includes(String(d.status || '').toUpperCase()) && Number(d.parcela || 0) > 0,
    );

    const debtSummaries = payableDebts.map((d) => {
      const ps = payments.filter((p) => p.debtId === d.id);
      const pago = ps
        .filter((p) => p.tipo !== 'NAO_PAGO')
        .reduce((acc, p) => acc + p.valorPago, 0);
      const hasNaoPago = ps.some((p) => p.tipo === 'NAO_PAGO');
      const hasLiquidacao = ps.some((p) => p.tipo === 'LIQUIDACAO');
      const hasPaid = ps.some((p) => p.tipo === 'PARCELA' || p.tipo === 'PARCIAL');

      let situacao: string;
      if (d.status === 'QUITADO' || hasLiquidacao) situacao = 'QUITADO';
      else if (hasNaoPago) situacao = 'NAO_PAGO';
      else if (hasPaid && pago >= d.parcela * 0.99) situacao = 'PAGO';
      else if (hasPaid) situacao = 'PARCIAL';
      else if (isFutureOrCurrent) situacao = 'PENDENTE';
      else situacao = 'ATRASADO';

      const restante = Math.max(0, d.parcela - pago);
      return {
        debtId:   d.id,
        credor:   d.credor,
        previsto: d.parcela,
        pago,
        restante,
        situacao,
        payments: ps,
      };
    });

    const totalPrevisto = payableDebts.reduce((a, d) => a + d.parcela, 0);
    const totalPago = payments
      .filter((p) => p.tipo !== 'NAO_PAGO')
      .reduce((a, p) => a + p.valorPago, 0);

    const totalPendente = debtSummaries.reduce((a: number, d: any) => a + Math.max(0, Number(d.restante || 0)), 0);

    res.json({
      competencia: comp,
      totalPrevisto,
      totalPago,
      totalPendente,
      debts: debtSummaries,
    });
  } catch (e) { next(e); }
});

/**
 * GET /payments/overdue
 * Lista dívidas com meses em atraso (sem PARCELA, PARCIAL, LIQUIDACAO ou NAO_PAGO declarado).
 * Considera apenas meses anteriores ao mês corrente.
 * Retorna apenas dívidas ativas (não QUITADO/PAUSADO).
 */
paymentsSummaryRouter.get('/overdue', async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const monthsBack = Math.max(1, Math.min(12, parseInt(String(req.query.months || '6'), 10)));

    const debts = await prisma.debt.findMany({
      where: { userId, deletedAt: null, status: { in: ['PAGAR', 'NEGOCIAR'] } },
    });
    const payments = await prisma.payment.findMany({
      where: { userId, deletedAt: null },
    });

    const now = new Date();
    const months: string[] = [];
    for (let i = 1; i <= monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const overdue: Array<{ debtId: string; credor: string; parcela: number; mesesEmAtraso: string[] }> = [];
    for (const d of debts) {
      const mesesEmAtraso: string[] = [];
      for (const m of months) {
        const has = payments.some((p) => p.debtId === d.id && p.competencia === m);
        if (!has) mesesEmAtraso.push(m);
      }
      if (mesesEmAtraso.length) {
        overdue.push({ debtId: d.id, credor: d.credor, parcela: d.parcela, mesesEmAtraso });
      }
    }
    res.json({ months, overdue });
  } catch (e) { next(e); }
});
