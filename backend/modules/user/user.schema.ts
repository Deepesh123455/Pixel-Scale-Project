import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { ImageTable } from "../imageProcessing/image.schema";
import { AuthTable } from "../auth/auth.schema";

export const UserTable = pgTable("users", {
  // 1. Fixed syntax: primaryKey() is a function
  id: uuid("id").defaultRandom().primaryKey(),

  // 2. Added length to varchar (standard practice) or use text()
  email: varchar("email", { length: 255 }).notNull().unique(),

  // 3. Removed 'as any' and ensured valid types
  name: varchar("name", { length: 256 }),

  // 4. Added precision/mode if necessary, otherwise standard timestamp is fine
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Note: I removed the extra index block (see explanation below)
export const userRelations =  relations(UserTable,({many})=>({
    images: many(ImageTable),
    authAccounts : many(AuthTable)
}))
