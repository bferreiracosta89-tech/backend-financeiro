-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fontePagadora" TEXT NOT NULL DEFAULT '',
    "banco" TEXT NOT NULL DEFAULT '',
    "dataRecebimento" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinExistencial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alimentacao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transporte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agua" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "energia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "internet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinExistencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "protocolado" BOOLEAN NOT NULL DEFAULT false,
    "local" TEXT NOT NULL DEFAULT 'Defensoria Pública',
    "dataProtocolo" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL DEFAULT '',
    "dataAudiencia" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT '',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parcela" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vencimento" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PAGAR',
    "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
    "garantia" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT NOT NULL DEFAULT '',
    "numeroContrato" TEXT NOT NULL DEFAULT '',
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxaJuros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "estabelecimento" TEXT NOT NULL DEFAULT '',
    "dataCompra" TEXT NOT NULL DEFAULT '',
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtdParcelas" INTEGER NOT NULL DEFAULT 1,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "valorParcela" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "primeiraParcela" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT 'Outros',
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formaPagamento" TEXT NOT NULL DEFAULT 'Dinheiro',
    "accountId" TEXT,
    "parcelado" BOOLEAN NOT NULL DEFAULT false,
    "qtdParcelas" INTEGER NOT NULL DEFAULT 1,
    "cardPurchaseId" TEXT,
    "observacao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CONTA_CORRENTE',
    "limiteTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diaFechamento" INTEGER NOT NULL DEFAULT 0,
    "diaVencimento" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negotiation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credor" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "canal" TEXT NOT NULL DEFAULT 'Telefone',
    "resposta" TEXT NOT NULL DEFAULT '',
    "proposta" TEXT NOT NULL DEFAULT '',
    "novaParcela" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prazo" TEXT NOT NULL DEFAULT '',
    "aceito" BOOLEAN NOT NULL DEFAULT false,
    "proximaAcao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Negotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT,
    "titulo" TEXT NOT NULL DEFAULT '',
    "diaDoMes" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "notificationId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "dataPagamento" TEXT NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL,
    "juros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Income_userId_key" ON "Income"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MinExistencial_userId_key" ON "MinExistencial"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalPlan_userId_key" ON "LegalPlan"("userId");

-- CreateIndex
CREATE INDEX "Debt_userId_updatedAt_idx" ON "Debt"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CardPurchase_userId_updatedAt_idx" ON "CardPurchase"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CardPurchase_debtId_idx" ON "CardPurchase"("debtId");

-- CreateIndex
CREATE INDEX "Expense_userId_updatedAt_idx" ON "Expense"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Expense_userId_data_idx" ON "Expense"("userId", "data");

-- CreateIndex
CREATE INDEX "Account_userId_updatedAt_idx" ON "Account"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Negotiation_userId_updatedAt_idx" ON "Negotiation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_updatedAt_idx" ON "Reminder"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Payment_userId_updatedAt_idx" ON "Payment"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Payment_debtId_competencia_idx" ON "Payment"("debtId", "competencia");

-- CreateIndex
CREATE INDEX "Payment_userId_competencia_idx" ON "Payment"("userId", "competencia");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinExistencial" ADD CONSTRAINT "MinExistencial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalPlan" ADD CONSTRAINT "LegalPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cardPurchaseId_fkey" FOREIGN KEY ("cardPurchaseId") REFERENCES "CardPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
