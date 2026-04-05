/**
 * lib/db/src/schema/metrics.ts — Metrics Database Schema
 *
 * Defines the PostgreSQL tables for the metrics tracking feature.
 * Uses PostgreSQL native enums for classification fields to enforce
 * valid values at the database level.
 *
 * Tables:
 *
 *   metrics — defines what is being tracked (the metric itself)
 *     - class: business category (revenue, retention, engagement, unit_economics)
 *     - period: measurement frequency (daily, weekly, monthly)
 *     - direction: whether higher or lower values are favorable
 *     - formulaNumerator/Denominator: optional formula breakdown for ratio metrics
 *     - isArchived: soft delete — hides from active list but preserves history
 *
 *   metric_values — stores each individual data point logged for a metric
 *     - value: stored as decimal(20,6) for high precision financial numbers
 *     - recordedDate: the date the measurement applies to (not when it was logged)
 *     - isCorrection: flags entries that correct a previously wrong value
 *     - originalValue/correctionNote: audit trail for corrections
 *     - Cascade deletes: if a metric is deleted, all its values are too
 *
 * Key business rule enforced here: the 8-metric limit is NOT enforced
 * at the database level — it's enforced in the API route (metrics.ts).
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  decimal,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL enums — enforce valid values at the database level
// These mirror the TypeScript union types used throughout the frontend

// Business category of the metric
export const metricClassEnum = pgEnum("metric_class", [
  "revenue",
  "retention",
  "engagement",
  "unit_economics",
]);

// How often the metric is expected to be updated
export const metricPeriodEnum = pgEnum("metric_period", [
  "daily",
  "weekly",
  "monthly",
]);

// Whether going up or down is a good thing — drives UI color indicators
export const metricDirectionEnum = pgEnum("metric_direction", [
  "higher_is_better",
  "lower_is_better",
  "context_dependent",
]);

// ─── metrics table ────────────────────────────────────────────────────────────
export const metricsTable = pgTable("metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),                        // Display name (e.g. "Monthly Revenue")
  class: metricClassEnum("class").notNull(),           // Business category
  period: metricPeriodEnum("period").notNull(),        // Measurement frequency
  direction: metricDirectionEnum("direction").notNull(), // Up/down favorability
  formulaNumerator: text("formula_numerator"),         // Optional formula (e.g. "CAC")
  formulaDenominator: text("formula_denominator"),     // Optional formula (e.g. "LTV")
  isArchived: boolean("is_archived").notNull().default(false), // Soft delete
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMetricSchema = createInsertSchema(metricsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metricsTable.$inferSelect;

// ─── metric_values table ──────────────────────────────────────────────────────
export const metricValuesTable = pgTable("metric_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Foreign key: links value to its parent metric
  // Cascade: all values are deleted if the metric is deleted
  metricId: uuid("metric_id").notNull().references(() => metricsTable.id, { onDelete: "cascade" }),
  // decimal(20,6): supports large financial numbers with 6 decimal places of precision
  value: decimal("value", { precision: 20, scale: 6 }).notNull(),
  recordedDate: date("recorded_date").notNull(),       // The date this measurement applies to
  isCorrection: boolean("is_correction").notNull().default(false), // True for correction entries
  originalValue: decimal("original_value", { precision: 20, scale: 6 }), // The wrong value being corrected
  correctionNote: text("correction_note"),             // Explanation of why the correction was made
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMetricValueSchema = createInsertSchema(metricValuesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMetricValue = z.infer<typeof insertMetricValueSchema>;
export type MetricValue = typeof metricValuesTable.$inferSelect;
