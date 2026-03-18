import express from "express";
import {
  initializePayment,
  verifyPayment,
  confirmCheckin,
  ownerRequestRelease,
} from "../controllers/paymentController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/initialize", authMiddleware, initializePayment);
router.get("/verify", authMiddleware, verifyPayment);
router.post("/:id/confirm-checkin", authMiddleware, confirmCheckin);
router.post("/:id/release", authMiddleware, ownerRequestRelease);

export default router;
