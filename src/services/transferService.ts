import axios from "axios";
import db from "../config/db";
import logger from "../config/logger";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PLATFORM_FEE_PERCENT = 0.05;

export async function initiateTransfer(
  recipientCode: string,
  amountKobo: number,
  reference: string,
  reason: string
): Promise<string> {
  const res = await axios.post(
    "https://api.paystack.co/transfer",
    { source: "balance", recipient: recipientCode, amount: amountKobo, reference, reason },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data.data.transfer_code as string;
}

/**
 * Releases escrow for a payment: calculates split, initiates Paystack transfer,
 * updates payment record. Throws on failure.
 */
export async function releaseEscrow(paymentId: string): Promise<void> {
  const payment = await db("payments").where({ id: paymentId }).first();
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.transfer_reference) throw new Error("Transfer already initiated");

  const bankAccount = await db("bank_accounts")
    .where({ owner_id: payment.owner_id, is_default: true })
    .first();

  if (!bankAccount) throw new Error(`No default bank account for owner ${payment.owner_id}`);

  const totalKobo = Math.round(Number(payment.amount) * 100);
  const platformFeeKobo = Math.round(totalKobo * PLATFORM_FEE_PERCENT);
  const ownerAmountKobo = totalKobo - platformFeeKobo;
  const transferRef = `hl_tf_${payment.reference}`;

  try {
    await initiateTransfer(
      bankAccount.recipient_code,
      ownerAmountKobo,
      transferRef,
      `HouseLink payout for payment ${payment.reference}`
    );

    await db("payments").where({ id: paymentId }).update({
      transfer_reference: transferRef,
      platform_fee: platformFeeKobo,
      owner_amount: ownerAmountKobo,
      escrow_status: "held",
    });
  } catch (err: any) {
    logger.error("Paystack transfer failed:", err?.response?.data || err.message);
    await db("payments").where({ id: paymentId }).update({
      platform_fee: platformFeeKobo,
      owner_amount: ownerAmountKobo,
      escrow_status: "failed",
    });
    throw err;
  }
}
