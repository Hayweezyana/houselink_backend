import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { releaseEscrow } from "../services/transferService";
import { sendReceiptEmail } from "../services/emailService";
import { createNotification } from "./notificationController";

export const initializePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { property_id, amount, email, checkin_date, checkout_date } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }
    if (!property_id || !amount || !email) {
      res.status(400).json({ message: "property_id, amount and email are required" });
      return;
    }

    const reference = uuidv4();

    // Fetch owner_id for escrow routing
    const property = await db("properties").where({ id: property_id }).select("owner_id").first();

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(Number(amount) * 100),
        reference,
        callback_url: `${(process.env.FRONTEND_URL ?? "").split(",")[0].trim()}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    await db("payments").insert({
      id: uuidv4(),
      user_id,
      property_id,
      owner_id: property?.owner_id || null,
      status: "pending",
      escrow_status: "held",
      reference,
      amount: Number(amount),
      payment_method: "paystack",
      checkin_date: checkin_date || null,
      checkout_date: checkout_date || null,
    });

    res.json({ message: "Payment initialized", data: response.data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/:id/confirm-checkin
 * Seeker confirms they have checked in → funds are released to owner.
 */
export const confirmCheckin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seekerId = req.user?.id;
    const id = String(req.params.id);

    if (!seekerId) { res.status(403).json({ message: "Unauthorized" }); return; }

    const payment = await db("payments").where({ id }).first();
    if (!payment) { res.status(404).json({ message: "Payment not found" }); return; }
    if (payment.user_id !== seekerId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (payment.status !== "success") { res.status(400).json({ message: "Payment not completed" }); return; }
    if (payment.seeker_confirmed_at) { res.status(400).json({ message: "Already confirmed" }); return; }
    if (payment.escrow_status === "released") { res.status(400).json({ message: "Escrow already released" }); return; }

    // Mark seeker confirmation
    await db("payments").where({ id }).update({ seeker_confirmed_at: new Date() });

    // Initiate transfer to owner
    await releaseEscrow(id);

    // Send receipt emails + notifications
    try {
      const property = await db("properties").where({ id: payment.property_id }).first();
      const seeker = await db("users").where({ id: payment.user_id }).first();
      const owner = await db("users").where({ id: payment.owner_id }).first();
      const updated = await db("payments").where({ id }).first();

      if (property && seeker && owner && updated) {
        await sendReceiptEmail({
          seekerEmail: seeker.email,
          seekerName: seeker.name,
          ownerEmail: owner.email,
          ownerName: owner.name,
          propertyTitle: property.title,
          propertyLocation: property.location,
          totalAmount: Number(payment.amount),
          ownerAmount: (updated.owner_amount ?? 0) / 100,
          platformFee: (updated.platform_fee ?? 0) / 100,
          reference: payment.reference,
        });
      }

      await Promise.allSettled([
        createNotification(payment.user_id, "payment", "Check-in Confirmed", "You've confirmed check-in. Payment has been released to the owner.", `/payment/${id}`),
        createNotification(payment.owner_id, "payment", "Escrow Released", `${seeker?.name ?? "A seeker"} confirmed check-in. Your payout is being processed.`, `/dashboard`),
      ]);
    } catch (_) {}

    res.json({ message: "Check-in confirmed. Payment released to owner." });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/:id/release
 * Owner requests auto-release of escrow if seeker hasn't confirmed within 24h of check-in.
 */
export const ownerRequestRelease = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    const id = String(req.params.id);

    if (!ownerId) { res.status(403).json({ message: "Unauthorized" }); return; }

    const payment = await db("payments").where({ id }).first();
    if (!payment) { res.status(404).json({ message: "Payment not found" }); return; }
    if (payment.owner_id !== ownerId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (payment.status !== "success") { res.status(400).json({ message: "Payment not completed" }); return; }
    if (payment.seeker_confirmed_at) { res.status(400).json({ message: "Seeker already confirmed check-in" }); return; }
    if (payment.escrow_status === "released") { res.status(400).json({ message: "Escrow already released" }); return; }

    if (payment.dispute_status === "open") {
      res.status(400).json({ message: "Cannot release escrow while a dispute is open. Contact support." });
      return;
    }

    // Allow auto-release only after 24h past check-in date
    if (payment.checkin_date) {
      const checkinPlus24h = new Date(payment.checkin_date);
      checkinPlus24h.setHours(checkinPlus24h.getHours() + 24);
      if (new Date() < checkinPlus24h) {
        res.status(400).json({
          message: `Auto-release is only available 24 hours after check-in date (${payment.checkin_date}).`,
        });
        return;
      }
    }

    await releaseEscrow(id);
    res.json({ message: "Escrow release initiated." });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/:id/dispute
 * Seeker raises a dispute — blocks escrow auto-release until admin resolves.
 */
export const raiseDispute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seekerId = req.user?.id;
    const id = String(req.params.id);
    const { reason } = req.body;

    if (!seekerId) { res.status(403).json({ message: "Unauthorized" }); return; }
    if (!reason) { res.status(400).json({ message: "reason is required" }); return; }

    const payment = await db("payments").where({ id }).first();
    if (!payment) { res.status(404).json({ message: "Payment not found" }); return; }
    if (payment.user_id !== seekerId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (payment.status !== "success") { res.status(400).json({ message: "Payment not completed" }); return; }
    if (payment.escrow_status === "released") { res.status(400).json({ message: "Escrow already released" }); return; }
    if (payment.dispute_status === "open") { res.status(400).json({ message: "A dispute is already open for this payment" }); return; }

    await db("payments").where({ id }).update({
      dispute_status: "open",
      dispute_reason: reason,
      disputed_at: new Date(),
    });

    await createNotification(payment.owner_id, "dispute", "Dispute Raised", "A seeker has raised a dispute on a payment. Escrow release is paused.", `/dashboard`).catch(() => {});

    res.json({ message: "Dispute raised. Escrow release is paused pending review. Contact support@houselinkng.com." });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/:id/dispute/resolve
 * Admin resolves or dismisses a dispute.
 * Body: { action: 'release' | 'refund', note? }
 */
export const resolveDispute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { action } = req.body; // 'release' = pay owner; 'refund' = mark for manual refund

    if (!["release", "refund"].includes(action)) {
      res.status(400).json({ message: "action must be 'release' or 'refund'" });
      return;
    }

    const payment = await db("payments").where({ id }).first();
    if (!payment) { res.status(404).json({ message: "Payment not found" }); return; }
    if (payment.dispute_status !== "open") { res.status(400).json({ message: "No open dispute on this payment" }); return; }

    if (action === "release") {
      await db("payments").where({ id }).update({ dispute_status: "resolved" });
      await releaseEscrow(id);
      await Promise.allSettled([
        createNotification(payment.user_id, "dispute", "Dispute Resolved", "Your dispute has been reviewed. Payment has been released to the owner.", `/payment/${id}`),
        createNotification(payment.owner_id, "dispute", "Dispute Resolved", "The dispute on your booking has been resolved. Payout is being processed.", `/dashboard`),
      ]);
      res.json({ message: "Dispute resolved. Escrow released to owner." });
    } else {
      await db("payments").where({ id }).update({ dispute_status: "dismissed", escrow_status: "refunded" });
      await Promise.allSettled([
        createNotification(payment.user_id, "dispute", "Refund Approved", "Your dispute has been approved. A refund will be processed to your original payment method.", `/payment/${id}`),
        createNotification(payment.owner_id, "dispute", "Dispute — Refund Issued", "The dispute on your booking was resolved in favour of the seeker. No payout will be made.", `/dashboard`),
      ]);
      res.json({ message: "Dispute dismissed. Payment marked for refund." });
    }
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reference = String(req.query.reference ?? "");
    if (!reference) {
      res.status(400).json({ message: "Reference is required" });
      return;
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const paymentData = response.data.data;

    if (paymentData.status === "success") {
      await db("payments").where({ reference }).update({ status: "success" });
      res.json({ message: "Payment successful", data: paymentData });
      return;
    }

    res.status(400).json({ message: "Payment failed or pending", data: paymentData });
  } catch (error) {
    next(error);
  }
};
