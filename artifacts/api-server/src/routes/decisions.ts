import { Router, type IRouter } from "express";
import { eq, desc, ilike, and, or, isNull, not } from "drizzle-orm";
import { db, decisionLogItemsTable, decisionCommentsTable, metricsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const VALID_TAGS = [
  "Product",
  "Growth",
  "Team",
  "Fundraising",
  "Operations",
  "Finance",
  "Reflection",
] as const;

const createDecisionSchema = z.object({
  sourceEntryId: z.string().uuid().nullable().optional(),
  linkedMetricId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120),
  contextSummary: z.string().min(1).max(500),
  optionsConsidered: z.array(z.string()).min(1),
  chosenOption: z.string().min(1),
  expectedOutcome: z.string().nullable().optional(),
  tags: z.array(z.enum(VALID_TAGS)).default([]),
});

const updateDecisionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  contextSummary: z.string().min(1).max(500).optional(),
  optionsConsidered: z.array(z.string()).min(1).optional(),
  chosenOption: z.string().min(1).optional(),
  expectedOutcome: z.string().nullable().optional(),
  actualOutcome: z.string().nullable().optional(),
  lessonsLearned: z.string().nullable().optional(),
  linkedMetricId: z.string().uuid().nullable().optional(),
  tags: z.array(z.enum(VALID_TAGS)).optional(),
  status: z.enum(["open", "closed"]).optional(),
  isArchived: z.boolean().optional(),
});

const addCommentSchema = z.object({
  authorName: z.string().min(1),
  content: z.string().min(1),
});

async function serializeDecision(d: typeof decisionLogItemsTable.$inferSelect) {
  let linkedMetricName: string | null = null;
  if (d.linkedMetricId) {
    const [metric] = await db
      .select({ name: metricsTable.name })
      .from(metricsTable)
      .where(eq(metricsTable.id, d.linkedMetricId));
    linkedMetricName = metric?.name ?? null;
  }

  return {
    id: d.id,
    sourceEntryId: d.sourceEntryId ?? null,
    linkedMetricId: d.linkedMetricId ?? null,
    linkedMetricName,
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
  };
}

router.get("/decisions", async (req, res): Promise<void> => {
  const { status, tag, search, includeArchived } = req.query;

  const conditions = [];

  if (includeArchived !== "true") {
    conditions.push(eq(decisionLogItemsTable.isArchived, false));
  }

  if (status === "open" || status === "closed") {
    conditions.push(eq(decisionLogItemsTable.status, status));
  }

  if (typeof search === "string" && search) {
    conditions.push(ilike(decisionLogItemsTable.title, `%${search}%`));
  }

  const decisions = await db
    .select()
    .from(decisionLogItemsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(decisionLogItemsTable.createdAt));

  const result = await Promise.all(decisions.map(serializeDecision));
  res.json(result);
});

router.post("/decisions", async (req, res): Promise<void> => {
  const parsed = createDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [decision] = await db
    .insert(decisionLogItemsTable)
    .values({
      sourceEntryId: parsed.data.sourceEntryId ?? null,
      linkedMetricId: parsed.data.linkedMetricId ?? null,
      title: parsed.data.title,
      contextSummary: parsed.data.contextSummary,
      optionsConsidered: parsed.data.optionsConsidered,
      chosenOption: parsed.data.chosenOption,
      expectedOutcome: parsed.data.expectedOutcome ?? null,
      tags: parsed.data.tags as string[],
    })
    .returning();

  res.status(201).json(await serializeDecision(decision));
});

router.get("/decisions/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const [decision] = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.id, rawId));

  if (!decision) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const comments = await db
    .select()
    .from(decisionCommentsTable)
    .where(eq(decisionCommentsTable.decisionId, rawId))
    .orderBy(decisionCommentsTable.createdAt);

  res.json({
    decision: await serializeDecision(decision),
    comments: comments.map((c) => ({
      id: c.id,
      decisionId: c.decisionId,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt,
    })),
  });
});

router.patch("/decisions/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = updateDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.contextSummary !== undefined) updateData.contextSummary = parsed.data.contextSummary;
  if (parsed.data.optionsConsidered !== undefined) updateData.optionsConsidered = parsed.data.optionsConsidered;
  if (parsed.data.chosenOption !== undefined) updateData.chosenOption = parsed.data.chosenOption;
  if (parsed.data.expectedOutcome !== undefined) updateData.expectedOutcome = parsed.data.expectedOutcome;
  if (parsed.data.actualOutcome !== undefined) updateData.actualOutcome = parsed.data.actualOutcome;
  if (parsed.data.lessonsLearned !== undefined) updateData.lessonsLearned = parsed.data.lessonsLearned;
  if (parsed.data.linkedMetricId !== undefined) updateData.linkedMetricId = parsed.data.linkedMetricId;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

  const [decision] = await db
    .update(decisionLogItemsTable)
    .set(updateData as Partial<typeof decisionLogItemsTable.$inferInsert>)
    .where(eq(decisionLogItemsTable.id, rawId))
    .returning();

  if (!decision) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(await serializeDecision(decision));
});

router.delete("/decisions/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const [deleted] = await db
    .delete(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.id, rawId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/decisions/:id/comments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const comments = await db
    .select()
    .from(decisionCommentsTable)
    .where(eq(decisionCommentsTable.decisionId, rawId))
    .orderBy(decisionCommentsTable.createdAt);

  res.json(
    comments.map((c) => ({
      id: c.id,
      decisionId: c.decisionId,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt,
    })),
  );
});

router.post("/decisions/:id/comments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const [decision] = await db
    .select()
    .from(decisionLogItemsTable)
    .where(eq(decisionLogItemsTable.id, rawId));

  if (!decision) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const parsed = addCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [comment] = await db
    .insert(decisionCommentsTable)
    .values({
      decisionId: rawId,
      authorName: parsed.data.authorName,
      content: parsed.data.content,
    })
    .returning();

  // Update hasComments flag
  await db
    .update(decisionLogItemsTable)
    .set({ hasComments: true })
    .where(eq(decisionLogItemsTable.id, rawId));

  res.status(201).json({
    id: comment.id,
    decisionId: comment.decisionId,
    authorName: comment.authorName,
    content: comment.content,
    createdAt: comment.createdAt,
  });
});

export default router;
