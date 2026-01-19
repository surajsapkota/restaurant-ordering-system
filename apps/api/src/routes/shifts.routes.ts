import { Router } from "express";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// ✅ Open a shift on a tablet
// POST /shifts/open
// Body: { terminalCode, openingCashCents? }
router.post("/open", requireAuth, async (req: any, res) => {
  const { terminalCode, openingCashCents } = req.body as {
    terminalCode?: string;
    openingCashCents?: number;
  };

  if (!terminalCode) {
    return res.status(400).json({ error: "terminalCode is required" });
  }

  // Create a new shift for this employee
  const shift = await prisma.shift.create({
    data: {
      userId: req.user.id,          // who opened shift
      terminalCode,                 // which tablet/register
      openingCashCents: openingCashCents ?? 0,
      status: "OPEN",
    },
    select: {
      id: true,
      status: true,
      terminalCode: true,
      openingCashCents: true,
      openedAt: true,
      userId: true,
    },
  });

  return res.json({ shift });
});

// ✅ Close a shift
// POST /shifts/close
router.post("/close", requireAuth, async (req: any, res) => {
  const { shiftId, closingCashCents } = req.body as {
    shiftId?: string;
    closingCashCents?: number;
  };

  if (!shiftId) {
    return res.status(400).json({ error: "shiftId is required" });
  }

  // Find open shift
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      status: "OPEN",
    },
  });

  if (!shift) {
    return res.status(404).json({ error: "Open shift not found" });
  }

  // 🔢 Calculate totals from orders during this shift
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: shift.openedAt,
      },
    },
  });

  const totalSalesCents = orders.reduce(
    (sum, o) => sum + o.totalCents,
    0
  );

  const closedShift = await prisma.shift.update({
  where: { id: shiftId },
  data: {
    status: "CLOSED",
    closedAt: new Date(),
    closingCashCents: closingCashCents ?? 0,

    grossSalesCents: totalSalesCents,
    netSalesCents: totalSalesCents,
    orderCount: orders.length,
  },
});


  return res.json({
    message: "Shift closed successfully",
    shift: closedShift,
  });
});

export default router;
