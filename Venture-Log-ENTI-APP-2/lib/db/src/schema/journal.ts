/**
 * lib/db/src/schema/journal.ts — Journal Database Schema
 *
 * Defines the PostgreSQL tables for the journal feature using Drizzle ORM.
 * These table definitions are the single source of truth for the database
 * structure — Drizzle generates migrations and TypeScript types from them.
 *
 * Tables:
 *
 *   journal_entries — stores each founder journal entry
 *     - id: UUID primary key (auto-generated, not sequential for security)
 *     - content: full markdown text of the entry
 *     - tags: PostgreSQL text array of up to 7 predefined tags
 *     - isPromoted: true if this entry was converted to a decision log item
 *     - createdAt / updatedAt: timestamps with timezone for accurate sorting
 *
 *   journal_summaries — stores AI-generated summaries of journal entries
 *     - One summary per entry (old summaries are replaced when entry is edited)
 *     - summary: the 2-3 sentence AI-generated summary text
 *     - entryUpdatedAt: tracks which version of the entry was summarized
 *     - Cascade deletes: if the journal entry is deleted, its summary is too
 *     - Used by the AI Coach to understand the founder's recent thinking
 */

import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// The 7 fixed tag categories — enforced at both DB and API level
export const JOURNAL_TAGS = [
  "Product",
  "Growth",
  "Team",
  "Fundraising",
  "Operations",
  "Finance",
  "Reflection",
] as const;

export type JournalTag = (typeof JOURNAL_TAGS)[number];

// ─── journal_entries table ────────────────────────────────────────────────────
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),         // UUID avoids sequential ID enumeration
  content: text("content").notNull().default(""),      // Markdown text, can be empty draft
  tags: text("tags").array().notNull().default([]),    // PostgreSQL native text array
  isPromoted: boolean("is_promoted").notNull().default(false), // True once promoted to decision log
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Zod validation schema for inserting new entries — omits auto-generated fields
export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

// ─── journal_summaries table ──────────────────────────────────────────────────
export const journalSummariesTable = pgTable("journal_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Foreign key: links summary to its source entry
  // onDelete cascade: summary is automatically deleted if the entry is deleted
  entryId: uuid("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),                  // AI-generated 2-3 sentence summary
  entryUpdatedAt: timestamp("entry_updated_at", { withTimezone: true }).notNull(), // Version tracking
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JournalSummary = typeof journalSummariesTable.$inferSelect;
