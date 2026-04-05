import { Router, type IRouter } from "express";
import { eq, desc, asc } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  journalEntriesTable,
  metricsTable,
  metricValuesTable,
  decisionLogItemsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router: IRouter = Router();

const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

async function buildFounderContext(): Promise<string> {
  const [recentEntries, activeMetrics, openDecisions] = await Promise.all([
    db
      .select()
      .from(journalEntriesTable)
      .orderBy(desc(journalEntriesTable.createdAt))
      .limit(8),
    db
      .select()
      .from(metricsTable)
      .where(eq(metricsTable.isArchived, false))
      .limit(8),
    db
      .select()
      .from(decisionLogItemsTable)
      .where(eq(decisionLogItemsTable.status, "open"))
      .orderBy(desc(decisionLogItemsTable.createdAt))
      .limit(5),
  ]);

  const metricsWithValues = await Promise.all(
    activeMetrics.map(async (m) => {
      const latestValue = await db
        .select()
        .from(metricValuesTable)
        .where(eq(metricValuesTable.metricId, m.id))
        .orderBy(desc(metricValuesTable.recordedDate))
        .limit(1);
      return {
        name: m.name,
        class: m.class,
        direction: m.direction,
        currentValue: latestValue[0] ? parseFloat(String(latestValue[0].value)) : null,
        recordedDate: latestValue[0]?.recordedDate ?? null,
      };
    })
  );

  const contextLines: string[] = [];

  if (metricsWithValues.length > 0) {
    contextLines.push("## Current Metrics");
    for (const m of metricsWithValues) {
      const val = m.currentValue !== null ? m.currentValue.toString() : "no data yet";
      contextLines.push(`- ${m.name} (${m.class}): ${val}${m.recordedDate ? ` as of ${m.recordedDate}` : ""}`);
    }
  }

  if (openDecisions.length > 0) {
    contextLines.push("\n## Open Decisions");
    for (const d of openDecisions) {
      contextLines.push(`- ${d.title}: ${d.contextSummary}`);
      if (d.optionsConsidered && (d.optionsConsidered as string[]).length > 0) {
        contextLines.push(`  Options being considered: ${(d.optionsConsidered as string[]).join(", ")}`);
      }
    }
  }

  if (recentEntries.length > 0) {
    contextLines.push("\n## Recent Journal Entries");
    for (const e of recentEntries) {
      const date = new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const preview = e.content.slice(0, 300) + (e.content.length > 300 ? "…" : "");
      const tags = e.tags && (e.tags as string[]).length > 0 ? ` [${(e.tags as string[]).join(", ")}]` : "";
      contextLines.push(`- ${date}${tags}: ${preview}`);
    }
  }

  return contextLines.length > 0
    ? contextLines.join("\n")
    : "No data logged yet. The founder is just getting started.";
}

router.get("/coach/conversations", async (_req, res): Promise<void> => {
  const convos = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(convos);
});

router.post("/coach/conversations", async (req, res): Promise<void> => {
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [convo] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(convo);
});

router.get("/coach/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!convo) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...convo, messages: msgs });
});

router.delete("/coach/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

router.post("/coach/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(30);

  const founderContext = await buildFounderContext();

  const systemPrompt = `You are an AI executive coach for solo founders. You are a sharp, direct, and honest advisor — not a cheerleader. Your role is to help the founder think more clearly, challenge assumptions, identify blind spots, and make better decisions. You ask tough questions when needed. You do not flatter.

You have access to the founder's current business context below. Use it to make your coaching specific and relevant. Reference their actual metrics, open decisions, and journal themes when appropriate.

${founderContext}

Guidelines:
- Be concise and direct. No corporate jargon or filler phrases.
- Ask one clarifying question at a time rather than overwhelming with multiple.
- When the founder mentions a decision, push back on their reasoning or alternatives.
- When metrics are weak, acknowledge it plainly and explore why.
- You can be challenging, but never dismissive or harsh.
- Format responses with short paragraphs. Use bullet points only when listing distinct items.`;

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: false,
    });

    const assistantContent = completion.choices[0]?.message?.content ?? "";

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: assistantContent,
    });

    res.json({ role: "assistant", content: assistantContent });
  } catch (err) {
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
