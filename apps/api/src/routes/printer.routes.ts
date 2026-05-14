import { Router, Request, Response } from "express";
import net from "net";

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

export default router;