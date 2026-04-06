/**
 * integrations-openai-ai-server/src/index.ts — OpenAI Server Integration Exports
 *
 * The public API for the server-side OpenAI integration package.
 * Backend routes import from "@workspace/integrations-openai-ai-server"
 * to access the OpenAI client and batch processing utilities.
 *
 * Exports:
 *   openai          — the configured OpenAI client instance
 *   batchProcess    — parallel batch processing with rate limit handling
 *   batchProcessWithSSE — sequential batch processing with SSE progress events
 *   isRateLimitError — helper to detect OpenAI 429 rate limit errors
 */
export { openai } from "./client";
export { generateImageBuffer, editImages } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";
