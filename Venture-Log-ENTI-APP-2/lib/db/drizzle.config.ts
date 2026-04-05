/**
 * drizzle.config.ts — Drizzle Kit Configuration
 *
 * Configures Drizzle Kit — the CLI tool used to manage database migrations
 * and schema synchronization for VentureLog.
 *
 * Drizzle Kit reads this config when running database commands:
 *   pnpm --filter @workspace/db run push
 *     → Compares the current schema files against the live database
 *       and pushes any structural changes (new tables, new columns, etc.)
 *       directly without generating migration files. Used in development.
 *
 *   pnpm --filter @workspace/db run push-force
 *     → Same as push but bypasses safety confirmations. Used when
 *       resetting the database during development.
 *
 * In production, Replit handles migrations automatically on publish.
 *
 * DATABASE_URL: the PostgreSQL connection string injected by Replit
 * when a database is provisioned for the project.
 */

import { defineConfig } from "drizzle-kit";
import path from "path";

// Fail fast if no database URL is available
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"), // Path to table definitions
  dialect: "postgresql",                                  // Target database type
  dbCredentials: {
    url: process.env.DATABASE_URL,                        // Connection string from environment
  },
});
