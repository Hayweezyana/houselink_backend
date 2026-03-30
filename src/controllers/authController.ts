import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db";
import { sendOtpEmail } from "../services/emailService";

const REFRESH_COOKIE = "hl_refresh";
const REFRESH_TTL_DAYS = 7;
const ACCESS_TTL = "15m";
const OTP_TTL_MINUTES = 10;
const VALID_ROLES = ["seeker", "owner"] as const;

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
}

function issueAccessToken(id: string, role: string): string {
  return jwt.sign({ id, role }, process.env.SECRET_KEY as string, {
    expiresIn: ACCESS_TTL,
  });
}

function setRefreshCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "strict", // cross-origin in prod (different Railway domains)
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

async function createAndSendOtp(email: string, type: string): Promise<void> {
  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await db("otp_codes").where({ email, type, used: false }).delete();
  await db("otp_codes").insert({ email, code, type, expires_at: expiresAt });
  await sendOtpEmail(email, code, type);
}

async function consumeOtp(email: string, code: string, type: string): Promise<boolean> {
  const otp = await db("otp_codes")
    .where({ email, code, type, used: false })
    .where("expires_at", ">", new Date())
    .first();
  if (!otp) return false;
  await db("otp_codes").where({ id: otp.id }).update({ used: true });
  return true;
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db("refresh_tokens").insert({ user_id: userId, token, expires_at: expiresAt });
  return token;
}

/**
 * POST /api/auth/send-otp
 * Body: { email, type: 'signup' | 'login' | 'password_reset' }
 */
export const sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, type } = req.body;
    const validTypes = ["signup", "login", "password_reset"];

    if (!email || !type || !validTypes.includes(type)) {
      res.status(400).json({ message: "Valid email and type required" });
      return;
    }

    if (type === "login" || type === "password_reset") {
      const user = await db("users").where({ email }).first();
      if (!user) {
        res.json({ message: "If that email exists, a code has been sent" });
        return;
      }
    }

    if (type === "signup") {
      const existing = await db("users").where({ email }).first();
      if (existing) {
        res.status(400).json({ message: "Email already in use" });
        return;
      }
    }

    await createAndSendOtp(email, type);
    res.json({ message: "OTP sent to your email" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register
 * Body: { name, email, password, otp, role? }
 * role defaults to 'seeker'. Pass role='owner' for property owners/agents.
 * OTP must be requested first via /send-otp (type='signup').
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, otp, role = "seeker" } = req.body;

    if (!name || !email || !password || !otp) {
      res.status(400).json({ message: "Name, email, password and OTP are required" });
      return;
    }
    if (!isStrongPassword(password)) {
      res.status(400).json({ message: "Password must be at least 8 characters and include a number or special character" });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ message: "Role must be 'seeker' or 'owner'" });
      return;
    }

    const existing = await db("users").where({ email }).first();
    if (existing) {
      res.status(400).json({ message: "Email already in use" });
      return;
    }

    const valid = await consumeOtp(email, otp, "signup");
    if (!valid) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const [user] = await db("users")
      .insert({ name, email, password: hashed, role })
      .returning(["id", "name", "email", "role", "created_at"]);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Step 1: verify password → send OTP
 * Returns { requiresOtp: true, role } so the frontend can redirect accordingly after step 2
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await db("users").where({ email }).first();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    await createAndSendOtp(email, "login");
    res.json({ requiresOtp: true, role: user.role, message: "OTP sent to your email" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login/verify
 * Step 2: verify OTP → issue tokens
 * Body: { email, otp }
 */
export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: "Email and OTP are required" });
      return;
    }

    const valid = await consumeOtp(email, otp, "login");
    if (!valid) {
      res.status(401).json({ message: "Invalid or expired OTP" });
      return;
    }

    const user = await db("users").where({ email }).first();
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    const token = issueAccessToken(user.id, user.role);
    const refreshTokenValue = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshTokenValue);

    const { password: _pw, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await db("users").where({ email }).first();
    if (user) {
      await createAndSendOtp(email, "password_reset");
    }

    res.json({ message: "If that email exists, a reset code has been sent" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword }
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({ message: "Email, OTP and new password are required" });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ message: "Password must be at least 8 characters and include a number or special character" });
      return;
    }

    const valid = await consumeOtp(email, otp, "password_reset");
    if (!valid) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const user = await db("users").where({ email }).first();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await db("users").where({ email }).update({ password: hashed });
    await db("refresh_tokens").where({ user_id: user.id }).delete();

    res.json({ message: "Password reset successfully. Please log in again." });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incoming = req.cookies?.[REFRESH_COOKIE];
    if (!incoming) {
      res.status(401).json({ message: "Refresh token missing" });
      return;
    }

    const stored = await db("refresh_tokens")
      .where({ token: incoming })
      .where("expires_at", ">", new Date())
      .first();

    if (!stored) {
      res.status(401).json({ message: "Refresh token invalid or expired" });
      return;
    }

    const user = await db("users").where({ id: stored.user_id }).select("id", "role").first();
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    const newRefreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db("refresh_tokens").where({ token: incoming }).delete();
    await db("refresh_tokens").insert({ user_id: user.id, token: newRefreshToken, expires_at: expiresAt });

    setRefreshCookie(res, newRefreshToken);
    res.json({ token: issueAccessToken(user.id, user.role) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incoming = req.cookies?.[REFRESH_COOKIE];
    if (incoming) {
      await db("refresh_tokens").where({ token: incoming }).delete();
    }
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth", secure: isProd, sameSite: isProd ? "none" : "strict" });
    res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await db("users")
      .where({ id: req.user?.id })
      .select("id", "name", "email", "role", "created_at")
      .first();

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/profile
 * Body: { name?, phone?, avatar? }
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, phone, avatar } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No fields to update" });
      return;
    }

    const [updated] = await db("users")
      .where({ id: req.user?.id })
      .update(updates)
      .returning(["id", "name", "email", "role", "created_at"]);

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "currentPassword and newPassword are required" });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ message: "New password must be at least 8 characters and include a number or special character" });
      return;
    }

    const user = await db("users").where({ id: req.user?.id }).first();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db("users").where({ id: user.id }).update({ password: hashed });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/:id  (legacy)
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await db("users")
      .where({ id: req.params.id })
      .select("id", "name", "email", "role", "created_at")
      .first();

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};
