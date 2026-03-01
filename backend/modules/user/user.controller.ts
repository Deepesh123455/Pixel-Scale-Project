import { db } from "../../config/db";
import { UserTable } from "./user.schema";
import { AuthTable } from "../auth/auth.schema";
import { eq, and } from "drizzle-orm";
import { hash } from "bcryptjs"; // 👈 Add hashing
import { catchAsync } from "../../shared/utils/CatchAsync";
import { Request, Response } from "express";
import { ApiError } from "../../shared/utils/AppError";
import { getUserEmailById } from "./user.service";
import { FindOrCreateUserBody } from "./user.validation";



// Add providerAccountId to args
export const findOrCreateUser  = async (
  email: string,
  provider: string,
  password: string | null,
  providerAccountId?: string,
) => {
  // 🚀 OPTIMIZATION: Hash the password OUTSIDE the transaction!
  // CPU-heavy task hai, isko DB connection lock karne mat do.
  const hashedPassword = password ? await hash(password, 10) : null;

  const distinctId = providerAccountId || email;

  // Ab DB transaction ekdum light aur fast hoga
  return await db.transaction(async (tx) => {
    // 1. Find User
    const existingUser = await tx.query.UserTable.findFirst({
      where: eq(UserTable.email, email),
    });

    // =================================================
    // CASE 1: USER EXISTS
    // =================================================
    if (existingUser) {
      const authAccount = await tx.query.AuthTable.findFirst({
        where: and(
          eq(AuthTable.userId, existingUser.id),
          eq(AuthTable.provider, provider),
        ),
      });

      if (authAccount) {
        await tx
          .update(AuthTable)
          .set({ lastLogin: new Date() })
          .where(eq(AuthTable.id, authAccount.id));
      } else {
        await tx.insert(AuthTable).values({
          userId: existingUser.id,
          provider: provider,
          providerId: distinctId,
          password: hashedPassword, // 👈 Pre-hashed password use kiya
          lastLogin: new Date(),
        });
      }
      return existingUser;
    }

    // =================================================
    // CASE 2: NEW USER (SIGN UP)
    // =================================================
    const [newUser] = await tx
      .insert(UserTable)
      .values({
        email,
        name: email.split("@")[0],
      })
      .returning();

    await tx.insert(AuthTable).values({
      userId: newUser.id,
      provider: provider,
      providerId: distinctId,
      password: hashedPassword, // 👈 Pre-hashed password use kiya
      lastLogin: new Date(),
    });

    return newUser;
  });
};

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError("Unauthorized", 401);
  }

  const userEmail = await getUserEmailById(userId);

  res.status(200).json({
    success: true,
    data: {
      email: userEmail,
    },
  });
});
