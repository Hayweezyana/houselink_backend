import { Request, Response, NextFunction } from "express";
import axios from "axios";
import db from "../config/db";
import logger from "../config/logger";

const PAYSTACK_BASE = "https://api.paystack.co";
const PLATFORM_FEE_PERCENT = 0.05; // 5%

const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

/**
 * GET /api/payout/banks
 * Returns list of Nigerian banks (public — no auth needed).
 * Used to populate the bank selector on the frontend.
 */
export const listBanks = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data } = await axios.get(
      `${PAYSTACK_BASE}/bank?country=nigeria&currency=NGN&perPage=100`,
      { headers: paystackHeaders() }
    );
    res.json({ banks: data.data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payout/resolve-account
 * Body: { account_number, bank_code }
 * Verifies an account number and returns the registered account name.
 */
export const resolveAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { account_number, bank_code } = req.body;
    if (!account_number || !bank_code) {
      res.status(400).json({ message: "account_number and bank_code are required" });
      return;
    }

    const { data } = await axios.get(
      `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: paystackHeaders() }
    );

    res.json({
      account_name: data.data.account_name,
      account_number: data.data.account_number,
    });
  } catch (error: any) {
    if (error.response?.status === 422) {
      res.status(422).json({ message: "Could not verify account. Check the number and bank." });
      return;
    }
    next(error);
  }
};

/**
 * POST /api/payout/bank-account  (owner only)
 * Body: { account_number, account_name, bank_name, bank_code }
 * Creates a Paystack transfer recipient and saves the bank account.
 * An owner can only have one payout account at a time (replaced on save).
 */
export const saveBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { account_number, account_name, bank_name, bank_code } = req.body;
    const owner_id = req.user?.id;

    if (!account_number || !account_name || !bank_name || !bank_code) {
      res.status(400).json({ message: "account_number, account_name, bank_name and bank_code are required" });
      return;
    }

    // Register as Paystack transfer recipient
    const { data } = await axios.post(
      `${PAYSTACK_BASE}/transferrecipient`,
      {
        type: "nuban",
        name: account_name,
        account_number,
        bank_code,
        currency: "NGN",
      },
      { headers: paystackHeaders() }
    );

    const recipient_code = data.data.recipient_code;

    // Replace any existing account for this owner
    await db("bank_accounts").where({ owner_id }).delete();

    const [account] = await db("bank_accounts")
      .insert({ owner_id, account_number, account_name, bank_name, bank_code, recipient_code, is_default: true })
      .returning("*");

    res.status(201).json({ account });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payout/bank-account  (owner only)
 * Returns the owner's saved payout account or null.
 */
export const getBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const account = await db("bank_accounts").where({ owner_id: req.user?.id }).first();
    res.json({ account: account || null });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/payout/bank-account  (owner only)
 * Removes the owner's payout account.
 */
export const deleteBankAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db("bank_accounts").where({ owner_id: req.user?.id }).delete();
    res.json({ message: "Bank account removed" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payout/history  (owner only)
 * Returns payment history for this owner's properties with escrow status.
 */
export const getPayoutHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const owner_id = req.user?.id;
    const payouts = await db("payments")
      .where({ owner_id })
      .join("properties", "payments.property_id", "properties.id")
      .join("users", "payments.user_id", "users.id")
      .select(
        "payments.id",
        "payments.reference",
        "payments.amount",
        "payments.owner_amount",
        "payments.platform_fee",
        "payments.escrow_status",
        "payments.status",
        "payments.transfer_reference",
        "payments.created_at",
        "properties.title as property_title",
        "users.name as seeker_name",
        "users.email as seeker_email"
      )
      .orderBy("payments.created_at", "desc");

    res.json(payouts);
  } catch (error) {
    next(error);
  }
};

export { PLATFORM_FEE_PERCENT };
