/**
 * index.ts — Server Entry Point
 *
 * This is the very first file that runs when VentureLog's backend starts.
 * Its only job is to read the PORT environment variable and start the
 * Express server listening for incoming HTTP requests on that port.
 *
 * The actual server configuration (middleware, routes) lives in app.ts.
 * Separating these concerns makes the app easier to test and maintain.
 */
 
import app from "./app";
import { logger } from "./lib/logger";
 
// ─── PORT CONFIGURATION ───────────────────────────────────────────────────────
 
/**
 * Read the PORT from environment variables.
 * Environment variables are configuration values set outside the code —
 * this allows the same code to run on different ports in different
 * environments (development, staging, production) without code changes.
 */
const rawPort = process.env["PORT"];
 
/**
 * Safety check: crash immediately with a clear error message if no PORT
 * is provided. This "fail fast" approach prevents the server from starting
 * in a broken state where it can't actually receive requests.
 */
if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}
 
// Convert the port from a string to a number (environment variables are always strings)
const port = Number(rawPort);
 
/**
 * Validate that the PORT is actually a valid number.
 * NaN (Not a Number) would result if PORT was set to something like "abc".
 * A port must also be a positive number to be valid.
 */
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
 
// ─── START THE SERVER ─────────────────────────────────────────────────────────
 
/**
 * Start the Express server and begin listening for HTTP requests.
 * The callback function runs once the server is ready (or if it fails to start).
 *
 * On success: logs "Server listening" with the port number
 * On failure: logs the error and exits the process with code 1 (indicates error)
 */
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1); // Exit with error code — tells the host system something went wrong
  }
 
  logger.info({ port }, "Server listening");
});
