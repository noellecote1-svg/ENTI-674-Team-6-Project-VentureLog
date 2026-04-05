/**
 * lib/db/src/index.ts — Database Connection
 *
 * Creates and exports the database connection used by the entire backend.
 * Every API route that reads or writes data imports `db` from here.
 *
 * Uses two libraries working together:
 *   - pg (node-postgres): the low-level PostgreSQL driver that handles
 *     the actual TCP connection to the database server
 *   - Drizzle ORM: sits on top of pg and lets the backend write
 *     type-safe queries in TypeScript instead of raw SQL strings
 *
 * The Pool: instead of opening a new database connection for every
 * request (expensive), a Pool maintains a set of reusable connections
 * that are checked out and returned as needed. This is standard practice
 * for production web applications.
 *
 * DATABASE_URL: a connection string provided as an environment variable
 * (e.g. "postgresql://user:password@host:5432/dbname"). This keeps
 * credentials out of the codebase entirely — Replit injects this
 * automatically when a PostgreSQL database is provisioned.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Fail fast if no database URL is configured — prevents cryptic connection errors
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the connection pool — reuses connections across requests for efficiency
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create the Drizzle ORM instance — this is what routes import to query the DB
// Passing the schema enables type-safe table references throughout the codebase
export const db = drizzle(pool, { schema });

// Re-export all schema tables so routes can import everything from "@workspace/db"
export * from "./schema";
