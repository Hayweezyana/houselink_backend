import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../config/db";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Add a Review
router.post("/", authMiddleware, async (req: Request, res: Response ): Promise<void> => {
  const { property_id, rating, comment } = req.body;
  if (!property_id || !rating || !comment) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db("reviews").insert({ id: uuidv4(), user_id: req.user.id, property_id, rating, comment });
    res.status(201).json({ message: "Review added" });
  } catch (error) {
    res.status(500).json({ error: "Failed to add review" });
  }
});

// Update a Review
router.put("/:review_id", authMiddleware, async (req: Request, res: Response ): Promise<void> => {
  const { rating, comment } = req.body;
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db("reviews")
      .where({ id: req.params.review_id, user_id: req.user.id })
      .update({ rating, comment, updated_at: db.fn.now() });

    res.json({ message: "Review updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update review" });
  }
});

// Delete a Review
router.delete("/:review_id", authMiddleware, async (req: Request, res: Response ): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db("reviews").where({ id: req.params.review_id, user_id: req.user.id }).del();
    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// Fetch Reviews for a Property
router.get("/:property_id", async (req, res) => {
  try {
    const reviews = await db("reviews")
      .join("users", "reviews.user_id", "users.id")
      .where("reviews.property_id", req.params.property_id)
      .select("reviews.*", "users.name as reviewer_name");

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

export default router;
