/**
 * integrations-openai-ai-server/src/client.ts — OpenAI Client (Server)
 *
 * Creates and exports the OpenAI client instance used by VentureLog's
 * backend API routes. This is the entry point for all AI features:
 *   - AI Coach conversations (coach.ts route)
 *   - Investor Update generation (investor-update.ts route)
 *   - Journal entry summarization (journal.ts route)
 *
 * Uses two environment variables injected by Replit's OpenAI integration:
 *   AI_INTEGRATIONS_OPENAI_API_KEY — authenticates requests to OpenAI
 *   AI_INTEGRATIONS_OPENAI_BASE_URL — the API endpoint (allows routing
 *     through Replit's proxy for key management)
 *
 * The app fails immediately on startup if either variable is missing,
 * rather than failing silently on the first API call.
 */
import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
