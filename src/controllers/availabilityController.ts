import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";

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
