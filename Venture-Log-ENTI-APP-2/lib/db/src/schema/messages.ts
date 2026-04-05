/**
 * lib/db/src/schema/messages.ts — AI Coach Messages Schema
 *
 * Defines the database table for individual messages within AI coaching
 * conversations. Every exchange between the founder and the AI coach
 * is stored here permanently, enabling conversation history to persist
 * across sessions.
 *
 * Table: messages
 *   - conversationId: foreign key linking each message to its conversation
 *     Cascade delete: all messages are removed if the conversation is deleted
 *   - role: either "user" (founder's message) or "assistant" (AI response)
 *     This role field is passed directly to the OpenAI API chat format
 *   - content: the full text of the message
 *   - createdAt: used to sort messages chronologically within a conversation
 *
 * The last 30 messages per conversation are sent to OpenAI on each request
 * to maintain context while keeping API token usage manageable.
 */

import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversations } from "./conversations";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  // Foreign key: links message to its parent conversation
  // Cascade: messages are automatically deleted when the conversation is deleted
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),                        // "user" or "assistant"
  content: text("content").notNull(),                  // Full message text
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
