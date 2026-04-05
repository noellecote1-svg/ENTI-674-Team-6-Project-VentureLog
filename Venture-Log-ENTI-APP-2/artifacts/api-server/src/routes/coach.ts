/**
 * routes/coach.ts — AI Executive Coach API Routes
 *
 * Powers VentureLog's AI Coach feature — a GPT-powered executive coach
 * that gives founders sharp, honest, context-aware guidance based on
 * their actual business data (metrics, decisions, journal entries).
 *
 * Unlike a generic chatbot, this coach is personalized — it reads the
 * founder's real data before every response and references their specific
 * metrics, open decisions, and recent journal themes. The tone is direct
 * and challenging, not flattering.
 *
 * Conversations are persisted in the database so founders can return
 * to previous coaching sessions and track their thinking over time.
 *
 * Endpoints:
 *   GET    /api/coach/conversations              → List all conversations
 *   POST   /api/coach/conversations              → Start a new conversation
 *   GET    /api/coach/conversations/:id          → Get a conversation with messages
 *   DELETE /api/coach/conversations/:id          → Delete a conversation
 *   POST   /api/coach/conversations/:id/messages → Send a message, get AI response
 */

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

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────────

/**
 * Schema for creating a new coaching conversation.
 * - title: A short label for the conversation (e.g. "Pricing strategy discussion")
 */
const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

/**
 * Schema for sending a message within a conversation.
 * - content: The founder's message text
 */
const sendMessageSchema = z.object({
  content: z.string().min(1),
});

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * buildFounderContext()
 *
 * Fetches the founder's current business data and formats it as a
 * structured text block that gets injected into the AI's system prompt.
 * This is what makes the coaching personalized rather than generic.
 *
 * Pulls three types of data:
 *   1. Recent journal entries (last 8) — what the founder has been thinking about
 *   2. Active metrics (up to 8) — current business numbers
 *   3. Open decisions (up to 5) — unresolved strategic choices
 *
 * Returns a formatted markdown string the AI can read and reference.
 */
async function buildFounderContext(): Promise<string> {
  // Fetch all three data sources in parallel for efficiency
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

  // For each active metric, also fetch its most recent value
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

  // Build the context string section by section
  const contextLines: string[] = [];

  // Section 1: Current metrics with their latest values
  if (metricsWithValues.length > 0) {
    contextLines.push("## Current Metrics");
    for (const m of metricsWithValues) {
      const val = m.currentValue !== null ? m.currentValue.toString() : "no data yet";
      contextLines.push(
        `- ${m.name} (${m.class}): ${val}${m.recordedDate ? ` as of ${m.recordedDate}` : ""}`,
      );
    }
  }

  // Section 2: Open decisions the founder hasn't resolved yet
  if (openDecisions.length > 0) {
    contextLines.push("\n## Open Decisions");
    for (const d of openDecisions) {
      contextLines.push(`- ${d.title}: ${d.contextSummary}`);
      if (d.optionsConsidered && (d.optionsConsidered as string[]).length > 0) {
        contextLines.push(
          `  Options being considered: ${(d.optionsConsidered as string[]).join(", ")}`,
        );
      }
    }
  }

  // Section 3: Recent journal entries (truncated to 300 chars each for context window efficiency)
  if (recentEntries.length > 0) {
    contextLines.push("\n## Recent Journal Entries");
    for (const e of recentEntries) {
      const date = new Date(e.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const preview = e.content.slice(0, 300) + (e.content.length > 300 ? "…" : "");
      const tags =
        e.tags && (e.tags as string[]).length > 0
          ? ` [${(e.tags as string[]).join(", ")}]`
          : "";
      contextLines.push(`- ${date}${tags}: ${preview}`);
    }
  }

  // If no data exists yet, tell the AI the founder is just getting started
  return contextLines.length > 0
    ? contextLines.join("\n")
    : "No data logged yet. The founder is just getting started.";
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/coach/conversations
 * Returns all coaching conversations, newest first.
 * Used to populate the conversation history sidebar.
 */
router.get("/coach/conversations", async (_req, res): Promise<void> => {
  const convos = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(convos);
});

/**
 * POST /api/coach/conversations
 * Creates a new coaching conversation with a title.
 * The first message is sent separately via the messages endpoint.
 *
 * Request body: { title }
 * Response: The new conversation object (201 Created)
 */
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

/**
 * GET /api/coach/conversations/:id
 * Returns a single conversation including all its messages in order.
 * Used to restore a previous coaching session.
 *
 * Response: { ...conversation, messages[] }
 */
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
  // Fetch messages in chronological order (oldest first) for correct chat display
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...convo, messages: msgs });
});

/**
 * DELETE /api/coach/conversations/:id
 * Deletes a conversation and all its messages.
 * Messages are cascade-deleted via the database foreign key constraint.
 *
 * Response: 204 No Content on success
 */
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

/**
 * POST /api/coach/conversations/:id/messages
 *
 * The core coaching endpoint. Handles the full AI response cycle:
 *   1. Saves the founder's message to the database
 *   2. Fetches the last 30 messages for conversation history
 *   3. Builds the founder's current business context (metrics, decisions, journal)
 *   4. Sends the full conversation + context to OpenAI
 *   5. Saves the AI response to the database
 *   6. Returns the AI response to the frontend
 *
 * The system prompt defines the coach's personality: direct, honest, challenging,
 * and deeply familiar with the founder's business data.
 *
 * The 30-message history limit keeps token costs manageable while
 * preserving enough context for coherent multi-turn conversations.
 *
 * Request body: { content }
 * Response: { role: "assistant", content: string }
 */
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

  // Verify the conversation exists
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Save the founder's message to the database first
  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  });

  // Fetch the last 30 messages for the AI's conversation history
  // Limiting to 30 keeps the OpenAI API request size (and cost) manageable
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(30);

  // Build the founder's personalized business context
  const founderContext = await buildFounderContext();

  /**
   * System prompt defines the AI coach's personality and behavior.
   * Key design decisions:
   * - "Sharp, direct, honest" — not a cheerleader, pushes back on weak reasoning
   * - References real data — makes coaching specific, not generic
   * - One question at a time — avoids overwhelming the founder
   * - Short paragraphs — respects the founder's time
   */
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

  // Build the full message array for OpenAI: system prompt + conversation history
  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    // Call the OpenAI API to generate the coach's response
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",             // Latest capable model for high-quality coaching
      max_completion_tokens: 8192,  // Generous limit for thorough coaching responses
      messages: chatMessages,
      stream: false,                // Full response at once (not streaming)
    });

    const assistantContent = completion.choices[0]?.message?.content ?? "";

    // Persist the AI response in the database for future session history
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
