import express, { Request, Response } from "express";
import db from "../config/db";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Add to Wishlist
router.post("/", authMiddleware, async (req: Request, res: Response ): Promise<void> => {
  const { property_id } = req.body;
  if (!property_id) {
    res.status(400).json({ error: "Property ID is required" });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db("wishlists").insert({ user_id: req.user.id, property_id });
    res.status(201).json({ message: "Property added to wishlist" });
  } catch (error) {
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

// Remove from Wishlist
router.delete("/:property_id", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db("wishlists")
      .where({ user_id: req.user.id, property_id: req.params.property_id })
      .del();
    res.json({ message: "Property removed from wishlist" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

// Get Wishlist
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const wishlist = await db("wishlists")
      .join("properties", "wishlists.property_id", "properties.id")
      .where("wishlists.user_id", req.user.id)
      .select("properties.*");

    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

export default router;
