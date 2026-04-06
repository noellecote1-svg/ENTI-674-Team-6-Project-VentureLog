/**
 * integrations-openai-ai-server/src/utils.ts — Batch Processing Utilities
 *
 * Generic utilities for processing multiple items through the OpenAI API
 * with built-in concurrency limiting, automatic retries, and rate limit
 * handling. Designed to prevent overwhelming the API when processing
 * large batches of data.
 *
 * Two processing modes:
 *   batchProcess()         — parallel processing with configurable concurrency
 *                            (default: 2 simultaneous requests)
 *   batchProcessWithSSE()  — sequential processing that streams progress
 *                            events to the client via Server-Sent Events
 *
 * Both modes use exponential backoff retry logic — if a request fails with
 * a rate limit error (429), it waits increasingly longer before retrying
 * (2s → 4s → 8s → ... up to 128s).
 *
 * Not currently used in VentureLog's core features but available for
 * future bulk operations like processing many journal entries at once.
 */
import pLimit from "p-limit";
import pRetry from "p-retry";

/**
 * Batch Processing Utilities
 *
 * Generic batch processing with built-in rate limiting and automatic retries.
 * Use for any task that requires processing multiple items through an LLM or external API.
 *
 * USAGE:
 * ```typescript
 * import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
 * import { openai } from "@workspace/integrations-openai-ai-server";
 *
 * const results = await batchProcess(
 *   artworks,
 *   async (artwork) => {
 *     const response = await openai.chat.completions.create({
 *       model: "gpt-5.2",
 *       messages: [{ role: "user", content: `Categorize: ${artwork.name}` }],
 *       response_format: { type: "json_object" },
 *     });
 *     return JSON.parse(response.choices[0]?.message?.content || "{}");
 *   },
 *   { concurrency: 2, retries: 5 }
 * );
 * ```
 */

export interface BatchOptions {
  concurrency?: number;
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onProgress?: (completed: number, total: number, item: unknown) => void;
}

export function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {}
): Promise<R[]> {
  const {
    concurrency = 2,
    retries = 7,
    minTimeout = 2000,
    maxTimeout = 128000,
    onProgress,
  } = options;

  const limit = pLimit(concurrency);
  let completed = 0;

  const promises = items.map((item, index) =>
    limit(() =>
      pRetry(
        async () => {
          try {
            const result = await processor(item, index);
            completed++;
            onProgress?.(completed, items.length, item);
            return result;
          } catch (error: unknown) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new pRetry.AbortError(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        { retries, minTimeout, maxTimeout, factor: 2 }
      )
    )
  );

  return Promise.all(promises);
}

export async function batchProcessWithSSE<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  sendEvent: (event: { type: string; [key: string]: unknown }) => void,
  options: Omit<BatchOptions, "concurrency" | "onProgress"> = {}
): Promise<R[]> {
  const { retries = 5, minTimeout = 1000, maxTimeout = 15000 } = options;

  sendEvent({ type: "started", total: items.length });

  const results: R[] = [];
  let errors = 0;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    sendEvent({ type: "processing", index, item });

    try {
      const result = await pRetry(
        () => processor(item, index),
        {
          retries,
          minTimeout,
          maxTimeout,
          factor: 2,
          onFailedAttempt: (error) => {
            if (!isRateLimitError(error)) {
              throw new pRetry.AbortError(
                error instanceof Error ? error : new Error(String(error))
              );
            }
          },
        }
      );
      results.push(result);
      sendEvent({ type: "progress", index, result });
    } catch (error) {
      errors++;
      results.push(undefined as R);
      sendEvent({
        type: "progress",
        index,
        error: error instanceof Error ? error.message : "Processing failed",
      });
    }
  }

  sendEvent({ type: "complete", processed: items.length, errors });
  return results;
}
