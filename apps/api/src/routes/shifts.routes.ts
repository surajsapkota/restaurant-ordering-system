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

function requireAdmin(req: any, res: Response, next: any) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admin can manage time records" });
  }

  next();
}

function parseDateStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
 * Get orders and payment details for the currently open shift.
 * GET /shifts/current/transactions
 */
router.get("/current/transactions", requireAuth, requireManagerOrAdmin, async (_req: any, res) => {
  try {
    const shift = await prisma.storeShift.findFirst({
      where: { status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });

    if (!shift) {
      return res.json({ shiftId: null, orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: { storeShiftId: shift.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
          },
        },
      },
    });

    return res.json({ shiftId: shift.id, orders });
  } catch (error) {
    console.error("GET /shifts/current/transactions failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Clock out an active employee session from manager controls.
 * POST /shifts/sessions/:sessionId/clock-out
 */
router.post("/sessions/:sessionId/clock-out", requireAuth, requireManagerOrAdmin, async (req: any, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const session = await prisma.employeeSession.findUnique({
      where: { id: sessionId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Employee session not found" });
    }

    if (session.logoutAt) {
      return res.status(400).json({ error: "Employee is already clocked out" });
    }

    const logoutAt = new Date();
    const workedMinutes = Math.max(
      0,
      Math.round((logoutAt.getTime() - session.loginAt.getTime()) / 1000 / 60)
    );

    const updated = await prisma.employeeSession.update({
      where: { id: sessionId },
      data: { logoutAt },
      select: {
        id: true,
        loginAt: true,
        logoutAt: true,
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
          },
        },
      },
    });

    return res.json({
      message: "Employee clocked out successfully",
      session: { ...updated, workedMinutes },
    });
  } catch (error) {
    console.error("POST /shifts/sessions/:sessionId/clock-out failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get employee attendance records for admin review.
 * GET /shifts/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/sessions", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const fromDate = parseDateStart(String(req.query.from ?? ""));
    const toDate = parseDateStart(String(req.query.to ?? ""));

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "from and to are required in YYYY-MM-DD format" });
    }

    const endDateExclusive = addDays(toDate, 1);
    if (fromDate >= endDateExclusive) {
      return res.status(400).json({ error: "from date cannot be after to date" });
    }

    const sessions = await prisma.employeeSession.findMany({
      where: {
        OR: [
          {
            loginAt: {
              gte: fromDate,
              lt: endDateExclusive,
            },
          },
          { logoutAt: null },
        ],
      },
      orderBy: { loginAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            role: true,
          },
        },
        storeShift: {
          select: {
            id: true,
            terminalCode: true,
            status: true,
          },
        },
      },
    });

    const items = sessions.map((session) => {
      const endTime = session.logoutAt?.getTime() ?? Date.now();
      const workedMinutes = Math.max(
        0,
        Math.round((endTime - session.loginAt.getTime()) / 1000 / 60) - session.breakMinutes
      );

      return { ...session, workedMinutes };
    });

    return res.json({
      items,
      activeCount: items.filter((session) => !session.logoutAt).length,
      totalWorkedMinutes: items
        .filter((session) => session.logoutAt)
        .reduce((sum, session) => sum + session.workedMinutes, 0),
    });
  } catch (error) {
    console.error("GET /shifts/sessions failed:", error);
    return res.status(500).json({ error: "Failed to load employee time records" });
  }
});

/**
 * Correct an attendance record.
 * PATCH /shifts/sessions/:sessionId
 */
router.patch("/sessions/:sessionId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const existing = await prisma.employeeSession.findUnique({ where: { id: sessionId } });
    if (!existing) {
      return res.status(404).json({ error: "Time record not found" });
    }

    const { loginAt, logoutAt, breakMinutes, notes } = req.body as {
      loginAt?: string;
      logoutAt?: string | null;
      breakMinutes?: number;
      notes?: string;
    };

    const correctedLoginAt = loginAt ? new Date(loginAt) : existing.loginAt;
    const correctedLogoutAt =
      logoutAt === null ? null : logoutAt ? new Date(logoutAt) : existing.logoutAt;

    if (Number.isNaN(correctedLoginAt.getTime()) || (correctedLogoutAt && Number.isNaN(correctedLogoutAt.getTime()))) {
      return res.status(400).json({ error: "Invalid date/time value" });
    }

    if (correctedLogoutAt && correctedLogoutAt < correctedLoginAt) {
      return res.status(400).json({ error: "Clock out must be after clock in" });
    }

    if (breakMinutes !== undefined && (!Number.isInteger(breakMinutes) || breakMinutes < 0)) {
      return res.status(400).json({ error: "Break minutes must be zero or greater" });
    }

    const session = await prisma.employeeSession.update({
      where: { id: sessionId },
      data: {
        loginAt: correctedLoginAt,
        logoutAt: correctedLogoutAt,
        ...(breakMinutes !== undefined ? { breakMinutes } : {}),
        ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            role: true,
          },
        },
      },
    });

    return res.json({ item: session });
  } catch (error) {
    console.error("PATCH /shifts/sessions/:sessionId failed:", error);
    return res.status(500).json({ error: "Failed to update employee time record" });
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

    const closedAt = new Date();
    const [closedShift, autoClockOut] = await prisma.$transaction([
      prisma.storeShift.update({
        where: { id: shift.id },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt,
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
      }),
      prisma.employeeSession.updateMany({
        where: { logoutAt: null },
        data: { logoutAt: closedAt },
      }),
    ]);

    return res.json({
      message: "Day closed successfully",
      shift: closedShift,
      autoClockedOutCount: autoClockOut.count,
      autoClockedOutAt: closedAt,
    });
  } catch (error) {
    console.error("POST /shifts/close failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
