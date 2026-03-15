import { Resend } from "resend";
import logger from "../config/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "HouseLink <onboarding@resend.dev>";

const OTP_SUBJECTS: Record<string, string> = {
  signup: "Verify your HouseLink account",
  login: "Your HouseLink login code",
  password_reset: "Reset your HouseLink password",
};

const OTP_BODIES: Record<string, (code: string) => string> = {
  signup: (code) => `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Welcome to HouseLink</h2>
      <p>Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#f4f4f4;border-radius:8px">${code}</div>
      <p style="color:#888;font-size:12px">If you didn't create a HouseLink account, you can ignore this email.</p>
    </div>`,
  login: (code) => `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Your login code</h2>
      <p>Use this code to complete sign-in. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#f4f4f4;border-radius:8px">${code}</div>
      <p style="color:#888;font-size:12px">If you didn't try to log in, please secure your account immediately.</p>
    </div>`,
  password_reset: (code) => `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Reset your password</h2>
      <p>Use this code to reset your HouseLink password. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:24px;background:#f4f4f4;border-radius:8px">${code}</div>
      <p style="color:#888;font-size:12px">If you didn't request a password reset, you can ignore this email.</p>
    </div>`,
};

export async function sendReceiptEmail(opts: {
  seekerEmail: string;
  seekerName: string;
  ownerEmail: string;
  ownerName: string;
  propertyTitle: string;
  propertyLocation: string;
  totalAmount: number;   // naira
  ownerAmount: number;   // naira (95%)
  platformFee: number;   // naira (5%)
  reference: string;
}): Promise<void> {
  const fmt = (n: number) => `₦${Number(n).toLocaleString("en-NG")}`;

  const seekerHtml = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
      <div style="background:#4c6ef5;padding:28px 32px;border-radius:16px 16px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">Payment Receipt</h1>
        <p style="color:#c5d0ff;margin:4px 0 0;font-size:13px">HouseLink Secure Escrow</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#555;margin:0 0 24px">Hi <strong>${opts.seekerName}</strong>, your payment has been received and held securely in escrow.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8f9ff"><td style="padding:10px 14px;font-weight:600">Property</td><td style="padding:10px 14px">${opts.propertyTitle}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600">Location</td><td style="padding:10px 14px">${opts.propertyLocation}</td></tr>
          <tr style="background:#f8f9ff"><td style="padding:10px 14px;font-weight:600">Amount Paid</td><td style="padding:10px 14px;font-weight:700;color:#4c6ef5">${fmt(opts.totalAmount)}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600">Reference</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${opts.reference}</td></tr>
          <tr style="background:#f8f9ff"><td style="padding:10px 14px;font-weight:600">Status</td><td style="padding:10px 14px"><span style="background:#e6fcf5;color:#0ca678;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">Held in Escrow</span></td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#888">Funds are protected and will only be released to the owner. The owner will contact you shortly to complete the process.</p>
      </div>
    </div>`;

  const ownerHtml = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
      <div style="background:#0ca678;padding:28px 32px;border-radius:16px 16px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">Payout Notification</h1>
        <p style="color:#c3fae8;margin:4px 0 0;font-size:13px">HouseLink Secure Escrow</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#555;margin:0 0 24px">Hi <strong>${opts.ownerName}</strong>, a payment has been made for your property. Your payout is being processed to your registered account.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8f9ff"><td style="padding:10px 14px;font-weight:600">Property</td><td style="padding:10px 14px">${opts.propertyTitle}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600">Seeker</td><td style="padding:10px 14px">${opts.seekerName}</td></tr>
          <tr style="background:#f8f9ff"><td style="padding:10px 14px;font-weight:600">Total Received</td><td style="padding:10px 14px">${fmt(opts.totalAmount)}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600">Platform Fee (5%)</td><td style="padding:10px 14px;color:#e03131">−${fmt(opts.platformFee)}</td></tr>
          <tr style="background:#f8f9ff;border-top:2px solid #0ca678"><td style="padding:12px 14px;font-weight:700;font-size:15px">Your Payout</td><td style="padding:12px 14px;font-weight:700;color:#0ca678;font-size:18px">${fmt(opts.ownerAmount)}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600">Reference</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${opts.reference}</td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#888">Transfer is in progress to your registered bank account. Allow up to 24 hours for settlement.</p>
      </div>
    </div>`;

  await Promise.allSettled([
    resend.emails.send({ from: FROM, to: opts.seekerEmail, subject: `Payment Receipt — ${opts.propertyTitle}`, html: seekerHtml }),
    resend.emails.send({ from: FROM, to: opts.ownerEmail, subject: `Payout Incoming — ${opts.propertyTitle}`, html: ownerHtml }),
  ]);
}

export async function sendOtpEmail(email: string, code: string, type: string): Promise<void> {
  const subject = OTP_SUBJECTS[type] ?? "Your HouseLink code";
  const html = OTP_BODIES[type]?.(code) ?? `<p>Your code: <strong>${code}</strong></p>`;

  const { error } = await resend.emails.send({ from: FROM, to: email, subject, html });
  if (error) {
    logger.error("Resend error:", error);
    throw new Error("Failed to send OTP email");
  }
}
