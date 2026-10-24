import express from "express";
import { randomInt } from "node:crypto";
import { pool } from "../db.js";
import { generateToken } from "../generateToken.js";
import { createOtpSchema, validateOtpSchema } from "../validation.js";

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

router.post("/otp/create", (req, res) => {
  const parsed = createOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid request body", errors: parsed.error.issues });
  }

  const { mobile_no: mobileNo } = parsed.data;
  const otp = randomInt(100000, 1000000).toString();
  otpStore.set(mobileNo, { otp, expiresAt: Date.now() + OTP_TTL_MS });


  console.log(otp);
  return res.status(200).json({ message: "otp sent" });
});

router.post("/otp/validate", async (req, res) => {
  const parsed = validateOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid request body", errors: parsed.error.issues });
  }

  const { mobile_no: mobileNo, otp } = parsed.data;
  const storedOtp = otpStore.get(mobileNo);
  if (!storedOtp) {
    return res.status(400).json({ message: "otp not found or already used" });
  }

  if (Date.now() >= storedOtp.expiresAt) {
    otpStore.delete(mobileNo);
    return res.status(400).json({ message: "otp expired" });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ message: "invalid otp" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({ message: "authentication is not configured" });
  }

  try {
    const result = await pool.query<{ id: string; mobile_no: string }>(
      `INSERT INTO users (mobile_no)
       VALUES ($1)
       ON CONFLICT (mobile_no) DO UPDATE SET mobile_no = EXCLUDED.mobile_no
       RETURNING id, mobile_no`,
      [mobileNo]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(500).json({ message: "could not authenticate user" });
    }

    const token = generateToken(user.id);
    otpStore.delete(mobileNo);
    return res.status(200).json({
      message: "otp verified",
      token,
      user: { id: user.id, mobile_no: user.mobile_no },
    });
  } catch (error) {
    console.error("Error validating OTP:", error);
    return res.status(500).json({ message: "internal server error" });
  }
});

export default router;
