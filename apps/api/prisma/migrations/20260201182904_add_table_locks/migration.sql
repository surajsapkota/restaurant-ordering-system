-- CreateTable
CREATE TABLE "TableLock" (
    "id" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableLock_tableNumber_key" ON "TableLock"("tableNumber");

-- CreateIndex
CREATE INDEX "TableLock_expiresAt_idx" ON "TableLock"("expiresAt");

-- AddForeignKey
ALTER TABLE "TableLock" ADD CONSTRAINT "TableLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
