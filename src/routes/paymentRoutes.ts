import express from "express";
import { initializePayment, verifyPayment } from "../controllers/paymentController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/initialize", authMiddleware, initializePayment);
router.get("/verify", authMiddleware, verifyPayment);

export default router;
