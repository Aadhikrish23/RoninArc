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
import { claimLinkCode, createLinkCode, nameAvailability } from "./linkCodes";

const PC_PASSWORD_HASH = /^\$2[aby]\$1[0-2]\$[./A-Za-z0-9]{53}$/;

const syncRouter = express.Router();
// Pushes can carry a whole library on first link.
syncRouter.use(express.json({ limit: "15mb" }));

const userId = (req: Request) => String((req as any).user?.id);
/** After linking to an existing cloud account the id changed: a fresh session for the new one. */
async function sessionFor(result: { moved: boolean; userId: string }, fallbackName?: string) {
  if (!result.moved) return undefined;
  const id = new mongoose.Types.ObjectId(result.userId);
  const user = await usermodel.findById(id).select("username").lean();
  return {
    accessToken: authServices.generateAccessToken(id, user?.username ?? String(fallbackName ?? "").trim().toLowerCase()),
    refreshToken: await authServices.generateRefreshToken(id),
  };
}

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
  // The sign-up form asks while you type. Says only taken/free (and free names near it).
  syncRouter.get(
    "/name-available",
    rateLimit({ windowMs: 15 * 60_000, max: 120, message: "Too many name checks. Try again in a few minutes." }),
    wrap(async (req, res) => res.json(await nameAvailability(req.query.username))),
  );
  // A linked PC asks for a code to show (with a QR code); a phone trades it for a session.
  syncRouter.post(
    "/link-code",
    authMiddleware,
    rateLimit({ windowMs: 15 * 60_000, max: 20, message: "Too many codes. Wait a few minutes.", key: (req) => userId(req) }),
    wrap(async (req, res) => res.status(201).json(await createLinkCode(userId(req)))),
  );
  syncRouter.post(
    "/link-code/claim",
    rateLimit({ windowMs: 15 * 60_000, max: 10, message: "Too many tries. Wait a few minutes, then make a new code on your PC." }),
    wrap(async (req, res) => res.json({ Status: "Success", Data: await claimLinkCode(req.body?.code) })),
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
      res.json({ ...result.status, moved: result.moved, session: await sessionFor(result, username) });
    }),
  );
  // "Sync with my other devices" at sign-in: link if possible, never fail. The password (just
  // typed) only tries the existing cloud account of the same name; it isn't kept.
  syncRouter.post(
    "/auto-link",
    authMiddleware,
    wrap(async (req, res) => {
      const password = typeof req.body?.password === "string" && req.body.password ? req.body.password : undefined;
      const result = await localSync.autoLink(userId(req), password);
      res.json({ ...result.status, result: result.result, moved: result.moved, session: await sessionFor(result) });
    }),
  );
  syncRouter.delete("/auto-link", authMiddleware, wrap(async (req, res) => res.json(await localSync.dropAutoLink(userId(req)))));
  // The sign-up form asks before the account exists, so no sign-in here.
  syncRouter.get(
    "/name-available",
    rateLimit({ windowMs: 15 * 60_000, max: 120, message: "Too many name checks. Try again in a few minutes." }),
    wrap(async (req, res) => {
      if (typeof req.query.username !== "string" || req.query.username.trim().length < 3) throw new AppError("Usernames are at least 3 characters.", 400);
      res.json(await localSync.nameAvailable(req.query.username));
    }),
  );
  syncRouter.post("/phone-code", authMiddleware, wrap(async (req, res) => res.status(201).json(await localSync.phoneCode(userId(req)))));
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
