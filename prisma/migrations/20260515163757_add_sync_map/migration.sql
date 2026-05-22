/*
  Warnings:

  - You are about to drop the column `canal` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `dataAcordo` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `debtCredor` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `homologado` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `parcelasPagas` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `primeiroVencimento` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `qtdParcelas` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `substituiDivida` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `credoresIncluidos` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `dataAudiencia` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `numeroProcesso` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `orgao` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `parcelaJudicial` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `parcelasPagas` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `primeiroVencimento` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `qtdParcelas` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `substituiDividas` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the column `valorConsolidado` on the `LegalAgreement` table. All the data in the column will be lost.
  - You are about to drop the `TaxReport` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaxReport" DROP CONSTRAINT "TaxReport_userId_fkey";

-- DropIndex
DROP INDEX "Agreement_userId_debtId_idx";

-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "canal",
DROP COLUMN "dataAcordo",
DROP COLUMN "debtCredor",
DROP COLUMN "homologado",
DROP COLUMN "parcelasPagas",
DROP COLUMN "primeiroVencimento",
DROP COLUMN "qtdParcelas",
DROP COLUMN "substituiDivida",
DROP COLUMN "tipo",
ADD COLUMN     "credor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "data" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prazo" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'SIMULADO';

-- AlterTable
ALTER TABLE "LegalAgreement" DROP COLUMN "credoresIncluidos",
DROP COLUMN "dataAudiencia",
DROP COLUMN "numeroProcesso",
DROP COLUMN "orgao",
DROP COLUMN "parcelaJudicial",
DROP COLUMN "parcelasPagas",
DROP COLUMN "primeiroVencimento",
DROP COLUMN "qtdParcelas",
DROP COLUMN "substituiDividas",
DROP COLUMN "valorConsolidado",
ADD COLUMN     "parcela" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "prazo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "processo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "TaxReport";

-- CreateTable
CREATE TABLE "SyncMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT,
    "competencia" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "mensagem" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncMap_userId_entity_idx" ON "SyncMap"("userId", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMap_userId_entity_localId_key" ON "SyncMap"("userId", "entity", "localId");

-- CreateIndex
CREATE INDEX "PaymentAlert_userId_competencia_idx" ON "PaymentAlert"("userId", "competencia");

-- CreateIndex
CREATE INDEX "PaymentAlert_userId_updatedAt_idx" ON "PaymentAlert"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SyncMap" ADD CONSTRAINT "SyncMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAlert" ADD CONSTRAINT "PaymentAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
