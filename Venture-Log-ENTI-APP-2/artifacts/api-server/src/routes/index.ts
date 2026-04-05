import { Router, type IRouter } from "express";
import healthRouter from "./health";
import journalRouter from "./journal";
import metricsRouter from "./metrics";
import decisionsRouter from "./decisions";
import dashboardRouter from "./dashboard";
import coachRouter from "./coach";
import investorUpdateRouter from "./investor-update";

const router: IRouter = Router();

router.use(healthRouter);
router.use(journalRouter);
router.use(metricsRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);
router.use(coachRouter);
router.use(investorUpdateRouter);

export default router;
