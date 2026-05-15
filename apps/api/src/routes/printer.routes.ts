import { Router, Request, Response } from "express";
import net from "net";
import { printCashierReceiptText } from "../utils/cashierPrinter";
import prisma from "../db/prisma";
import { formatCashierReceipt } from "../utils/receiptFormatter";

const router = Router();

const PRINTER_IP = "192.168.0.191";
const PRINTER_PORT = 9100;

function sendToPrinter(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log("🖨 Connected to printer");

      client.write(data, (err) => {
        if (err) {
          console.error("❌ Printer write failed:", err);
          client.destroy();
          return reject(err);
        }

        client.end();
      });
    });

    client.on("close", () => {
      console.log("✅ Printer connection closed");
      resolve();
    });

    client.on("error", (err) => {
      console.error("❌ Printer error:", err);
      reject(err);
    });

    client.setTimeout(5000, () => {
      console.error("❌ Printer timeout");
      client.destroy();
      reject(new Error("Printer timeout"));
    });
  });
}

router.get("/test", async (_req: Request, res: Response) => {
  try {
    const initializePrinter = Buffer.from([0x1b, 0x40]);
    const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);

    const text = `
BOMBAY TO MUMBAI
------------------------------
Kitchen Printer Test

If you see this, printing works!

------------------------------



`;

    const data = Buffer.concat([
      initializePrinter,
      Buffer.from(text, "utf8"),
      cutPaper,
    ]);

    await sendToPrinter(data);

    return res.json({ success: true, message: "Printed successfully" });
  } catch (error) {
    console.error("Printer test failed:", error);
    return res.status(500).json({
      success: false,
      message: "Printer test failed",
    });
  }
});

router.get("/cashier-test", async (_req: Request, res: Response) => {
  try {
    await printCashierReceiptText(`
BOMBAY TO MUMBAI
------------------------------
Cashier Printer Test

If you see this,
front counter printer works!

------------------------------



`);

    return res.json({ success: true, message: "Cashier printer test printed" });
  } catch (error) {
    console.error("Cashier printer test failed:", error);
    return res.status(500).json({
      success: false,
      message: "Cashier printer test failed",
    });
  }
});
router.get("/cashier-receipt/:orderId", async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const receiptText = formatCashierReceipt(order);

    await printCashierReceiptText(receiptText);

    return res.json({
      success: true,
      message: "Cashier receipt printed",
    });
  } catch (error) {
    console.error("Cashier receipt print failed:", error);
    return res.status(500).json({
      success: false,
      message: "Cashier receipt print failed",
    });
  }
});

export default router;