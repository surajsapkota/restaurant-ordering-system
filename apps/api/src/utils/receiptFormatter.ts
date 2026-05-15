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
  
  function money(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  
  function line(left: string, right: string, width = 32) {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + " ".repeat(spaces) + right;
  }
  
  export function formatCashierReceipt(order: ReceiptOrder) {
    const now = new Date();
  
    const lines: string[] = [];
  
    lines.push("================================");
    lines.push("BOMBAY TO MUMBAI");
    lines.push("135 QUEENSTON ST");
    lines.push("ST CATHARINES, ON L2R2Z8");
    lines.push("Tel: (905) 688-6161");
    lines.push("WWW.BOMBAYTOMUMBAI.CA");
    lines.push("================================");
    lines.push("");
    lines.push(`Order No: ${order.orderNumber}`);
    lines.push(`Trans #: ${order.orderNumber}`);
    if (order.tableNumber) lines.push(`Table #: ${order.tableNumber}`);
    lines.push(`[${order.type.replace("_", " ")}]`);
    lines.push("--------------------------------");
    lines.push("Qty Item Description       Price");
    lines.push("--------------------------------");
  
    for (const item of order.items) {
      const itemTotal = item.basePriceCents * item.qty;
      lines.push(line(`${item.qty} ${item.nameSnapshot}`, money(itemTotal)));
  
      if (item.notes) {
        const notes = item.notes.split("\n").filter(Boolean);
        for (const note of notes) {
          lines.push(`  ${note}`);
        }
      }
    }
  
    lines.push("--------------------------------");
    lines.push(line("Net Total", money(order.subtotalCents)));
    lines.push(line("HST", money(order.taxCents)));
  
    if (order.tipCents && order.tipCents > 0) {
      lines.push(line("Tip", money(order.tipCents)));
    }
  
    lines.push("================================");
    lines.push(line("TOTAL", money(order.totalCents)));
    lines.push("================================");
    lines.push("");
    lines.push(
      `${order.items.length} Items   ${now.toLocaleString("en-CA", {
        month: "short",
        day: "2-digit",
        year: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      })}`
    );
    lines.push("");
    lines.push("Thank You! Please Come Again");
    lines.push("================================");
    lines.push(`Order No: ${order.orderNumber}`);
    lines.push("================================");
    lines.push("");
    lines.push("");
    lines.push("");
  
    return lines.join("\n");
  }