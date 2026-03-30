import express from "express";
import crypto from "crypto";
import db from "../config/db";
import logger from "../config/logger";
import { sendCheckinConfirmationEmail, sendOwnerBookingNotificationEmail } from "../services/emailService";
import { createNotification } from "../controllers/notificationController";

const router = express.Router();

router.post("/", express.json({ type: "application/json" }), async (req, res): Promise<void> => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      logger.error("PAYSTACK_SECRET_KEY is not configured — webhook rejected");
      res.status(500).json({ message: "Webhook not configured" });
      return;
    }

    const signature = req.headers["x-paystack-signature"] as string;
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (hash !== signature) {
      res.status(401).json({ message: "Invalid signature" });
      return;
    }

    const { event, data } = req.body;

    // ── charge.success → hold funds, send seeker confirmation email ────────────
    if (event === "charge.success") {
      const { reference } = data;
      if (!reference) { res.sendStatus(200); return; }

      await db("payments").where({ reference }).update({ status: "success", escrow_status: "held" });

      const payment = await db("payments").where({ reference }).first();
      if (!payment) { res.sendStatus(200); return; }

      // Send check-in confirmation email to seeker (non-blocking)
      try {
        const property = await db("properties").where({ id: payment.property_id }).first();
        const seeker = await db("users").where({ id: payment.user_id }).first();

        if (property && seeker) {
          await sendCheckinConfirmationEmail({
            seekerEmail: seeker.email,
            seekerName: seeker.name,
            propertyTitle: property.title,
            propertyLocation: property.location,
            totalAmount: Number(payment.amount),
            checkinDate: payment.checkin_date ?? "Not specified",
            checkoutDate: payment.checkout_date ?? "Not specified",
            paymentId: payment.id,
            reference,
          });
        }
      } catch (emailErr: any) {
        logger.error("Check-in confirmation email error:", emailErr.message);
      }

      // Notify owner that a booking payment was received
      try {
        const property = await db("properties").where({ id: payment.property_id }).first();
        const seeker = await db("users").where({ id: payment.user_id }).first();
        const owner = await db("users").where({ id: payment.owner_id }).first();

        if (property && seeker && owner) {
          await sendOwnerBookingNotificationEmail({
            ownerEmail: owner.email,
            ownerName: owner.name,
            seekerName: seeker.name,
            propertyTitle: property.title,
            totalAmount: Number(payment.amount),
            checkinDate: payment.checkin_date ?? "Not specified",
            checkoutDate: payment.checkout_date ?? "Not specified",
          });

          await Promise.allSettled([
            createNotification(payment.user_id, "payment", "Payment Held in Escrow", `Your payment for ${property.title} is held securely. Confirm check-in after arrival.`, `/payment/${payment.id}`),
            createNotification(payment.owner_id, "booking", "New Booking Received", `${seeker.name} has booked ${property.title}. Funds are in escrow.`, `/dashboard`),
          ]);
        }
      } catch (ownerEmailErr: any) {
        logger.error("Owner booking notification email error:", ownerEmailErr.message);
      }
    }

    // ── transfer.success → release escrow ─────────────────────────────────────
    else if (event === "transfer.success") {
      const transferCode = data?.transfer_code;
      const transferRef = data?.reference;
      if (transferRef) {
        await db("payments")
          .where({ transfer_reference: transferRef })
          .update({ escrow_status: "released" });
        logger.info(`Escrow released for transfer ${transferCode ?? transferRef}`);
      }
    }

    // ── transfer.failed / transfer.reversed → fail escrow ─────────────────────
    else if (event === "transfer.failed" || event === "transfer.reversed") {
      const transferRef = data?.reference;
      if (transferRef) {
        await db("payments")
          .where({ transfer_reference: transferRef })
          .update({ escrow_status: "failed" });
        logger.warn(`Escrow failed for transfer ref ${transferRef} (event: ${event})`);
      }
    }

    // ── charge.failed ──────────────────────────────────────────────────────────
    else if (event === "charge.failed") {
      const { reference } = data || {};
      if (reference) {
        await db("payments").where({ reference }).update({ status: "failed" });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook processing error" });
  }
});

export default router;
