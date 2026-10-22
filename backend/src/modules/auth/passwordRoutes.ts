import express from "express";
import type { Request, Response, NextFunction } from "express";
import AppError from "../../shared/errors/AppError";
import { cloudApiUrl, isCloud } from "../../shared/runtimeMode";
import { rateLimit } from "../../shared/rateLimit";
import { requestPasswordReset, resetPassword, resetPage } from "./passwordReset";
import { cloudError, cloudHttp } from "../sync/localSync";

const router = express.Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const SENT = "If an account matches, we've emailed a link to reset its password. Check your inbox (and spam).";

const forgotLimit = rateLimit({ windowMs: 15 * 60_000, max: 5, message: "Too many reset requests. Try again in a few minutes." });

router.post(
  "/forgot-password",
  forgotLimit,
  wrap(async (req, res) => {
    const identifier = String(req.body?.identifier ?? req.body?.email ?? req.body?.username ?? "");
    if (isCloud()) {
      await requestPasswordReset(identifier);
      return res.json({ Status: "Success", Message: SENT });
    }
    // On a PC: accounts that sync reset through RoninArc Cloud; the new password works here
    // on the next sign-in.
    if (!cloudApiUrl()) throw new AppError("Password reset needs RoninArc Cloud, which isn't set up in this build.", 503);
    try {
      const { data } = await cloudHttp(10_000).post("/auth/forgot-password", { identifier });
      return res.json({ Status: "Success", Message: data?.Message ?? SENT });
    } catch (error) {
      throw cloudError(error, "Couldn't ask RoninArc Cloud for a reset link.");
    }
  }),
);

if (isCloud()) {
  router.get("/reset-password", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(resetPage(typeof req.query.token === "string" ? req.query.token : ""));
  });
  router.post(
    "/reset-password",
    rateLimit({ windowMs: 15 * 60_000, max: 20, message: "Too many attempts. Try again in a few minutes." }),
    wrap(async (req, res) => {
      await resetPassword(req.body?.token, req.body?.password);
      res.json({ Status: "Success", Message: "Your password is changed. Sign in with it." });
    }),
  );
}

export default router;
