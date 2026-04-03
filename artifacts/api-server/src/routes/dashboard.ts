import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  metricsTable,
  metricValuesTable,
  decisionLogItemsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Check if entry exists for today
  const todayEntries = await db
    .select({ id: journalEntriesTable.id })
    .from(journalEntriesTable)
    .where(
      sql`DATE(${journalEntriesTable.createdAt} AT TIME ZONE 'UTC') = ${todayStr}::date`,
    )
    .limit(1);

  const hasEntryToday = todayEntries.length > 0;

  // Build daily prompt
  let promptType: "stale_metric" | "open_decision" | "default" = "default";
  let promptMessage =
    "What is the one thing from this week you want to make sure you remember?";

  // Check for stale metrics (not updated in 5+ days)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const activeMetrics = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false));

  for (const metric of activeMetrics) {
    const latestValue = await db
      .select()
      .from(metricValuesTable)
      .where(eq(metricValuesTable.metricId, metric.id))
      .orderBy(desc(metricValuesTable.createdAt))
      .limit(1);

    if (latestValue.length === 0 || latestValue[0].createdAt < fiveDaysAgo) {
      promptType = "stale_metric";
      const lastDate = latestValue[0]
        ? latestValue[0].createdAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })
        : "never";
      promptMessage = `Your ${metric.name} has not been updated since ${lastDate}. What drove that?`;
      break;
    }
  }

  // Check for open decisions older than 7 days
  if (promptType === "default") {
    const oldOpenDecisions = await db
      .select()
      .from(decisionLogItemsTable)
      .where(
        and(
          eq(decisionLogItemsTable.status, "open"),
          eq(decisionLogItemsTable.isArchived, false),
          lte(decisionLogItemsTable.createdAt, sevenDaysAgo),
        ),
      )
      .limit(1);

    if (oldOpenDecisions.length > 0) {
      const d = oldOpenDecisions[0];
      const decisionDate = d.createdAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      promptType = "open_decision";
      promptMessage = `You logged a decision about "${d.title}" on ${decisionDate} and left it open. Any update on the outcome?`;
    }
  }

  // Top 3 metrics with sparklines (most recently updated)
  const topMetrics = await Promise.all(
    activeMetrics.slice(0, 3).map(async (m) => {
      const values = await db
        .select()
        .from(metricValuesTable)
        .where(
          and(eq(metricValuesTable.metricId, m.id), eq(metricValuesTable.isCorrection, false)),
        )
        .orderBy(desc(metricValuesTable.recordedDate))
        .limit(8);

      const current = values[0] ? parseFloat(values[0].value) : null;
      const previous = values[1] ? parseFloat(values[1].value) : null;

      const sparkline = values
        .slice()
        .reverse()
        .map((v) => ({
          date: v.recordedDate,
          value: parseFloat(v.value),
        }));

      return {
        metricId: m.id,
        metricName: m.name,
        currentValue: current,
        previousValue: previous,
        direction: m.direction,
        class: m.class,
        sparkline,
      };
    }),
  );

  // Recent decisions (3 most recent non-archived)
  const recentDecisionsRaw = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.isArchived, false))
    .orderBy(desc(decisionLogItemsTable.createdAt))
    .limit(3);

  const recentDecisions = recentDecisionsRaw.map((d) => ({
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
  }));

  // Counts
  const [journalCount] = await db
    .select({ count: count() })
    .from(journalEntriesTable);

  const [decisionCount] = await db
    .select({ count: count() })
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.isArchived, false));

  const [openDecisionCount] = await db
    .select({ count: count() })
    .from(decisionLogItemsTable)
    .where(
      and(
        eq(decisionLogItemsTable.status, "open"),
        eq(decisionLogItemsTable.isArchived, false),
      ),
    );

  res.json({
    prompt: {
      type: promptType,
      message: promptMessage,
      hasEntryToday,
    },
    topMetrics,
    recentDecisions,
    totalJournalEntries: Number(journalCount?.count ?? 0),
    totalDecisions: Number(decisionCount?.count ?? 0),
    openDecisions: Number(openDecisionCount?.count ?? 0),
  });
});

export default router;
