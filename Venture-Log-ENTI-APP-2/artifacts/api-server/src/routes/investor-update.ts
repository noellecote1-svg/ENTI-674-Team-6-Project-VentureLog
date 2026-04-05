/**
 * routes/investor-update.ts — AI Investor Update Generator
 *
 * Powers VentureLog's Investor Update feature — one of the most valuable
 * tools in the app. Instead of staring at a blank page, founders can
 * generate a professional, data-driven investor update in seconds by
 * clicking a button.
 *
 * The AI reads all of the founder's VentureLog data for a given month
 * (metrics, decisions, journal entries) and produces a structured update
 * in the format used by YC-backed founders — complete with real numbers,
 * honest highlights AND lowlights, and a clear ask section.
 *
 * This is a significant competitive differentiator for VentureLog:
 * it turns the founder's ongoing journaling habit into a tangible,
 * investor-ready deliverable with zero extra effort.
 *
 * Endpoint:
 *   POST /api/investor-update/generate
 *
 * Request body:
 *   {
 *     period: "YYYY-MM",              // The month to generate the update for
 *     companyName?: string,           // Optional — personalizes the header
 *     founderName?: string,           // Optional — personalizes the header
 *     additionalContext?: string      // Optional — any extra context to include
 *   }
 *
 * Response:
 *   { content: string }              // The full markdown investor update
 */

import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  metricsTable,
  metricValuesTable,
  decisionLogItemsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────

/**
 * Schema for the investor update generation request.
 * - period: The month in YYYY-MM format (e.g. "2024-03" for March 2024)
 * - companyName: Optional startup name for the update header
 * - founderName: Optional founder name for personalization
 * - additionalContext: Any extra details the founder wants the AI to include
 */
const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM"),
  companyName: z.string().optional(),
  founderName: z.string().optional(),
  additionalContext: z.string().optional(),
});

// ─── ROUTE ────────────────────────────────────────────────────────────────────

/**
 * POST /api/investor-update/generate
 *
 * Generates a complete investor update for the specified month.
 *
 * Process:
 *   1. Validate and parse the request (period, optional company/founder name)
 *   2. Calculate date ranges for the current and previous months
 *   3. Fetch all relevant data: metrics, decisions, journal entries
 *   4. For each metric, calculate month-over-month percentage change
 *   5. Format all data into a structured prompt
 *   6. Send to OpenAI and return the generated update
 */
router.post("/investor-update/generate", async (req, res): Promise<void> => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body. Period must be YYYY-MM format." });
    return;
  }

  const { period, companyName, founderName, additionalContext } = parsed.data;

  // ─── DATE RANGE CALCULATION ──────────────────────────────────────────────────
  // Calculate exact date boundaries for both the current period and the
  // previous month (needed for month-over-month metric comparisons)
  const [year, month] = period.split("-").map(Number);

  const periodStart = new Date(year, month - 1, 1);               // First day of target month
  const periodEnd = new Date(year, month, 0, 23, 59, 59);         // Last day of target month
  const prevStart = new Date(year, month - 2, 1);                 // First day of previous month
  const prevEnd = new Date(year, month - 1, 0, 23, 59, 59);      // Last day of previous month

  // String versions for database date comparisons
  const periodStartStr = periodStart.toISOString().split("T")[0];
  const periodEndStr = periodEnd.toISOString().split("T")[0];
  const prevStartStr = prevStart.toISOString().split("T")[0];
  const prevEndStr = prevEnd.toISOString().split("T")[0];

  // Human-readable month name for the update header (e.g. "March 2024")
  const monthName = periodStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ─── FETCH DATA ──────────────────────────────────────────────────────────────
  // Fetch metrics, decisions, and journal entries in parallel for efficiency
  const [activeMetrics, periodDecisions, periodJournalEntries] = await Promise.all([
    // All active metrics (not archived)
    db
      .select()
      .from(metricsTable)
      .where(eq(metricsTable.isArchived, false)),
    // All decisions (not filtered by date — the AI will use what's relevant)
    db
      .select()
      .from(decisionLogItemsTable)
      .orderBy(desc(decisionLogItemsTable.createdAt)),
    // Journal entries written during the target month
    db
      .select()
      .from(journalEntriesTable)
      .where(
        and(
          gte(journalEntriesTable.createdAt, periodStart),
          lte(journalEntriesTable.createdAt, periodEnd),
        ),
      )
      .orderBy(desc(journalEntriesTable.createdAt)),
  ]);

  // ─── METRIC MoM CALCULATIONS ─────────────────────────────────────────────────
  // For each metric, fetch the most recent value in both this month and last month
  // to calculate month-over-month (MoM) percentage change
  const metricsData = await Promise.all(
    activeMetrics.map(async (m) => {
      const [currentVal, prevVal] = await Promise.all([
        // Most recent value recorded during the target month
        db
          .select()
          .from(metricValuesTable)
          .where(
            and(
              eq(metricValuesTable.metricId, m.id),
              gte(metricValuesTable.recordedDate, periodStartStr),
              lte(metricValuesTable.recordedDate, periodEndStr),
            ),
          )
          .orderBy(desc(metricValuesTable.recordedDate))
          .limit(1),
        // Most recent value recorded during the previous month
        db
          .select()
          .from(metricValuesTable)
          .where(
            and(
              eq(metricValuesTable.metricId, m.id),
              gte(metricValuesTable.recordedDate, prevStartStr),
              lte(metricValuesTable.recordedDate, prevEndStr),
            ),
          )
          .orderBy(desc(metricValuesTable.recordedDate))
          .limit(1),
      ]);

      const current = currentVal[0] ? parseFloat(String(currentVal[0].value)) : null;
      const previous = prevVal[0] ? parseFloat(String(prevVal[0].value)) : null;

      // Calculate percentage change (e.g. "+12.5% MoM" or "-3.2% MoM")
      // Guard against division by zero if previous value was 0
      let change: string | null = null;
      if (current !== null && previous !== null && previous !== 0) {
        const pct = ((current - previous) / Math.abs(previous)) * 100;
        change = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% MoM`;
      }

      return {
        name: m.name,
        class: m.class,
        direction: m.direction,
        current,
        previous,
        change, // Formatted string like "+12.5% MoM" or null if can't calculate
      };
    }),
  );

  // ─── FORMAT DATA FOR THE PROMPT ──────────────────────────────────────────────
  // Transform raw data into structured text sections for the AI prompt

  // Separate decisions into closed (made this period) and still open
  const closedDecisions = periodDecisions.filter((d) => d.status === "closed");
  const openDecisionsList = periodDecisions.filter((d) => d.status === "open");

  // Format metrics as bullet points with MoM changes
  const metricsSection = metricsData
    .filter((m) => m.current !== null) // Only include metrics that have data this period
    .map((m) => `- ${m.name}: ${m.current}${m.change ? ` (${m.change})` : ""}`)
    .join("\n");

  // Format top 5 closed decisions with their chosen option and expected outcome
  const decisionsSection = closedDecisions
    .slice(0, 5)
    .map(
      (d) =>
        `- ${d.title}: chose "${d.chosenOption}"${d.expectedOutcome ? `. Expected: ${d.expectedOutcome}` : ""}`,
    )
    .join("\n");

  // Format top 3 open decisions — investor visibility into pending choices
  const openDecisionsSection = openDecisionsList
    .slice(0, 3)
    .map((d) => `- ${d.title}: ${d.contextSummary}`)
    .join("\n");

  // Format recent journal entries — gives AI color and narrative context
  // Truncated to 400 chars each to keep the prompt size manageable
  const journalSection = periodJournalEntries
    .slice(0, 10)
    .map((e) => {
      const tags =
        e.tags && (e.tags as string[]).length > 0
          ? `[${(e.tags as string[]).join(", ")}] `
          : "";
      return `- ${tags}${e.content.slice(0, 400)}`;
    })
    .join("\n");

  // ─── AI PROMPT ───────────────────────────────────────────────────────────────
  /**
   * The prompt is carefully structured to produce a professional investor update
   * in the standard format used by YC-backed startups. Key design decisions:
   *
   * - Explicit format with section headers ensures consistent output structure
   * - "Honest, confident, specific — no vague statements" prevents generic filler
   * - Lowlights section is explicitly required — real investors appreciate honesty
   * - "Write only the update" prevents AI preamble/commentary cluttering the output
   */
  const prompt = `You are helping a founder write a professional investor update for ${monthName}.

${companyName ? `Company: ${companyName}` : ""}
${founderName ? `Founder: ${founderName}` : ""}

Here is the raw data from their VentureLog:

**METRICS (${monthName}):**
${metricsSection || "No metrics logged this period."}

**DECISIONS MADE THIS PERIOD:**
${decisionsSection || "No closed decisions this period."}

**OPEN DECISIONS:**
${openDecisionsSection || "None."}

**JOURNAL ENTRIES (this period):**
${journalSection || "No journal entries this period."}

${additionalContext ? `**ADDITIONAL CONTEXT FROM FOUNDER:**\n${additionalContext}` : ""}

Write a professional investor update in the standard format used by YC-backed founders. Use the data above to populate it with real numbers and insights. The tone should be honest, confident, and specific — no vague statements.

Structure:
## ${monthName} Investor Update${companyName ? ` — ${companyName}` : ""}

**TL;DR** — 2-3 sentence summary of the month.

**Metrics**
Key numbers with MoM changes where available.

**Highlights**
3-5 bullet points: wins, milestones, momentum.

**Lowlights**
2-3 bullet points: honest challenges or misses. Do not skip this section.

**Decisions Made**
Key calls made this month and rationale.

**Focus for Next Month**
2-3 priorities.

**Ask**
Any specific help or introductions needed from investors. If no data available, leave a placeholder: [Add any asks here].

Write only the update. Do not add commentary before or after it.`;

  // ─── CALL OPENAI AND RETURN ──────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",            // Latest capable model for professional writing quality
      max_completion_tokens: 8192, // Generous limit — investor updates can be detailed
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    res.json({ content }); // Return the generated markdown update
  } catch (err) {
    res.status(500).json({ error: "Failed to generate investor update" });
  }
});

export default router;
