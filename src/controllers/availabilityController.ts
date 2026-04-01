import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { createNotification } from "./notificationController";

export const getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { property_id } = req.params;
    const availability = await db("property_availability")
      .where({ property_id })
      .orderBy("available_from", "asc");
    res.json(availability);
  } catch (error) { next(error); }
};

export const setAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { property_id } = req.params;
    const { available_from, available_to, is_blocked } = req.body;
    const owner_id = req.user?.id;

    const property = await db("properties").where({ id: property_id }).first();
    if (!property) { res.status(404).json({ message: "Property not found" }); return; }
    if (property.owner_id !== owner_id) { res.status(403).json({ message: "Forbidden" }); return; }

    const [entry] = await db("property_availability")
      .insert({ id: uuidv4(), property_id, available_from, available_to, is_blocked: is_blocked ?? false })
      .returning("*");

    res.status(201).json(entry);
  } catch (error) { next(error); }
};

/**
 * POST /api/properties/:property_id/availability/request
 * Seeker requests an inspection on an available date.
 * Creates a chat message + in-app notification to the owner.
 */
export const requestInspection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { property_id } = req.params;
    const seeker_id = req.user?.id;
    const { requested_date, note } = req.body;

    if (!seeker_id) { res.status(403).json({ message: "Unauthorized" }); return; }
    if (!requested_date) { res.status(400).json({ message: "requested_date is required" }); return; }

    const [property, seeker] = await Promise.all([
      db("properties").where({ id: property_id }).select("owner_id", "title").first(),
      db("users").where({ id: seeker_id }).select("name", "email").first(),
    ]);

    if (!property) { res.status(404).json({ message: "Property not found" }); return; }

    const dateStr = new Date(requested_date).toLocaleDateString("en-NG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const msgText = `Hi, I'd like to schedule an inspection on ${dateStr}.${note ? ` ${note}` : ""}`;

    await db("messages").insert({
      id: uuidv4(),
      sender_id: seeker_id,
      receiver_id: property.owner_id,
      property_id,
      message: msgText,
    });

    await createNotification(
      property.owner_id,
      "inspection",
      "Inspection Request",
      `${seeker?.name ?? "A seeker"} wants to inspect "${property.title}" on ${dateStr}.`,
      `/manage-properties`
    ).catch(() => {});

    res.json({ message: "Inspection request sent to the owner." });
  } catch (error) { next(error); }
};

export const deleteAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const owner_id = req.user?.id;

    const entry = await db("property_availability")
      .join("properties", "property_availability.property_id", "properties.id")
      .where("property_availability.id", id)
      .select("properties.owner_id")
      .first();

    if (!entry) { res.status(404).json({ message: "Entry not found" }); return; }
    if (entry.owner_id !== owner_id) { res.status(403).json({ message: "Forbidden" }); return; }

    await db("property_availability").where({ id }).del();
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
};
