// Router helps us keep routes in separate files (clean structure)
import { Router, Request, Response } from "express";

// Import the shared Prisma client (DB connection)
import prisma from "../db/prisma";

// Create a new router for menu endpoints
const router = Router();

/**
 * GET /menu
 * Meaning: "Give me the full menu"
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Ask the database for all ACTIVE categories
    // Sort categories by sortOrder (0,1,2...)
    // Also include ACTIVE items inside each category
    const categories = await prisma.menuCategory.findMany({
      where: { isActive: true }, // only categories that are active
      orderBy: { sortOrder: "asc" }, // Featured first if sortOrder is 0
      include: {
        items: {
          where: { isActive: true }, // only active menu items
          orderBy: { name: "asc" }, // optional: sort items A-Z
        },
      },
    });

    // Send the menu back as JSON
    return res.status(200).json({ categories });
  } catch (error) {
    // If anything fails (DB issue, connection issue, etc.)
    console.error("❌ GET /menu failed:", error);

    // Send a safe error message to the client
    return res.status(500).json({ error: "Failed to load menu" });
  }
});

// Export router so app.ts can use it
export default router;
