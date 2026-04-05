/**
 * routes/decisions.ts — Decision Log API Routes
 *
 * Handles all operations for VentureLog's Decision Log feature.
 * The decision log helps founders document important choices they make,
 * creating an accountability trail and institutional memory over time.
 *
 * Each decision captures the full context:
 *   - What the decision was about (title + context summary)
 *   - What options were considered
 *   - What was chosen and the expected outcome
 *   - What actually happened (filled in later)
 *   - Lessons learned in retrospect
 *   - Optional links to a journal entry or metric that prompted it
 *
 * Decisions also support threaded comments for team collaboration.
 *
 * Endpoints:
 *   GET    /api/decisions                    → List decisions (filterable)
 *   POST   /api/decisions                    → Create a new decision
 *   GET    /api/decisions/:id                → Get one decision with comments
 *   PATCH  /api/decisions/:id                → Update a decision
 *   DELETE /api/decisions/:id                → Delete a decision
 *   GET    /api/decisions/:id/comments       → List comments on a decision
 *   POST   /api/decisions/:id/comments       → Add a comment to a decision
 */

import { Router, type IRouter } from "express";
import { eq, desc, ilike, and, or, isNull, not } from "drizzle-orm";
import {
  db,
  decisionLogItemsTable,
  decisionCommentsTable,
  metricsTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

// ─── VALID TAGS ────────────────────────────────────────────────────────────────
// Decisions share the same 7 tags as journal entries for consistency across the app
const VALID_TAGS = [
  "Product",
  "Growth",
  "Team",
  "Fundraising",
  "Operations",
  "Finance",
  "Reflection",
] as const;

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────────

/**
 * Schema for creating a new decision.
 * - sourceEntryId: Optional link to the journal entry that prompted this decision
 * - linkedMetricId: Optional link to the metric this decision relates to
 * - title: Short summary of the decision (max 120 chars)
 * - contextSummary: Why this decision was needed (max 500 chars)
 * - optionsConsidered: Array of alternatives that were evaluated
 * - chosenOption: Which option was selected
 * - expectedOutcome: What the founder expects to happen
 * - tags: Business area tags for filtering
 */
const createDecisionSchema = z.object({
  sourceEntryId: z.string().uuid().nullable().optional(),
  linkedMetricId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120),
  contextSummary: z.string().min(1).max(500),
  optionsConsidered: z.array(z.string()),
  chosenOption: z.string().min(1),
  expectedOutcome: z.string().nullable().optional(),
  tags: z.array(z.enum(VALID_TAGS)).default([]),
});

/**
 * Schema for updating an existing decision.
 * All fields optional — supports partial updates.
 * Includes retrospective fields only relevant after the decision plays out:
 * - actualOutcome: What actually happened
 * - lessonsLearned: Retrospective insights
 * - status: "open" (active/pending) or "closed" (resolved)
 * - isArchived: Soft-delete flag — preferred over hard deletion
 */
const updateDecisionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  contextSummary: z.string().min(1).max(500).optional(),
  optionsConsidered: z.array(z.string()).optional(),
  chosenOption: z.string().min(1).optional(),
  expectedOutcome: z.string().nullable().optional(),
  actualOutcome: z.string().nullable().optional(),
  lessonsLearned: z.string().nullable().optional(),
  linkedMetricId: z.string().uuid().nullable().optional(),
  tags: z.array(z.enum(VALID_TAGS)).optional(),
  status: z.enum(["open", "closed"]).optional(),
  isArchived: z.boolean().optional(),
});

/**
 * Schema for adding a comment to a decision.
 */
const addCommentSchema = z.object({
  authorName: z.string().min(1),
  content: z.string().min(1),
});

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * serializeDecision()
 * Converts a raw database decision row into the API response format.
 * Also resolves the linked metric's display name (if any) via a DB lookup.
 *
 * Async because it may need to query the metrics table for the linked name.
 */
async function serializeDecision(
  d: typeof decisionLogItemsTable.$inferSelect,
) {
  // Look up the linked metric's name so the frontend can display it
  // without needing to make a separate API call
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
    linkedMetricName,                              // Resolved name for display
    title: d.title,
    contextSummary: d.contextSummary,
    optionsConsidered: d.optionsConsidered as string[],
    chosenOption: d.chosenOption,
    expectedOutcome: d.expectedOutcome ?? null,
    actualOutcome: d.actualOutcome ?? null,        // Filled in after outcome is known
    lessonsLearned: d.lessonsLearned ?? null,      // Retrospective insights
    tags: d.tags,
    status: d.status,                              // "open" | "closed"
    hasComments: d.hasComments,                    // Cached flag avoids a COUNT query on lists
    isArchived: d.isArchived,
    createdAt: d.createdAt,
  };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/decisions
 * Returns decisions with optional filtering. Archived decisions are
 * excluded by default to keep the list focused on active items.
 *
 * Query parameters:
 *   ?status=open|closed    → Filter by decision status
 *   ?search=pricing        → Case-insensitive title search
 *   ?includeArchived=true  → Include archived decisions
 */
router.get("/decisions", async (req, res): Promise<void> => {
  const { status, tag, search, includeArchived } = req.query;

  const conditions = [];

  // Default: hide archived decisions to keep the list clean
  if (includeArchived !== "true") {
    conditions.push(eq(decisionLogItemsTable.isArchived, false));
  }

  // Filter by open/closed status if provided
  if (status === "open" || status === "closed") {
    conditions.push(eq(decisionLogItemsTable.status, status));
  }

  // Case-insensitive title search
  if (typeof search === "string" && search) {
    conditions.push(ilike(decisionLogItemsTable.title, `%${search}%`));
  }

  const decisions = await db
    .select()
    .from(decisionLogItemsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(decisionLogItemsTable.createdAt));

  // Serialize all results (resolves linked metric names in parallel)
  const result = await Promise.all(decisions.map(serializeDecision));
  res.json(result);
});

/**
 * POST /api/decisions
 * Creates a new decision log entry.
 *
 * Request body: { title, contextSummary, optionsConsidered[], chosenOption,
 *                 expectedOutcome?, tags[], sourceEntryId?, linkedMetricId? }
 * Response: The created decision (201 Created)
 */
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

/**
 * GET /api/decisions/:id
 * Returns a single decision with its full details and all comments.
 *
 * Response: { decision, comments[] }
 */
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

  // Fetch comments in chronological order (oldest first for threaded conversation feel)
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

/**
 * PATCH /api/decisions/:id
 * Partially updates a decision. Commonly used to:
 *   - Record the actual outcome after the fact
 *   - Close a decision once it's resolved
 *   - Add lessons learned in retrospect
 *   - Archive a decision to remove it from active views
 */
router.patch("/decisions/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = updateDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Build update object with only the fields that were provided
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

/**
 * DELETE /api/decisions/:id
 * Permanently deletes a decision. Note: archiving via PATCH is preferred
 * as it preserves the historical record while removing it from active views.
 *
 * Response: 204 No Content on success
 */
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

/**
 * GET /api/decisions/:id/comments
 * Returns all comments on a specific decision in chronological order.
 */
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

/**
 * POST /api/decisions/:id/comments
 * Adds a new comment to a decision and updates the hasComments flag.
 *
 * The hasComments flag is a denormalization strategy — it lets the decisions
 * list show a comment indicator without running a COUNT query per decision.
 *
 * Request body: { authorName, content }
 * Response: The newly created comment (201 Created)
 */
router.post("/decisions/:id/comments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  // Verify the parent decision exists before adding a comment
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

  // Update hasComments flag on the parent decision
  // This cached flag avoids expensive COUNT queries on the decisions list view
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
