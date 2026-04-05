/**
 * routes/journal.ts — Journal Entry API Routes
 *
 * Handles all CRUD (Create, Read, Update, Delete) operations for the
 * founder's private journal. Founders write markdown entries, tag them
 * by business area, and can optionally "promote" them to the decision log.
 *
 * Additionally, every time an entry is created or updated, this file
 * triggers an optional AI summarization in the background (requires
 * an OpenAI API key). The summary is stored separately and used to
 * give the AI Coach feature context about past entries.
 *
 * Endpoints:
 *   GET    /api/journal          → List all entries (with optional tag/search filters)
 *   POST   /api/journal          → Create a new entry
 *   GET    /api/journal/:id      → Get a single entry by ID
 *   PATCH  /api/journal/:id      → Update an existing entry
 *   DELETE /api/journal/:id      → Delete an entry
 */

import { Router, type IRouter } from "express";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { db, journalEntriesTable, journalSummariesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

// ─── VALID TAGS ────────────────────────────────────────────────────────────────
// These are the only 7 allowed tags for journal entries — fixed by the product spec.
// Using "as const" makes TypeScript treat these as exact string literals, not just "string".
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
// Zod schemas define the exact shape of data expected in request bodies.
// If incoming data doesn't match, the request is rejected with a 400 error.

/**
 * Schema for creating a new journal entry.
 * - content: Required. The markdown text of the entry.
 * - tags: Optional array of predefined tags. Defaults to empty array.
 * - isPromoted: Optional. True if this entry should appear in the decision log.
 */
const createEntrySchema = z.object({
  content: z.string(),
  tags: z.array(z.enum(VALID_TAGS)).default([]),
  isPromoted: z.boolean().optional(),
});

/**
 * Schema for updating an existing journal entry.
 * All fields are optional — only the provided fields will be updated.
 */
const updateEntrySchema = z.object({
  content: z.string().optional(),
  tags: z.array(z.enum(VALID_TAGS)).optional(),
  isPromoted: z.boolean().optional(),
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/journal
 * Returns all journal entries, newest first.
 *
 * Optional query parameters:
 *   ?tag=Product     → Filter entries that include a specific tag
 *   ?search=revenue  → Filter entries whose content contains the search term
 *
 * Both filters can be combined.
 */
router.get("/journal", async (req, res): Promise<void> => {
  const { tag, search } = req.query;

  // Start with a base query — .$dynamic() allows adding WHERE conditions conditionally
  let query = db
    .select()
    .from(journalEntriesTable)
    .orderBy(desc(journalEntriesTable.createdAt))
    .$dynamic();

  // Add tag filter if provided — uses PostgreSQL array containment operator @>
  // This checks if the tags column (an array) contains the specified tag
  if (typeof tag === "string" && tag) {
    query = query.where(sql`${journalEntriesTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  // Add full-text search filter if provided — ilike is case-insensitive LIKE
  if (typeof search === "string" && search) {
    query = query.where(ilike(journalEntriesTable.content, `%${search}%`));
  }

  const entries = await query;

  // Shape raw database rows into clean API response objects
  const result = entries.map((e) => ({
    id: e.id,
    content: e.content,
    tags: e.tags,
    isPromoted: e.isPromoted,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  res.json(result);
});

/**
 * POST /api/journal
 * Creates a new journal entry and saves it to the database.
 * After saving, triggers background AI summarization (if OpenAI key is configured).
 *
 * Request body: { content, tags?, isPromoted? }
 * Response: The newly created entry (201 Created)
 */
router.post("/journal", async (req, res): Promise<void> => {
  // Validate the request body against our schema
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Insert the new entry into the database
  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      content: parsed.data.content,
      tags: parsed.data.tags as string[],
      isPromoted: parsed.data.isPromoted ?? false,
    })
    .returning(); // Return the full inserted row including auto-generated id and timestamps

  // Send the response immediately — don't make the user wait for AI summarization
  res.status(201).json({
    id: entry.id,
    content: entry.content,
    tags: entry.tags,
    isPromoted: entry.isPromoted,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

  // Fire-and-forget: trigger AI summarization in the background
  // The .catch(() => {}) ensures any errors are silently ignored
  triggerSummarization(entry.id, entry.content, entry.updatedAt).catch(() => {});
});

/**
 * GET /api/journal/:id
 * Returns a single journal entry by its unique ID.
 *
 * Response: The entry object, or 404 if not found
 */
router.get("/journal/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id; // Normalize in case of array

  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.id, rawId));

  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    id: entry.id,
    content: entry.content,
    tags: entry.tags,
    isPromoted: entry.isPromoted,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
});

/**
 * PATCH /api/journal/:id
 * Partially updates an existing journal entry.
 * Only the fields included in the request body will be changed.
 *
 * Request body: { content?, tags?, isPromoted? }
 * Response: The updated entry, or 404 if not found
 */
router.patch("/journal/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Always update the updatedAt timestamp when any field changes
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  // Only include fields that were actually provided in the request
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.isPromoted !== undefined) updateData.isPromoted = parsed.data.isPromoted;

  const [entry] = await db
    .update(journalEntriesTable)
    .set(updateData as Partial<typeof journalEntriesTable.$inferInsert>)
    .where(eq(journalEntriesTable.id, rawId))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    id: entry.id,
    content: entry.content,
    tags: entry.tags,
    isPromoted: entry.isPromoted,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

  // Re-trigger AI summarization only if the content actually changed
  if (parsed.data.content !== undefined) {
    triggerSummarization(entry.id, entry.content, entry.updatedAt).catch(() => {});
  }
});

/**
 * DELETE /api/journal/:id
 * Permanently deletes a journal entry from the database.
 *
 * Response: 204 No Content on success, or 404 if not found
 */
router.delete("/journal/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const [deleted] = await db
    .delete(journalEntriesTable)
    .where(eq(journalEntriesTable.id, rawId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendStatus(204); // 204 = success with no response body
});

// ─── AI SUMMARIZATION (BACKGROUND) ────────────────────────────────────────────

/**
 * triggerSummarization()
 *
 * Sends the journal entry content to OpenAI and stores a concise 2-3 sentence
 * summary in the journalSummaries table. This summary is later used by the
 * AI Coach feature to give it context about what the founder has been thinking.
 *
 * This function runs after the API response is already sent, so it never
 * slows down the user experience.
 *
 * If no OPENAI_API_KEY is set, the function exits immediately — AI features
 * are optional and the app works fully without them.
 *
 * @param entryId   - The database ID of the journal entry to summarize
 * @param content   - The full text content of the journal entry
 * @param updatedAt - The timestamp when the entry was last modified
 */
async function triggerSummarization(
  entryId: string,
  content: string,
  updatedAt: Date,
): Promise<void> {
  // Skip summarization if no OpenAI API key is configured
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return;

  try {
    // Call the OpenAI API to generate a summary
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Lightweight, fast, cost-effective model
        messages: [
          {
            role: "system",
            content: `You are summarizing a founder's private journal entry for use as AI coach context. 
Produce a 2-3 sentence factual summary of the key decisions, observations, blockers, 
and outcomes described. Do not add interpretation or evaluation. Do not reproduce 
sensitive personal content. Output only the summary with no preamble.`,
          },
          { role: "user", content }, // The actual journal entry text
        ],
        max_tokens: 200, // Keep summaries short
      }),
    });

    if (!response.ok) return;

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const summary = data.choices[0]?.message?.content?.trim();
    if (!summary) return;

    // Replace any existing summary for this entry with the fresh one
    await db
      .delete(journalSummariesTable)
      .where(eq(journalSummariesTable.entryId, entryId));

    await db.insert(journalSummariesTable).values({
      entryId,
      summary,
      entryUpdatedAt: updatedAt, // Track which version of the entry this summary is for
    });
  } catch {
    // Fail silently — summarization failure should never break the journal feature
  }
}

export default router;
