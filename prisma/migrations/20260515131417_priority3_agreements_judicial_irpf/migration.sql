-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT,
    "debtCredor" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'EXTRAJUDICIAL',
    "status" TEXT NOT NULL DEFAULT 'SIMULACAO',
    "dataAcordo" TEXT NOT NULL DEFAULT '',
    "valorOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorAcordado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "novaParcela" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "primeiroVencimento" TEXT NOT NULL DEFAULT '',
    "canal" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "homologado" BOOLEAN NOT NULL DEFAULT false,
    "substituiDivida" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "numeroProcesso" TEXT NOT NULL DEFAULT '',
    "orgao" TEXT NOT NULL DEFAULT '',
    "vara" TEXT NOT NULL DEFAULT '',
    "dataAudiencia" TEXT NOT NULL DEFAULT '',
    "dataHomologacao" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "valorConsolidado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parcelaJudicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "primeiroVencimento" TEXT NOT NULL DEFAULT '',
    "credoresIncluidos" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "substituiDividas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "rendimentos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dividasDeclaraveis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pagamentosEfetuados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jurosPagos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descontosObtidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bancos" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TaxReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agreement_userId_updatedAt_idx" ON "Agreement"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Agreement_userId_debtId_idx" ON "Agreement"("userId", "debtId");

-- CreateIndex
CREATE INDEX "LegalAgreement_userId_updatedAt_idx" ON "LegalAgreement"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "TaxReport_userId_ano_idx" ON "TaxReport"("userId", "ano");

-- CreateIndex
CREATE INDEX "TaxReport_userId_updatedAt_idx" ON "TaxReport"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAgreement" ADD CONSTRAINT "LegalAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
