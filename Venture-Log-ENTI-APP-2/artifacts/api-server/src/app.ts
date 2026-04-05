/**
 * app.ts — Express Application Setup
 *
 * This file creates and configures the core Express server instance.
 * Think of it as the "blueprint" for the server — it defines all the
 * middleware (tools that process every request) and connects the routes
 * (URL endpoints) before the server starts listening for traffic.
 *
 * This file does NOT start the server — that happens in index.ts.
 */
 
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
 
// Create a new Express application instance
const app: Express = express();
 
// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
// Middleware are functions that run on every incoming request before it reaches
// a route handler. They are applied in the order they are defined here.
 
/**
 * HTTP Request Logger (pino-http)
 * Logs every incoming request and outgoing response to the console.
 * Sensitive headers like Authorization and cookies are automatically
 * hidden (redacted) to protect user privacy.
 * In development, logs are colorized for easier reading.
 */
app.use(
  pinoHttp({
    logger,
    serializers: {
      // Only log the request ID, HTTP method, and URL path (strips query strings for cleanliness)
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      // Only log the HTTP status code from the response
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
 
/**
 * CORS (Cross-Origin Resource Sharing)
 * Allows the frontend (running on a different port/domain) to make
 * requests to this API server. Without this, browsers would block
 * all frontend-to-backend communication as a security measure.
 */
app.use(cors());
 
/**
 * JSON Body Parser
 * Automatically parses incoming request bodies that contain JSON data,
 * making the data available as a JavaScript object via req.body.
 * This is essential for POST and PATCH requests that send data.
 */
app.use(express.json());
 
/**
 * URL-Encoded Body Parser
 * Handles form submissions where data is sent as URL-encoded strings
 * (the default format for HTML form posts).
 * extended: true allows for rich objects and arrays to be encoded.
 */
app.use(express.urlencoded({ extended: true }));
 
// ─── ROUTES ───────────────────────────────────────────────────────────────────
 
/**
 * Mount all API routes under the /api prefix.
 * This means every route defined in the routes/ folder will be accessible
 * at URLs starting with /api — for example:
 *   GET  /api/journal
 *   POST /api/decisions
 *   GET  /api/dashboard/summary
 *   POST /api/coach/conversations
 *   POST /api/investor-update/generate
 */
app.use("/api", router);
 
// Export the configured app so index.ts can start it
export default app;
