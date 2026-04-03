import { Router, type IRouter } from "express";
import healthRouter from "./health";
import journalRouter from "./journal";
import metricsRouter from "./metrics";
import decisionsRouter from "./decisions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(journalRouter);
router.use(metricsRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);

export default router;
