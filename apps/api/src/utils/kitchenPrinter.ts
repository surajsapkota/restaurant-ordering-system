import { Router, Request, Response } from "express";
import net from "net";

const KITCHEN_PRINTER_IP = "192.168.0.191";
const KITCHEN_PRINTER_PORT = 9100;

type KitchenOrder = {
  orderNumber: number;
  type: string;
  tableNumber?: string | null;
  customerName?: string | null;
  createdAt?: Date;
  items: {
    qty: number;
    nameSnapshot: string;
    notes?: string | null;
  }[];
};

function sendToPrinter(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(KITCHEN_PRINTER_PORT, KITCHEN_PRINTER_IP, () => {
      console.log("Kitchen printer connected");

      client.write(data, (err) => {
        if (err) {
          client.destroy();
          return reject(err);
        }
        client.end();
      });
    });

    client.on("close", () => {
      console.log("Kitchen printer connection closed");
      resolve();
    });

    client.on("error", (err) => {
      console.error("Kitchen printer error:", err);
      reject(err);
    });

    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error("Kitchen printer timeout"));
    });
  });
}

// ─── ESC/POS Helpers ────────────────────────────────────────────────────────

const ESC = {
  init:        Buffer.from([0x1b, 0x40]),          // Reset printer
  alignLeft:   Buffer.from([0x1b, 0x61, 0x00]),
  alignCenter: Buffer.from([0x1b, 0x61, 0x01]),
  alignRight:  Buffer.from([0x1b, 0x61, 0x02]),
  boldOn:      Buffer.from([0x1b, 0x45, 0x01]),
  boldOff:     Buffer.from([0x1b, 0x45, 0x00]),
  normal:      Buffer.from([0x1d, 0x21, 0x00]),    // Normal size
  medium:      Buffer.from([0x1d, 0x21, 0x01]),    // Double height
  large:       Buffer.from([0x1d, 0x21, 0x11]),    // Double width + height
  huge:        Buffer.from([0x1d, 0x21, 0x33]),    // 4x size (header only)
  cut:         Buffer.from([0x1d, 0x56, 0x00]),
};

function txt(s: string): Buffer {
  return Buffer.from(s, "ascii");
}

function line(char = "-", len = 32): Buffer {
  return txt(char.repeat(len) + "\n");
}

// ─── Main Print Function ─────────────────────────────────────────────────────

export async function printKitchenTicket(order: KitchenOrder) {
  const now = order.createdAt ?? new Date();

  const timeText = now.toLocaleString("en-CA", {
    month:  "2-digit",
    day:    "2-digit",
    year:   "2-digit",
    hour:   "numeric",
    minute: "2-digit",
  });

  const typeLabel =
    order.type === "DINE_IN"  ? "DINE IN"  :
    order.type === "TAKEOUT"  ? "TAKEOUT"  : "DELIVERY";

  const chunks: Buffer[] = [];

  // ── Reset ──────────────────────────────────────────────────────────────────
  chunks.push(ESC.init);

  // ── HEADER: Order Type ─────────────────────────────────────────────────────
  // Big and bold — tells staff at a glance what kind of order this is
  chunks.push(ESC.alignCenter);
  chunks.push(ESC.huge);
  chunks.push(ESC.boldOn);
  chunks.push(txt(`${typeLabel}\n`));
  chunks.push(ESC.boldOff);
  chunks.push(ESC.normal);
  chunks.push(line("="));

  // ── ORDER DETAILS ──────────────────────────────────────────────────────────
  // Medium, plain — just info, no need to shout
  chunks.push(ESC.alignLeft);
  chunks.push(ESC.medium);

  chunks.push(txt(`ORDER #${order.orderNumber}\n`));

  if (order.tableNumber) {
    chunks.push(txt(`TABLE   ${order.tableNumber}\n`));
  }

  if (order.customerName) {
    chunks.push(txt(`NAME    ${order.customerName}\n`));
  }

  chunks.push(ESC.normal);
  chunks.push(txt(`TIME    ${timeText}\n`));

  chunks.push(line("-"));

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  // Each item is the most important thing on the ticket.
  // Bold for the name, normal (unbolded) for notes.
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];

    // Item number pill: "1." "2." etc — helps staff count items quickly
    chunks.push(ESC.alignLeft);
    chunks.push(ESC.normal);
    chunks.push(txt(`ITEM ${i + 1} of ${order.items.length}\n`));

    // Item name — large and bold, easy to read across the pass
    chunks.push(ESC.large);
    chunks.push(ESC.boldOn);
    chunks.push(txt(`${item.qty}x ${item.nameSnapshot.toUpperCase()}\n`));
    chunks.push(ESC.boldOff);

    // Notes — medium, NOT bold, clearly subordinate to the item name
    if (item.notes) {
      const noteLines = item.notes.split("\n").filter(Boolean);
      chunks.push(ESC.medium);
      for (const note of noteLines) {
        chunks.push(txt(`  > ${note}\n`));          // Lowercase, indented
      }
    }

    // Divider between items (lighter than the section divider)
    chunks.push(ESC.normal);
    chunks.push(txt("\n"));
    if (i < order.items.length - 1) {
      chunks.push(line("- "));                       // Dashed, not solid
    }
    chunks.push(txt("\n"));
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  chunks.push(line("="));
  chunks.push(ESC.alignCenter);
  chunks.push(ESC.normal);
  chunks.push(txt("BOMBAY TO MUMBAI\n"));
  chunks.push(txt("\n\n\n"));
  chunks.push(ESC.cut);

  await sendToPrinter(Buffer.concat(chunks));
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const router = Router();

router.get("/test", async (_req: Request, res: Response) => {
  try {
    const testOrder: KitchenOrder = {
      orderNumber: 99,
      type: "DINE_IN",
      tableNumber: "4",
      customerName: "Test Customer",
      createdAt: new Date(),
      items: [
        {
          qty: 2,
          nameSnapshot: "Butter Chicken",
          notes: "No spice\nExtra sauce",
        },
        {
          qty: 1,
          nameSnapshot: "Garlic Naan",
          notes: null,
        },
      ],
    };

    await printKitchenTicket(testOrder);

    return res.json({ success: true, message: "Test ticket printed" });
  } catch (error) {
    console.error("Printer test failed:", error);
    return res.status(500).json({ success: false, message: "Printer test failed" });
  }
});

export default router;