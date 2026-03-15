import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    if (!process.env.SECRET_KEY) {
      res.status(500).json({ message: "JWT secret not configured" });
      return;
    }
    const decoded = jwt.verify(token, process.env.SECRET_KEY) as {
      id: string;
      email: string;
      role?: string;
    };
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Role guard — use after authMiddleware.
 * Usage: router.post("/", authMiddleware, requireRole("owner"), handler)
 */
export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };

export { authMiddleware };
export default authMiddleware;
