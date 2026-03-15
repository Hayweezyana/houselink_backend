import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  getAvailability,
  setAvailability,
  deleteAvailability,
} from "../controllers/availabilityController";

const router = express.Router({ mergeParams: true });

router.get("/", getAvailability);
router.post("/", authMiddleware, setAvailability);
router.delete("/:id", authMiddleware, deleteAvailability);

export default router;
