import { Router, Response } from "express";
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from "@prisma/client";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

function requireAdmin(req: any, res: Response, next: any) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admin can view sales reports" });
  }
  next();
}

function parseStartOfDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

router.get("/sales", requireAuth, requireAdmin, async (req: any, res: Response) => {
  try {
    const fromDate = parseStartOfDay(String(req.query.from ?? ""));
    const toDate = parseStartOfDay(String(req.query.to ?? ""));

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "from and to are required in YYYY-MM-DD format" });
    }

    const endDateExclusive = addDays(toDate, 1);
    if (fromDate >= endDateExclusive) {
      return res.status(400).json({ error: "from date cannot be after to date" });
    }

    if (endDateExclusive.getTime() - fromDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "Date range cannot exceed 366 days" });
    }

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.CLOSED,
        paymentStatus: PaymentStatus.PAID,
        closedAt: {
          gte: fromDate,
          lt: endDateExclusive,
        },
      },
      orderBy: { closedAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true, employeeCode: true },
        },
        items: {
          include: { modifiers: true },
        },
        payments: true,
      },
    });

    const cancelledCount = await prisma.order.count({
      where: {
        status: OrderStatus.CANCELLED,
        updatedAt: {
          gte: fromDate,
          lt: endDateExclusive,
        },
      },
    });

    const totalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
    const subtotalCents = orders.reduce((sum, order) => sum + order.subtotalCents, 0);
    const discountCents = orders.reduce((sum, order) => sum + order.discountCents, 0);
    const taxCents = orders.reduce((sum, order) => sum + order.taxCents, 0);
    const tipCents = orders.reduce((sum, order) => sum + order.tipCents, 0);

    const paymentBreakdown = {
      cashCents: 0,
      cardCents: 0,
    };

    const orderTypeBreakdown = {
      [OrderType.DINE_IN]: { count: 0, salesCents: 0 },
      [OrderType.TAKEOUT]: { count: 0, salesCents: 0 },
      [OrderType.DELIVERY]: { count: 0, salesCents: 0 },
    };

    for (const order of orders) {
      orderTypeBreakdown[order.type].count += 1;
      orderTypeBreakdown[order.type].salesCents += order.totalCents;

      for (const payment of order.payments) {
        if (payment.method === PaymentMethod.CASH) {
          paymentBreakdown.cashCents += payment.amountCents;
        } else {
          paymentBreakdown.cardCents += payment.amountCents;
        }
      }
    }

    return res.json({
      range: {
        from: String(req.query.from),
        to: String(req.query.to),
      },
      summary: {
        totalCents,
        netSalesCents: subtotalCents - discountCents,
        discountCents,
        taxCents,
        tipCents,
        orderCount: orders.length,
        averageOrderCents: orders.length ? Math.round(totalCents / orders.length) : 0,
        cancelledCount,
      },
      paymentBreakdown,
      orderTypeBreakdown,
      orders,
    });
  } catch (error) {
    console.error("GET /reports/sales failed:", error);
    return res.status(500).json({ error: "Failed to load sales report" });
  }
});

export default router;
