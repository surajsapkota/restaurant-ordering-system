type ReceiptOrder = {
  orderNumber: number;
  type: string;
  tableNumber?: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents?: number | null;
  totalCents: number;
  createdAt?: Date;
  items: {
    qty: number;
    nameSnapshot: string;
    basePriceCents: number;
    notes?: string | null;
  }[];
};

const WIDTH = 32;

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function divider(char = "-") {
  return char.repeat(WIDTH);
}

function center(text: string) {
  const clean = text.slice(0, WIDTH);
  const spaces = Math.max(0, Math.floor((WIDTH - clean.length) / 2));
  return " ".repeat(spaces) + clean;
}

function row(left: string, right: string) {
  const cleanLeft = left.slice(0, WIDTH - right.length - 1);
  const spaces = Math.max(1, WIDTH - cleanLeft.length - right.length);
  return cleanLeft + " ".repeat(spaces) + right;
}

function wrapText(text: string, maxLength: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function formatCashierReceipt(order: ReceiptOrder) {
  const now = order.createdAt ? new Date(order.createdAt) : new Date();
  const lines: string[] = [];

  lines.push(center("BOMBAY TO MUMBAI"));
  lines.push(center("Fine Indian & Hakka Cuisine"));
  lines.push(center("135 QUEENSTON ST"));
  lines.push(center("ST CATHARINES, ON"));
  lines.push(center("(905) 688-6161"));
  lines.push(divider("="));

  lines.push(row("Order No:", String(order.orderNumber)));
  lines.push(row("Trans #:", String(order.orderNumber)));
  if (order.tableNumber) lines.push(row("Table #:", String(order.tableNumber)));
  lines.push(center(order.type.replace("_", " ")));
  lines.push(divider("-"));

  for (const item of order.items) {
    const itemTotal = item.basePriceCents * item.qty;
    const firstLine = `${item.qty} x ${item.nameSnapshot}`;

    const wrapped = wrapText(firstLine, 22);

    lines.push(row(wrapped[0], money(itemTotal)));

    for (let i = 1; i < wrapped.length; i++) {
      lines.push(`  ${wrapped[i]}`);
    }

    if (item.notes) {
      const notes = item.notes.split("\n").filter(Boolean);
      for (const note of notes) {
        const wrappedNotes = wrapText(`* ${note}`, 28);
        for (const n of wrappedNotes) {
          lines.push(`  ${n}`);
        }
      }
    }
  }

  lines.push(divider("-"));
  lines.push(row("Subtotal", money(order.subtotalCents)));
  lines.push(row("HST", money(order.taxCents)));

  if (order.tipCents && order.tipCents > 0) {
    lines.push(row("Tip", money(order.tipCents)));
  }

  lines.push(divider("="));
  lines.push(row("TOTAL", money(order.totalCents)));
  lines.push(divider("="));

  lines.push(`${order.items.length} Items`);
  lines.push(
    now.toLocaleString("en-CA", {
      month: "short",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    })
  );

  lines.push("");
  lines.push(center("Thank You!"));
  lines.push(center("Please Come Again"));
  lines.push("");
  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}