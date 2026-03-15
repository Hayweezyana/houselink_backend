import express from "express";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";
import {
  listBanks,
  resolveAccount,
  saveBankAccount,
  getBankAccount,
  deleteBankAccount,
  getPayoutHistory,
} from "../controllers/payoutController";

const router = express.Router();

// Public — needed by the frontend bank selector before auth
router.get("/banks", listBanks);
router.post("/resolve-account", resolveAccount);

// Owner only
router.get("/bank-account", authMiddleware, requireRole("owner"), getBankAccount);
router.post("/bank-account", authMiddleware, requireRole("owner"), saveBankAccount);
router.delete("/bank-account", authMiddleware, requireRole("owner"), deleteBankAccount);
router.get("/history", authMiddleware, requireRole("owner"), getPayoutHistory);

export default router;
