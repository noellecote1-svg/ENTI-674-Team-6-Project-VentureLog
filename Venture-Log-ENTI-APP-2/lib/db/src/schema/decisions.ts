/**
 * lib/db/src/schema/decisions.ts — Decisions Database Schema
 *
 * Defines the PostgreSQL tables for the Decision Log feature.
 *
 * Tables:
 *
 *   decision_log_items — stores each strategic decision the founder logs
 *     - sourceEntryId: optional link back to the journal entry that prompted
 *       this decision (set null on delete — decision survives if entry deleted)
 *     - linkedMetricId: optional link to the metric this decision relates to
 *       (set null on delete — decision survives if metric deleted)
 *     - optionsConsidered: stored as JSONB array — preserves the full list
 *       of alternatives the founder evaluated before choosing
 *     - status: "open" (active) or "closed" (resolved) — PostgreSQL enum
 *     - hasComments: a denormalized boolean cache — set to true when the
 *       first comment is added. Avoids a COUNT query on every list view.
 *     - isArchived: soft delete — hides from active list, preserves history
 *
 *   decision_comments — threaded discussion on individual decisions
 *     - Cascade deletes: comments are deleted if their decision is deleted
 *     - authorName: plain text — no user auth yet (Phase 6)
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { journalEntriesTable } from "./journal";
import { metricsTable } from "./metrics";

// PostgreSQL enum for decision resolution status
export const decisionStatusEnum = pgEnum("decision_status", ["open", "closed"]);

// ─── decision_log_items table ─────────────────────────────────────────────────
export const decisionLogItemsTable = pgTable("decision_log_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Optional link to the journal entry that prompted this decision
  // "set null" means the decision is preserved even if the source entry is deleted
  sourceEntryId: uuid("source_entry_id").references(() => journalEntriesTable.id, {
    onDelete: "set null",
  }),
  // Optional link to a metric relevant to this decision
  // "set null" means the decision is preserved even if the metric is archived/deleted
  linkedMetricId: uuid("linked_metric_id").references(() => metricsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),                      // Short decision summary (max 120 chars)
  contextSummary: text("context_summary").notNull(),   // Why this decision was needed (max 500 chars)
  // JSONB stores the full array of options considered — preserves order and structure
  optionsConsidered: jsonb("options_considered").notNull().$type<string[]>().default([]),
  chosenOption: text("chosen_option").notNull(),       // Which option was selected
  expectedOutcome: text("expected_outcome"),           // What the founder hoped would happen
  actualOutcome: text("actual_outcome"),               // What actually happened (filled in later)
  lessonsLearned: text("lessons_learned"),             // Retrospective insights (filled in later)
  tags: text("tags").array().notNull().default([]),    // Business area tags for filtering
  status: decisionStatusEnum("status").notNull().default("open"), // Resolution state
  // Denormalized cache: true once any comment exists — avoids COUNT queries on list views
  hasComments: boolean("has_comments").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false), // Soft delete
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisionLogItemsTable).omit({
  id: true,
  createdAt: true,
  hasComments: true, // Managed by the API, not set by the user
});

export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type DecisionLogItem = typeof decisionLogItemsTable.$inferSelect;

// ─── decision_comments table ──────────────────────────────────────────────────
export const decisionCommentsTable = pgTable("decision_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Cascade: comments are automatically deleted when their parent decision is deleted
  decisionId: uuid("decision_id").notNull().references(() => decisionLogItemsTable.id, {
    onDelete: "cascade",
  }),
  authorName: text("author_name").notNull(),           // Display name — no auth yet (future Phase 6)
  content: text("content").notNull(),                  // Comment text
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionCommentSchema = createInsertSchema(decisionCommentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDecisionComment = z.infer<typeof insertDecisionCommentSchema>;
export type DecisionComment = typeof decisionCommentsTable.$inferSelect;
