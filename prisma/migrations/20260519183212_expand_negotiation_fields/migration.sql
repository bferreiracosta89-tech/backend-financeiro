-- DropForeignKey
ALTER TABLE "Negotiation" DROP CONSTRAINT "Negotiation_userId_fkey";

-- DropIndex
DROP INDEX "Negotiation_userId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN     "observacao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valorAcordado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "valorOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "canal" SET DEFAULT '';

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
