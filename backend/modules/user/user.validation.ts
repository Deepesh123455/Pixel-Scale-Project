import { z } from "zod";

export const findOrCreateUserSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email is required" })
      .email("Invalid email format"),
    
    // ✅ FIX 1: z.enum sirf `message` accept karta hai
    provider: z.enum(["email_password", "email_otp", "google"], {
      message: "Provider must be exactly: email_password, email_otp, or google",
    }),
    
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password is too long")
      .nullable()
      .optional(),
      
    providerAccountId: z.string().optional().nullable(),
  })
}).refine(
  (data) => {
    // ✅ FIX 2: "data.body.provider" aur "data.body.password" use karna hoga
    if (data.body.provider === "email_password" && (!data.body.password || data.body.password.trim() === "")) {
      return false;
    }
    return true;
  },
  {
    message: "Password is strictly required when using email_password provider",
    // ✅ FIX 2b: Path ko bhi update karna hoga taaki error exactly password field par aaye
    path: ["body", "password"], 
  }
);

// ✅ Type extraction ekdum sahi chalega ab
export type FindOrCreateUserBody = z.infer<typeof findOrCreateUserSchema>["body"];