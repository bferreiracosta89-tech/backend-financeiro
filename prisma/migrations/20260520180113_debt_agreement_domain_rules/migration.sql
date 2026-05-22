-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "parcelaAnterior" DOUBLE PRECISION,
ADD COLUMN     "parcelasPagasAnterior" INTEGER,
ADD COLUMN     "qtdParcelasAnterior" INTEGER,
ADD COLUMN     "totalAnterior" DOUBLE PRECISION,
ADD COLUMN     "valorTotalAnterior" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN     "debtId" TEXT,
ADD COLUMN     "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valorAcordado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "valorOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Negotiation_debtId_idx" ON "Negotiation"("debtId");

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
