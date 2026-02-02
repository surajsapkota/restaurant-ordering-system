// src/routes/orders.routes.ts

import { Router, Response } from "express";
import prisma from "../db/prisma";
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const TAX_RATE = 0.13;
const dollarsToCents = (d: number) => Math.round(d * 100);

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

    // ---- find OPEN shift for this terminal ----
    const shift = await prisma.shift.findFirst({
      where: { status: "OPEN", terminalCode },
      orderBy: { openedAt: "desc" }, // Shift model has openedAt
    });

    if (!shift) {
      return res.status(400).json({
        error: "No OPEN shift for this terminal. Please open a shift first.",
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

    // ---- totals ----
    let subtotalCents = 0;

    for (const it of items) {
      const qty = Number(it.qty ?? 1);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: "qty must be a positive integer" });
      }

      const menuItem = menuItemMap.get(it.menuItemId);
      if (!menuItem) return res.status(400).json({ error: "Invalid menuItemId in items" });

      subtotalCents += menuItem.priceCents * qty;
    }

    const tipCents = tipDollars ? dollarsToCents(Number(tipDollars)) : 0;
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents + tipCents;

    // ---- create order + items (transaction) ----
    const createdOrder = await prisma.$transaction(async (tx) => {
      const lastOrder = await tx.order.findFirst({
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const order = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: type as OrderType,
          tableNumber: tableNumber ?? null,
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
          deliveryAddr: deliveryAddr ?? null,

          subtotalCents,
          taxCents,
          tipCents,
          totalCents,

          shiftId: shift.id,
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

      return tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
    });

    return res.status(201).json({ order: createdOrder });
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
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

/**
 * PATCH /orders/:id/payment
 */
router.patch("/:id/payment", requireAuth, async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { method } = req.body;

    if (!method) return res.status(400).json({ error: "method is required (CASH or CARD)" });

    const validMethods = Object.values(PaymentMethod);
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `Invalid method. Allowed: ${validMethods.join(", ")}` });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: method as PaymentMethod,
      },
      include: { items: true },
    });

    return res.status(200).json({ order: updatedOrder });
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

export default router;
