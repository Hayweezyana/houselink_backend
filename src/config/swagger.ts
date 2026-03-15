import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HouseLink API",
      version: "1.0.0",
      description:
        "REST API for HouseLink — a Nigerian property rental marketplace. Supports property listings, messaging, payments via Paystack, and real-time chat.",
      contact: { name: "HouseLink Support", email: "support@houselink.ng" },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["user", "owner", "admin"] },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Property: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            location: { type: "string" },
            type: {
              type: "string",
              enum: ["Apartment", "House", "Studio", "Duplex", "Bungalow", "Self-contain", "Office"],
            },
            rooms: { type: "integer" },
            images: { type: "array", items: { type: "string", format: "uri" } },
            videos: { type: "array", items: { type: "string", format: "uri" } },
            amenities: { type: "array", items: { type: "string" } },
            verified: { type: "boolean" },
            is_available: { type: "boolean" },
            views: { type: "integer" },
            avg_rating: { type: "number" },
            owner_id: { type: "string", format: "uuid" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        PaginatedProperties: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Property" } },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                pages: { type: "integer" },
              },
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sender_id: { type: "string", format: "uuid" },
            receiver_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            message: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            type: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            link: { type: "string" },
            is_read: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
