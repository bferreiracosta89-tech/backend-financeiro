import { Router } from 'express';
import { prisma } from '../db/prisma';
import { AuthedRequest } from '../middleware/auth';

export const dashboardRouter = Router();

/**
 * GET /dashboard/monthly?competencia=YYYY-MM
 * Retorna comparativo PREVISTO vs PAGO no mês.
 * Default = mês corrente.
 */
dashboardRouter.get('/monthly', async (req: AuthedRequest, res, next) => {
  try {
    const competencia = String(req.query.competencia || ymNow());
    const userId = req.userId!;

    // Previsto: soma das parcelas vigentes das dívidas que ainda geram obrigação mensal.
    // Negociação aceita atualiza a própria dívida para NEGOCIAR com nova parcela;
    // portanto NEGOCIAR precisa entrar na somatória do mês.
    const debts = await prisma.debt.findMany({
      where: { userId, deletedAt: null },
    });
    const activeForPanel = ['PAGAR', 'NEGOCIAR', 'NEGOCIADA', 'ACORDADO', 'JUDICIAL'];
    const payableDebts = debts.filter((d) =>
      activeForPanel.includes(String(d.status || '').toUpperCase()) && Number(d.parcela || 0) > 0,
    );
    const previsto = payableDebts.reduce((s, d) => s + d.parcela, 0);

    // Pago/pendente precisam ser calculados por dívida ativa da competência.
    // Pagamentos de dívidas excluídas permanecem no histórico, mas não entram no painel.
    const payments = await prisma.payment.findMany({
      where: { userId, competencia, deletedAt: null },
    });
    const payableIds = new Set(payableDebts.map((d) => d.id));
    const panelPayments = payments.filter((p) => payableIds.has(String(p.debtId || '')));
    const pago = panelPayments
      .filter((p) => p.tipo !== 'NAO_PAGO')
      .reduce((s, p) => s + p.valorPago, 0);

    // Detalhamento por dívida
    const detalhe = payableDebts.map((d) => {
      const pagosDelaNoMes = panelPayments.filter((p) => p.debtId === d.id);
      const valorPago = pagosDelaNoMes
        .filter((p) => p.tipo !== 'NAO_PAGO')
        .reduce((s, p) => s + p.valorPago, 0);
      const tipos = pagosDelaNoMes.map((p) => p.tipo);
      let situacao: 'PAGO' | 'PARCIAL' | 'AMORTIZADO' | 'QUITADO' | 'NAO_PAGO' | 'PENDENTE';
      if (d.status === 'QUITADO' || tipos.includes('LIQUIDACAO')) situacao = 'QUITADO';
      else if (valorPago >= Number(d.parcela || 0) * 0.99) situacao = 'PAGO';
      else if (valorPago > 0) situacao = 'PARCIAL';
      else if (tipos.includes('NAO_PAGO')) situacao = 'NAO_PAGO';
      else if (tipos.includes('AMORTIZACAO')) situacao = 'AMORTIZADO';
      else situacao = 'PENDENTE';
      return {
        id: d.id, credor: d.credor, parcela: d.parcela, status: d.status,
        valorPago, restante: Math.max(0, d.parcela - valorPago), situacao,
      };
    });

    // Renda e mínimo
    const income = await prisma.income.findUnique({ where: { userId } });
    const me = await prisma.minExistencial.findUnique({ where: { userId } });
    const totalMinE = me
      ? (me.alimentacao + me.transporte + me.agua + me.energia + me.internet + me.saude + me.outros)
      : 0;
    const liquido = income?.liquido || 0;
    const reserva = me?.reserva || 0;

    res.json({
      competencia,
      liquido,
      totalMinE,
      reserva,
      previsto,
      pago,
      pendente: detalhe.reduce((s, d) => s + Math.max(0, Number((d as any).restante || 0)), 0),
      naoPagoCount: detalhe.filter((d) => d.situacao === 'NAO_PAGO').length,
      pendenteCount: detalhe.filter((d) => d.situacao === 'PENDENTE').length,
      detalhe,
    });
  } catch (e) { next(e); }
});

/**
 * GET /dashboard/atrasos
 * Devolve dívidas com mês passado que não têm registro algum (nem PARCELA, nem NAO_PAGO).
 */
dashboardRouter.get('/atrasos', async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const hoje = new Date();
    // Considera "passado" qualquer mês anterior ao corrente
    const mesAtual = ymNow();
    const tresMesesAtras = ymMinusMonths(mesAtual, 3);

    const debts = await prisma.debt.findMany({
      where: { userId, deletedAt: null, status: { in: ['PAGAR','NEGOCIAR'] } },
    });
    const payments = await prisma.payment.findMany({
      where: {
        userId, deletedAt: null,
        competencia: { gte: tresMesesAtras, lt: mesAtual },
      },
    });

    // Para cada dívida, verifica nos últimos 3 meses passados quais ficaram sem registro
    const months: string[] = [];
    let m = tresMesesAtras;
    while (m < mesAtual) {
      months.push(m);
      m = ymPlusMonths(m, 1);
    }

    const atrasos: any[] = [];
    for (const d of debts) {
      const semRegistro: string[] = [];
      for (const month of months) {
        const tem = payments.find((p) => p.debtId === d.id && p.competencia === month);
        if (!tem) semRegistro.push(month);
      }
      if (semRegistro.length > 0) {
        atrasos.push({
          id: d.id, credor: d.credor, parcela: d.parcela,
          mesesSemRegistro: semRegistro,
        });
      }
    }
    res.json({ mesesVerificados: months, atrasos });
  } catch (e) { next(e); }
});

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function ymMinusMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function ymPlusMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
