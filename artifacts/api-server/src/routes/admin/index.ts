import { Router } from "express";
import adminAuthRouter from "./admin-auth";
import dashboardRouter from "./dashboard";
import dbBrowserRouter from "./db-browser";
import usersMgmtRouter from "./users-mgmt";
import adminsMgmtRouter from "./admins-mgmt";
import searchRouter from "./search";
import filesRouter from "./files";
import auditRouter from "./audit";

const router = Router();

router.use("/auth", adminAuthRouter);
router.use("/dashboard", dashboardRouter);
router.use("/db", dbBrowserRouter);
router.use("/users", usersMgmtRouter);
router.use("/admins", adminsMgmtRouter);
router.use("/search", searchRouter);
router.use("/files", filesRouter);
router.use("/audit-logs", auditRouter);

export default router;
