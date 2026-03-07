import { z } from "zod";

// ============================================================================
// 1. Reusable Parameter Validator (For Image IDs)
// ============================================================================
export const imageIdParamSchema = z.object({
  params: z.object({
    imageId: z
      .string()
      .uuid({ message: "Invalid Image ID format. Must be a UUID." }),
  }),
});

// ============================================================================
// 2. Upload Request Validator
// ============================================================================
// Note: Kyunki data multipart/form-data se aayega, operations aur resizeParams
// stringified JSON honge. Hum Zod se check karwayenge ki wo valid strings hain.
export const uploadImageSchema = z.object({
  body: z.object({
    guestId: z.string().optional(),
    operations: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed); // Ensure it's an array ["grayscale", "blur"]
          } catch {
            return false;
          }
        },
        { message: "Operations must be a valid JSON array string" },
      ),

    resizeParams: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const parsed = JSON.parse(val);
            return typeof parsed === "object" && !Array.isArray(parsed); // Ensure it's an object { width: 300 }
          } catch {
            return false;
          }
        },
        { message: "Resize params must be a valid JSON object string" },
      ),
  }),
  // Headers check (Agar guestId body mein nahi, toh headers mein aana chahiye)
  headers: z
    .object({
      "x-guest-id": z.string().optional(),
    })
    .passthrough(), // .unknown() allows other valid headers to pass through
});

// ============================================================================
// 3. Claim Guest Images Validator
// ============================================================================
export const claimGuestImagesSchema = z.object({
  body: z.object({
    guestId: z
      .string()
      .min(1, { message: "Guest ID is required to claim images" }),
  }),
});



