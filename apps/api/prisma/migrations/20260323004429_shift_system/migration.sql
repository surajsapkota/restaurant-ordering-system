/*
  Warnings:

  - You are about to drop the column `shiftId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `Shift` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[employeeCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_userId_fkey";

-- DropIndex
DROP INDEX "Order_shiftId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "shiftId",
ADD COLUMN     "storeShiftId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeCode" TEXT;

-- DropTable
DROP TABLE "Shift";

-- CreateTable
CREATE TABLE "StoreShift" (
    "id" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "businessDate" TIMESTAMP(3) NOT NULL,
    "terminalCode" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "openingCashCents" INTEGER NOT NULL DEFAULT 0,
    "closingCashCents" INTEGER,
    "grossSalesCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "voidedCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "netSalesCents" INTEGER NOT NULL DEFAULT 0,
    "cashSalesCents" INTEGER NOT NULL DEFAULT 0,
    "cardSalesCents" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSession" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "storeShiftId" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreShift_status_idx" ON "StoreShift"("status");

-- CreateIndex
CREATE INDEX "StoreShift_businessDate_idx" ON "StoreShift"("businessDate");

-- CreateIndex
CREATE INDEX "StoreShift_openedById_idx" ON "StoreShift"("openedById");

-- CreateIndex
CREATE INDEX "EmployeeSession_employeeId_idx" ON "EmployeeSession"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSession_storeShiftId_idx" ON "EmployeeSession"("storeShiftId");

-- CreateIndex
CREATE INDEX "EmployeeSession_loginAt_idx" ON "EmployeeSession"("loginAt");

-- CreateIndex
CREATE INDEX "Order_storeShiftId_idx" ON "Order"("storeShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- AddForeignKey
ALTER TABLE "StoreShift" ADD CONSTRAINT "StoreShift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShift" ADD CONSTRAINT "StoreShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSession" ADD CONSTRAINT "EmployeeSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSession" ADD CONSTRAINT "EmployeeSession_storeShiftId_fkey" FOREIGN KEY ("storeShiftId") REFERENCES "StoreShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeShiftId_fkey" FOREIGN KEY ("storeShiftId") REFERENCES "StoreShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
