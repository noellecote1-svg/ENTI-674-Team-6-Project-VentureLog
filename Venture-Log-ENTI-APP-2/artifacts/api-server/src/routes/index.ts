/**
 * routes/index.ts — Central Route Registry
 *
 * This file is the "switchboard" for all API routes in VentureLog.
 * It imports every feature's router and combines them into one master
 * router that gets mounted in app.ts under the /api prefix.
 *
 * VentureLog has grown to 7 feature areas, each handled by its own file:
 *
 *   health          → Server status check
 *   journal         → Founder journal entries (CRUD)
 *   metrics         → Business metrics tracking (CRUD + value logging)
 *   decisions       → Decision log with comments (CRUD)
 *   dashboard       → Home screen summary data
 *   coach           → AI executive coach (conversations + messages)
 *   investor-update → AI-generated monthly investor updates
 *
 * Adding a new feature means: create a route file, import it here, add router.use().
 */

import { Router, type IRouter } from "express";

// Import each feature's route handler
import healthRouter from "./health";               // GET /api/healthz
import journalRouter from "./journal";             // CRUD /api/journal
import metricsRouter from "./metrics";             // CRUD /api/metrics
import decisionsRouter from "./decisions";         // CRUD /api/decisions
import dashboardRouter from "./dashboard";         // GET /api/dashboard/summary
import coachRouter from "./coach";                 // /api/coach/conversations
import investorUpdateRouter from "./investor-update"; // POST /api/investor-update/generate

// Create the master router
const router: IRouter = Router();

// Register all feature routers
// Order doesn't matter here since each router handles its own distinct URL paths
router.use(healthRouter);
router.use(journalRouter);
router.use(metricsRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);
router.use(coachRouter);
router.use(investorUpdateRouter);

export default router;
