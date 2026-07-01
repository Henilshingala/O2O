import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import authRouter from "./routes/auth";
import dataRouter from "./routes/api";
import uploadRouter from "./routes/upload";
import analyticsRouter from "./routes/analytics";
import extendedRouter from "./routes/extended";
import friendsRouter from "./routes/friends";
import usersRouter from "./routes/users";
import notificationsRouter from "./routes/notifications";
import healthRouter from "./routes/health";
import adminRouter from "./routes/admin/index";
import { logger } from "./lib/logger";

const app: Express = express();
app.set('trust proxy', 1);

// Helmet with relaxed CSP for admin SPA
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use("/api/", apiLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ──── API routes ────
app.use("/api/auth", authRouter);
app.use("/api/data", dataRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/extended", extendedRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/users", usersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api", healthRouter);
app.use("/api/admin", adminRouter);

// ──── Health check ────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ──── Admin Panel SPA ────
const adminDistPath = path.resolve(process.cwd(), "..", "admin-panel", "dist");

if (fs.existsSync(adminDistPath)) {
  // Serve built admin SPA assets (JS, CSS, images) at /admin-assets/
  app.use("/admin-assets", express.static(adminDistPath));

  // Admin SPA: serve index.html for all /admin routes (SPA client-side routing)
  app.get(["/admin", /^\/admin\/.*/], (_req, res) => {
    const indexPath = path.join(adminDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(404).send("Admin panel index.html not found");
  });
}

// ──── Root landing ────
app.get("/", (_req, res) => {
  const adminBuilt = fs.existsSync(adminDistPath);
  res.send(`
    <!DOCTYPE html>
    <html><head><title>O2O API Server</title>
    <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0;}
    .box{text-align:center;padding:40px;border-radius:16px;background:#1e293b;box-shadow:0 25px 50px -12px rgba(0,0,0,.5);max-width:420px;}
    h1{font-size:2rem;margin:0 0 8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    p{margin:8px 0;color:#94a3b8;} code{background:#334155;padding:4px 8px;border-radius:6px;color:#a5b4fc;}
    a{color:#818cf8;text-decoration:none;font-weight:600;} a:hover{text-decoration:underline;}</style>
    </head><body><div class="box"><h1>O2O API Server</h1>
    <p>API is running at <code>/api/*</code></p>
    ${adminBuilt ? '<p><a href="/admin/">Open Admin Panel →</a></p>' : '<p>Admin panel not built. Run: <code>pnpm --filter @workspace/admin-panel build</code></p>'}
    </div></body></html>
  `);
});

export default app;
