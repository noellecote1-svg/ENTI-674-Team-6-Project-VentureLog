import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, metricsTable, metricValuesTable, decisionLogItemsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const createMetricSchema = z.object({
  name: z.string().min(1),
  class: z.enum(["revenue", "retention", "engagement", "unit_economics"]),
  period: z.enum(["daily", "weekly", "monthly"]),
  direction: z.enum(["higher_is_better", "lower_is_better", "context_dependent"]),
  formulaNumerator: z.string().nullable().optional(),
  formulaDenominator: z.string().nullable().optional(),
});

const updateMetricSchema = z.object({
  name: z.string().min(1).optional(),
  isArchived: z.boolean().optional(),
});

const logValueSchema = z.object({
  value: z.number(),
  recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isCorrection: z.boolean().optional(),
  originalValue: z.number().nullable().optional(),
  correctionNote: z.string().nullable().optional(),
});

function serializeMetric(m: typeof metricsTable.$inferSelect, currentValue?: number | null, previousValue?: number | null, lastUpdatedAt?: Date | null) {
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
    currentValue: currentValue ?? null,
    previousValue: previousValue ?? null,
    lastUpdatedAt: lastUpdatedAt ?? null,
  };
}

router.get("/metrics", async (_req, res): Promise<void> => {
  const metrics = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false))
    .orderBy(desc(metricsTable.createdAt));

  // Fetch latest 2 values for each metric
  const result = await Promise.all(
    metrics.map(async (m) => {
      const values = await db
        .select()
        .from(metricValuesTable)
        .where(and(eq(metricValuesTable.metricId, m.id), eq(metricValuesTable.isCorrection, false)))
        .orderBy(desc(metricValuesTable.recordedDate))
        .limit(2);

      const currentValue = values[0] ? parseFloat(values[0].value) : null;
      const previousValue = values[1] ? parseFloat(values[1].value) : null;
      const lastUpdatedAt = values[0]?.createdAt ?? null;

      return serializeMetric(m, currentValue, previousValue, lastUpdatedAt);
    }),
  );

  res.json(result);
});

router.post("/metrics", async (req, res): Promise<void> => {
  // Check 8-metric limit
  const activeMetrics = await db
    .select({ id: metricsTable.id })
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false));

  if (activeMetrics.length >= 8) {
    res.status(400).json({ error: "Maximum of 8 active metrics reached. Upgrade to Pro to add more." });
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

  const values = await db
    .select()
    .from(metricValuesTable)
    .where(eq(metricValuesTable.metricId, rawId))
    .orderBy(desc(metricValuesTable.recordedDate))
    .limit(12);

  const nonCorrectionValues = values.filter((v) => !v.isCorrection);
  const currentValue = nonCorrectionValues[0] ? parseFloat(nonCorrectionValues[0].value) : null;
  const previousValue = nonCorrectionValues[1] ? parseFloat(nonCorrectionValues[1].value) : null;
  const lastUpdatedAt = nonCorrectionValues[0]?.createdAt ?? null;

  const linkedDecisions = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.linkedMetricId, rawId));

  res.json({
    metric: serializeMetric(metric, currentValue, previousValue, lastUpdatedAt),
    values: values.map((v) => ({
      id: v.id,
      metricId: v.metricId,
      value: parseFloat(v.value),
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

router.post("/metrics/:id/values", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = logValueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [metric] = await db.select().from(metricsTable).where(eq(metricsTable.id, rawId));
  if (!metric) {
    res.status(404).json({ error: "Not found" });
    return;
  }

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
    value: parseFloat(value.value),
    recordedDate: value.recordedDate,
    isCorrection: value.isCorrection,
    originalValue: value.originalValue ? parseFloat(value.originalValue) : null,
    correctionNote: value.correctionNote ?? null,
    createdAt: value.createdAt,
  });
});

export default router;
