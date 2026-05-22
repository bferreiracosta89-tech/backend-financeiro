/*
  Warnings:

  - You are about to drop the column `debtId` on the `Negotiation` table. All the data in the column will be lost.
  - You are about to drop the column `observacao` on the `Negotiation` table. All the data in the column will be lost.
  - You are about to drop the column `parcelasPagas` on the `Negotiation` table. All the data in the column will be lost.
  - You are about to drop the column `qtdParcelas` on the `Negotiation` table. All the data in the column will be lost.
  - You are about to drop the column `valorAcordado` on the `Negotiation` table. All the data in the column will be lost.
  - You are about to drop the column `valorOriginal` on the `Negotiation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Negotiation" DROP CONSTRAINT "Negotiation_debtId_fkey";

-- DropForeignKey
ALTER TABLE "Negotiation" DROP CONSTRAINT "Negotiation_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaxReport" DROP CONSTRAINT "TaxReport_userId_fkey";

-- AlterTable
ALTER TABLE "LegalAgreement" ADD COLUMN     "credoresIncluidos" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dataAudiencia" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "debtIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "numeroProcesso" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "orgao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "parcelaJudicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "primeiroVencimento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "substituiDividas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valorConsolidado" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Negotiation" DROP COLUMN "debtId",
DROP COLUMN "observacao",
DROP COLUMN "parcelasPagas",
DROP COLUMN "qtdParcelas",
DROP COLUMN "valorAcordado",
DROP COLUMN "valorOriginal",
ALTER COLUMN "canal" SET DEFAULT 'Telefone';

-- CreateIndex
CREATE INDEX "Negotiation_userId_updatedAt_idx" ON "Negotiation"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
