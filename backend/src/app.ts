import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import authRouter from "./routes/auth";
import type { Request, Response, NextFunction } from "express";
import AppError from "./utils/AppError";
import library_router from "./routes/library";
import rawgRouter from "./routes/rawg";
import dashboardRouter from "./routes/dashboard";
dotenv.config();
const app = express();
app.use(helmet());
const allowedOrgin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: allowedOrgin }));

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  return res.json({ Status: "ok", message: "RoninArc was healthy " });
});
app.use("/auth", authRouter);
app.use("/game",library_router);
app.use("/rawg",rawgRouter);
app.use("/dashboard", dashboardRouter);





app.use((req: Request, res: Response, next: NextFunction) => {
  return res.status(404).json({ Status: "fail", error: "Route not found" });
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  let statusCode;
  let status;
  let message;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = err.status;
    message = err.message;
  } else {
    statusCode = 500;
    status = "Fail";
    message = "Internal Server Error";
  }

  return res.status(statusCode).json({ Status: status, error: message });
});

export default app;
