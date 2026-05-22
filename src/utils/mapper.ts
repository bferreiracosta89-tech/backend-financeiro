export function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);

  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {});
  }

  return obj;
}

export function isLocalId(id: any): boolean {
  return typeof id === "string" && id.startsWith("local-");
}

/**
 * Lista única de campos que podem entrar no Prisma via sync.
 * Antes faltavam campos importantes (debtId em negotiations, campos de acordo,
 * campos de judicial e campos de exclusão), causando sync parcial.
 */
const ALLOWED: Record<string, string[]> = {
  income: [
    "bruto",
    "liquido",
    "fontePagadora",
    "banco",
    "dataRecebimento",
    "observacao",
  ],
  minExistencial: [
    "alimentacao",
    "transporte",
    "agua",
    "energia",
    "internet",
    "saude",
    "outros",
    "reserva",
  ],
  legalPlan: [
    "protocolado",
    "local",
    "dataProtocolo",
    "numero",
    "dataAudiencia",
    "status",
    "observacao",
  ],
  debts: [
    "credor",
    "tipo",
    "numeroContrato",
    "valorTotal",
    "total",
    "parcela",
    "taxaJuros",
  "totalAnterior",
  "valorTotalAnterior",
  "parcelaAnterior",
    "qtdParcelas",
    "parcelasPagas",
    "vencimento",
    "status",
    "prioridade",
    "garantia",
    "observacao",
    "deletedAt",
    "statusAnterior",
    "totalAnterior",
    "valorTotalAnterior",
    "parcelaAnterior",
    "qtdParcelasAnterior",
    "parcelasPagasAnterior",
  ],
  accounts: [
    "nome",
    "tipo",
    "saldo",
    "limiteTotal",
    "limiteUsado",
    "vencimentoFatura",
    "diaFechamento",
    "diaVencimento",
    "observacao",
    "deletedAt",
  ],
  expenses: [
    "data",
    "descricao",
    "categoria",
    "valor",
    "vencimento",
    "pago",
    "essencial",
    "formaPagamento",
    "accountId",
    "parcelado",
    "qtdParcelas",
    "cardPurchaseId",
    "observacao",
    "deletedAt",
  ],
  cardPurchases: [
    "debtId",
    "descricao",
    "estabelecimento",
    "dataCompra",
    "valorTotal",
    "qtdParcelas",
    "parcelasPagas",
    "valorParcela",
    "primeiraParcela",
    "observacao",
    "deletedAt",
  ],
  negotiations: [
    "debtId",
    "credor",
    "valorOriginal",
    "valorAcordado",
    "qtdParcelas",
    "parcelasPagas",
    "data",
    "canal",
    "resposta",
    "proposta",
    "novaParcela",
    "prazo",
    "aceito",
    "proximaAcao",
    "deletedAt",
  ],
  reminders: [
    "debtId",
    "titulo",
    "diaDoMes",
    "ativo",
    "notificationId",
    "deletedAt",
  ],
  payments: [
    "debtId",
    "accountId",
    "competencia",
    "dataPagamento",
    "data",
    "valor",
    "valorPago",
    "tipo",
    "juros",
    "desconto",
    "status",
    "observacao",
    "deletedAt",
  ],
  agreements: [
    "debtId",
    "debtCredor",
    "credor",
    "tipo",
    "status",
    "data",
    "dataAcordo",
    "valorOriginal",
    "valorAcordado",
    "desconto",
    "novaParcela",
    "prazo",
    "qtdParcelas",
    "parcelasPagas",
    "primeiroVencimento",
    "canal",
    "homologado",
    "substituiDivida",
    "observacao",
    "deletedAt",
  ],
  legalAgreements: [
    "debtIds",
    "debtId",
    "numeroProcesso",
    "processo",
    "orgao",
    "vara",
    "dataAudiencia",
    "dataHomologacao",
    "valorConsolidado",
    "valorTotal",
    "parcelaJudicial",
    "parcela",
    "qtdParcelas",
    "parcelasPagas",
    "primeiroVencimento",
    "credoresIncluidos",
    "substituiDividas",
    "prazo",
    "status",
    "observacao",
    "deletedAt",
  ],
  paymentAlerts: ["debtId", "competencia", "status", "mensagem", "deletedAt"],
  taxReports: [
    "ano",
    "rendimentos",
    "dividas",
    "pagamentos",
    "dividasDeclaraveis",
    "pagamentosEfetuados",
    "jurosPagos",
    "descontosObtidos",
    "bancos",
    "bens",
    "observacao",
    "payload",
    "deletedAt",
  ],
};

const BOOL_FIELDS = new Set([
  "protocolado",
  "garantia",
  "aceito",
  "ativo",
  "parcelado",
  "active",
  "pago",
  "essencial",
  "homologado",
  "substituiDivida",
  "substituiDividas",
]);

const INT_FIELDS = new Set([
  "qtdParcelas",
  "parcelasPagas",
  "diaFechamento",
  "diaVencimento",
  "diaDoMes",
  "qtdParcelasAnterior",
  "parcelasPagasAnterior",
]);

const FLOAT_FIELDS = new Set([
  "bruto",
  "liquido",
  "alimentacao",
  "transporte",
  "agua",
  "energia",
  "internet",
  "saude",
  "outros",
  "reserva",
  "total",
  "parcela",
  "valorTotal",
  "valorConsolidado",
  "taxaJuros",
  "totalAnterior",
  "valorTotalAnterior",
  "parcelaAnterior",
  "valor",
  "limiteTotal",
  "limiteUsado",
  "saldo",
  "novaParcela",
  "valorParcela",
  "valorPago",
  "rendimentos",
  "dividas",
  "pagamentos",
  "dividasDeclaraveis",
  "pagamentosEfetuados",
  "jurosPagos",
  "descontosObtidos",
  "juros",
  "desconto",
  "valorOriginal",
  "valorAcordado",
  "parcelaJudicial",
]);

export function coerceBoolean(v: any): boolean {
  return (
    v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
  );
}

function normalizeDate(v: any): Date | null {
  if (!v || v === "" || v === 0 || v === false) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function cleanForPrisma(entity: string, data: any) {
  const raw = snakeToCamel(data || {});
  const allowed = ALLOWED[entity] || [];
  const clean: any = {};

  for (const key of allowed) {
    if (!(key in raw)) continue;
    let value = raw[key];

    if (key.endsWith("Id") || key === "id") {
      if (value === "" || value === 0 || isLocalId(value)) value = null;
      else value = String(value);
    }

    if (BOOL_FIELDS.has(key)) value = coerceBoolean(value);
    if (INT_FIELDS.has(key)) {
      value = Number.parseInt(String(value || 0), 10) || 0;
    }
    if (FLOAT_FIELDS.has(key)) value = Number(value || 0);
    if (key === "deletedAt") value = normalizeDate(value);

    clean[key] = value;
  }

  return clean;
}
