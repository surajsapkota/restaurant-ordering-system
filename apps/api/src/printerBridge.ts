import fs from "fs";
import path from "path";
import prisma from "./db/prisma";
import { printKitchenTicket } from "./utils/kitchenPrinter";
import { printCashierReceiptText } from "./utils/cashierPrinter";

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
      items: { include: { modifiers: true } },
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

async function checkAndPrintCashierJobs() {
  const jobs = await prisma.printerJob.findMany({
    where: {
      printer: "CASHIER",
      status: "PENDING",
      attempts: { lt: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const job of jobs) {
    const claimed = await prisma.printerJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: {
        status: "PRINTING",
        attempts: { increment: 1 },
        error: null,
      },
    });

    if (claimed.count === 0) continue;

    try {
      await printCashierReceiptText(job.content);
      await prisma.printerJob.update({
        where: { id: job.id },
        data: {
          status: "PRINTED",
          printedAt: new Date(),
        },
      });
      console.log(`Printed cashier job ${job.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cashier print failed";
      const finalAttempt = job.attempts + 1 >= 3;
      await prisma.printerJob.update({
        where: { id: job.id },
        data: {
          status: finalAttempt ? "FAILED" : "PENDING",
          error: message.slice(0, 500),
        },
      });
      console.error(`Cashier job ${job.id} failed:`, error);
    }
  }
}

async function startBridge() {
  console.log("🟢 Printer bridge started");
  console.log("Watching database for kitchen orders and cashier print jobs...");

  setInterval(async () => {
    try {
      await checkAndPrint();
    } catch (error) {
      console.error("Kitchen printer bridge error:", error);
    }

    try {
      await checkAndPrintCashierJobs();
    } catch (error) {
      console.error("Cashier printer bridge error:", error);
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
