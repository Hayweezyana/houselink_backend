import express from "express";
import { sendMessages, getMessages, getUnreadCount } from "../controllers/chatController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.get("/unread-count", authMiddleware, getUnreadCount);
router.post("/", authMiddleware, sendMessages);
router.get("/:property_id", authMiddleware, getMessages);

export default router;
