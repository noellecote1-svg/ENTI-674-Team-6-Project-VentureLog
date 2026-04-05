/**
 * lib/db/src/schema/index.ts — Database Schema Barrel Export
 *
 * Re-exports all database table definitions from a single entry point.
 * This allows any file that needs database tables to import from one place:
 *
 *   import { db, journalEntriesTable, metricsTable } from "@workspace/db"
 *
 * Instead of importing from each individual schema file separately.
 * Adding a new database table means: create a new schema file and
 * add it to this barrel export.
 */

export * from "./journal";
export * from "./metrics";
export * from "./decisions";
export * from "./conversations";
export * from "./messages";
