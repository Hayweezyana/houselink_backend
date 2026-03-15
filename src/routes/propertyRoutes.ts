import express, { Request, Response, NextFunction } from "express";
import db from "../config/db";
import {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "../controllers/propertyController";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";
import upload from "../middleware/uploadMiddleware";

const router = express.Router();

/**
 * @openapi
 * /api/properties:
 *   get:
 *     tags: [Properties]
 *     summary: List properties with filtering and pagination
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Full-text search on title, description, location
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [Apartment, House, Studio, Duplex, Bungalow, Self-contain, Office] }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: rooms
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of properties
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedProperties' }
 */
router.get("/", (_req, res, next) => {
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  next();
}, getAllProperties);

/**
 * @openapi
 * /api/properties/owner/analytics:
 *   get:
 *     tags: [Properties]
 *     summary: Get analytics dashboard for the authenticated owner's properties
 *     responses:
 *       200:
 *         description: Array of properties with enriched analytics (views, wishlist, reviews, messages)
 *       401:
 *         description: Unauthorized
 */
router.get("/owner/analytics", authMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const owner_id = req.user?.id;
    if (!owner_id) { res.status(401).json({ message: "Unauthorized" }); return; }

    const properties = await db("properties")
      .where({ owner_id })
      .select(
        "id", "title", "price", "location", "views", "is_available", "verified", "created_at"
      );

    const ids = properties.map((p) => p.id);

    const [wishlistCounts, reviewStats, messageCounts] = await Promise.all([
      db("wishlists").whereIn("property_id", ids).groupBy("property_id")
        .select("property_id", db.raw("COUNT(*) as count")),
      db("reviews").whereIn("property_id", ids).groupBy("property_id")
        .select("property_id", db.raw("COUNT(*) as count"), db.raw("ROUND(AVG(rating), 1) as avg_rating")),
      db("messages").whereIn("property_id", ids).groupBy("property_id")
        .select("property_id", db.raw("COUNT(*) as count")),
    ]);

    const wishMap: Record<string, number> = {};
    wishlistCounts.forEach((w: any) => { wishMap[w.property_id] = Number(w.count); });

    const reviewMap: Record<string, { count: number; avg: number }> = {};
    reviewStats.forEach((r: any) => { reviewMap[r.property_id] = { count: Number(r.count), avg: Number(r.avg_rating) }; });

    const msgMap: Record<string, number> = {};
    messageCounts.forEach((m: any) => { msgMap[m.property_id] = Number(m.count); });

    const analytics = properties.map((p) => ({
      ...p,
      wishlist_count: wishMap[p.id] || 0,
      review_count: reviewMap[p.id]?.count || 0,
      avg_rating: reviewMap[p.id]?.avg || 0,
      message_count: msgMap[p.id] || 0,
    }));

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     tags: [Properties]
 *     summary: Get a single property by ID (increments view count)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Property details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Property' }
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  await db("properties").where({ id: req.params.id }).increment("views", 1).catch(() => {});
  return getPropertyById(req, res, next);
});

/**
 * @openapi
 * /api/properties:
 *   post:
 *     tags: [Properties]
 *     summary: Create a new property listing (owner only)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, price, location]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               location: { type: string }
 *               type: { type: string }
 *               rooms: { type: integer }
 *               amenities: { type: string, description: "JSON array string" }
 *               media:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Property created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Property' }
 */
router.post("/", authMiddleware, requireRole("owner"), upload.array("media", 10), createProperty);

/**
 * @openapi
 * /api/properties/{id}:
 *   put:
 *     tags: [Properties]
 *     summary: Update a property (owner only, field whitelist enforced)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               location: { type: string }
 *               type: { type: string }
 *               rooms: { type: integer }
 *     responses:
 *       200:
 *         description: Updated property
 *       403:
 *         description: Not the property owner
 *       404:
 *         description: Not found
 */
router.put("/:id", authMiddleware, requireRole("owner"), updateProperty);

/**
 * @openapi
 * /api/properties/{id}:
 *   delete:
 *     tags: [Properties]
 *     summary: Delete a property (owner only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Not the property owner
 *       404:
 *         description: Not found
 */
router.delete("/:id", authMiddleware, requireRole("owner"), deleteProperty);

export default router;
