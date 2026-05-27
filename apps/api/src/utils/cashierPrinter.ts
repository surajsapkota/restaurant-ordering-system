import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

const CASHIER_PRINTER_NAME = "Cashier";

export async function printCashierReceiptText(text: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `receipt-${Date.now()}.txt`);

  fs.writeFileSync(filePath, text, "utf8");

  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-Content -Path "${filePath}" | Out-Printer -Name "${CASHIER_PRINTER_NAME}"`,
      ],
      (error) => {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }

        if (error) {
          return reject(error);
        }

        resolve();
      }
    );
  });
}
