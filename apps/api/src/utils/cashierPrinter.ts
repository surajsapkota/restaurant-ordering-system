import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

const DEFAULT_CASHIER_PRINTER_NAME = "Cashier";

const ESC = {
  init: Buffer.from([0x1b, 0x40]),
  alignLeft: Buffer.from([0x1b, 0x61, 0x00]),
  normal: Buffer.from([0x1d, 0x21, 0x00]),
  cut: Buffer.from([0x1d, 0x56, 0x00]),
};

function getCashierPrinterName() {
  const printerName = process.env.CASHIER_PRINTER_NAME?.trim() || DEFAULT_CASHIER_PRINTER_NAME;
  if (!/^[a-zA-Z0-9 _-]+$/.test(printerName)) {
    throw new Error("CASHIER_PRINTER_NAME contains invalid characters");
  }

  return printerName;
}

function encodedRawPrintCommand(printerName: string, filePath: string) {
  const script = `
$ErrorActionPreference = "Stop"
$source = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string printerName, out IntPtr printerHandle, IntPtr defaults);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr printerHandle, int level, [In] DOCINFO docInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr printerHandle, byte[] bytes, int count, out int written);

    public static void PrintFile(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr handle;
        if (!OpenPrinter(printerName, out handle, IntPtr.Zero)) {
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        }

        try {
            DOCINFO info = new DOCINFO();
            info.pDocName = "POS Receipt";
            info.pDataType = "RAW";
            if (StartDocPrinter(handle, 1, info) == 0) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }

            try {
                if (!StartPagePrinter(handle)) {
                    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
                }

                try {
                    int written;
                    if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) {
                        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
                    }
                } finally {
                    EndPagePrinter(handle);
                }
            } finally {
                EndDocPrinter(handle);
            }
        } finally {
            ClosePrinter(handle);
        }
    }
}
"@
Add-Type -TypeDefinition $source
[RawPrinter]::PrintFile('${printerName}', '${filePath.replace(/'/g, "''")}')
`;

  return Buffer.from(script, "utf16le").toString("base64");
}

export async function printCashierReceiptText(text: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `receipt-${Date.now()}.bin`);
  const printerName = getCashierPrinterName();

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
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodedRawPrintCommand(printerName, filePath),
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
              `Raw cashier printing failed. Confirm Windows has an installed printer named "${printerName}".`
            )
          );
        }

        resolve();
      }
    );
  });
}
