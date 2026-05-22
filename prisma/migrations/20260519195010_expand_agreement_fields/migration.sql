-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_userId_fkey";

-- DropIndex
DROP INDEX "Agreement_userId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "canal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dataAcordo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homologado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "primeiroVencimento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qtdParcelas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "substituiDivida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'EXTRAJUDICIAL',
ALTER COLUMN "status" SET DEFAULT 'SIMULACAO';

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
