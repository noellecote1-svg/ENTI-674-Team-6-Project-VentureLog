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

export const decisionStatusEnum = pgEnum("decision_status", ["open", "closed"]);

export const decisionLogItemsTable = pgTable("decision_log_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceEntryId: uuid("source_entry_id").references(() => journalEntriesTable.id, {
    onDelete: "set null",
  }),
  linkedMetricId: uuid("linked_metric_id").references(() => metricsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  contextSummary: text("context_summary").notNull(),
  optionsConsidered: jsonb("options_considered").notNull().$type<string[]>().default([]),
  chosenOption: text("chosen_option").notNull(),
  expectedOutcome: text("expected_outcome"),
  actualOutcome: text("actual_outcome"),
  lessonsLearned: text("lessons_learned"),
  tags: text("tags").array().notNull().default([]),
  status: decisionStatusEnum("status").notNull().default("open"),
  hasComments: boolean("has_comments").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisionLogItemsTable).omit({
  id: true,
  createdAt: true,
  hasComments: true,
});

export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type DecisionLogItem = typeof decisionLogItemsTable.$inferSelect;

export const decisionCommentsTable = pgTable("decision_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  decisionId: uuid("decision_id").notNull().references(() => decisionLogItemsTable.id, {
    onDelete: "cascade",
  }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionCommentSchema = createInsertSchema(decisionCommentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDecisionComment = z.infer<typeof insertDecisionCommentSchema>;
export type DecisionComment = typeof decisionCommentsTable.$inferSelect;
