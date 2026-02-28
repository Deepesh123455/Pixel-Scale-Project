import { db } from "../../config/db";
import { UserTable } from "./user.schema";
import { AuthTable } from "../auth/auth.schema";
import { eq, and } from "drizzle-orm";
import { hash } from "bcryptjs"; // 👈 Add hashing

// Add providerAccountId to args
export const findOrCreateUser = async (
  email: string,
  provider: string,
  password: string | null,
  providerAccountId?: string, // 👈 Optional: Use email if this is missing
) => {
  return await db.transaction(async (tx) => {
    // Use the passed ID, or fallback to email (for OTP/Password login)
    const distinctId = providerAccountId || email;

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
        // Hash password if one is provided
        const hashedPassword = password ? await hash(password, 10) : null;

        await tx.insert(AuthTable).values({
          userId: existingUser.id,
          provider: provider,
          providerId: distinctId, // 👈 Uses correct ID
          password: hashedPassword, // 👈 Secure
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
        name: email.split("@")[0], // Suggestion: Pass 'name' as arg if available
      })
      .returning();

    const hashedPassword = password ? await hash(password, 10) : null;

    await tx.insert(AuthTable).values({
      userId: newUser.id,
      provider: provider,
      providerId: distinctId,
      password: hashedPassword,
      lastLogin: new Date(),
    });

    return newUser;
  });
};

