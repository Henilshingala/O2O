import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import authRouter from "./routes/auth";
import dataRouter from "./routes/api";
import uploadRouter from "./routes/upload";
import analyticsRouter from "./routes/analytics";
import extendedRouter from "./routes/extended";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(helmet());

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
  origin: process.env.CORS_ORIGIN || "*", // Ideally restricted to frontend domain in prod
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRouter);
app.use("/api/data", dataRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/extended", extendedRouter);

export default app;
