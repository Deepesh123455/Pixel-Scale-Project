import { pgTable, uuid, varchar, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { UserTable } from "../user/user.schema";
import { relations } from "drizzle-orm";

export const AuthTable = pgTable(
  "auth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    userId: uuid("user_id")
      .references(() => UserTable.id, { onDelete: "cascade" })
      .notNull(),
      
    // 'email_password', 'email_otp', 'google', 'github'
    provider: varchar("provider", { length: 50 }).notNull(),
    
    // Email ID or Google Sub ID
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    
    // Nullable Password field
    password: varchar("password", { length: 255 }),

    // NEW: Store OAuth tokens or extra provider details here
    metadata: jsonb("metadata"), 

    passwordResetToken: varchar("password_reset_token", { length: 255 }),

    passwordResetExpires: timestamp("password_reset_expires"),
    
    // NEW: Track when this specific method was last used
    lastLogin: timestamp("last_login"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    
    //NEW: Standard practice for mutable tables
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      providerUniqueIdx: uniqueIndex("provider_unique_idx").on(
        table.provider,
        table.providerId
      ),
    };
  }
);

export const authRelations = relations(AuthTable, ({ one }) => ({
  user: one(UserTable, {
    fields: [AuthTable.userId],
    references: [UserTable.id],
  }),
}));