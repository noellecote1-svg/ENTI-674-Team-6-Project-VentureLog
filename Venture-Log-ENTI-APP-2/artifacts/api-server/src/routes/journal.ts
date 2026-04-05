import { Router, type IRouter } from "express";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { db, journalEntriesTable, journalSummariesTable } from "@workspace/db";
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

const createEntrySchema = z.object({
  content: z.string(),
  tags: z.array(z.enum(VALID_TAGS)).default([]),
  isPromoted: z.boolean().optional(),
});

const updateEntrySchema = z.object({
  content: z.string().optional(),
  tags: z.array(z.enum(VALID_TAGS)).optional(),
  isPromoted: z.boolean().optional(),
});

router.get("/journal", async (req, res): Promise<void> => {
  const { tag, search } = req.query;

  let query = db
    .select()
    .from(journalEntriesTable)
    .orderBy(desc(journalEntriesTable.createdAt))
    .$dynamic();

  if (typeof tag === "string" && tag) {
    query = query.where(sql`${journalEntriesTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  if (typeof search === "string" && search) {
    query = query.where(ilike(journalEntriesTable.content, `%${search}%`));
  }

  const entries = await query;

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

router.post("/journal", async (req, res): Promise<void> => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      content: parsed.data.content,
      tags: parsed.data.tags as string[],
      isPromoted: parsed.data.isPromoted ?? false,
    })
    .returning();

  res.status(201).json({
    id: entry.id,
    content: entry.content,
    tags: entry.tags,
    isPromoted: entry.isPromoted,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

  // Background: trigger summarization (fire and forget)
  triggerSummarization(entry.id, entry.content, entry.updatedAt).catch(() => {});
});

router.get("/journal/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

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

router.patch("/journal/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rawId = Array.isArray(id) ? id[0] : id;

  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

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

  // Background: trigger summarization (fire and forget)
  if (parsed.data.content !== undefined) {
    triggerSummarization(entry.id, entry.content, entry.updatedAt).catch(() => {});
  }
});

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

  res.sendStatus(204);
});

async function triggerSummarization(
  entryId: string,
  content: string,
  updatedAt: Date,
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are summarizing a founder's private journal entry for use as AI coach context. 
Produce a 2-3 sentence factual summary of the key decisions, observations, blockers, 
and outcomes described. Do not add interpretation or evaluation. Do not reproduce 
sensitive personal content. Output only the summary with no preamble.`,
          },
          { role: "user", content },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) return;

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const summary = data.choices[0]?.message?.content?.trim();
    if (!summary) return;

    // Delete old summary for this entry, insert new one
    await db
      .delete(journalSummariesTable)
      .where(eq(journalSummariesTable.entryId, entryId));

    await db.insert(journalSummariesTable).values({
      entryId,
      summary,
      entryUpdatedAt: updatedAt,
    });
  } catch {
    // Fail silently
  }
}

export default router;
