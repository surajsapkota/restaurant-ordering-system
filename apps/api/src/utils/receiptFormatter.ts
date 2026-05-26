type ReceiptItem = {
  qty: number;
  nameSnapshot: string;
  basePriceCents: number;
  notes?: string | null;
  modifiers?: {
    nameSnapshot: string;
    priceDeltaCents: number;
  }[];
};

type ReceiptOrder = {
  orderNumber: number;
  type: string;
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddr?: string | null;
  customerNote?: string | null;
  subtotalCents: number;
  taxCents: number;
  tipCents?: number | null;
  totalCents: number;
  createdAt?: Date | string;
  items: ReceiptItem[];
};

type ReceiptOptions = {
  title?: string;
};

const WIDTH = 42;

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
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) lines.push(current);
  return lines;
}

function typeLabel(type: string) {
  return type.replace(/_/g, " ");
}

function addItemLines(lines: string[], item: ReceiptItem) {
  const modifiersTotal = (item.modifiers ?? []).reduce(
    (sum, modifier) => sum + modifier.priceDeltaCents,
    0
  );
  const itemTotal = (item.basePriceCents + modifiersTotal) * item.qty;
  const wrappedName = wrapText(`${item.qty} x ${item.nameSnapshot}`, 28);

  lines.push(row(wrappedName[0], money(itemTotal)));
  for (const nameLine of wrappedName.slice(1)) {
    lines.push(`    ${nameLine}`);
  }

  for (const modifier of item.modifiers ?? []) {
    const price = modifier.priceDeltaCents > 0 ? ` +${money(modifier.priceDeltaCents * item.qty)}` : "";
    for (const modifierLine of wrapText(`+ ${modifier.nameSnapshot}${price}`, WIDTH - 6)) {
      lines.push(`    ${modifierLine}`);
    }
  }

  for (const note of (item.notes ?? "").split("\n").filter(Boolean)) {
    for (const noteLine of wrapText(`Note: ${note}`, WIDTH - 6)) {
      lines.push(`    ${noteLine}`);
    }
  }
}

function receiptHeader(lines: string[], title: string) {
  lines.push(center("BOMBAY TO MUMBAI"));
  lines.push(center("Fine Indian & Hakka Cuisine"));
  lines.push(center("135 Queenston St"));
  lines.push(center("St Catharines, ON"));
  lines.push(center("(905) 688-6161"));
  lines.push(divider("="));
  lines.push(center(title));
  lines.push(divider("="));
}

export function formatCashierReceipt(order: ReceiptOrder, options: ReceiptOptions = {}) {
  const printedAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const title = options.title ?? "CUSTOMER RECEIPT";
  const lines: string[] = [];

  receiptHeader(lines, title);
  lines.push(row("Order #", String(order.orderNumber)));
  lines.push(row("Order Type", typeLabel(order.type)));
  if (order.tableNumber) lines.push(row("Table", String(order.tableNumber)));
  if (order.customerName) lines.push(row("Customer", order.customerName));
  if (order.customerPhone) lines.push(row("Phone", order.customerPhone));
  if (order.deliveryAddr) {
    lines.push("Delivery Address:");
    for (const addressLine of wrapText(order.deliveryAddr, WIDTH - 4)) {
      lines.push(`  ${addressLine}`);
    }
  }
  if (order.customerNote) {
    lines.push("Order Note:");
    for (const noteLine of wrapText(order.customerNote, WIDTH - 4)) {
      lines.push(`  ${noteLine}`);
    }
  }
  lines.push(divider("-"));

  for (const item of order.items) {
    addItemLines(lines, item);
  }

  lines.push(divider("-"));
  lines.push(row("Subtotal", money(order.subtotalCents)));
  lines.push(row("HST", money(order.taxCents)));
  if (order.tipCents && order.tipCents > 0) lines.push(row("Tip", money(order.tipCents)));
  lines.push(divider("="));
  lines.push(row("TOTAL", money(order.totalCents)));
  lines.push(divider("="));
  lines.push(
    printedAt.toLocaleString("en-CA", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  );
  lines.push("");
  lines.push(center("Thank you. Please come again."));
  lines.push("", "", "", "");

  return lines.join("\n");
}

export function formatCombinedCashierReceipt(orders: ReceiptOrder[]) {
  const lines: string[] = [];
  receiptHeader(lines, "COMBINED CUSTOMER BILL");

  for (const order of orders) {
    lines.push(row(`Order #${order.orderNumber}`, typeLabel(order.type)));
    if (order.tableNumber) lines.push(row("Table", String(order.tableNumber)));
    for (const item of order.items) addItemLines(lines, item);
    lines.push(divider("-"));
  }

  const subtotalCents = orders.reduce((sum, order) => sum + order.subtotalCents, 0);
  const taxCents = orders.reduce((sum, order) => sum + order.taxCents, 0);
  const tipCents = orders.reduce((sum, order) => sum + (order.tipCents ?? 0), 0);
  const totalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  lines.push(row("Subtotal", money(subtotalCents)));
  lines.push(row("HST", money(taxCents)));
  if (tipCents > 0) lines.push(row("Tip", money(tipCents)));
  lines.push(divider("="));
  lines.push(row("COMBINED TOTAL", money(totalCents)));
  lines.push(divider("="));
  lines.push(center("Bill print only - orders remain separate"));
  lines.push("", "", "", "");
  return lines.join("\n");
}
