import express from "express";
import { sendMessages, getMessages, getUnreadCount, getConversations } from "../controllers/chatController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.get("/unread-count", authMiddleware, getUnreadCount);
router.get("/conversations", authMiddleware, getConversations);
router.post("/", authMiddleware, sendMessages);
router.get("/:property_id", authMiddleware, getMessages);

export default router;
