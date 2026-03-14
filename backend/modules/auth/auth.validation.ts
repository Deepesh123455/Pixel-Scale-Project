import { z } from "zod";

// Shared Password Rules (DRY Principle) 
const passwordRules = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters long")
  .max(64, "Password must be at most 64 characters long")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /\d/.test(val), {
    message: "Password must contain at least one number",
  })
  .refine((val) => /[\W_]/.test(val), {
    message: "Password must contain at least one special character (!@#$%^&*)",
  });

//Schemas

export const sendOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .toLowerCase()
      .email("Please enter a valid email address"),
  }),
});

export const verifySchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .toLowerCase()
      .email("Please enter a valid email address"),
    otp: z
      .string()
      .trim()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^[0-9]+$/, "OTP must contain only numbers"),
  }),
});

export const loginViaPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Please enter a valid email address")
      .toLowerCase(),
    password: z.string().trim().min(1, "Password is required"),
  }),
});

export const signUpViaPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Please enter a valid email address")
      .toLowerCase()
      .max(255),
    password: passwordRules,
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Please enter a valid email address")
      .toLowerCase(),
  }),
});

// UPDATED: Handling Tokens in Params OR Body 
export const verifyResetTokenSchema = z
  .object({
    params: z
      .object({
        token: z.string().trim().optional(),
      })
      .optional(),
    body: z
      .object({
        token: z.string().trim().optional(),
      })
      .optional(),
  })
  .refine((data) => data.params?.token || data?.body?.token, {
    message: "Token must be provided in the URL or the request body",
    path: ["params", "token"],
  });

// UPDATED: Handling Tokens in Params OR Body 
export const resetPasswordSchema = z
  .object({
    params: z
      .object({
        token: z.string().trim().optional(),
      })
      .optional(),
    body: z.object({
      token: z.string().trim().optional(),
      password: passwordRules,
    }),
  })
  .refine((data) => data.params?.token || data.body?.token, {
    message: "Token must be provided in the URL or the request body",
    path: ["body", "token"],
  });

export const updatePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().trim().min(1, "Current password is required"),
      newPassword: passwordRules,
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: "New password must be different from the current password",
      path: ["newPassword"],
    }),
});

// NEW: Google Login Schema 
export const googleLoginSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, "Google ID token is required"),
  }),
});

// Types 
export type SendOtpType = z.infer<typeof sendOtpSchema>["body"];
export type VerifyType = z.infer<typeof verifySchema>["body"];
export type LoginViaPasswordType = z.infer<
  typeof loginViaPasswordSchema
>["body"];
export type SignUpViaPasswordType = z.infer<
  typeof signUpViaPasswordSchema
>["body"];
export type ForgotPasswordType = z.infer<typeof forgotPasswordSchema>["body"];
// Note: Types for reset tokens now depend on your exact needs, but generally you extract the body
export type ResetPasswordType = z.infer<typeof resetPasswordSchema>["body"];
export type UpdatePasswordType = z.infer<typeof updatePasswordSchema>["body"];
export type GoogleLoginType = z.infer<typeof googleLoginSchema>["body"];
