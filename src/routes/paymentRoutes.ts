import express from "express";
import {
  initializePayment,
  verifyPayment,
  confirmCheckin,
  ownerRequestRelease,
  raiseDispute,
  resolveDispute,
} from "../controllers/paymentController";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/initialize", authMiddleware, initializePayment);
router.get("/verify", authMiddleware, verifyPayment);
router.post("/:id/confirm-checkin", authMiddleware, confirmCheckin);
router.post("/:id/release", authMiddleware, ownerRequestRelease);
router.post("/:id/dispute", authMiddleware, raiseDispute);
router.post("/:id/dispute/resolve", authMiddleware, requireRole("admin"), resolveDispute);

export default router;
