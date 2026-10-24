import { z } from "zod";
export declare const createOtpSchema: z.ZodObject<{
    mobile_no: z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>;
}, z.core.$strip>;
export declare const validateOtpSchema: z.ZodObject<{
    mobile_no: z.ZodPipe<z.ZodNumber, z.ZodTransform<string, number>>;
    otp: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>, z.ZodString>;
}, z.core.$strip>;
export declare const createLoanSchema: z.ZodObject<{
    friend_name: z.ZodString;
    amount: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>;
    due_date: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=validation.d.ts.map