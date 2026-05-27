CREATE TABLE "PrinterJob" (
    "id" TEXT NOT NULL,
    "printer" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "PrinterJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrinterJob_printer_status_createdAt_idx" ON "PrinterJob"("printer", "status", "createdAt");
