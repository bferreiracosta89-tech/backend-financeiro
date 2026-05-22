import { Router } from "express";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { cleanForPrisma } from "../utils/mapper";


function pascal(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function modelMeta(name: string): any | null {
  const models = (prisma as any)._runtimeDataModel?.models || {};
  return models[pascal(name)] || models[name] || null;
}

function scalarFieldSet(name: string): Set<string> {
  const fields = modelMeta(name)?.fields || [];
  return new Set(fields.filter((f: any) => f.kind === "scalar" || f.kind === "enum").map((f: any) => f.name));
}

function relationFieldSet(name: string): Set<string> {
  const fields = modelMeta(name)?.fields || [];
  return new Set(fields.filter((f: any) => f.kind === "object").map((f: any) => f.name));
}

function stripReadonly(data: any) {
  const clean = { ...(data || {}) };
  delete clean.id;
  delete clean.serverId;
  delete clean.userId;
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.user;
  delete clean.debt;
  delete clean.account;
  delete clean.cardPurchase;
  delete clean.expenses;
  delete clean.payments;
  delete clean.reminders;
  delete clean.agreements;
  delete clean.negotiations;
  // campos calculados pelo front, não persistem no schema de Account
  delete clean.usado;
  delete clean.disponivel;
  delete clean.limiteUsado;
  delete clean.saldo;
  delete clean.vencimentoFatura;
  return clean;
}

function normalizeNullStrings(data: any) {
  for (const key of Object.keys(data)) {
    if (data[key] === "null" || data[key] === "undefined") data[key] = null;
  }
  return data;
}

function removeUnknownScalars(modelName: string, data: any) {
  const scalars = scalarFieldSet(modelName);
  if (!scalars.size) return data;
  for (const key of Object.keys(data)) {
    if (!scalars.has(key)) delete data[key];
  }
  return data;
}

function applyRelationInput(modelName: string, clean: any, relationName: string, scalarName: string, mode: "create" | "update" = "update") {
  const relations = relationFieldSet(modelName);
  const scalars = scalarFieldSet(modelName);
  if (!(scalarName in clean)) return;

  const value = clean[scalarName];

  if (relations.has(relationName)) {
    delete clean[scalarName];
    // Em create o Prisma não aceita disconnect. Relação opcional vazia deve ser omitida.
    if (value === null || value === "") {
      if (mode === "update") clean[relationName] = { disconnect: true };
    } else {
      clean[relationName] = { connect: { id: String(value) } };
    }
    return;
  }

  if (!scalars.has(scalarName)) delete clean[scalarName];
}

function crudEntityName(name: string) {
  const map: Record<string, string> = {
    debt: "debts",
    cardPurchase: "cardPurchases",
    expense: "expenses",
    account: "accounts",
    negotiation: "negotiations",
    reminder: "reminders",
    agreement: "agreements",
    legalAgreement: "legalAgreements",
    paymentAlert: "paymentAlerts",
    taxReport: "taxReports",
  };
  return map[name] || name;
}

function requiredString(value: any) {
  return String(value ?? "").trim();
}

function validationError(message: string) {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
}

function prepareCrudData(name: string, rawBody: any, modelName = name, mode: "create" | "update" = "update") {
  const normalizedEntity = crudEntityName(name);
  const cleanedByWhitelist = cleanForPrisma(normalizedEntity, rawBody || {});
  const clean = removeUnknownScalars(modelName, normalizeNullStrings(stripReadonly(cleanedByWhitelist)));

  applyRelationInput(modelName, clean, "debt", "debtId", mode);
  applyRelationInput(modelName, clean, "account", "accountId", mode);
  applyRelationInput(modelName, clean, "cardPurchase", "cardPurchaseId", mode);

  if (modelName === "debt" || name === "debt") return normalizeDebtPayload(clean);
  return clean;
}

function num(v: any) {
  return Number(v || 0);
}

function bool(v: any) {
  return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
}

function uniq(values: any[]) {
  return Array.from(new Set(values.map(String).filter(Boolean)));
}

function parseDebtIds(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return uniq(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return uniq(parsed);
    } catch {}
    return uniq(value.split(",").map((x) => x.trim()).filter(Boolean));
  }
  return uniq([value]);
}


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


function validateInstallmentMath(label: string, total: number, parcela: number, qtdParcelas: number) {
  if (total > 0 && qtdParcelas > 0 && parcela > 0) {
    const expected = parcela * qtdParcelas;
    const tolerance = 0.05;
    if (Math.abs(expected - total) > tolerance) {
      throw validationError(`${label}: valor da parcela x quantidade de parcelas precisa fechar o valor total. Total informado: ${total.toFixed(2)}; cálculo: ${expected.toFixed(2)}.`);
    }
  }
}

function resolveParcela(total: number, parcela: number, qtdParcelas: number) {
  if (parcela > 0) return parcela;
  if (total > 0 && qtdParcelas > 0) return Math.round((total / qtdParcelas) * 100) / 100;
  return 0;
}

function normalizeDebtPayload(data: any) {
  const clean = { ...(data || {}) };
  const credor = requiredString(clean.credor);
  if (!credor) throw validationError("Informe o credor da dívida.");

  const total = num(clean.total ?? clean.valorTotal);
  const valorTotal = num(clean.valorTotal ?? clean.total);
  const qtdParcelas = intFrom(clean.qtdParcelas, 0);
  const parcelasPagas = Math.max(0, intFrom(clean.parcelasPagas, 0));
  const parcela = resolveParcela(total, num(clean.parcela), qtdParcelas);
  validateInstallmentMath("Dívida", total, parcela, qtdParcelas);
  const status = debtStatusByBalance(String(clean.status || 'PAGAR'), total, qtdParcelas, parcelasPagas);
  return {
    ...clean,
    credor,
    tipo: requiredString(clean.tipo) || "Empréstimo",
    total,
    valorTotal: valorTotal > 0 ? valorTotal : total,
    parcela,
    taxaJuros: num(clean.taxaJuros),
    qtdParcelas,
    parcelasPagas,
    status,
  };
}

async function normalizeDebtAfterCrud(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
  if (!debt) return;
  const total = num(debt.total ?? debt.valorTotal);
  const valorTotal = num(debt.valorTotal ?? debt.total);
  const qtdParcelas = Number(debt.qtdParcelas || 0);
  const parcelasPagas = Number(debt.parcelasPagas || 0);
  const status = debtStatusByBalance(String(debt.status || 'PAGAR'), total, qtdParcelas, parcelasPagas);
  if (status !== debt.status || total !== debt.total || valorTotal !== debt.valorTotal) {
    await prisma.debt.update({ where: { id: debt.id }, data: { total, valorTotal: valorTotal > 0 ? valorTotal : total, status } });
  }
}

async function softDeleteDebtChildren(userId: string, debtId: string) {
  const now = new Date();
  await prisma.agreement.updateMany({ where: { userId, debtId, deletedAt: null }, data: { deletedAt: now } });
  await prisma.negotiation.updateMany({ where: { userId, debtId, deletedAt: null }, data: { deletedAt: now } });
  await prisma.reminder.updateMany({ where: { userId, debtId, deletedAt: null }, data: { deletedAt: now } });
  await prisma.paymentAlert.updateMany({ where: { userId, debtId, deletedAt: null }, data: { deletedAt: now } }).catch(() => undefined);
}

async function updateDebtFinancialState(userId: string, debtId: string, data: any) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
  if (!debt) return null;

  const total = num(data.total ?? data.valorTotal ?? debt.total);
  const parcela = num(data.parcela ?? debt.parcela);
  const qtdParcelas = intFrom(data.qtdParcelas, data.prazo, debt.qtdParcelas);
  const parcelasPagas = Math.max(0, intFrom(data.parcelasPagas, 0));
  const baseStatus = String(data.status || debt.status || 'PAGAR');

  return prisma.debt.update({
    where: { id: debtId },
    data: {
      total,
      valorTotal: total,
      parcela,
      qtdParcelas,
      parcelasPagas,
      status: debtStatusByBalance(baseStatus, total, qtdParcelas, parcelasPagas),
    },
  });
}

async function markLinkedDealsFinished(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
  if (!debt || String(debt.status).toUpperCase() !== 'QUITADO') return;

  await prisma.agreement.updateMany({
    where: { userId, debtId, deletedAt: null },
    data: { status: 'QUITADO', parcelasPagas: debt.qtdParcelas || debt.parcelasPagas },
  }).catch(() => undefined);

  await prisma.negotiation.updateMany({
    where: { userId, debtId, deletedAt: null, aceito: true },
    data: { resposta: 'QUITADA', parcelasPagas: debt.qtdParcelas || debt.parcelasPagas },
  }).catch(() => undefined);

  const legalAgreements = await prisma.legalAgreement.findMany({ where: { userId, deletedAt: null } }).catch(() => [] as any[]);
  for (const la of legalAgreements as any[]) {
    const ids = legalAgreementDebtIds(la);
    if (!ids.includes(String(debtId))) continue;
    await prisma.legalAgreement.update({
      where: { id: la.id },
      data: { status: 'QUITADO', parcelasPagas: la.qtdParcelas || la.parcelasPagas },
    }).catch(() => undefined);
  }
}

export async function applyPaymentToDebt(userId: string, payment: any, delta: 1 | -1) {
  const debtId = payment?.debtId;
  if (!debtId) return;
  const debt = await prisma.debt.findFirst({ where: { id: String(debtId), userId, deletedAt: null } });
  if (!debt) return;

  const tipo = String(payment?.tipo || '').toUpperCase();
  const competencia = String(payment?.competencia || '');
  const valorPago = Math.max(0, num(payment?.valorPago ?? payment?.valor ?? 0));
  let total = num(debt.total);
  let parcelasPagas = Number(debt.parcelasPagas || 0);
  let status = String(debt.status || 'PAGAR');

  if (tipo === 'PARCELA' || tipo === 'PARCIAL') {
    total = Math.max(0, total - valorPago * delta);

    // A competência só conta como parcela paga quando o valor acumulado no mês
    // atinge a parcela prevista. Isso permite: parcial agora + restante depois.
    if (competencia && Number(debt.parcela || 0) > 0) {
      const monthPayments = await prisma.payment.findMany({
        where: { userId, debtId: String(debtId), competencia, deletedAt: null, tipo: { in: ['PARCELA', 'PARCIAL', 'LIQUIDACAO'] } },
      });
      const paidByOtherRecords = monthPayments
        .filter((p) => String(p.id) !== String(payment.id))
        .reduce((acc, p) => acc + num(p.valorPago), 0);
      const paidBeforeThisOperation = delta === 1 ? paidByOtherRecords : paidByOtherRecords + valorPago;
      const paidAfterThisOperation = delta === 1 ? paidByOtherRecords + valorPago : paidByOtherRecords;
      const installment = Number(debt.parcela || 0);
      const wasPaidBefore = paidBeforeThisOperation >= installment * 0.99;
      const isPaidNow = paidAfterThisOperation >= installment * 0.99;
      if (!wasPaidBefore && isPaidNow) parcelasPagas += 1;
      if (wasPaidBefore && !isPaidNow) parcelasPagas -= 1;
    } else if (tipo === 'PARCELA') {
      parcelasPagas += delta;
    }
  } else if (tipo === 'AMORTIZACAO') {
    total = Math.max(0, total - valorPago * delta);
    const modo = String(payment?.amortizacaoModo || parseAmortizacaoModo(payment?.observacao) || '').toUpperCase();
    const parcelaAtual = Number(debt.parcela || 0);
    const qtdAtual = Number(debt.qtdParcelas || 0);
    const restantesAntes = Math.max(0, qtdAtual - parcelasPagas);
    if (parcelaAtual > 0 && restantesAntes > 0) {
      if (modo === 'PROXIMAS') {
        // Regra ajustada: amortizar próximas parcelas é antecipação de parcela.
        // Mantém valor fixo da parcela, incrementa parcelasPagas pelo que o valor cobrir
        // e remove a pendência da competência/mês quando suficiente.
        const parcelasEquivalentes = Math.floor(valorPago / parcelaAtual);
        if (delta === 1) parcelasPagas += parcelasEquivalentes;
        if (delta === -1) parcelasPagas -= parcelasEquivalentes;
        parcelasPagas = Math.max(0, Math.min(qtdAtual, parcelasPagas));
        await prisma.debt.update({
          where: { id: String(debtId) },
          data: {
            total,
            valorTotal: total,
            parcela: parcelaAtual,
            qtdParcelas: qtdAtual,
            parcelasPagas,
            status: debtStatusByBalance(status, total, qtdAtual, parcelasPagas),
          },
        });
        return;
      }
      if (modo === 'ULTIMAS') {
        // Regra ajustada: amortizar últimas parcelas mantém prazo e recalcula a parcela restante.
        const restantesDepois = Math.max(1, qtdAtual - parcelasPagas);
        const novaParcela = Math.round((total / restantesDepois) * 100) / 100;
        await prisma.debt.update({
          where: { id: String(debtId) },
          data: {
            total,
            valorTotal: total,
            parcela: novaParcela,
            qtdParcelas: qtdAtual,
            parcelasPagas,
            status: debtStatusByBalance(status, total, qtdAtual, parcelasPagas),
          },
        });
        return;
      }
    }
  } else if (tipo === 'LIQUIDACAO') {
    if (delta === 1) {
      total = 0;
      status = 'QUITADO';
      parcelasPagas = debt.qtdParcelas && debt.qtdParcelas > parcelasPagas ? debt.qtdParcelas : parcelasPagas;
    } else {
      total = Math.max(0, total + valorPago);
      status = debt.statusAnterior || 'PAGAR';
    }
  } else if (tipo === 'NAO_PAGO') {
    // Registro informativo do mês. Não muda saldo, parcela, parcelas pagas nem status da dívida.
  }

  parcelasPagas = Math.max(0, parcelasPagas);
  status = debtStatusByBalance(status, total, Number(debt.qtdParcelas || 0), parcelasPagas);

  await prisma.debt.update({
    where: { id: String(debtId) },
    data: { total, valorTotal: total, parcelasPagas, status },
  });

  if (status === 'QUITADO') await markLinkedDealsFinished(userId, String(debtId));
}


function parseAmortizacaoModo(observacao: any): string {
  const text = String(observacao || '').toUpperCase();
  if (text.includes('PROXIM')) return 'PROXIMAS';
  if (text.includes('ULTIM')) return 'ULTIMAS';
  return '';
}

function agreementDebtIds(data: any): string[] {
  return data?.debtId ? [String(data.debtId)] : [];
}

function negotiationDebtIds(data: any): string[] {
  return data?.debtId ? [String(data.debtId)] : [];
}

function legalAgreementDebtIds(data: any): string[] {
  return parseDebtIds(data?.debtIds ?? data?.debtId ?? "");
}

async function captureDebtSnapshot(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
  if (!debt) return null;

  if (!debt.statusAnterior) {
    return prisma.debt.update({
      where: { id: debt.id },
      data: {
        statusAnterior: debt.status || "PAGAR",
        totalAnterior: debt.total,
        valorTotalAnterior: debt.valorTotal,
        parcelaAnterior: debt.parcela,
        qtdParcelasAnterior: debt.qtdParcelas,
        parcelasPagasAnterior: debt.parcelasPagas,
      },
    });
  }

  return debt;
}

async function restoreDebtSnapshot(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
  if (!debt) return;

  await prisma.debt.update({
    where: { id: debt.id },
    data: {
      status: debt.statusAnterior || "PAGAR",
      total: debt.totalAnterior ?? debt.total,
      valorTotal: debt.valorTotalAnterior ?? debt.valorTotal,
      parcela: debt.parcelaAnterior ?? debt.parcela,
      qtdParcelas: debt.qtdParcelasAnterior ?? debt.qtdParcelas,
      parcelasPagas: debt.parcelasPagasAnterior ?? debt.parcelasPagas,
      statusAnterior: null,
      totalAnterior: null,
      valorTotalAnterior: null,
      parcelaAnterior: null,
      qtdParcelasAnterior: null,
      parcelasPagasAnterior: null,
    },
  });
}

async function recomputeDebtFromDomain(userId: string, debtIds: string[]) {
  const ids = uniq(debtIds).filter(Boolean);
  for (const debtId of ids) {
    const current = await prisma.debt.findFirst({ where: { id: debtId, userId, deletedAt: null } });
    if (!current) continue;

    // Volta para o snapshot original quando existir, depois reaplica todos os vínculos ativos.
    // Isso evita erro clássico: excluir negociação e perder acordo/judicial/pagamento válido.
    if (current.statusAnterior) {
      await prisma.debt.update({
        where: { id: current.id },
        data: {
          status: current.statusAnterior || 'PAGAR',
          total: current.totalAnterior ?? current.total,
          valorTotal: current.valorTotalAnterior ?? current.valorTotal,
          parcela: current.parcelaAnterior ?? current.parcela,
          qtdParcelas: current.qtdParcelasAnterior ?? current.qtdParcelas,
          parcelasPagas: current.parcelasPagasAnterior ?? current.parcelasPagas,
          statusAnterior: null,
          totalAnterior: null,
          valorTotalAnterior: null,
          parcelaAnterior: null,
          qtdParcelasAnterior: null,
          parcelasPagasAnterior: null,
        },
      });
    }

    const agreements = await prisma.agreement.findMany({
      where: { userId, debtId, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
    }).catch(() => [] as any[]);
    for (const ag of agreements as any[]) {
      if (bool(ag.substituiDivida ?? true)) await applyAgreementToDebt(userId, ag);
    }

    const negotiations = await prisma.negotiation.findMany({
      where: { userId, debtId, deletedAt: null, aceito: true },
      orderBy: { updatedAt: 'asc' },
    }).catch(() => [] as any[]);
    for (const ng of negotiations as any[]) await applyNegotiationToDebt(userId, ng);

    const legalAgreements = await prisma.legalAgreement.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
    }).catch(() => [] as any[]);
    for (const la of legalAgreements as any[]) {
      if (legalAgreementDebtIds(la).includes(String(debtId)) && bool(la.substituiDividas ?? true)) {
        await applyLegalAgreementToDebts(userId, la);
      }
    }

    const payments = await prisma.payment.findMany({
      where: { userId, debtId, deletedAt: null },
      orderBy: [{ competencia: 'asc' }, { createdAt: 'asc' }],
    }).catch(() => [] as any[]);
    for (const p of payments as any[]) await applyPaymentToDebt(userId, p, 1);

    await normalizeDebtAfterCrud(userId, debtId);
  }
}

async function applyAgreementToDebt(userId: string, data: any) {
  const debtId = data?.debtId;
  if (!debtId || !bool(data?.substituiDivida ?? true)) return;

  const debt = await captureDebtSnapshot(userId, String(debtId));
  if (!debt) return;

  const statusText = String(data?.status || '').toUpperCase();
  const baseStatus = statusText === 'QUITADO'
    ? 'QUITADO'
    : bool(data?.homologado) || ['ACEITO', 'ATIVO'].includes(statusText)
      ? 'ACORDADO'
      : 'NEGOCIAR';
  const total = num(data?.valorAcordado) > 0 ? num(data.valorAcordado) : num((debt as any).total);
  const qtd = intFrom(data?.qtdParcelas, data?.qtd_parcelas, data?.parcelas, data?.prazo, (debt as any).qtdParcelas);
  const parcela = resolveParcela(total, num(data?.novaParcela), qtd) || num((debt as any).parcela);
  validateInstallmentMath("Acordo", total, parcela, qtd);
  const parcelasPagas = Math.max(0, intFrom(data?.parcelasPagas, 0));

  await updateDebtFinancialState(userId, String(debtId), {
    total, parcela, qtdParcelas: qtd, parcelasPagas, status: baseStatus,
  });
}

async function applyNegotiationToDebt(userId: string, data: any) {
  const debtId = data?.debtId;
  if (!debtId || !bool(data?.aceito)) return;

  const debt = await captureDebtSnapshot(userId, String(debtId));
  if (!debt) return;

  const qtd = intFrom(data?.qtdParcelas, data?.qtd_parcelas, data?.parcelas, data?.prazo, (debt as any).qtdParcelas);
  const parcelaInformada = num(data?.novaParcela);
  // Negociação aceita atualiza o plano da dívida; não quita automaticamente.
  // Se valorAcordado não veio preenchido, usa parcela x quantidade; se também não houver,
  // preserva o saldo atual da dívida.
  let total = num(data?.valorAcordado) > 0 ? num(data.valorAcordado) : 0;
  if (total <= 0 && parcelaInformada > 0 && qtd > 0) total = Math.round(parcelaInformada * qtd * 100) / 100;
  if (total <= 0) total = num((debt as any).total);
  const parcela = resolveParcela(total, parcelaInformada, qtd) || num((debt as any).parcela);
  validateInstallmentMath("Negociação", total, parcela, qtd);
  const parcelasPagas = Math.min(Math.max(0, intFrom(data?.parcelasPagas, 0)), Math.max(0, qtd - 1));
  const status = total <= 0 ? 'QUITADO' : 'NEGOCIAR';

  await updateDebtFinancialState(userId, String(debtId), {
    total, parcela, qtdParcelas: qtd, parcelasPagas, status,
  });
}

async function applyLegalAgreementToDebts(userId: string, data: any) {
  const ids = legalAgreementDebtIds(data);
  if (!ids.length || !bool(data?.substituiDividas ?? true)) return;

  const total = num(data?.valorConsolidado ?? data?.valorTotal);
  const parcela = num(data?.parcelaJudicial ?? data?.parcela);
  const qtd = Math.trunc(num(data?.qtdParcelas ?? data?.prazo));

  const debts: any[] = [];
  for (const debtId of ids) {
    const debt = await captureDebtSnapshot(userId, debtId);
    if (debt) debts.push(debt);
  }
  if (!debts.length) return;

  const consolidatedTotal = total > 0 ? total : debts.reduce((acc, d) => acc + num(d.total), 0);
  const consolidatedQtd = qtd > 0 ? qtd : Math.max(...debts.map((d) => Number(d.qtdParcelas || 0)), 0);
  const consolidatedParcela = resolveParcela(consolidatedTotal, parcela, consolidatedQtd) || debts.reduce((acc, d) => acc + num(d.parcela), 0);
  validateInstallmentMath("Acordo judicial", consolidatedTotal, consolidatedParcela, consolidatedQtd);
  const parcelasPagas = Math.max(0, intFrom(data?.parcelasPagas, 0));

  // Quando o acordo judicial contém vários credores, o painel deve enxergar UMA parcela judicial.
  // Para isso, a primeira dívida vinculada vira a dívida consolidada; as demais ficam zeradas
  // e marcadas como JUDICIAL para histórico, evitando duplicidade no painel.
  for (let i = 0; i < debts.length; i++) {
    const debt = debts[i];
    if (i === 0) {
      await updateDebtFinancialState(userId, debt.id, {
        total: consolidatedTotal,
        parcela: consolidatedParcela,
        qtdParcelas: consolidatedQtd,
        parcelasPagas,
        status: 'JUDICIAL',
      });
    } else {
      await updateDebtFinancialState(userId, debt.id, {
        total: 0,
        parcela: 0,
        qtdParcelas: 0,
        parcelasPagas: 0,
        status: 'JUDICIAL',
      });
    }
  }
}

export async function applyDomainEffects(name: string, userId: string, before: any | null, after: any | null, deleted = false) {
  const impacted = uniq([
    ...agreementDebtIds(before), ...agreementDebtIds(after),
    ...negotiationDebtIds(before), ...negotiationDebtIds(after),
    ...legalAgreementDebtIds(before), ...legalAgreementDebtIds(after),
    before?.debtId, after?.debtId,
    before?.id && name === 'debt' ? before.id : null,
    after?.id && name === 'debt' ? after.id : null,
  ]);

  if (name === "debt") {
    if (after?.id && !deleted) await normalizeDebtAfterCrud(userId, String(after.id));
    if (before?.id && deleted) await softDeleteDebtChildren(userId, String(before.id));
    return;
  }

  if (name === "payment") {
    if (before && !deleted) await applyPaymentToDebt(userId, before, -1);
    if (after && !deleted) await applyPaymentToDebt(userId, after, 1);
    if (before && deleted) await applyPaymentToDebt(userId, before, -1);
    return;
  }

  if (["agreement", "negotiation", "legalAgreement"].includes(name)) {
    // Recalcula do snapshot + vínculos ativos. É mais seguro que aplicar diferenças parciais.
    await recomputeDebtFromDomain(userId, impacted);
  }
}

export function makeCrudRouter(model: any, name: string, modelName = name) {
  const router = Router();

  router.get("/", async (req: AuthedRequest, res, next) => {
    try {
      const data = await model.findMany({ where: { userId: req.userId, deletedAt: null }, orderBy: { updatedAt: "desc" } });
      res.json(data);
    } catch (error) { next(error); }
  });

  router.get("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const data = await model.findFirst({ where: { id: req.params.id, userId: req.userId, deletedAt: null } });
      if (!data) return res.status(404).json({ error: `${name} não encontrado` });
      res.json(data);
    } catch (error) { next(error); }
  });

  router.post("/", async (req: AuthedRequest, res, next) => {
    try {
      const clean = prepareCrudData(name, req.body, modelName, "create");
      const data = await model.create({ data: { ...clean, user: { connect: { id: req.userId! } }, deletedAt: null } });
      await applyDomainEffects(name, req.userId!, null, data, false);
      const fresh = await model.findUnique({ where: { id: data.id } });
      res.status(201).json(fresh || data);
    } catch (error) { next(error); }
  });

  router.put("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const existing = await model.findFirst({ where: { id: req.params.id, userId: req.userId, deletedAt: null } });
      if (!existing) return res.status(404).json({ error: `${name} não encontrado` });
      const clean = prepareCrudData(name, req.body, modelName, "update");
      const data = await model.update({ where: { id: req.params.id }, data: clean });
      await applyDomainEffects(name, req.userId!, existing, data, false);
      const fresh = await model.findUnique({ where: { id: data.id } });
      res.json(fresh || data);
    } catch (error) { next(error); }
  });

  router.delete("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const existing = await model.findFirst({ where: { id: req.params.id, userId: req.userId } });
      if (!existing) return res.status(404).json({ error: `${name} não encontrado` });
      if (existing.deletedAt) return res.json(existing);
      const data = await model.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
      await applyDomainEffects(name, req.userId!, existing, null, true);
      res.json(data);
    } catch (error) { next(error); }
  });

  return router;
}
