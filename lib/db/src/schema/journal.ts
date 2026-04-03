import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  isPromoted: boolean("is_promoted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

export const journalSummariesTable = pgTable("journal_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  entryUpdatedAt: timestamp("entry_updated_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JournalSummary = typeof journalSummariesTable.$inferSelect;
