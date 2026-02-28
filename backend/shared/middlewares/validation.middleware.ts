import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ApiError } from "../utils/AppError";

type AnyZodSchema = z.ZodObject<any, any>;

// Flaw 4 Fix: Don't forget to EXPORT the function
export const validate = (schema: AnyZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validateData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers : req.headers
      });

      // Flaw 1 Fix: CRITICAL! Only reassign if they exist in the validated data.
      // Isse original req.query/params safe rahenge agar schema mein define nahi hain toh.
      if (validateData.body) req.body = validateData.body;
      if (validateData.query) req.query = validateData.query as any;
      if (validateData.params) req.params = validateData.params as any;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorDetails = error.issues.map((issue) => ({
          // Flaw 2 Fix: Array ko string mein convert kiya
          field: issue.path.join("."),
          message: issue.message,
        }));

        next(new ApiError("Validation Error", 400,errorDetails));
      } else {
        next(error);
      }
    }
  };
};
