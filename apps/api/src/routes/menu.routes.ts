import { Router, Request, Response } from "express";
import prisma from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

function requireManagerOrAdmin(req: any, res: Response, next: () => void) {
  if (req.user?.role !== "MANAGER" && req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Manager access is required" });
  }
  next();
}

/**
 * GET /menu
 * Meaning: "Give me the full menu"
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const scope = String(req.query.scope ?? "active");
    const showAll = scope === "all";

    const categories = await prisma.menuCategory.findMany({
      where: showAll ? {} : { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: showAll ? {} : { isActive: true },
          orderBy: { name: "asc" },
          include: {
            modifierOptions: {
              where: showAll ? {} : { isActive: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    return res.status(200).json({ categories });
  } catch (error) {
    console.error("❌ GET /menu failed:", error);
    return res.status(500).json({ error: "Failed to load menu" });
  }
});

router.post("/:itemId/modifiers", requireAuth, requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const itemId = String(req.params.itemId);
    const { name, priceDeltaCents, isActive = true } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) return res.status(400).json({ error: "Modifier name is required" });
    if (!Number.isInteger(priceDeltaCents) || priceDeltaCents < 0) {
      return res.status(400).json({ error: "Modifier price must be zero or greater" });
    }

    const modifier = await prisma.menuModifierOption.create({
      data: { menuItemId: itemId, name: trimmedName, priceDeltaCents, isActive: Boolean(isActive) },
    });
    return res.status(201).json({ modifier });
  } catch (error) {
    console.error("POST /menu/:itemId/modifiers failed:", error);
    return res.status(500).json({ error: "Failed to create modifier" });
  }
});

router.patch("/modifiers/:id", requireAuth, requireManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { name, priceDeltaCents, isActive } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) return res.status(400).json({ error: "Modifier name is required" });
    if (!Number.isInteger(priceDeltaCents) || priceDeltaCents < 0 || typeof isActive !== "boolean") {
      return res.status(400).json({ error: "Valid modifier price and status are required" });
    }

    const modifier = await prisma.menuModifierOption.update({
      where: { id: String(req.params.id) },
      data: { name: trimmedName, priceDeltaCents, isActive },
    });
    return res.json({ modifier });
  } catch (error) {
    console.error("PATCH /menu/modifiers/:id failed:", error);
    return res.status(500).json({ error: "Failed to update modifier" });
  }
});
/**
 * POST /menu/categories
 * Meaning: "Create one new menu category"
 */
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const { name, sortOrder, isActive } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return res.status(400).json({ error: "Category name cannot be empty" });
    }

    if (typeof sortOrder !== "number" || Number.isNaN(sortOrder)) {
      return res.status(400).json({ error: "Valid sortOrder is required" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be true or false" });
    }

    const existingCategory = await prisma.menuCategory.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existingCategory) {
      return res.status(409).json({ error: "Category already exists" });
    }

    const createdCategory = await prisma.menuCategory.create({
      data: {
        name: trimmedName,
        slug: trimmedName.toLowerCase().replace(/\s+/g, "-"),
        sortOrder,
        isActive,
      },
    });

    return res.status(201).json({
      message: "Menu category created successfully",
      category: createdCategory,
    });
  } catch (error) {
    console.error("❌ POST /menu/categories failed:", error);
    return res.status(500).json({ error: "Failed to create menu category" });
  }
});
/**
 * PATCH /menu/categories/:id
 * Meaning: "Update one menu category"
 */
router.patch("/categories/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, sortOrder, isActive } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return res.status(400).json({ error: "Category name cannot be empty" });
    }

    if (typeof sortOrder !== "number" || Number.isNaN(sortOrder)) {
      return res.status(400).json({ error: "Valid sortOrder is required" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be true or false" });
    }

    const existingCategory = await prisma.menuCategory.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existingCategory) {
      return res.status(409).json({ error: "Another category with this name already exists" });
    }

    const updatedCategory = await prisma.menuCategory.update({
      where: { id },
      data: {
        name: trimmedName,
        slug: trimmedName.toLowerCase().replace(/\s+/g, "-"),
        sortOrder,
        isActive,
      },
    });

    return res.status(200).json({
      message: "Menu category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("❌ PATCH /menu/categories/:id failed:", error);
    return res.status(500).json({ error: "Failed to update menu category" });
  }
});
/**
 * PATCH /menu/:id
 * Meaning: "Update one menu item"
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const {
      name,
      description,
      priceCents,
      taxable,
      isActive,
      categoryId,
      imageUrl,
      imageAlt,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }

    if (typeof priceCents !== "number" || Number.isNaN(priceCents)) {
      return res.status(400).json({ error: "Valid priceCents is required" });
    }

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "categoryId is required" });
    }

    if (typeof taxable !== "boolean") {
      return res.status(400).json({ error: "taxable must be true or false" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be true or false" });
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        priceCents,
        taxable,
        isActive,
        categoryId,
        imageUrl: imageUrl?.trim() || null,
        imageAlt: imageAlt?.trim() || null,
      },
      include: {
        category: true,
      },
    });

    return res.status(200).json({
      message: "Menu item updated successfully",
      item: updatedItem,
    });
  } catch (error) {
    console.error("❌ PATCH /menu/:id failed:", error);
    return res.status(500).json({ error: "Failed to update menu item" });
  }
});

/**
 * POST /menu
 * Meaning: "Create one new menu item"
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      priceCents,
      taxable,
      isActive,
      categoryId,
      imageUrl,
      imageAlt,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }

    if (typeof priceCents !== "number" || Number.isNaN(priceCents)) {
      return res.status(400).json({ error: "Valid priceCents is required" });
    }

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "categoryId is required" });
    }

    if (typeof taxable !== "boolean") {
      return res.status(400).json({ error: "taxable must be true or false" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be true or false" });
    }

    const createdItem = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
        description: description?.trim() || null,
        priceCents,
        taxable,
        isActive,
        categoryId,
        imageUrl: imageUrl?.trim() || null,
        imageAlt: imageAlt?.trim() || null,
      },
      include: {
        category: true,
      },
    });

    return res.status(201).json({
      message: "Menu item created successfully",
      item: createdItem,
    });
  } catch (error) {
    console.error("❌ POST /menu failed:", error);
    return res.status(500).json({ error: "Failed to create menu item" });
  }
});

export default router;
