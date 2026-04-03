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

export const metricClassEnum = pgEnum("metric_class", [
  "revenue",
  "retention",
  "engagement",
  "unit_economics",
]);

export const metricPeriodEnum = pgEnum("metric_period", [
  "daily",
  "weekly",
  "monthly",
]);

export const metricDirectionEnum = pgEnum("metric_direction", [
  "higher_is_better",
  "lower_is_better",
  "context_dependent",
]);

export const metricsTable = pgTable("metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  class: metricClassEnum("class").notNull(),
  period: metricPeriodEnum("period").notNull(),
  direction: metricDirectionEnum("direction").notNull(),
  formulaNumerator: text("formula_numerator"),
  formulaDenominator: text("formula_denominator"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMetricSchema = createInsertSchema(metricsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metricsTable.$inferSelect;

export const metricValuesTable = pgTable("metric_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  metricId: uuid("metric_id").notNull().references(() => metricsTable.id, { onDelete: "cascade" }),
  value: decimal("value", { precision: 20, scale: 6 }).notNull(),
  recordedDate: date("recorded_date").notNull(),
  isCorrection: boolean("is_correction").notNull().default(false),
  originalValue: decimal("original_value", { precision: 20, scale: 6 }),
  correctionNote: text("correction_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMetricValueSchema = createInsertSchema(metricValuesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMetricValue = z.infer<typeof insertMetricValueSchema>;
export type MetricValue = typeof metricValuesTable.$inferSelect;
