import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

const DEFAULT_CASHIER_PRINTER_SHARE = "Cashier";

const ESC = {
  init: Buffer.from([0x1b, 0x40]),
  alignLeft: Buffer.from([0x1b, 0x61, 0x00]),
  normal: Buffer.from([0x1d, 0x21, 0x00]),
  cut: Buffer.from([0x1d, 0x56, 0x00]),
};

function getCashierPrinterPath() {
  const shareName = process.env.CASHIER_PRINTER_SHARE?.trim() || DEFAULT_CASHIER_PRINTER_SHARE;
  if (!/^[a-zA-Z0-9 _-]+$/.test(shareName)) {
    throw new Error("CASHIER_PRINTER_SHARE contains invalid characters");
  }

  return `\\\\localhost\\${shareName}`;
}

export async function printCashierReceiptText(text: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `receipt-${Date.now()}.bin`);
  const printerPath = getCashierPrinterPath();

  fs.writeFileSync(
    filePath,
    Buffer.concat([
      ESC.init,
      ESC.alignLeft,
      ESC.normal,
      Buffer.from(text, "ascii"),
      Buffer.from("\n\n\n"),
      ESC.cut,
    ])
  );

  return new Promise((resolve, reject) => {
    execFile(
      "cmd",
      [
        "/d",
        "/s",
        "/c",
        `copy /B "${filePath}" "${printerPath}"`,
      ],
      (error) => {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }

        if (error) {
          return reject(
            new Error(
              `Raw cashier printing failed. Confirm printer sharing is enabled with share name "${process.env.CASHIER_PRINTER_SHARE?.trim() || DEFAULT_CASHIER_PRINTER_SHARE}".`
            )
          );
        }

        resolve();
      }
    );
  });
}
