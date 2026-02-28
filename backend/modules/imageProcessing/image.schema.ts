import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { UserTable } from "../user/user.schema";
import { relations } from "drizzle-orm";

export const ImageTable = pgTable(
  "images",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 1. Removed .notNull() so Guests can upload
    user_id: uuid("user_id").references(() => UserTable.id, {
      onDelete: "cascade",
    }),

    // 2. Added guest_id for non-logged-in users
    guest_id: varchar("guest_id", { length: 255 }),

    originalName: varchar("original_name", { length: 255 }).notNull(),

    operationsUsed: jsonb("operations_used").$type<string[]>(),

    previewS3Key: varchar("preview_s3_key", { length: 500 }).notNull(),

    hdS3Key: varchar("hd_s3_key", { length: 500 }).notNull(),

    size: integer("size_kb").notNull(),

    // 3. Added status to track BullMQ background job progress
    status: varchar("status", { length: 50 }).default("pending").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      // Indexes banaye hain taaki queries (fetching gallery) lightning fast hon
      user_id_index: index("user_id_index").on(table.user_id),
      guest_id_index: index("guest_id_index").on(table.guest_id),
    };
  },
);

export const imageRelations = relations(ImageTable, ({ one }) => ({
  author: one(UserTable, {
    fields: [ImageTable.user_id],
    references: [UserTable.id],
  }),
}));
