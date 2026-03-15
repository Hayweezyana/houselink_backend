import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";

/**
 * Utility to create a notification (used internally by other controllers)
 */
export const createNotification = async (
  user_id: string,
  type: string,
  title: string,
  body: string,
  link?: string
) => {
  await db("notifications").insert({ id: uuidv4(), user_id, type, title, body, link: link || null });
};

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.user?.id;
    if (!user_id) { res.status(401).json({ message: "Unauthorized" }); return; }

    const notifications = await db("notifications")
      .where({ user_id })
      .orderBy("created_at", "desc")
      .limit(50);

    res.json(notifications);
  } catch (error) { next(error); }
};

export const markAllRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.user?.id;
    if (!user_id) { res.status(401).json({ message: "Unauthorized" }); return; }
    await db("notifications").where({ user_id, is_read: false }).update({ is_read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (error) { next(error); }
};

export const markOneRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.user?.id;
    if (!user_id) { res.status(401).json({ message: "Unauthorized" }); return; }
    await db("notifications")
      .where({ id: req.params.id, user_id })
      .update({ is_read: true });
    res.json({ message: "Notification marked as read" });
  } catch (error) { next(error); }
};
