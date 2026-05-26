import { Router, Request, Response } from "express";
import net from "net";
import { printCashierReceiptText } from "../utils/cashierPrinter";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { formatCashierReceipt, formatCombinedCashierReceipt } from "../utils/receiptFormatter";

const router = Router();

const PRINTER_IP = "192.168.0.191";
const PRINTER_PORT = 9100;

function sendToPrinter(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      client.write(data, (err) => {
        if (err) {
          client.destroy();
          return reject(err);
        }
        client.end();
      });
    });

    client.on("close", () => resolve());
    client.on("error", (err) => reject(err));
    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error("Printer timeout"));
    });
  });
}

router.get("/test", requireAuth, async (_req: Request, res: Response) => {
  try {
    const initializePrinter = Buffer.from([0x1b, 0x40]);
    const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
    const text = [
      "BOMBAY TO MUMBAI",
      "------------------------------",
      "Kitchen Printer Test",
      "",
      "If you see this, printing works!",
      "",
      "------------------------------",
      "",
      "",
      "",
    ].join("\n");

    await sendToPrinter(
      Buffer.concat([initializePrinter, Buffer.from(text, "utf8"), cutPaper])
    );
    return res.json({ success: true, message: "Printed successfully" });
  } catch (error) {
    console.error("Printer test failed:", error);
    return res.status(500).json({ success: false, message: "Printer test failed" });
  }
});

router.get("/cashier-test", requireAuth, async (_req: Request, res: Response) => {
  try {
    await printCashierReceiptText(
      [
        "BOMBAY TO MUMBAI",
        "------------------------------",
        "Cashier Printer Test",
        "",
        "If you see this,",
        "front counter printer works!",
        "",
        "------------------------------",
        "",
        "",
      ].join("\n")
    );
    return res.json({ success: true, message: "Cashier printer test printed" });
  } catch (error) {
    console.error("Cashier printer test failed:", error);
    return res.status(500).json({ success: false, message: "Cashier printer test failed" });
  }
});

router.post("/cashier-receipt/:orderId", requireAuth, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const title = req.body?.copy === "check" ? "CUSTOMER BILL - NOT PAID" : "PAID RECEIPT";
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { modifiers: true } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    await printCashierReceiptText(formatCashierReceipt(order, { title }));
    return res.json({ success: true, message: "Cashier receipt printed" });
  } catch (error) {
    console.error("Cashier receipt print failed:", error);
    return res.status(500).json({ success: false, message: "Cashier receipt print failed" });
  }
});

router.post("/cashier-combined-receipt", requireAuth, async (req: Request, res: Response) => {
  try {
    const rawOrderIds: unknown[] = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
    const orderIds: string[] = Array.from(
      new Set(
        rawOrderIds
          .map((id) => String(id))
          .filter(Boolean)
      )
    ).slice(0, 10);

    if (orderIds.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least two orders" });
    }

    const foundOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { items: { include: { modifiers: true } } },
    });

    if (foundOrders.length !== orderIds.length) {
      return res.status(404).json({ success: false, message: "One or more orders were not found" });
    }

    const sortedOrders = orderIds
      .map((id) => foundOrders.find((order) => order.id === id))
      .filter((order): order is (typeof foundOrders)[number] => Boolean(order));

    await printCashierReceiptText(formatCombinedCashierReceipt(sortedOrders));
    return res.json({ success: true, message: "Combined customer bill printed" });
  } catch (error) {
    console.error("Combined cashier receipt print failed:", error);
    return res.status(500).json({ success: false, message: "Combined bill print failed" });
  }
});

export default router;
