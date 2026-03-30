import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import { createNotification } from "./notificationController";

/**
 * GET /api/admin/users
 * List all users with optional role filter and pagination.
 */
export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, page = "1", limit = "20", search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db("users")
      .select("id", "name", "email", "role", "suspended_at", "created_at")
      .orderBy("created_at", "desc")
      .limit(Number(limit))
      .offset(offset);

    if (role) query = query.where({ role });
    if (search) {
      const term = `%${search}%`;
      query = query.where((b) => b.whereILike("name", term).orWhereILike("email", term));
    }

    const users = await query;
    const [{ total }] = await db("users").count("id as total");
    res.json({ data: users, total: Number(total) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/suspend
 * Suspend a user account.
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await db("users").where({ id }).first();
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    if (user.role === "admin") { res.status(403).json({ message: "Cannot suspend an admin" }); return; }

    await db("users").where({ id }).update({ suspended_at: new Date() });
    // Invalidate all sessions
    await db("refresh_tokens").where({ user_id: id }).delete();

    await createNotification(id, "account", "Account Suspended", "Your account has been suspended. Contact support@houselinkng.com if you believe this is an error.").catch(() => {});
    res.json({ message: "User suspended" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/unsuspend
 * Lift a suspension.
 */
export const unsuspendUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await db("users").where({ id }).update({ suspended_at: null });
    res.json({ message: "User unsuspended" });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:id
 * Hard delete a user and all their data.
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await db("users").where({ id }).first();
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    if (user.role === "admin") { res.status(403).json({ message: "Cannot delete an admin" }); return; }

    await db("users").where({ id }).delete();
    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/properties
 * List all properties including unverified ones.
 */
export const listAllProperties = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { verified, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db("properties")
      .join("users", "properties.owner_id", "users.id")
      .select(
        "properties.id", "properties.title", "properties.location", "properties.price",
        "properties.verified", "properties.views", "properties.created_at",
        "users.name as owner_name", "users.email as owner_email"
      )
      .whereNull("properties.deleted_at")
      .orderBy("properties.created_at", "desc")
      .limit(Number(limit))
      .offset(offset);

    if (verified !== undefined) query = query.where("properties.verified", verified === "true");

    const properties = await query;
    const [{ total }] = await db("properties").whereNull("deleted_at").count("id as total");
    res.json({ data: properties, total: Number(total) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/properties/:id/verify
 * Mark a property as verified.
 */
export const verifyProperty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const property = await db("properties").where({ id }).first();
    if (!property) { res.status(404).json({ message: "Property not found" }); return; }

    await db("properties").where({ id }).update({ verified: true });
    await createNotification(property.owner_id, "property", "Property Verified", `Your listing "${property.title}" has been verified and is now visible to seekers.`, `/property/${id}`).catch(() => {});
    res.json({ message: "Property verified" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/properties/:id/reject
 * Reject (soft-delete) a property with a reason.
 */
export const rejectProperty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const property = await db("properties").where({ id }).first();
    if (!property) { res.status(404).json({ message: "Property not found" }); return; }

    await db("properties").where({ id }).update({ deleted_at: new Date(), verified: false });
    const msg = reason ? `Your listing "${property.title}" was rejected: ${reason}` : `Your listing "${property.title}" has been removed.`;
    await createNotification(property.owner_id, "property", "Property Rejected", msg).catch(() => {});
    res.json({ message: "Property rejected" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/disputes
 * List all payments with open disputes.
 */
export const listDisputes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const disputes = await db("payments")
      .where("payments.dispute_status", "open")
      .join("properties", "payments.property_id", "properties.id")
      .join("users as seeker", "payments.user_id", "seeker.id")
      .join("users as owner", "payments.owner_id", "owner.id")
      .select(
        "payments.id", "payments.reference", "payments.amount",
        "payments.dispute_reason", "payments.disputed_at",
        "payments.checkin_date", "payments.checkout_date",
        "properties.title as property_title",
        "seeker.name as seeker_name", "seeker.email as seeker_email",
        "owner.name as owner_name", "owner.email as owner_email"
      )
      .orderBy("payments.disputed_at", "asc");

    res.json(disputes);
  } catch (error) {
    next(error);
  }
};
