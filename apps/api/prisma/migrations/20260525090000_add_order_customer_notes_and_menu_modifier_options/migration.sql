ALTER TABLE "Order" ADD COLUMN "customerNote" TEXT;

CREATE TABLE "MenuModifierOption" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuModifierOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuModifierOption_menuItemId_idx" ON "MenuModifierOption"("menuItemId");

ALTER TABLE "MenuModifierOption" ADD CONSTRAINT "MenuModifierOption_menuItemId_fkey"
FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
