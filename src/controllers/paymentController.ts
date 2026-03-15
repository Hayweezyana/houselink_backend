import { Request, Response, NextFunction } from "express";
import db from "../config/db";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export const initializePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { property_id, amount, email } = req.body;
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
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
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
    });

    res.json({ message: "Payment initialized", data: response.data });
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
    const { reference } = req.query;
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
