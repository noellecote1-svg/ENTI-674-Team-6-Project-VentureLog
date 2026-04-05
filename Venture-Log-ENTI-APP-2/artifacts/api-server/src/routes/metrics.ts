/**
 * routes/metrics.ts — Business Metrics API Routes
 *
 * Handles all operations for tracking startup business metrics.
 * Founders define metrics (e.g. "Monthly Revenue", "Churn Rate") and
 * log values over time to track trends. Each metric can be visualized
 * as a sparkline chart and linked to relevant decisions.
 *
 * Key business rule: Maximum 8 active metrics per account.
 * This limit is enforced in the POST /metrics route and is designed
 * to keep founders focused — a future Pro tier will raise this cap.
 *
 * Endpoints:
 *   GET    /api/metrics              → List all active metrics (with latest values)
 *   POST   /api/metrics              → Create a new metric (max 8 enforced)
 *   GET    /api/metrics/:id          → Get one metric with full value history
 *   PATCH  /api/metrics/:id          → Update metric name or archive it
 *   POST   /api/metrics/:id/values   → Log a new data point for a metric
 */

import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, metricsTable, metricValuesTable, decisionLogItemsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────────

/**
 * Schema for creating a new metric.
 * - name: Display name (e.g. "Monthly Recurring Revenue")
 * - class: Business category — revenue, retention, engagement, or unit_economics
 * - period: How often it's measured — daily, weekly, or monthly
 * - direction: Whether higher or lower values are better (drives UI trend indicators)
 * - formulaNumerator/Denominator: Optional formula breakdown (e.g. "Revenue" / "Customers")
 */
const createMetricSchema = z.object({
  name: z.string().min(1),
  class: z.enum(["revenue", "retention", "engagement", "unit_economics"]),
  period: z.enum(["daily", "weekly", "monthly"]),
  direction: z.enum(["higher_is_better", "lower_is_better", "context_dependent"]),
  formulaNumerator: z.string().nullable().optional(),
  formulaDenominator: z.string().nullable().optional(),
});

/**
 * Schema for updating a metric.
 * Only name and archived status can be changed after creation.
 * Archiving is the preferred way to "remove" a metric — it hides it
 * while preserving all historical data.
 */
const updateMetricSchema = z.object({
  name: z.string().min(1).optional(),
  isArchived: z.boolean().optional(),
});

/**
 * Schema for logging a new metric value (data point).
 * - value: The numeric measurement
 * - recordedDate: The date this measurement applies to (must be YYYY-MM-DD)
 * - isCorrection: If true, this corrects a previously logged wrong value
 * - originalValue/correctionNote: Audit trail for corrections
 */
const logValueSchema = z.object({
  value: z.number(),
  recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Enforce YYYY-MM-DD format
  isCorrection: z.boolean().optional(),
  originalValue: z.number().nullable().optional(),
  correctionNote: z.string().nullable().optional(),
});

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * serializeMetric()
 * Converts a raw database metric row into the clean API response format.
 * Accepts optional current/previous values and last updated timestamp
 * which are fetched separately and passed in.
 *
 * Note: Drizzle ORM returns decimal values as strings from PostgreSQL,
 * so numeric values must be pre-parsed as floats before being passed in.
 */
function serializeMetric(
  m: typeof metricsTable.$inferSelect,
  currentValue?: number | null,
  previousValue?: number | null,
  lastUpdatedAt?: Date | null,
) {
  return {
    id: m.id,
    name: m.name,
    class: m.class,
    period: m.period,
    direction: m.direction,
    formulaNumerator: m.formulaNumerator ?? null,
    formulaDenominator: m.formulaDenominator ?? null,
    isArchived: m.isArchived,
    createdAt: m.createdAt,
    currentValue: currentValue ?? null,     // Most recent logged value
    previousValue: previousValue ?? null,   // Second most recent (for % change display)
    lastUpdatedAt: lastUpdatedAt ?? null,   // When the last value was recorded
  };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/metrics
 * Returns all active (non-archived) metrics, newest first.
 * Each metric includes its two most recent values for percent-change display.
 */
router.get("/metrics", async (_req, res): Promise<void> => {
  const metrics = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false))
    .orderBy(desc(metricsTable.createdAt));

  // For each metric, fetch its two most recent non-correction values
  const result = await Promise.all(
    metrics.map(async (m) => {
      const values = await db
        .select()
        .from(metricValuesTable)
        .where(
          and(
            eq(metricValuesTable.metricId, m.id),
            eq(metricValuesTable.isCorrection, false), // Exclude correction entries
          ),
        )
        .orderBy(desc(metricValuesTable.recordedDate))
        .limit(2); // Only need 2: current and previous for % change

      // Parse from string to float (Drizzle/PostgreSQL returns decimals as strings)
      const currentValue = values[0] ? parseFloat(values[0].value) : null;
      const previousValue = values[1] ? parseFloat(values[1].value) : null;
      const lastUpdatedAt = values[0]?.createdAt ?? null;

      return serializeMetric(m, currentValue, previousValue, lastUpdatedAt);
    }),
  );

  res.json(result);
});

/**
 * POST /api/metrics
 * Creates a new metric after enforcing the 8-metric active limit.
 *
 * Request body: { name, class, period, direction, formulaNumerator?, formulaDenominator? }
 * Response: The newly created metric (201 Created)
 */
router.post("/metrics", async (req, res): Promise<void> => {
  // ── Enforce the 8-metric business rule ────────────────────────────────────
  // This keeps founders focused and is the trigger for a future Pro upgrade
  const activeMetrics = await db
    .select({ id: metricsTable.id })
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false));

  if (activeMetrics.length >= 8) {
    res.status(400).json({
      error: "Maximum of 8 active metrics reached. Upgrade to Pro to add more.",
    });
    return;
  }

  const parsed = createMetricSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [metric] = await db
    .insert(metricsTable)
    .values({
      name: parsed.data.name,
      class: parsed.data.class,
      period: parsed.data.period,
      direction: parsed.data.direction,
      formulaNumerator: parsed.data.formulaNumerator ?? null,
      formulaDenominator: parsed.data.formulaDenominator ?? null,
    })
    .returning();

  res.status(201).json(serializeMetric(metric, null, null, null));
});

/**
 * GET /api/metrics/:id
 * Returns a single metric with its full value history (up to 12 data points)
 * and any decisions that are linked to this metric.
 *
 * Response: { metric, values[], linkedDecisions[] }
 */
router.get("/metrics/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const [metric] = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.id, rawId));

  if (!metric) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Fetch up to 12 most recent values for the chart display
  const values = await db
    .select()
    .from(metricValuesTable)
    .where(eq(metricValuesTable.metricId, rawId))
    .orderBy(desc(metricValuesTable.recordedDate))
    .limit(12);

  // Filter out corrections to find the "real" current and previous values
  const nonCorrectionValues = values.filter((v) => !v.isCorrection);
  const currentValue = nonCorrectionValues[0] ? parseFloat(nonCorrectionValues[0].value) : null;
  const previousValue = nonCorrectionValues[1] ? parseFloat(nonCorrectionValues[1].value) : null;
  const lastUpdatedAt = nonCorrectionValues[0]?.createdAt ?? null;

  // Fetch decisions that reference this metric — shows the founder
  // which strategic choices were influenced by this number
  const linkedDecisions = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.linkedMetricId, rawId));

  res.json({
    metric: serializeMetric(metric, currentValue, previousValue, lastUpdatedAt),
    // Return all values including corrections for full chart history
    values: values.map((v) => ({
      id: v.id,
      metricId: v.metricId,
      value: parseFloat(v.value),           // Convert string → number
      recordedDate: v.recordedDate,
      isCorrection: v.isCorrection,
      originalValue: v.originalValue ? parseFloat(v.originalValue) : null,
      correctionNote: v.correctionNote ?? null,
      createdAt: v.createdAt,
    })),
    linkedDecisions: linkedDecisions.map((d) => ({
      id: d.id,
      sourceEntryId: d.sourceEntryId ?? null,
      linkedMetricId: d.linkedMetricId ?? null,
      linkedMetricName: null,
      title: d.title,
      contextSummary: d.contextSummary,
      optionsConsidered: d.optionsConsidered as string[],
      chosenOption: d.chosenOption,
      expectedOutcome: d.expectedOutcome ?? null,
      actualOutcome: d.actualOutcome ?? null,
      lessonsLearned: d.lessonsLearned ?? null,
      tags: d.tags,
      status: d.status,
      hasComments: d.hasComments,
      isArchived: d.isArchived,
      createdAt: d.createdAt,
    })),
  });
});

/**
 * PATCH /api/metrics/:id
 * Updates a metric's name or archives it.
 * Archiving is preferred over deletion — it removes the metric from
 * active views while keeping all historical data intact.
 */
router.patch("/metrics/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = updateMetricSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [metric] = await db
    .update(metricsTable)
    .set(parsed.data)
    .where(eq(metricsTable.id, rawId))
    .returning();

  if (!metric) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(serializeMetric(metric, null, null, null));
});

/**
 * POST /api/metrics/:id/values
 * Logs a new data point for an existing metric.
 *
 * Supports corrections: if isCorrection is true, the entry records both
 * the corrected value and the original wrong value with an explanatory note.
 * Correction entries are excluded from chart displays but kept for auditing.
 *
 * Request body: { value, recordedDate, isCorrection?, originalValue?, correctionNote? }
 * Response: The newly logged value (201 Created)
 */
router.post("/metrics/:id/values", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = logValueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify the parent metric exists before logging a value
  const [metric] = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.id, rawId));

  if (!metric) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Store value as a string — PostgreSQL numeric columns require string input via Drizzle
  const [value] = await db
    .insert(metricValuesTable)
    .values({
      metricId: rawId,
      value: parsed.data.value.toString(),
      recordedDate: parsed.data.recordedDate,
      isCorrection: parsed.data.isCorrection ?? false,
      originalValue: parsed.data.originalValue?.toString() ?? null,
      correctionNote: parsed.data.correctionNote ?? null,
    })
    .returning();

  res.status(201).json({
    id: value.id,
    metricId: value.metricId,
    value: parseFloat(value.value),   // Convert back to number for the response
    recordedDate: value.recordedDate,
    isCorrection: value.isCorrection,
    originalValue: value.originalValue ? parseFloat(value.originalValue) : null,
    correctionNote: value.correctionNote ?? null,
    createdAt: value.createdAt,
  });
});

export default router;
