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

const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM"),
  companyName: z.string().optional(),
  founderName: z.string().optional(),
  additionalContext: z.string().optional(),
});

router.post("/investor-update/generate", async (req, res): Promise<void> => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body. Period must be YYYY-MM format." });
    return;
  }

  const { period, companyName, founderName, additionalContext } = parsed.data;
  const [year, month] = period.split("-").map(Number);

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);
  const prevStart = new Date(year, month - 2, 1);
  const prevEnd = new Date(year, month - 1, 0, 23, 59, 59);

  const periodStartStr = periodStart.toISOString().split("T")[0];
  const periodEndStr = periodEnd.toISOString().split("T")[0];
  const prevStartStr = prevStart.toISOString().split("T")[0];
  const prevEndStr = prevEnd.toISOString().split("T")[0];

  const monthName = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [activeMetrics, periodDecisions, periodJournalEntries] = await Promise.all([
    db
      .select()
      .from(metricsTable)
      .where(eq(metricsTable.isArchived, false)),
    db
      .select()
      .from(decisionLogItemsTable)
      .orderBy(desc(decisionLogItemsTable.createdAt)),
    db
      .select()
      .from(journalEntriesTable)
      .where(
        and(
          gte(journalEntriesTable.createdAt, periodStart),
          lte(journalEntriesTable.createdAt, periodEnd)
        )
      )
      .orderBy(desc(journalEntriesTable.createdAt)),
  ]);

  const metricsData = await Promise.all(
    activeMetrics.map(async (m) => {
      const [currentVal, prevVal] = await Promise.all([
        db
          .select()
          .from(metricValuesTable)
          .where(
            and(
              eq(metricValuesTable.metricId, m.id),
              gte(metricValuesTable.recordedDate, periodStartStr),
              lte(metricValuesTable.recordedDate, periodEndStr)
            )
          )
          .orderBy(desc(metricValuesTable.recordedDate))
          .limit(1),
        db
          .select()
          .from(metricValuesTable)
          .where(
            and(
              eq(metricValuesTable.metricId, m.id),
              gte(metricValuesTable.recordedDate, prevStartStr),
              lte(metricValuesTable.recordedDate, prevEndStr)
            )
          )
          .orderBy(desc(metricValuesTable.recordedDate))
          .limit(1),
      ]);

      const current = currentVal[0] ? parseFloat(String(currentVal[0].value)) : null;
      const previous = prevVal[0] ? parseFloat(String(prevVal[0].value)) : null;
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
        change,
      };
    })
  );

  const closedDecisions = periodDecisions.filter((d) => d.status === "closed");
  const openDecisionsList = periodDecisions.filter((d) => d.status === "open");

  const metricsSection = metricsData
    .filter((m) => m.current !== null)
    .map((m) => `- ${m.name}: ${m.current}${m.change ? ` (${m.change})` : ""}`)
    .join("\n");

  const decisionsSection = closedDecisions
    .slice(0, 5)
    .map((d) => `- ${d.title}: chose "${d.chosenOption}"${d.expectedOutcome ? `. Expected: ${d.expectedOutcome}` : ""}`)
    .join("\n");

  const openDecisionsSection = openDecisionsList
    .slice(0, 3)
    .map((d) => `- ${d.title}: ${d.contextSummary}`)
    .join("\n");

  const journalSection = periodJournalEntries
    .slice(0, 10)
    .map((e) => {
      const tags = e.tags && (e.tags as string[]).length > 0 ? `[${(e.tags as string[]).join(", ")}] ` : "";
      return `- ${tags}${e.content.slice(0, 400)}`;
    })
    .join("\n");

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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate investor update" });
  }
});

export default router;
