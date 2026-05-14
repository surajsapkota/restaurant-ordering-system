// src/routes/orders.routes.ts

import { Router, Response } from "express";
import prisma from "../db/prisma";
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { printKitchenTicket } from "../utils/kitchenPrinter";

const router = Router();

const TAX_RATE = 0.13;
const dollarsToCents = (d: number) => Math.round(d * 100);
function isManagerOrAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}


// Recompute totals after voiding items
async function recomputeOrderTotals(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { basePriceCents: true, qty: true },
  });

  const subtotalCents = items.reduce((sum, it) => sum + it.basePriceCents * it.qty, 0);
  const taxCents = Math.round(subtotalCents * TAX_RATE);

  return {
    subtotalCents,
    taxCents,
    totalBeforeTipCents: subtotalCents + taxCents,
  };
}

/**
 * GET /orders
 * Protected. Optional filters:
 * /orders?status=READY&paymentStatus=UNPAID&type=DINE_IN
 */
router.get("/", requireAuth, async (req: any, res: Response) => {
  try {
    const statusQuery = req.query.status;
    const paymentStatusQuery = req.query.paymentStatus;
    const typeQuery = req.query.type;

    const status = typeof statusQuery === "string" ? statusQuery : undefined;
    const paymentStatus = typeof paymentStatusQuery === "string" ? paymentStatusQuery : undefined;
    const type = typeof typeQuery === "string" ? typeQuery : undefined;

    const validStatuses = Object.values(OrderStatus);
    const validPaymentStatuses = Object.values(PaymentStatus);
    const validTypes = Object.values(OrderType);

    const whereFilter: any = {};

    if (status && validStatuses.includes(status as OrderStatus)) {
      whereFilter.status = status as OrderStatus;
    }

    if (paymentStatus && validPaymentStatuses.includes(paymentStatus as PaymentStatus)) {
      whereFilter.paymentStatus = paymentStatus as PaymentStatus;
    }

    if (type && validTypes.includes(type as OrderType)) {
      whereFilter.type = type as OrderType;
    }

    const orders = await prisma.order.findMany({
      where: whereFilter,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    return res.status(200).json({ orders, filtersUsed: whereFilter });
  } catch (error) {
    console.error("GET /orders failed:", error);
    return res.status(500).json({ error: "Failed to load orders" });
  }
});
router.post("/:id/items", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { items, sendToKitchen } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "CLOSED") return res.status(400).json({ error: "Order is CLOSED" });

    // Fetch menu items (validate ids)
    const menuItemIds = items.map((it: any) => it.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isActive: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: "One or more menu items are invalid or inactive" });
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const newlyAddedItemsForPrint: any[] = [];

    const updated = await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const qty = Number(it.qty ?? 1);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error("qty must be a positive integer");
        }
    
        const menuItem = menuItemMap.get(it.menuItemId);
        if (!menuItem) throw new Error("Invalid menuItemId");
    
        const notesText =
          (typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() + "\n" : "") +
          (it.sideChoice ? `Side: ${it.sideChoice}\n` : "") +
          (it.spiceLevel ? `Spice: ${it.spiceLevel}\n` : "") +
          (it.extraCents ? `Extra: ${(Number(it.extraCents) / 100).toFixed(2)}` : "");
    
        const createdItem = await tx.orderItem.create({
          data: {
            orderId,
            menuItemId: menuItem.id,
            nameSnapshot: menuItem.name,
            basePriceCents: menuItem.priceCents + Number(it.extraCents ?? 0),
            qty,
            notes: notesText.trim() ? notesText.trim() : null,
          },
        });
    
        newlyAddedItemsForPrint.push(createdItem);
      }


      // recompute totals from DB
      const dbItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { basePriceCents: true, qty: true },
      });

      const subtotalCents = dbItems.reduce((sum, it) => sum + it.basePriceCents * it.qty, 0);
      const taxCents = Math.round(subtotalCents * TAX_RATE);
      const totalCents = subtotalCents + taxCents + (order.tipCents ?? 0);

      const nextStatus = sendToKitchen ? OrderStatus.IN_KITCHEN : order.status;

      return tx.order.update({
        where: { id: orderId },
        data: {
          subtotalCents,
          taxCents,
          totalCents,
          status: nextStatus,
          ...(sendToKitchen ? { sentToKitchenAt: new Date() } : {}),
        },
        include: { items: true },
      });
    });

    if (sendToKitchen) {
      try {
        await printKitchenTicket({
          ...updated,
          items: newlyAddedItemsForPrint,
        });
    
        console.log("Kitchen ticket printed");
      } catch (printError) {
        console.error("Kitchen print failed:", printError);
      }
    }
    
    return res.status(200).json({ order: updated });
  } catch (e) {
    console.error("POST /orders/:id/items failed:", e);
    return res.status(500).json({ error: "Failed to add items" });
  }
});


/**
 * POST /orders
 * Protected. Creates a new order inside an OPEN shift (same terminal).
 *
 * Body example:
 * {
 *   "type": "DINE_IN",
 *   "tableNumber": "9",
 *   "terminalCode": "TABLET-1",
 *   "items": [{ "menuItemId": "...", "qty": 2, "notes": "no onion" }]
 * }
 */
router.post("/", requireAuth, async (req: any, res: Response) => {
  try {
    const {
      type,
      tableNumber,
      customerName,
      customerPhone,
      deliveryAddr,
      tipDollars,
      items,
      terminalCode,
      sendToKitchen
    } = req.body;

    // ---- validations ----
    if (!type) {
      return res.status(400).json({ error: "type is required (DINE_IN, TAKEOUT, DELIVERY)" });
    }

    const validTypes = Object.values(OrderType);
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Allowed: ${validTypes.join(", ")}` });
    }

    if (!terminalCode || typeof terminalCode !== "string") {
      return res.status(400).json({ error: "terminalCode is required (ex: TABLET-1)" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    // normalize tableNumber into string (your schema uses text)
    const tableNumberStr =
      type === OrderType.DINE_IN && tableNumber != null && String(tableNumber).trim()
        ? String(tableNumber).trim()
        : null;

    // ---- find OPEN shift (whole restaurant) ----
    const shift = await prisma.storeShift.findFirst({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });

    if (!shift) {
      return res.status(400).json({
        code: "SHIFT_NOT_OPEN",
        error: "Shift is not open. Please ask manager to open shift.",
      });
    }

    // ---- fetch menu items ----
    const menuItemIds = items.map((it: any) => it.menuItemId);

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isActive: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: "One or more menu items are invalid or inactive" });
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // Validate qty and compute subtotal for JUST the new items
    let newItemsSubtotalCents = 0;

    for (const it of items) {
      const qty = Number(it.qty ?? 1);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: "qty must be a positive integer" });
      }

      const menuItem = menuItemMap.get(it.menuItemId);
      if (!menuItem) return res.status(400).json({ error: "Invalid menuItemId in items" });

      newItemsSubtotalCents += menuItem.priceCents * qty;
    }

    const createdOrUpdated = await prisma.$transaction(async (tx) => {
      // ✅ POS RULE: one open unpaid order per dine-in table
      // If table already has an active unpaid order, ADD items to it instead of creating new order.
      let existingOrder: any = null;

      if (type === OrderType.DINE_IN && tableNumberStr) {
        existingOrder = await tx.order.findFirst({
          where: {
            type: OrderType.DINE_IN,
            tableNumber: tableNumberStr,
            paymentStatus: PaymentStatus.UNPAID,
            status: { in: [OrderStatus.NEW, OrderStatus.IN_KITCHEN, OrderStatus.READY] },
          },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        });
      }

      // --------------------------------------------
      // CASE A: Append items to existing open order
      // --------------------------------------------
      if (existingOrder) {
        if (!existingOrder.storeShiftId) {
          await tx.order.update({
            where: { id: existingOrder.id },
            data: { storeShiftId: shift.id },
          });
        }
        for (const it of items) {
          const qty = Number(it.qty ?? 1);
          const menuItem = menuItemMap.get(it.menuItemId)!;

          await tx.orderItem.create({
            data: {
              orderId: existingOrder.id,
              menuItemId: menuItem.id,
              nameSnapshot: menuItem.name,
              basePriceCents: menuItem.priceCents,
              qty,
              notes: typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() : null,
            },
          });
        }

        // Recompute totals from DB (safe & accurate)
        const allItems = await tx.orderItem.findMany({
          where: { orderId: existingOrder.id },
          select: { basePriceCents: true, qty: true },
        });

        const subtotalCents = allItems.reduce((sum, it) => sum + it.basePriceCents * it.qty, 0);
        const taxCents = Math.round(subtotalCents * TAX_RATE);
        const tipCents = existingOrder.tipCents ?? 0;
        const totalCents = subtotalCents + taxCents + tipCents;

        // IMPORTANT: If new items are added, order should go back to NEW
        // because kitchen needs to see the new additions again.
        const updated = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            subtotalCents,
            taxCents,
            totalCents,
            status: OrderStatus.NEW,
            sentToKitchenAt: null, // reset because this is a “new send”
          },
          include: { items: true },
        });

        return { mode: "APPENDED", order: updated };
      }

      // --------------------------------------------
      // CASE B: Create brand new order
      // --------------------------------------------
      const lastOrder = await tx.order.findFirst({
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const tipCents = tipDollars ? dollarsToCents(Number(tipDollars)) : 0;
      const taxCents = Math.round(newItemsSubtotalCents * TAX_RATE);
      const totalCents = newItemsSubtotalCents + taxCents + tipCents;

      const order = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: type as OrderType,
          tableNumber: tableNumberStr,
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
          deliveryAddr: deliveryAddr ?? null,

          subtotalCents: newItemsSubtotalCents,
          taxCents,
          tipCents,
          totalCents,
          status: sendToKitchen ? OrderStatus.IN_KITCHEN : OrderStatus.NEW,
          sentToKitchenAt: sendToKitchen ? new Date() : null,

          storeShiftId: shift.id,
          terminalCode,

          createdById: req.user.id,
        },
      });

      for (const it of items) {
        const qty = Number(it.qty ?? 1);
        const menuItem = menuItemMap.get(it.menuItemId)!;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            nameSnapshot: menuItem.name,
            basePriceCents: menuItem.priceCents,
            qty,
            notes: typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() : null,
          },
        });
      }

      const created = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      return { mode: "CREATED", order: created };
    });

  if (sendToKitchen && createdOrUpdated.order) {
    try {
      await printKitchenTicket(createdOrUpdated.order);
      console.log("Kitchen ticket printed");
    } catch (printError) {
      console.error("Kitchen print failed:", printError);
    }
  }
    
    return res.status(createdOrUpdated.mode === "CREATED" ? 201 : 200).json(createdOrUpdated);
  } catch (error) {
    console.error("POST /orders failed:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
});


/**
 * PATCH /orders/:id/status
 */
router.patch("/:id/status", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "status is required" });

    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` });
    }

    const extraUpdates: any = {};
    if (status === "IN_KITCHEN") extraUpdates.sentToKitchenAt = new Date();
    if (status === "CLOSED") extraUpdates.closedAt = new Date();

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status, ...extraUpdates },
      include: { items: true },
    });
    
    if (status === "IN_KITCHEN") {
      try {
        await printKitchenTicket(updatedOrder);
      } catch (printError) {
        console.error("Kitchen print failed:", printError);
      }
    }
    
    return res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("PATCH /orders/:id/status failed:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  }
});

/**
 * POST /orders/:id/void
 */
router.post("/:id/void", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "reason is required" });
    }
    if (!isManagerOrAdmin(req.user?.role)) {
      return res.status(403).json({ error: "Only manager/admin can void an order." });
    }    

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true, createdBy: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "CLOSED") return res.status(400).json({ error: "Cannot void a CLOSED order" });

    const result = await prisma.$transaction(async (tx) => {
      await tx.voidLog.create({
        data: {
          orderId,
          orderItemId: null,
          reason,
          voidedById: req.user.id,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.UNPAID,
          paymentMethod: null,
          closedAt: new Date(),
      
        },
        include: { items: true, voidLogs: true },
      });
    });

    return res.status(200).json({ order: result });
  } catch (error) {
    console.error("POST /orders/:id/void failed:", error);
    return res.status(500).json({ error: "Failed to void order" });
  }
});

/**
 * POST /orders/:id/items/:orderItemId/void
 */
router.post("/:id/items/:orderItemId/void", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const orderItemId = String(req.params.orderItemId);
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "reason is required" });
    }
    if (!isManagerOrAdmin(req.user?.role)) {
      return res.status(403).json({ error: "Only manager/admin can void items Contact Manager." });
    }
    

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "CLOSED") return res.status(400).json({ error: "Cannot void items on a CLOSED order" });

    const orderItem = await prisma.orderItem.findFirst({
      where: { id: orderItemId, orderId },
    });
    if (!orderItem) return res.status(404).json({ error: "Order item not found in this order" });

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.voidLog.create({
        data: {
          orderId,
          orderItemId,
          reason,
          voidedById: req.user.id,
        },
      });

      await tx.orderItem.delete({ where: { id: orderItemId } });

      const totals = await recomputeOrderTotals(orderId);
      const totalCents = totals.totalBeforeTipCents + (order.tipCents ?? 0);

      return tx.order.update({
        where: { id: orderId },
        data: {
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          totalCents,
        },
        include: { items: true, voidLogs: true },
      });
    });

    return res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("POST /orders/:id/items/:orderItemId/void failed:", error);
    return res.status(500).json({ error: "Failed to void order item" });
  }
});

router.patch("/:id/payment", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { method, amountDollars, amountReceivedDollars } = req.body;

    if (!method) {
      return res.status(400).json({ error: "method is required (CASH or CARD)" });
    }

    const validMethods = Object.values(PaymentMethod);
    if (!validMethods.includes(method)) {
      return res
        .status(400)
        .json({ error: `Invalid method. Allowed: ${validMethods.join(", ")}` });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true, items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === OrderStatus.CLOSED) {
      return res.status(400).json({ error: "Order is already closed" });
    }

    const alreadyPaidCents = (order.payments ?? []).reduce(
      (sum, p) => sum + p.amountCents,
      0
    );

    const remainingCents = Math.max(0, order.totalCents - alreadyPaidCents);

    if (remainingCents <= 0) {
      return res.status(400).json({ error: "Order is already fully paid" });
    }

    const paymentAmountCents =
      amountDollars != null
        ? Math.round(Number(amountDollars) * 100)
        : remainingCents;

    if (!Number.isFinite(paymentAmountCents) || paymentAmountCents <= 0) {
      return res.status(400).json({ error: "amountDollars must be greater than 0" });
    }

    if (paymentAmountCents > remainingCents) {
      return res.status(400).json({ error: "Payment amount cannot exceed remaining balance" });
    }

    let amountReceivedCents: number | null = null;
    let changeGivenCents: number | null = null;

    if (method === PaymentMethod.CASH) {
      amountReceivedCents =
        amountReceivedDollars != null
          ? Math.round(Number(amountReceivedDollars) * 100)
          : paymentAmountCents;

      if (!Number.isFinite(amountReceivedCents) || amountReceivedCents < paymentAmountCents) {
        return res.status(400).json({
          error: "Cash received must be greater than or equal to payment amount",
        });
      }

      changeGivenCents = amountReceivedCents - paymentAmountCents;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId,
          method: method as PaymentMethod,
          amountCents: paymentAmountCents,
          amountReceivedCents,
          changeGivenCents,
        },
      });

      const allPayments = await tx.payment.findMany({
        where: { orderId },
        select: { amountCents: true },
      });

      const totalPaidCents = allPayments.reduce(
        (sum: number, p) => sum + p.amountCents,
        0
      );
      const stillRemainingCents = Math.max(0, order.totalCents - totalPaidCents);
      const fullyPaid = stillRemainingCents === 0;

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: fullyPaid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          paymentMethod: fullyPaid ? (method as PaymentMethod) : null,
          status: fullyPaid ? OrderStatus.CLOSED : order.status,
          closedAt: fullyPaid ? new Date() : null,
        },
        include: {
          items: true,
          payments: true,
          createdBy: true,
        },
      });

      return {
        order: updatedOrder,
        totalPaidCents,
        remainingCents: stillRemainingCents,
        fullyPaid,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("PATCH /orders/:id/payment failed:", error);
    return res.status(500).json({ error: "Failed to update payment" });
  }
});


/**
 * GET /orders/active/summary
 */
router.get("/active/summary", requireAuth, async (req: any, res: Response) => {
  try {
    const [newCount, kitchen, ready] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.NEW } }),
      prisma.order.count({ where: { status: OrderStatus.IN_KITCHEN } }),
      prisma.order.count({ where: { status: OrderStatus.READY } }),
    ]);

    return res.status(200).json({ open: newCount, kitchen, ready });
  } catch (error) {
    console.error("GET /orders/active/summary failed:", error);
    return res.status(500).json({ error: "Failed to load active orders summary" });
  }
});

router.get("/:id", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.status(200).json({ order });
  } catch (e) {
    console.error("GET /orders/:id failed:", e);
    return res.status(500).json({ error: "Failed to load order" });
  }
});



export default router;
