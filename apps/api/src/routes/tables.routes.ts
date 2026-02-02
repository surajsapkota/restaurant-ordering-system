import { Router, Response } from "express";
import prisma from "../db/prisma";
import { OrderStatus, OrderType, PaymentStatus } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { io } from "../server";


const router = Router();

// lock expiry (seconds) — you can change later
const LOCK_TTL_SECONDS = 120;

function nowPlusSeconds(sec: number) {
  return new Date(Date.now() + sec * 1000);
}

/**
 * GET /tables/status?count=30
 * Returns status for tables 1..count (available / occupied / needs_payment / locked)
 */
router.get("/status", requireAuth, async (req: any, res: Response) => {
  try {
    const count = Math.max(1, Math.min(Number(req.query.count ?? 30), 300));

    // Cleanup expired locks
    await prisma.tableLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Active dine-in orders (not closed/cancelled)
    const activeOrders = await prisma.order.findMany({
      where: {
        type: OrderType.DINE_IN,
        tableNumber: { not: null },
        status: { in: [OrderStatus.NEW, OrderStatus.IN_KITCHEN, OrderStatus.READY] },
      },
      select: {
        id: true,
        tableNumber: true,
        status: true,
        paymentStatus: true,
      },
    });

    // Locks (not expired)
    const locks = await prisma.tableLock.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: {
        tableNumber: true,
        lockedById: true,
        expiresAt: true,
        lockedBy: { select: { name: true } },
      },
    });

    // Build maps
    const orderByTable = new Map<number, typeof activeOrders[number]>();
    for (const o of activeOrders) {
      const t = Number(o.tableNumber);
      if (!Number.isFinite(t)) continue;

      // if multiple, prefer needs_payment
      const existing = orderByTable.get(t);
      if (!existing) orderByTable.set(t, o);
      else {
        const existingNeedsPay =
          existing.status === "READY" && existing.paymentStatus === PaymentStatus.UNPAID;
        const currentNeedsPay =
          o.status === "READY" && o.paymentStatus === PaymentStatus.UNPAID;

        if (!existingNeedsPay && currentNeedsPay) orderByTable.set(t, o);
      }
    }

    const lockByTable = new Map<number, typeof locks[number]>();
    for (const l of locks) lockByTable.set(l.tableNumber, l);

    const tables = Array.from({ length: count }, (_, i) => i + 1).map((tableNo) => {
      const lock = lockByTable.get(tableNo);
      if (lock) {
        return {
          tableNumber: tableNo,
          status: "locked" as const,
          lockedById: lock.lockedById,
          lockedByName: lock.lockedBy?.name ?? null,
          lockedByMe: lock.lockedById === req.user.id,
          lockExpiresAt: lock.expiresAt,
        };
      }

      const order = orderByTable.get(tableNo);
      if (!order) return { tableNumber: tableNo, status: "available" as const };

      const needsPayment = order.status === "READY" && order.paymentStatus === "UNPAID";
      if (needsPayment) {
        return { tableNumber: tableNo, status: "needs_payment" as const, orderId: order.id };
      }

      return { tableNumber: tableNo, status: "occupied" as const, orderId: order.id };
    });

    return res.status(200).json({ count, tables });
  } catch (e) {
    console.error("GET /tables/status failed:", e);
    return res.status(500).json({ error: "Failed to load table statuses" });
  }
});

/**
 * POST /tables/:tableNumber/lock
 * Locks table for this user (prevents other employees)
 */
router.post("/:tableNumber/lock", requireAuth, async (req: any, res: Response) => {
  try {
    const tableNumber = Number(req.params.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ error: "Invalid tableNumber" });
    }

    // cleanup expired locks
    await prisma.tableLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const existing = await prisma.tableLock.findUnique({
      where: { tableNumber },
      select: { lockedById: true, expiresAt: true },
    });

    if (existing && existing.expiresAt > new Date() && existing.lockedById !== req.user.id) {
      return res.status(409).json({ error: "Table is locked by another employee" });
    }

    const lock = await prisma.tableLock.upsert({
      where: { tableNumber },
      create: {
        tableNumber,
        lockedById: req.user.id,
        expiresAt: nowPlusSeconds(LOCK_TTL_SECONDS),
      },
      update: {
        lockedById: req.user.id,
        expiresAt: nowPlusSeconds(LOCK_TTL_SECONDS),
      },
      select: { tableNumber: true, lockedById: true, expiresAt: true },
    });
    io.emit("tables:changed");

    return res.status(200).json({ lock });
  } catch (e) {
    console.error("POST /tables/:tableNumber/lock failed:", e);
    return res.status(500).json({ error: "Failed to lock table" });
  }
});

/**
 * DELETE /tables/:tableNumber/lock
 * Unlock table (only same user OR admin)
 */
router.delete("/:tableNumber/lock", requireAuth, async (req: any, res: Response) => {
  try {
    const tableNumber = Number(req.params.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ error: "Invalid tableNumber" });
    }

    const existing = await prisma.tableLock.findUnique({
      where: { tableNumber },
      select: { lockedById: true },
    });

    if (!existing) return res.status(204).send();

    const isAdmin = req.user?.role === "ADMIN";
    const isOwner = existing.lockedById === req.user.id;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not allowed to unlock this table" });
    }

    await prisma.tableLock.delete({ where: { tableNumber } });
    io.emit("tables:changed");

    return res.status(204).send();
  } catch (e) {
    console.error("DELETE /tables/:tableNumber/lock failed:", e);
    return res.status(500).json({ error: "Failed to unlock table" });
  }
});


export default router;
