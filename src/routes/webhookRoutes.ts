import express from "express";
import crypto from "crypto";
import axios from "axios";
import db from "../config/db";
import logger from "../config/logger";
import { sendReceiptEmail } from "../services/emailService";

const router = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PLATFORM_FEE_PERCENT = 0.05;

async function initiateTransfer(
  recipientCode: string,
  amountKobo: number,
  reference: string,
  reason: string
): Promise<string> {
  const res = await axios.post(
    "https://api.paystack.co/transfer",
    {
      source: "balance",
      recipient: recipientCode,
      amount: amountKobo,
      reference,
      reason,
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data.data.transfer_code as string;
}

router.post("/", express.json({ type: "application/json" }), async (req, res): Promise<void> => {
  try {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    const signature = req.headers["x-paystack-signature"] as string;

    if (secret) {
      const hash = crypto
        .createHmac("sha512", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (hash !== signature) {
        res.status(401).json({ message: "Invalid signature" });
        return;
      }
    }

    const { event, data } = req.body;

    // ── charge.success → mark payment + initiate transfer ─────────────────────
    if (event === "charge.success") {
      const { reference } = data;
      if (!reference) { res.sendStatus(200); return; }

      // Mark payment as success
      await db("payments").where({ reference }).update({ status: "success" });

      // Load payment row
      const payment = await db("payments").where({ reference }).first();
      if (!payment) { res.sendStatus(200); return; }

      // If already processed (transfer_reference exists), skip
      if (payment.transfer_reference) { res.sendStatus(200); return; }

      // Load owner's bank account
      const bankAccount = await db("bank_accounts")
        .where({ owner_id: payment.owner_id, is_default: true })
        .first();

      if (!bankAccount) {
        logger.warn(`No bank account found for owner ${payment.owner_id} — escrow held`);
        res.sendStatus(200);
        return;
      }

      // Calculate split (amount is stored in naira in payments table)
      const totalKobo = Math.round(Number(payment.amount) * 100);
      const platformFeeKobo = Math.round(totalKobo * PLATFORM_FEE_PERCENT);
      const ownerAmountKobo = totalKobo - platformFeeKobo;

      const transferRef = `hl_tf_${reference}`;

      try {
        await initiateTransfer(
          bankAccount.recipient_code,
          ownerAmountKobo,
          transferRef,
          `HouseLink payout for payment ${reference}`
        );

        await db("payments").where({ reference }).update({
          transfer_reference: transferRef,
          platform_fee: platformFeeKobo,
          owner_amount: ownerAmountKobo,
          escrow_status: "held",
        });
      } catch (transferErr: any) {
        logger.error("Paystack transfer initiation failed:", transferErr?.response?.data || transferErr.message);
        await db("payments").where({ reference }).update({
          platform_fee: platformFeeKobo,
          owner_amount: ownerAmountKobo,
          escrow_status: "failed",
        });
        res.sendStatus(200);
        return;
      }

      // Send receipt emails (non-blocking)
      try {
        const property = await db("properties").where({ id: payment.property_id }).first();
        const seeker = await db("users").where({ id: payment.user_id }).first();
        const owner = await db("users").where({ id: payment.owner_id }).first();

        if (property && seeker && owner) {
          await sendReceiptEmail({
            seekerEmail: seeker.email,
            seekerName: seeker.name,
            ownerEmail: owner.email,
            ownerName: owner.name,
            propertyTitle: property.title,
            propertyLocation: property.location,
            totalAmount: Number(payment.amount),
            ownerAmount: ownerAmountKobo / 100,
            platformFee: platformFeeKobo / 100,
            reference,
          });
        }
      } catch (emailErr: any) {
        logger.error("Receipt email error:", emailErr.message);
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
