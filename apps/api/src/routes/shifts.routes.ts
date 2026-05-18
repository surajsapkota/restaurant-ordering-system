import { Router, Response } from "express";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import {
  ShiftStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from "@prisma/client";

const router = Router();

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "CUSTOMER";

function requireManagerOrAdmin(req: any, res: Response, next: any) {
  const role: Role | undefined = req.user?.role;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return res.status(403).json({ error: "Only manager/admin can do this" });
  }

  next();
}

/**
 * Get current open store shift
 * GET /shifts/current
 */
/**
 * Get current open store shift
 * GET /shifts/current
 */
router.get("/current", requireAuth, async (_req: any, res) => {
  try {
    const shift = await prisma.storeShift.findFirst({
      where: { status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        status: true,
        businessDate: true,
        terminalCode: true,
        openingCashCents: true,
        openedAt: true,
        openedById: true,
        openedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!shift) {
      return res.json({ shift: null });
    }

    // GET ALL PAID ORDERS FOR THIS SHIFT
    const orders = await prisma.order.findMany({
      where: {
        storeShiftId: shift.id,
        paymentStatus: PaymentStatus.PAID,
      },
      select: {
        subtotalCents: true,
        taxCents: true,
        tipCents: true,
        totalCents: true,
        paymentMethod: true,
      },
    });

    // CALCULATE LIVE TOTALS
    const grossSalesCents = orders.reduce(
      (sum, o) => sum + o.totalCents,
      0
    );

    const taxCents = orders.reduce(
      (sum, o) => sum + o.taxCents,
      0
    );

    const tipCents = orders.reduce(
      (sum, o) => sum + o.tipCents,
      0
    );

    const cashSalesCents = orders
      .filter((o) => o.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, o) => sum + o.totalCents, 0);

    const cardSalesCents = orders
      .filter((o) => o.paymentMethod === PaymentMethod.CARD)
      .reduce((sum, o) => sum + o.totalCents, 0);

    const orderCount = orders.length;

    // ACTIVE EMPLOYEE SESSIONS
    const staffClockedIn = await prisma.employeeSession.findMany({
      where: {
        logoutAt: null,
        loginAt: {
          gte: shift.openedAt,
        },
      },
      select: {
        id: true,
        loginAt: true,
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
            employeeCode: true,
          },
        },
      },
      orderBy: {
        loginAt: "asc",
      },
    });

    return res.json({
      shift: {
        ...shift,

        grossSalesCents,
        taxCents,
        tipCents,

        cashSalesCents,
        cardSalesCents,

        orderCount,

        staffClockedInCount: staffClockedIn.length,
        staffClockedIn,
      },
    });
  } catch (error) {
    console.error("GET /shifts/current failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Open store shift
 * POST /shifts/open
 * Body: { terminalCode, openingCashCents? }
 */
router.post("/open", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
  try {
    const { terminalCode, openingCashCents } = req.body as {
      terminalCode?: string;
      openingCashCents?: number;
    };

    if (!terminalCode?.trim()) {
      return res.status(400).json({ error: "terminalCode is required" });
    }

    const existing = await prisma.storeShift.findFirst({
      where: { status: ShiftStatus.OPEN },
      select: { id: true, openedAt: true },
    });

    if (existing) {
      return res.status(409).json({
        error: "A shift is already open",
        shiftId: existing.id,
        openedAt: existing.openedAt,
      });
    }

    const shift = await prisma.storeShift.create({
      data: {
        status: ShiftStatus.OPEN,
        businessDate: new Date(),
        terminalCode: terminalCode.trim(),
        openingCashCents: Number.isFinite(openingCashCents)
          ? Math.max(0, openingCashCents as number)
          : 0,
        openedById: req.user.id,
      },
      select: {
        id: true,
        status: true,
        businessDate: true,
        terminalCode: true,
        openingCashCents: true,
        openedAt: true,
        openedById: true,
      },
    });

    return res.json({
      message: "Shift opened successfully",
      shift,
    });
  } catch (error) {
    console.error("POST /shifts/open failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Close current open store shift
 * POST /shifts/close
 * Body: { shiftId?, closingCashCents? }
 */
router.post("/close", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
  try {
    const { shiftId, closingCashCents } = req.body as {
      shiftId?: string;
      closingCashCents?: number;
    };

    const shift = shiftId
      ? await prisma.storeShift.findFirst({
          where: { id: shiftId, status: ShiftStatus.OPEN },
        })
      : await prisma.storeShift.findFirst({
          where: { status: ShiftStatus.OPEN },
          orderBy: { openedAt: "desc" },
        });

    if (!shift) {
      return res.status(404).json({ error: "Open shift not found" });
    }

    const orders = await prisma.order.findMany({
      where: {
        storeShiftId: shift.id,
        status: OrderStatus.CLOSED,
        paymentStatus: PaymentStatus.PAID,
      },
      select: {
        subtotalCents: true,
        taxCents: true,
        tipCents: true,
        totalCents: true,
        discountCents: true,
        paymentMethod: true,
      },
    });

    const grossSalesCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const netSalesCents = orders.reduce(
      (sum, o) => sum + (o.subtotalCents - o.discountCents),
      0
    );
    const taxCents = orders.reduce((sum, o) => sum + o.taxCents, 0);
    const tipCents = orders.reduce((sum, o) => sum + o.tipCents, 0);
    const discountCents = orders.reduce((sum, o) => sum + o.discountCents, 0);

    const cashSalesCents = orders
      .filter((o) => o.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, o) => sum + o.totalCents, 0);

    const cardSalesCents = orders
      .filter((o) => o.paymentMethod === PaymentMethod.CARD)
      .reduce((sum, o) => sum + o.totalCents, 0);

    const orderCount = orders.length;

    const closedShift = await prisma.storeShift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        closedById: req.user.id,
        closingCashCents: Number.isFinite(closingCashCents)
          ? Math.max(0, closingCashCents as number)
          : 0,

        grossSalesCents,
        netSalesCents,
        taxCents,
        tipCents,
        discountCents,
        cashSalesCents,
        cardSalesCents,
        orderCount,
      },
    });

    return res.json({
      message: "Shift closed successfully",
      shift: closedShift,
    });
  } catch (error) {
    console.error("POST /shifts/close failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;