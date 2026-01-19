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
  

export default router;
