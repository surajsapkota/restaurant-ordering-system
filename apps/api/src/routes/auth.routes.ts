// src/routes/auth.routes.ts
// This file holds auth routes (login / pin login later)

import { Router } from "express";
import { verifySecret, signToken } from "../utils/auth";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";


const router = Router();

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  // 1) Basic validation (make sure user sent email & password)
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // 2) Find the user by email
  const user = await prisma.user.findUnique({ where: { email } });

  // If user not found OR not active OR no password hash -> reject
  if (!user || !user.isActive || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // 3) Compare entered password with saved hash
  const ok = await verifySecret(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // 4) Create token
  const token = signToken({ userId: user.id, role: user.role });

  // 5) Send token + basic user info (no sensitive fields)
  return res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
  });
});
// POST /auth/pin
router.post("/pin", async (req, res) => {
    const { pin } = req.body as { pin?: string };
  
    if (!pin) {
      return res.status(400).json({ error: "pin is required" });
    }
  
    // get active users who have a pinHash
    const users = await prisma.user.findMany({
      where: { isActive: true, pinHash: { not: null } },
      select: { id: true, name: true, role: true, pinHash: true },
    });
  
    // compare provided pin with stored hash
    for (const u of users) {
      const ok = await verifySecret(pin, u.pinHash!);
      if (ok) {
        const token = signToken({ userId: u.id, role: u.role });
        return res.json({ token, user: { id: u.id, name: u.name, role: u.role } });
      }
    }
  
    return res.status(401).json({ error: "Invalid PIN" });
  });
  
// GET /auth/me
router.get("/me", requireAuth, async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  
    return res.json({ user });
  });
  
  router.post("/employee-login", async (req, res) => {
    try {
      const { employeeCode, pin } = req.body as {
        employeeCode?: string;
        pin?: string;
      };
  
      if (!employeeCode || !pin) {
        return res.status(400).json({
          error: "employeeCode and pin are required",
        });
      }
  
      const user = await prisma.user.findFirst({
        where: {
          employeeCode,
          isActive: true,
        },
      });
  
      if (!user || !user.pinHash) {
        return res.status(401).json({
          error: "Invalid employee code or PIN",
        });
      }
  
      const ok = await verifySecret(pin, user.pinHash);
  
      if (!ok) {
        return res.status(401).json({
          error: "Invalid employee code or PIN",
        });
      }
  
      const token = signToken({ userId: user.id, role: user.role });
  
      const activeShift = await prisma.storeShift.findFirst({
        where: { status: "OPEN" },
        orderBy: { openedAt: "desc" },
        select: {
          id: true,
          status: true,
          businessDate: true,
          terminalCode: true,
          openedAt: true,
          openedById: true,
        },
      });
  
      const employeeSession = await prisma.employeeSession.create({
        data: {
          employeeId: user.id,
          storeShiftId: activeShift?.id ?? null,
        },
        select: {
          id: true,
          loginAt: true,
          storeShiftId: true,
        },
      });
  
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          employeeCode: user.employeeCode,
        },
        employeeSession,
        activeShift,
      });
    } catch (error) {
      console.error("POST /auth/employee-login failed:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

// POST /auth/logout
router.post("/logout", requireAuth, async (req: any, res) => {
  try {
    // Find the latest open session for this employee
    const session = await prisma.employeeSession.findFirst({
      where: {
        employeeId: req.user.id,
        logoutAt: null, // still open
      },
      orderBy: { loginAt: "desc" },
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    const logoutAt = new Date();
    const workedMinutes = Math.round(
      (logoutAt.getTime() - session.loginAt.getTime()) / 1000 / 60
    );

    const updated = await prisma.employeeSession.update({
      where: { id: session.id },
      data: { logoutAt, breakMinutes: 0 },
      select: {
        id: true,
        loginAt: true,
        logoutAt: true,
        breakMinutes: true,
        storeShiftId: true,
      },
    });

    return res.json({
      message: "Logged out successfully",
      session: {
        ...updated,
        workedMinutes,
      },
    });
  } catch (error) {
    console.error("POST /auth/logout failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
export default router;
