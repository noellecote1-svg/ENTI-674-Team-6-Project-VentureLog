/**
 * lib/db/src/schema/conversations.ts — AI Coach Conversations Schema
 *
 * Defines the database table for AI coaching conversation sessions.
 * Each conversation is a named thread containing multiple messages
 * between the founder and the AI coach.
 *
 * Table: conversations
 *   - id: auto-incrementing integer (serial) — simpler than UUID for
 *     conversations since they don't need to be unguessable
 *   - title: set to the first 60 characters of the founder's first message,
 *     giving each conversation a meaningful label in the sidebar
 *   - createdAt: used to sort conversations newest-first in the sidebar
 *
 * Related table: messages (defined in messages.ts)
 * When a conversation is deleted, all its messages are cascade deleted.
 */

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),                       // Auto-incrementing integer ID
  title: text("title").notNull(),                      // First 60 chars of opening message
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Validation schema for creating new conversations — omits auto-generated fields
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
