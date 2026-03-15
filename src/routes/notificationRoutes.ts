import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  getNotifications,
  markAllRead,
  markOneRead,
} from "../controllers/notificationController";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.put("/read-all", authMiddleware, markAllRead);
router.put("/:id/read", authMiddleware, markOneRead);

export default router;
