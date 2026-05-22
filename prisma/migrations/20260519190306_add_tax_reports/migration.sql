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
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxReport_userId_ano_key" ON "TaxReport"("userId", "ano");

-- AddForeignKey
ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
