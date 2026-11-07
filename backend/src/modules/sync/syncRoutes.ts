import express from "express";
import mongoose from "mongoose";
import usermodel from "../auth/models/User";
import type { Request, Response, NextFunction } from "express";
import authMiddleware from "../auth/authMiddleware";
import * as authServices from "../auth/authService";
import AppError from "../../shared/errors/AppError";
import { isCloud } from "../../shared/runtimeMode";
import { rateLimit } from "../../shared/rateLimit";
import { applyPush, pull } from "./cloudSync";
import * as localSync from "./localSync";

const PC_PASSWORD_HASH = /^\$2[aby]\$1[0-2]\$[./A-Za-z0-9]{53}$/;

const syncRouter = express.Router();
// Pushes can carry a whole library on first link.
syncRouter.use(express.json({ limit: "15mb" }));

const userId = (req: Request) => String((req as any).user?.id);
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

if (isCloud()) {
  // A PC creating the cloud account for its existing library keeps its account id.
  syncRouter.post(
    "/register",
    rateLimit({ windowMs: 60 * 60_000, max: 10, message: "Too many sign-ups from this network. Try again later." }),
    wrap(async (req, res) => {
      const { username, password, passwordHash, email, userId: id } = req.body ?? {};
      if (typeof username !== "string") throw new AppError("Username and password are required", 400);
      if (passwordHash !== undefined) {
        // The PC's account keeps its password. The cost is capped: every sign-in pays it.
        if (typeof passwordHash !== "string" || !PC_PASSWORD_HASH.test(passwordHash) || typeof id !== "string") {
          throw new AppError("That password can't be used for a cloud account.", 400);
        }
      } else if (typeof password !== "string") {
        throw new AppError("Username and password are required", 400);
      }
      const data = await authServices.registerUser(username, passwordHash ? "" : password, email, {
        id: typeof id === "string" ? id : undefined,
        passwordHash,
      });
      res.status(201).json({ Status: "Success", Data: data });
    }),
  );
  syncRouter.post("/push", authMiddleware, wrap(async (req, res) => res.json(await applyPush(userId(req), req.body ?? {}))));
  syncRouter.get("/pull", authMiddleware, wrap(async (req, res) => res.json(await pull(userId(req), typeof req.query.since === "string" ? req.query.since : undefined))));
} else {
  syncRouter.get("/status", authMiddleware, wrap(async (req, res) => res.json(await localSync.status(userId(req)))));
  syncRouter.post(
    "/link",
    authMiddleware,
    wrap(async (req, res) => {
      const { mode, username, email, password } = req.body ?? {};
      if (mode !== "create" && mode !== "signin") throw new AppError('mode must be "create" or "signin"', 400);
      // Creating needs nothing: it uses this PC's account unless told otherwise.
      if (mode === "signin" && (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password)) {
        throw new AppError("Username and password are required", 400);
      }
      const result = await localSync.link(userId(req), {
        mode,
        username: typeof username === "string" ? username : undefined,
        email: typeof email === "string" ? email : undefined,
        password: typeof password === "string" ? password : undefined,
      });
      // Linked to an existing cloud account: this account's id changed, so sign in afresh.
      let session;
      if (result.moved) {
        const id = new mongoose.Types.ObjectId(result.userId);
        const user = await usermodel.findById(id).select("username").lean();
        session = {
          accessToken: authServices.generateAccessToken(id, user?.username ?? String(username).trim().toLowerCase()),
          refreshToken: await authServices.generateRefreshToken(id),
        };
      }
      res.json({ ...result.status, moved: result.moved, session });
    }),
  );
  syncRouter.post(
    "/reconnect",
    authMiddleware,
    wrap(async (req, res) => {
      if (typeof req.body?.password !== "string") throw new AppError("Password is required", 400);
      res.json(await localSync.reconnect(userId(req), req.body.password));
    }),
  );
  syncRouter.post("/unlink", authMiddleware, wrap(async (req, res) => res.json(await localSync.unlink(userId(req)))));
  syncRouter.post(
    "/now",
    authMiddleware,
    wrap(async (req, res) => {
      await localSync.syncNow(userId(req));
      res.json(await localSync.status(userId(req)));
    }),
  );
}

export default syncRouter;
