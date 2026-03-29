// apps/api/src/routes/employees.routes.ts
import { Router, Response } from "express";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { hashSecret, verifySecret } from "../utils/auth";

const router = Router();

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "CUSTOMER";

function isValid4DigitPin(pin: string) {
  return /^[0-9]{4}$/.test(pin);
}

function requireManagerOrAdmin(req: any, res: Response, next: any) {
  const role: Role | undefined = req.user?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

async function isPinAlreadyUsed(pin: string, exceptUserId?: string) {
  const users = await prisma.user.findMany({
    where: {
      pinHash: { not: null },
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true, pinHash: true },
  });

  for (const u of users) {
    if (!u.pinHash) continue;
    const ok = await verifySecret(pin, u.pinHash);
    if (ok) return true;
  }
  return false;
}

async function generateNextEmployeeCode() {
  const users = await prisma.user.findMany({
    where: {
      employeeCode: { not: null },
    },
    select: {
      employeeCode: true,
    },
  });

  let maxCode = 2000;

  for (const user of users) {
    const code = Number(user.employeeCode);
    if (Number.isFinite(code) && code > maxCode) {
      maxCode = code;
    }
  }

  return String(maxCode + 1);
}
/**
 * GET /employees
 * List staff (EMPLOYEE + MANAGER)
 */
router.get("/", requireAuth, requireManagerOrAdmin, async (_req: any, res: Response) => {
  const items = await prisma.user.findMany({
    where: { role: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      phone: true,
      employeeCode:true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({ items });
});

/**
 * POST /employees
 * Create staff with unique 4-digit PIN
 * body: { name, role: "EMPLOYEE"|"MANAGER", pin, phone? }
 */
router.post("/", requireAuth, requireManagerOrAdmin, async (req: any, res: Response) => {
  const actorRole: Role = req.user.role;

  const { name, role, pin, phone } = req.body as {
    name?: string;
    role?: "EMPLOYEE" | "MANAGER";
    pin?: string;
    phone?: string;
  };

  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  if (role !== "EMPLOYEE" && role !== "MANAGER") {
    return res.status(400).json({ error: "Role must be EMPLOYEE or MANAGER" });
  }
  if (!pin || !isValid4DigitPin(pin)) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits" });
  }

  // Managers cannot create MANAGER accounts (only ADMIN can)
  if (actorRole === "MANAGER" && role === "MANAGER") {
    return res.status(403).json({ error: "Only ADMIN can create managers" });
  }

  if (await isPinAlreadyUsed(pin)) {
    return res.status(409).json({ error: "PIN already in use. Choose another." });
  }

  const pinHash = await hashSecret(pin);

  const employeeCode = await generateNextEmployeeCode();
  
  const created = await prisma.user.create({
    data: {
      name: name.trim(),
      role,
      pinHash,
      phone: phone?.trim() || null,
      isActive: true,
      employeeCode, 
    },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      phone: true,
      employeeCode: true,
      createdAt: true,
    },
  });

  return res.status(201).json({ item: created });
});

/**
 * PATCH /employees/:id
 * body can include: { name?, isActive?, phone?, pin?, role? }
 * - Managers can only edit EMPLOYEE accounts
 * - Only ADMIN can change role or delete
 */
router.patch("/:id", requireAuth, requireManagerOrAdmin, async (req: any, res: Response) => {
  const actorRole: Role = req.user.role;
  const { id } = req.params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (actorRole === "MANAGER" && target.role !== "EMPLOYEE") {
    return res.status(403).json({ error: "Managers can only edit employees" });
  }

  const { name, isActive, phone, pin, role } = req.body as {
    name?: string;
    isActive?: boolean;
    phone?: string;
    pin?: string;
    role?: "EMPLOYEE" | "MANAGER";
  };

  const data: any = {};

  if (typeof isActive === "boolean") data.isActive = isActive;
  if (typeof phone === "string") data.phone = phone.trim() || null;
  if (name?.trim()) data.name = name.trim();

  // Role change (ADMIN only)
  if (role !== undefined) {
    if (actorRole !== "ADMIN") {
      return res.status(403).json({ error: "Only ADMIN can change roles" });
    }
    if (role !== "EMPLOYEE" && role !== "MANAGER") {
      return res.status(400).json({ error: "Role must be EMPLOYEE or MANAGER" });
    }
    data.role = role;
  }

  // PIN reset
  if (pin !== undefined) {
    if (!isValid4DigitPin(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    }
    if (await isPinAlreadyUsed(pin, id)) {
      return res.status(409).json({ error: "PIN already in use. Choose another." });
    }
    data.pinHash = await hashSecret(pin);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, role: true, isActive: true, updatedAt: true },
  });

  return res.json({ item: updated });
});

/**
 * DELETE /employees/:id
 * ADMIN only
 */
router.delete("/:id", requireAuth, requireManagerOrAdmin, async (req: any, res: Response) => {
  const actorRole: Role = req.user.role;
  if (actorRole !== "ADMIN") {
    return res.status(403).json({ error: "Only ADMIN can delete employees" });
  }

  const { id } = req.params;
  await prisma.user.delete({ where: { id } });

  return res.json({ ok: true });
});

export default router;
