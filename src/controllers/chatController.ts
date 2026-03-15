import { NextFunction, Request, Response } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";


/**
 * Send a message
 */
export const sendMessages = async (req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { receiver_id, property_id, message } = req.body;
    const sender_id = req.user?.id;
    if (!sender_id) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    const newMessage = await db("messages").insert({
      id: uuidv4(),
      sender_id,
      receiver_id,
      property_id,
      message,
    }).returning("*");

    res.status(201).json(newMessage[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Get chat messages between two users for a property.
 * Also marks all received messages in that conversation as read.
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { property_id } = req.params;
    const user_id = req.user?.id;

    const messages = await db("messages")
      .where("property_id", property_id)
      .andWhere((builder) => {
        builder.where("sender_id", user_id).orWhere("receiver_id", user_id);
      })
      .orderBy("created_at", "asc");

    // Mark received messages as read
    await db("messages")
      .where({ property_id, receiver_id: user_id, is_read: false })
      .update({ is_read: true });

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/unread-count
 * Returns total unread message count for the authenticated user
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user_id = req.user?.id;
    const [{ count }] = await db("messages")
      .where({ receiver_id: user_id, is_read: false })
      .count("id as count");

    res.json({ unread: Number(count) });
  } catch (error) {
    next(error);
  }
};
