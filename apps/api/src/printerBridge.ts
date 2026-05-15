import fs from "fs";
import path from "path";
import prisma from "./db/prisma";
import { printKitchenTicket } from "./utils/kitchenPrinter";

const PRINTED_FILE = path.join(process.cwd(), "printed-items.json");

type PrintedStore = {
  itemIds: string[];
};

function loadPrinted(): PrintedStore {
  if (!fs.existsSync(PRINTED_FILE)) {
    return { itemIds: [] };
  }

  return JSON.parse(fs.readFileSync(PRINTED_FILE, "utf8"));
}

function savePrinted(store: PrintedStore) {
  fs.writeFileSync(PRINTED_FILE, JSON.stringify(store, null, 2));
}

async function initPrintedItems() {
  const items = await prisma.orderItem.findMany({
    select: { id: true },
  });

  savePrinted({
    itemIds: items.map((i) => i.id),
  });

  console.log(`✅ Initialized printer bridge with ${items.length} existing items`);
}

async function checkAndPrint() {
  const store = loadPrinted();
  const printedSet = new Set(store.itemIds);

  const orders = await prisma.order.findMany({
    where: {
      status: "IN_KITCHEN",
    },
    include: {
      items: true,
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: 20,
  });

  for (const order of orders) {
    const newItems = order.items.filter(
      (item) => !printedSet.has(item.id)
    );

    if (newItems.length === 0) continue;

    console.log(
      `🖨 Printing order #${order.orderNumber} (${newItems.length} new item(s))`
    );

    await printKitchenTicket({
      ...order,
      items: newItems,
    });

    for (const item of newItems) {
      printedSet.add(item.id);
    }

    savePrinted({
      itemIds: Array.from(printedSet),
    });

    console.log(`✅ Printed order #${order.orderNumber}`);
  }
}

async function startBridge() {
  console.log("🟢 Printer bridge started");
  console.log("Watching Neon database for kitchen orders...");

  setInterval(async () => {
    try {
      await checkAndPrint();
    } catch (error) {
      console.error("❌ Printer bridge error:", error);
    }
  }, 5000);
}

if (process.argv.includes("--init")) {
  initPrintedItems()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  startBridge();
}