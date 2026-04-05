/**
 * routes/index.ts — Central Route Registry
 *
 * This file is the "switchboard" for all API routes in VentureLog.
 * It imports every feature's router and combines them into one master
 * router that gets mounted in app.ts under the /api prefix.
 *
 * Adding a new feature to the API means:
 *   1. Create a new route file in this folder (e.g. notifications.ts)
 *   2. Import it here and add it with router.use()
 *
 * This pattern keeps app.ts clean and makes it easy to see all available
 * feature areas at a glance.
 */
 
import { Router, type IRouter } from "express";
 
// Import each feature's route handler
import healthRouter from "./health";       // GET /api/healthz — server status check
import journalRouter from "./journal";     // CRUD for journal entries
import metricsRouter from "./metrics";     // CRUD for business metrics + values
import decisionsRouter from "./decisions"; // CRUD for decision log items + comments
import dashboardRouter from "./dashboard"; // GET /api/dashboard/summary — homepage data
 
// Create the master router
const router: IRouter = Router();
 
// Register all feature routers — order doesn't matter here since each
// router handles its own distinct URL paths
router.use(healthRouter);
router.use(journalRouter);
router.use(metricsRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);
 
export default router;
