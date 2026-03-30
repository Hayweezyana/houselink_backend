import { NextFunction, Request, Response } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { createNotification } from "./notificationController";
import { sendNewMessageEmail } from "../services/emailService";
import { io } from "../index";


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

    // Notify receiver in-app + email
    try {
      const [sender, receiver, property] = await Promise.all([
        db("users").where({ id: sender_id }).select("name").first(),
        db("users").where({ id: receiver_id }).select("name", "email").first(),
        db("properties").where({ id: property_id }).select("title").first(),
      ]);
      if (sender && receiver && property) {
        const frontendUrl = (process.env.FRONTEND_URL ?? "").split(",")[0].trim();
        await Promise.allSettled([
          createNotification(receiver_id, "message", "New message", `${sender.name} sent you a message about ${property.title}`, `/chat/${property_id}`),
          sendNewMessageEmail({
            receiverEmail: receiver.email,
            receiverName: receiver.name,
            senderName: sender.name,
            propertyTitle: property.title,
            messagePreview: message.length > 120 ? message.slice(0, 120) + "…" : message,
            chatUrl: `${frontendUrl}/chat/${property_id}`,
          }),
        ]);
      }
    } catch (_) {}

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

    // Mark received messages as read and emit read receipt
    const unread = await db("messages")
      .where({ property_id, receiver_id: user_id, is_read: false })
      .select("id");

    if (unread.length > 0) {
      await db("messages")
        .where({ property_id, receiver_id: user_id, is_read: false })
        .update({ is_read: true });

      io.to(`property-${property_id}`).emit("messagesRead", {
        property_id,
        reader_id: user_id,
      });
    }

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
