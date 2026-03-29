// apps/api/src/routes/tables.routes.ts

import { Router, Response } from "express";
import prisma from "../db/prisma";
import { OrderStatus, OrderType, PaymentStatus } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { io } from "../server";

const router = Router();

// How long a table lock should live (seconds)
// We refresh it while employee is on the table screen
const LOCK_TTL_SECONDS = 120;

function nowPlusSeconds(sec: number) {
  return new Date(Date.now() + sec * 1000);
}

/**
 * GET /tables/status?count=60
 * Returns status for table 1..count:
 *  - available
 *  - occupied (has an open dine-in order)
 *  - needs_payment (READY + UNPAID)
 *  - locked (another employee is working on it)
 */
router.get("/status", requireAuth, async (req: any, res: Response) => {
  try {
    const count = Math.max(1, Math.min(Number(req.query.count ?? 30), 300));

    // 1) Clean up expired locks so UI doesn’t get stuck
    await prisma.tableLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // 2) Get all active dine-in orders (NOT closed/cancelled)
    // IMPORTANT:
    // DO NOT filter paymentStatus here.
    // If you filter UNPAID only, some “active” tables disappear and UI becomes inconsistent.
    const activeOrders = await prisma.order.findMany({
      where: {
        type: OrderType.DINE_IN,
        tableNumber: { not: null },
        status: { in: [OrderStatus.NEW, OrderStatus.IN_KITCHEN, OrderStatus.READY] },
      },
      // newest first so we can pick the most recent order per table
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tableNumber: true,
        status: true,
        paymentStatus: true,
      },
    });

    // 3) Get current locks (not expired)
    const locks = await prisma.tableLock.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: {
        tableNumber: true,
        lockedById: true,
        expiresAt: true,
        lockedBy: { select: { name: true } },
      },
    });

    // 4) Map latest order per table
    // Since activeOrders is newest -> oldest, the first one we see for a table is “the current one”
    const orderByTable = new Map<number, typeof activeOrders[number]>();
    for (const o of activeOrders) {
      const t = Number(o.tableNumber);
      if (!Number.isFinite(t)) continue;

      if (!orderByTable.has(t)) orderByTable.set(t, o);
    }

    // 5) Map lock per table
    const lockByTable = new Map<number, typeof locks[number]>();
    for (const l of locks) lockByTable.set(l.tableNumber, l);

    // 6) Build response for 1..count
    const tables = Array.from({ length: count }, (_, i) => i + 1).map((tableNo) => {
      const lock = lockByTable.get(tableNo);
      const order = orderByTable.get(tableNo);
    
      // ✅ LOCKED (highest priority)
      if (lock) {
        return {
          tableNumber: tableNo,
          status: "locked" as const,
          orderId: order?.id ?? null, // ✅ IMPORTANT
          lockedById: lock.lockedById,
          lockedByName: lock.lockedBy?.name ?? null,
          lockedByMe: lock.lockedById === req.user.id,
          lockExpiresAt: lock.expiresAt,
        };
      }
    
      // ✅ NO ORDER = available
      if (!order) {
        return { tableNumber: tableNo, status: "available" as const };
      }
    
      // ✅ NEEDS PAYMENT
      const needsPayment =
        order.status === OrderStatus.READY &&
        order.paymentStatus === PaymentStatus.UNPAID;
    
      if (needsPayment) {
        return {
          tableNumber: tableNo,
          status: "needs_payment" as const,
          orderId: order.id,
        };
      }
    
      // ✅ OCCUPIED
      return {
        tableNumber: tableNo,
        status: "occupied" as const,
        orderId: order.id,
      };
    });

    return res.status(200).json({ count, tables });
  } catch (e) {
    console.error("GET /tables/status failed:", e);
    return res.status(500).json({ error: "Failed to load table statuses" });
  }
});

/**
 * POST /tables/:tableNumber/lock
 * Locks a table for the current user.
 * If someone else has it locked, returns 409.
 */
router.post("/:tableNumber/lock", requireAuth, async (req: any, res: Response) => {
  try {
    const tableNumber = Number(req.params.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ error: "Invalid tableNumber" });
    }

    // Clean expired locks first
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

    // Upsert = create if not exists, otherwise refresh it
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

    // Tell all tablets “tables changed” so UI refreshes immediately
    io.emit("tables:changed");

    return res.status(200).json({ lock });
  } catch (e) {
    console.error("POST /tables/:tableNumber/lock failed:", e);
    return res.status(500).json({ error: "Failed to lock table" });
  }
});

/**
 * DELETE /tables/:tableNumber/lock
 * Unlock table.
 * Allowed: same user who locked OR ADMIN.
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
