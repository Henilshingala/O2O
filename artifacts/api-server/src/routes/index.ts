import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import coreApiRouter from "./api";
import uploadRouter from "./upload";
import analyticsRouter from "./analytics";
import friendsRouter from "./friends";

const router: IRouter = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/data", coreApiRouter);
router.use("/upload", uploadRouter);
router.use("/analytics", analyticsRouter);
router.use("/friends", friendsRouter);

export default router;
