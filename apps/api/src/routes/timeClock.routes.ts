import { Router } from "express";
import { ShiftStatus } from "@prisma/client";
import prisma from "../db/prisma";
import { verifySecret } from "../utils/auth";

const router = Router();

router.post("/punch", async (req, res) => {
  try {
    const { employeeCode, pin } = req.body as {
      employeeCode?: string;
      pin?: string;
    };

    if (!employeeCode?.trim() || !pin?.trim()) {
      return res.status(400).json({ error: "Employee ID and code are required" });
    }

    const employee = await prisma.user.findFirst({
      where: {
        employeeCode: employeeCode.trim(),
        role: { in: ["EMPLOYEE", "MANAGER"] },
        isActive: true,
      },
    });

    if (!employee?.pinHash || !(await verifySecret(pin.trim(), employee.pinHash))) {
      return res.status(401).json({ error: "Invalid employee ID or code" });
    }

    const activeSession = await prisma.employeeSession.findFirst({
      where: {
        employeeId: employee.id,
        logoutAt: null,
      },
      orderBy: { loginAt: "desc" },
    });

    if (activeSession) {
      const logoutAt = new Date();
      const workedMinutes = Math.max(
        0,
        Math.round((logoutAt.getTime() - activeSession.loginAt.getTime()) / 1000 / 60) -
          activeSession.breakMinutes
      );
      const session = await prisma.employeeSession.update({
        where: { id: activeSession.id },
        data: { logoutAt },
        select: {
          id: true,
          loginAt: true,
          logoutAt: true,
          breakMinutes: true,
        },
      });

      return res.json({
        action: "CLOCK_OUT",
        message: `${employee.name} clocked out successfully.`,
        employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode },
        session: { ...session, workedMinutes },
      });
    }

    const activeShift = await prisma.storeShift.findFirst({
      where: { status: ShiftStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });

    const session = await prisma.employeeSession.create({
      data: {
        employeeId: employee.id,
        storeShiftId: activeShift?.id ?? null,
      },
      select: {
        id: true,
        loginAt: true,
        logoutAt: true,
        breakMinutes: true,
      },
    });

    return res.json({
      action: "CLOCK_IN",
      message: `${employee.name} clocked in successfully.`,
      employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode },
      session,
    });
  } catch (error) {
    console.error("POST /time-clock/punch failed:", error);
    return res.status(500).json({ error: "Failed to record time clock punch" });
  }
});

export default router;
