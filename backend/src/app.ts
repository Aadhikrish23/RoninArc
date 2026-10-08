import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import openApiDocument from "./docs/openapi";
import authRouter from "./modules/auth/auth";
import type { Request, Response, NextFunction } from "express";
import AppError from "./shared/errors/AppError";
import library_router from "./modules/library/library";
import rawgRouter from "./modules/rawg/rawg";
import dashboardRouter from "./modules/dashboard/dashboard";
import reviewRouter from "./modules/review/review";
import collectionRoutes from "./modules/collection/collectionRoutes";
import activityRouter from "./modules/activity/activity";
import playSessionRoutes from "./modules/playSession/playSession";
import noteRouter from "./modules/notes/notes";
import backupRouter from "./modules/backup/backup";
import recommendationRouter from "./modules/recommendation/recommendation";
import providerRoutes from "./modules/providers/providerRoutes";
import { aiRoutes } from "./modules/ai";
import clientLogsRouter from "./modules/logs/clientLogs";
import { requestLogger } from "./shared/logging/requestLogger";
import { reportError } from "./shared/logging/errorReporter";
dotenv.config();
const app = express();
app.use(requestLogger);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
const allowedOrgin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

// The packaged Electron app loads the frontend via loadFile(), whose exact
// origin string (file://, "null", app://...) is inconsistent across
// platforms/Electron versions. It's not worth pinning down -- the backend
// is only ever reachable from localhost by this same packaged app in that
// mode, so ELECTRON_EMBEDDED (set by main.js when it spawns this process)
// just reflects back whatever origin the request declares instead.
app.use(
  cors({
    origin: process.env.ELECTRON_EMBEDDED === "1" ? true : allowedOrgin,
    exposedHeaders: ["X-Request-Id"],
  }),
);

// Mounted before the global JSON parser so it can use its own, larger body limit.
app.use("/logs", clientLogsRouter);

app.use(express.json());

// API documentation: interactive UI at /api/docs, raw OpenAPI 3.1 JSON at /api/docs.json.
app.get("/api/docs.json", (req: Request, res: Response) => res.json(openApiDocument));
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "RoninArc API",
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: "list", tryItOutEnabled: true },
  }),
);


app.get("/health", (req: Request, res: Response) => {
  return res.json({ Status: "ok", message: "RoninArc was healthy " });
});
app.use("/auth", authRouter);
app.use("/game", library_router);
app.use("/rawg", rawgRouter);
app.use("/dashboard", dashboardRouter);
app.use("/review", reviewRouter);
app.use("/collection", collectionRoutes);
app.use("/activity", activityRouter);
app.use("/play-session", playSessionRoutes);
app.use("/notes", noteRouter);
app.use("/backup", backupRouter);
app.use("/recommendations", recommendationRouter);

app.use("/provider", providerRoutes);
app.use("/ai", aiRoutes);

app.use((req: Request, res: Response, next: NextFunction) => {
  return res.status(404).json({ Status: "fail", error: "Route not found" });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  let statusCode;
  let status;
  let message;

  const bodyError = err as { type?: string; status?: number };
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = err.status;
    message = err.message;
  } else if (bodyError?.type === "entity.parse.failed") {
    statusCode = 400;
    status = "Fail";
    message = "Malformed JSON body";
  } else if (bodyError?.type === "entity.too.large") {
    statusCode = 413;
    status = "Fail";
    message = "Request body too large";
  } else {
    statusCode = 500;
    status = "Fail";
    message = "Internal Server Error";
  }

  // 4xx are already captured by the request log; server-side failures get the
  // full error (stack included) locally and in Sentry when configured.
  if (statusCode >= 500) {
    reportError(err, { method: req.method, path: req.originalUrl.split("?")[0], statusCode });
  }

  return res.status(statusCode).json({ Status: status, error: message });
});

export default app;
