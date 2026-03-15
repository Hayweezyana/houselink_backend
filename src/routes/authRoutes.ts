import express from "express";
import {
  register,
  login,
  verifyLoginOtp,
  sendOtp,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} from "../controllers/authController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

/**
 * @openapi
 * /api/auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP to email — call before register, login step-2, or password reset
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, type]
 *             properties:
 *               email: { type: string, format: email }
 *               type: { type: string, enum: [signup, login, password_reset] }
 *     responses:
 *       200:
 *         description: OTP sent (or silently skipped if email not found)
 */
router.post("/send-otp", sendOtp);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user or owner — OTP required (call /send-otp first)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, otp]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               otp: { type: string, example: "123456" }
 *               role:
 *                 type: string
 *                 enum: [seeker, owner]
 *                 default: seeker
 *                 description: "'seeker' for renters/buyers, 'owner' for landlords/agents"
 *     responses:
 *       201:
 *         description: User created — contains id, name, email, role
 *       400:
 *         description: Validation error, email in use, or invalid OTP
 */
router.post("/register", register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login step 1 — verify password, sends OTP. Returns requiresOtp + role.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: "{ requiresOtp: true, role: 'seeker'|'owner' } — call /login/verify next"
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", login);

/**
 * @openapi
 * /api/auth/login/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Login step 2 — verify OTP, returns access token + refresh cookie
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: "{ token, user } — token is a 15-min JWT, refresh token set as HttpOnly cookie"
 *       401:
 *         description: Invalid or expired OTP
 */
router.post("/login/verify", verifyLoginOtp);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send password reset OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Always 200 (avoids email enumeration)
 */
router.post("/forgot-password", forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with OTP from /forgot-password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset — all sessions invalidated
 *       400:
 *         description: Invalid OTP or validation error
 */
router.post("/reset-password", resetPassword);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh cookie → new access token
 *     security: []
 *     responses:
 *       200:
 *         description: "{ token }"
 *       401:
 *         description: Refresh token missing or expired
 */
router.post("/refresh", refreshToken);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Invalidate refresh token and clear cookie
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post("/logout", authMiddleware, logout);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get authenticated user profile (includes role)
 *     responses:
 *       200:
 *         description: "{ id, name, email, role, created_at }"
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authMiddleware, getMe);

/**
 * @openapi
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update profile (name, phone, avatar)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               avatar: { type: string }
 *     responses:
 *       200:
 *         description: Updated user profile
 */
router.put("/profile", authMiddleware, updateProfile);

/**
 * @openapi
 * /api/auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password (requires current password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password updated
 *       401:
 *         description: Current password incorrect
 */
router.put("/change-password", authMiddleware, changePassword);

export default router;
