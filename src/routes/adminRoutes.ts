import express from "express";
import { authMiddleware, requireRole } from "../middleware/authMiddleware";
import {
  listUsers,
  suspendUser,
  unsuspendUser,
  deleteUser,
  listAllProperties,
  verifyProperty,
  rejectProperty,
  listDisputes,
} from "../controllers/adminController";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authMiddleware, requireRole("admin"));

// Users
router.get("/users", listUsers);
router.post("/users/:id/suspend", suspendUser);
router.post("/users/:id/unsuspend", unsuspendUser);
router.delete("/users/:id", deleteUser);

// Properties
router.get("/properties", listAllProperties);
router.post("/properties/:id/verify", verifyProperty);
router.post("/properties/:id/reject", rejectProperty);

// Disputes
router.get("/disputes", listDisputes);

export default router;
