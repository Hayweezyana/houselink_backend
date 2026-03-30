import { Request, Response, NextFunction, RequestHandler } from "express";
import db from "../config/db";
import { v4 as uuidv4 } from "uuid";

interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string };
}

const ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "price",
  "location",
  "type",
  "rooms",
  "amenities",
  "images",
  "videos",
  "is_available",
];

export const createProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, price, location, type, rooms, amenities } = req.body;
    const owner_id = req.user?.id;

    if (!owner_id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!title || !price || !location) {
      res.status(400).json({ message: "title, price and location are required" });
      return;
    }

    const media = (req.files as Express.Multer.File[]) || [];
    const imagePaths = media
      .filter((f) => f.mimetype.startsWith("image"))
      .map((f) => (f as any).path || `/uploads/${f.filename}`);
    const videoPaths = media
      .filter((f) => f.mimetype.startsWith("video"))
      .map((f) => (f as any).path || `/uploads/${f.filename}`);

    const [property] = await db("properties")
      .insert({
        id: uuidv4(),
        owner_id,
        title,
        description,
        price: Number(price),
        location,
        type: type || null,
        rooms: rooms ? Number(rooms) : null,
        amenities: amenities || null,
        images: imagePaths,
        videos: videoPaths,
      })
      .returning("*");

    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
};

export const getAllProperties: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      type,
      rooms,
      amenity,
      page = "1",
      limit = "12",
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = db("properties")
      .select("properties.*", db.raw("COALESCE(AVG(reviews.rating), 0) as avg_rating"))
      .leftJoin("reviews", "reviews.property_id", "properties.id")
      .whereNull("properties.deleted_at")
      .groupBy("properties.id")
      .orderBy("properties.created_at", "desc")
      .limit(Number(limit))
      .offset(offset);

    if (search) {
      const term = `%${search}%`;
      query = query.where((builder) =>
        builder
          .whereILike("properties.title", term)
          .orWhereILike("properties.description", term)
          .orWhereILike("properties.location", term)
      );
    }
    if (minPrice) query = query.where("price", ">=", Number(minPrice));
    if (maxPrice) query = query.where("price", "<=", Number(maxPrice));
    if (type) query = query.where("properties.type", type);
    if (rooms) query = query.where("properties.rooms", Number(rooms));
    if (amenity) query = query.whereRaw("amenities ILIKE ?", [`%${amenity}%`]);

    const properties = await query;

    // Total count for pagination
    let countQuery = db("properties").whereNull("deleted_at").count("id as total");
    if (search) {
      const term = `%${search}%`;
      countQuery = countQuery.where((b) =>
        b
          .whereILike("title", term)
          .orWhereILike("description", term)
          .orWhereILike("location", term)
      );
    }
    if (minPrice) countQuery = countQuery.where("price", ">=", Number(minPrice));
    if (maxPrice) countQuery = countQuery.where("price", "<=", Number(maxPrice));
    if (type) countQuery = countQuery.where("type", type);
    if (rooms) countQuery = countQuery.where("rooms", Number(rooms));
    if (amenity) countQuery = countQuery.whereRaw("amenities ILIKE ?", [`%${amenity}%`]);

    const [{ total }] = await countQuery;

    res.json({
      data: properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        pages: Math.ceil(Number(total) / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyById: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const property = await db("properties").where({ id: req.params.id }).whereNull("deleted_at").first();
    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    res.json(property);
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const owner_id = req.user?.id;

    const property = await db("properties").where({ id }).whereNull("deleted_at").first();
    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (property.owner_id !== owner_id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Whitelist allowed fields — no mass assignment
    const updates: Record<string, any> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    updates.updated_at = db.fn.now();

    const [updated] = await db("properties").where({ id }).update(updates).returning("*");
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const owner_id = req.user?.id;

    const property = await db("properties").where({ id }).whereNull("deleted_at").first();
    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }
    if (property.owner_id !== owner_id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await db("properties").where({ id }).update({ deleted_at: db.fn.now() });
    res.json({ message: "Property deleted successfully" });
  } catch (error) {
    next(error);
  }
};
