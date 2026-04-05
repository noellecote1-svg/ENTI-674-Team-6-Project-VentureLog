/**
 * routes/dashboard.ts — Dashboard Summary Endpoint
 *
 * Powers the VentureLog home screen. When a founder opens the app, this
 * endpoint is called to fetch everything needed for the dashboard in a
 * single request:
 *
 *   1. A personalized daily prompt (nudging the founder to journal or act)
 *   2. Top 3 metrics with sparkline chart data
 *   3. 3 most recent decisions
 *   4. Summary counts (total journal entries, total decisions, open decisions)
 *
 * The daily prompt is the most intelligent part — it adapts based on what
 * the founder most needs to pay attention to right now, prioritizing:
 *   stale metrics → open decisions → default reflection question
 *
 * Endpoint:
 *   GET /api/dashboard/summary
 */

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

/**
 * GET /api/dashboard/summary
 *
 * Computes and returns the full dashboard data payload.
 * This is a read-only endpoint — it never modifies data.
 */
router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // Format: "YYYY-MM-DD"
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ─── CHECK IF FOUNDER HAS JOURNALED TODAY ──────────────────────────────────
  // Used to personalize the daily prompt message
  const todayEntries = await db
    .select({ id: journalEntriesTable.id })
    .from(journalEntriesTable)
    .where(
      sql`DATE(${journalEntriesTable.createdAt} AT TIME ZONE 'UTC') = ${todayStr}::date`,
    )
    .limit(1);

  const hasEntryToday = todayEntries.length > 0;

  // ─── BUILD THE DAILY PROMPT ────────────────────────────────────────────────
  // Priority order: stale metric > open decision > default
  let promptType: "stale_metric" | "open_decision" | "default" = "default";
  let promptMessage =
    "What is the one thing from this week you want to make sure you remember?";

  // Check for metrics that haven't been updated in 5+ days
  // A stale metric suggests the founder may have lost track of a key number
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const activeMetrics = await db
    .select()
    .from(metricsTable)
    .where(eq(metricsTable.isArchived, false));

  for (const metric of activeMetrics) {
    // Get the most recent value logged for this metric
    const latestValue = await db
      .select()
      .from(metricValuesTable)
      .where(eq(metricValuesTable.metricId, metric.id))
      .orderBy(desc(metricValuesTable.createdAt))
      .limit(1);

    // If never updated, or last updated more than 5 days ago → prompt the founder
    if (latestValue.length === 0 || latestValue[0].createdAt < fiveDaysAgo) {
      promptType = "stale_metric";
      const lastDate = latestValue[0]
        ? latestValue[0].createdAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })
        : "never";
      promptMessage = `Your ${metric.name} has not been updated since ${lastDate}. What drove that?`;
      break; // Only flag one stale metric at a time
    }
  }

  // If no stale metrics, check for open decisions older than 7 days
  // Old open decisions may need a status update or outcome recorded
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

  // ─── TOP METRICS WITH SPARKLINES ──────────────────────────────────────────
  // Fetches the first 3 active metrics with last 8 data points each.
  // Used to draw small inline trend charts (sparklines) on the dashboard.
  const topMetrics = await Promise.all(
    activeMetrics.slice(0, 3).map(async (m) => {
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
        .limit(8);

      // current = most recent value, previous = second most recent (used for % change)
      const current = values[0] ? parseFloat(values[0].value) : null;
      const previous = values[1] ? parseFloat(values[1].value) : null;

      // Reverse so sparkline chart renders left-to-right (oldest → newest)
      const sparkline = values
        .slice()
        .reverse()
        .map((v) => ({
          date: v.recordedDate,
          value: parseFloat(v.value), // Drizzle returns decimals as strings — convert to number
        }));

      return {
        metricId: m.id,
        metricName: m.name,
        currentValue: current,
        previousValue: previous,
        direction: m.direction,   // "higher_is_better" | "lower_is_better" | "context_dependent"
        class: m.class,           // "revenue" | "retention" | "engagement" | "unit_economics"
        sparkline,
      };
    }),
  );

  // ─── RECENT DECISIONS ─────────────────────────────────────────────────────
  // The 3 most recently created non-archived decisions for the dashboard feed
  const recentDecisionsRaw = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.isArchived, false))
    .orderBy(desc(decisionLogItemsTable.createdAt))
    .limit(3);

  const recentDecisions = recentDecisionsRaw.map((d) => ({
    id: d.id,
    sourceEntryId: d.sourceEntryId ?? null,       // Journal entry this decision came from (if any)
    linkedMetricId: d.linkedMetricId ?? null,     // Metric this decision relates to (if any)
    linkedMetricName: null,                        // Not resolved here for performance
    title: d.title,
    contextSummary: d.contextSummary,
    optionsConsidered: d.optionsConsidered as string[],
    chosenOption: d.chosenOption,
    expectedOutcome: d.expectedOutcome ?? null,
    actualOutcome: d.actualOutcome ?? null,
    lessonsLearned: d.lessonsLearned ?? null,
    tags: d.tags,
    status: d.status,                              // "open" | "closed"
    hasComments: d.hasComments,
    isArchived: d.isArchived,
    createdAt: d.createdAt,
  }));

  // ─── SUMMARY COUNTS ───────────────────────────────────────────────────────
  // Aggregate stats displayed as numbers on the dashboard

  // Total journal entries ever written
  const [journalCount] = await db
    .select({ count: count() })
    .from(journalEntriesTable);

  // Total non-archived decisions
  const [decisionCount] = await db
    .select({ count: count() })
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.isArchived, false));

  // Total open (unresolved) decisions — key accountability metric for founders
  const [openDecisionCount] = await db
    .select({ count: count() })
    .from(decisionLogItemsTable)
    .where(
      and(
        eq(decisionLogItemsTable.status, "open"),
        eq(decisionLogItemsTable.isArchived, false),
      ),
    );

  // ─── SEND RESPONSE ────────────────────────────────────────────────────────
  res.json({
    prompt: {
      type: promptType,       // "stale_metric" | "open_decision" | "default"
      message: promptMessage, // The actual text shown to the founder
      hasEntryToday,          // Whether the founder has already journaled today
    },
    topMetrics,
    recentDecisions,
    totalJournalEntries: Number(journalCount?.count ?? 0),
    totalDecisions: Number(decisionCount?.count ?? 0),
    openDecisions: Number(openDecisionCount?.count ?? 0),
  });
});

export default router;
