import { AuthTable } from "./auth.schema";
import { IAuthRepository } from "./auth.Repository.interface";
import { db } from "../../config/db";
import { eq, and, gt } from "drizzle-orm";
import { UserTable } from "../user/user.schema";

export class AuthRepositry implements IAuthRepository {
  async findUserByEmail(email: string): Promise<any> {
    return await db.query.UserTable.findFirst({
      where: eq(UserTable.email, email),
    });
  }

  async findUserById(id: string): Promise<any> {
    return await db.query.UserTable.findFirst({
      where: eq(UserTable.id, id),
    });
  }

  async findAuthByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<any> {
    return await db.query.AuthTable.findFirst({
      where: and(
        eq(AuthTable.userId, userId),
        eq(AuthTable.provider, provider),
      ),
    });
  }

  async findAuthByProviderIdAndProvider(
    providerId: string,
    provider: string,
  ): Promise<any> {
    return await db.query.AuthTable.findFirst({
      where: and(
        eq(AuthTable.providerId, providerId),
        eq(AuthTable.provider, provider),
      ),
    });
  }

  async findAuthByResetToken(
    hashedToken: string,
    checkExpiry?: boolean,
  ): Promise<any> {
    if (checkExpiry)
      return await db.query.AuthTable.findFirst({
        where: and(
          eq(AuthTable.passwordResetToken, hashedToken),
          gt(AuthTable.passwordResetExpires, new Date()),
        ),
      });
    return await db.query.AuthTable.findFirst({
      where: eq(AuthTable.passwordResetToken, hashedToken),
    });
  }

  async updateAuthRecord(
    authId: string,
    updateData: Partial<any>,
  ): Promise<void> {
    await db.update(AuthTable).set(updateData).where(eq(AuthTable.id, authId));
  }
}


export const authRepositry = new AuthRepositry();