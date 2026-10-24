import { z } from "zod";

const mobileNoSchema = z
  .number()
  .int("mobile_no must be a whole number")
  .safe("mobile_no must be a safe integer")
  .min(10_000_000, "mobile_no must contain at least 8 digits")
  .max(999_999_999_999_999, "mobile_no must not exceed 15 digits")
  .transform(String);

export const createOtpSchema = z.object({
  mobile_no: mobileNoSchema,
});

export const validateOtpSchema = z.object({
  mobile_no: mobileNoSchema,
  otp: z
    .union([z.string(), z.number()])
    .transform((otp) => String(otp).trim())
    .pipe(z.string().regex(/^\d{6}$/, "otp must be a 6-digit code")),
});

export const createLoanSchema = z.object({
  friend_name: z.string().trim().min(1).max(100),
  amount: z
    .union([z.number(), z.string()])
    .transform((amount) => Number(amount))
    .pipe(z.number().finite().positive().max(9999999999.99)),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must use YYYY-MM-DD format")
    .refine((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
    }, "due_date must be a valid calendar date"),
});
