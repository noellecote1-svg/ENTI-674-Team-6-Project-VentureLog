/**
 * logger.ts — Application Logger
 *
 * Creates and exports a shared logging instance used throughout the entire
 * backend. Instead of using console.log() everywhere, the app uses this
 * structured logger which produces consistent, searchable log output.
 *
 * Uses Pino — one of the fastest logging libraries for Node.js.
 * Pino outputs logs as JSON in production (easy to parse by log management
 * tools) and as colorized, human-readable text in development.
 */
 
import pino from "pino";
 
/**
 * Detect whether the app is running in production mode.
 * The NODE_ENV environment variable is a widely adopted convention:
 *   "production"  — live server, real users
 *   "development" — local machine, developer testing
 */
const isProduction = process.env.NODE_ENV === "production";
 
/**
 * Create and export the logger instance.
 *
 * Configuration:
 * - level: Controls which messages get logged. "info" means log everything
 *   at info level and above (info, warn, error). Can be overridden via the
 *   LOG_LEVEL environment variable (e.g. "debug" for more verbose output).
 *
 * - redact: Automatically removes sensitive data from logs before writing.
 *   This ensures that authorization tokens and session cookies never appear
 *   in log files, protecting user security and privacy.
 *
 * - transport (development only): Uses "pino-pretty" to format logs with
 *   colors and human-readable timestamps instead of raw JSON. This makes
 *   development much easier to read in the terminal.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
 
  // These fields are automatically stripped from every log entry
  redact: [
    "req.headers.authorization", // Bearer tokens / API keys
    "req.headers.cookie",        // Session cookies
    "res.headers['set-cookie']", // Cookies being set on responses
  ],
 
  // In production: output raw JSON (no transport config needed)
  // In development: output colorized, pretty-printed text
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true }, // Add color coding to log levels
        },
      }),
});
