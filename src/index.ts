import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import crypto from "crypto";
import axios from "axios";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { startCronJobs } from "./jobs/cronJobs";
import { initSocket } from "./config/socket";

import logger from "./config/logger";
import authRoutes from "./routes/authRoutes";
import propertyRoutes from "./routes/propertyRoutes";
import chatRoutes from "./routes/chatRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import wishlistRoutes from "./routes/wishlistRoutes";
import uploadsRoute from "./routes/uploads";
import notificationRoutes from "./routes/notificationRoutes";
import availabilityRoutes from "./routes/availabilityRoutes";
import payoutRoutes from "./routes/payoutRoutes";
import adminRoutes from "./routes/adminRoutes";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Trust the first hop (Render / any reverse proxy) so that
// X-Forwarded-For is used for rate-limit key generation.
app.set("trust proxy", 1);

// ─── Compression (gzip/brotli) ────────────────────────────────────────────────
app.use(compression());

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, "")); // normalise: trim whitespace + trailing slash
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and any listed origin
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin: ${origin} (allowed: ${allowedOrigins.join(", ")})`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg: string) => logger.info(msg.trim()) },
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Too many subscription attempts." },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { message: "Too many payment requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const payoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { message: "Too many payout requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Socket.io (scoped to property rooms) ────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});
initSocket(io);

io.on("connection", (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on("joinRoom", (room: string) => {
    socket.join(room);
  });

  socket.on("sendMessage", (data) => {
    io.to(`property-${data.property_id}`).emit(
      `receiveMessage-${data.property_id}`,
      data
    );
  });

  // Typing indicators
  socket.on("typing", (data: { property_id: string; user_id: string }) => {
    socket.to(`property-${data.property_id}`).emit("userTyping", {
      user_id: data.user_id,
      property_id: data.property_id,
    });
  });

  socket.on("stopTyping", (data: { property_id: string; user_id: string }) => {
    socket.to(`property-${data.property_id}`).emit("userStopTyping", {
      user_id: data.user_id,
      property_id: data.property_id,
    });
  });

  // Read receipts
  socket.on("messagesRead", (data: { property_id: string; reader_id: string }) => {
    socket.to(`property-${data.property_id}`).emit("messagesRead", {
      property_id: data.property_id,
      reader_id: data.reader_id,
    });
  });

  socket.on("disconnect", () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Subscribe ────────────────────────────────────────────────────────────────
app.post(
  "/subscribe",
  subscribeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { email, token } = req.body;
    if (!email || !token) {
      res.status(400).json({ message: "Missing fields" });
      return;
    }

    try {
      const recaptchaVerify = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
      );
      if (!recaptchaVerify.data.success) {
        res.status(400).json({ message: "reCAPTCHA failed" });
        return;
      }
    } catch {
      res.status(500).json({ message: "reCAPTCHA verification error" });
      return;
    }

    try {
      const listId = process.env.MAILCHIMP_LIST_ID;
      const apiKey = process.env.MAILCHIMP_API_KEY;
      if (!listId || !apiKey) {
        res.status(503).json({ message: "Email service not configured" });
        return;
      }
      const datacenter = apiKey.split("-")[1];
      const subscriberHash = crypto
        .createHash("md5")
        .update(email.toLowerCase())
        .digest("hex");
      const url = `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;
      await axios.put(
        url,
        { email_address: email, status_if_new: "subscribed" },
        {
          headers: {
            Authorization: `apikey ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.status(200).json({ message: "Thanks! You've been subscribed." });
    } catch (error: any) {
      logger.error("Mailchimp error:", error.response?.data || error.message);
      res.status(500).json({ message: "Subscription failed" });
    }
  }
);

// ─── API Docs ─────────────────────────────────────────────────────────────────
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "HouseLink API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  })
);
app.get("/api/docs.json", (_req: Request, res: Response): void => { res.json(swaggerSpec); });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "HouseLink API", version: "1.0.0", docs: "/api/docs" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiLimiter);
app.use("/api/properties", propertyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payment", paymentLimiter, paymentRoutes);
app.use("/api/webhook/paystack", webhookRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/uploads", uploadsRoute);
app.use("/api/notifications", notificationRoutes);
app.use("/api/properties/:property_id/availability", availabilityRoutes);
app.use("/api/payout", payoutLimiter, payoutRoutes);
app.use("/api/admin", adminRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
  res.status(status).json({ message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`HouseLink API running at http://localhost:${PORT}`);
  logger.info(`API docs available at http://localhost:${PORT}/api/docs`);
  startCronJobs();
});

export default server;
