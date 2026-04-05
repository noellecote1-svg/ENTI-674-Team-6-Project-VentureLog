/**
 * routes/health.ts — Health Check Endpoint
 *
 * Provides a simple endpoint that confirms the API server is running.
 * Health checks are a standard practice in production applications —
 * deployment platforms (like Replit, AWS, etc.) ping this endpoint
 * periodically to verify the server is alive and responsive.
 *
 * If this endpoint stops responding, the platform knows to restart the server.
 *
 * Endpoint:
 *   GET /api/healthz → { status: "ok" }
 */
 
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
 
const router: IRouter = Router();
 
/**
 * GET /api/healthz
 *
 * Returns a simple JSON object confirming the server is running.
 * The response is validated against the HealthCheckResponse Zod schema
 * before being sent — ensuring the response always matches the expected format.
 *
 * Response: { status: "ok" }
 */
router.get("/healthz", (_req, res) => {
  // Parse/validate the response shape using the shared Zod schema
  // This ensures the response always matches what the frontend expects
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
 
export default router;
