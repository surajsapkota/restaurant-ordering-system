// src/middleware/requireAuth.ts
// This middleware protects routes.
// If user is not logged in (no token), it blocks the request.

import jwt from "jsonwebtoken";
import prisma from "../db/prisma";
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function requireAuth(req: any, res: any, next: any) {
  try {
    // 1) Get token from request header: "Authorization: Bearer <token>"
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    // If token missing -> not logged in
    if (!token) {
      return res.status(401).json({ error: "Missing token. Please login." });
    }

    // 2) Verify token (checks if token is valid and not expired)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    // 3) Confirm user still exists + active in DB
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not active. Access denied." });
    }

    // 4) Attach user info to request so routes can use it
    req.user = { id: user.id, role: user.role };

    // 5) Continue to the next middleware/route
    next();
  } catch (err) {
    // If token is invalid or expired
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
