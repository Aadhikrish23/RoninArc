import express from "express";
import type { Request, Response, NextFunction } from "express";
import authcontroller from "./authcontroller";
import authMiddleware from "./authMiddleware";
import { rateLimit } from "../../shared/rateLimit";

const authRouter = express.Router();
authRouter.get("/me", authMiddleware, authcontroller.getCurrentUser);
authRouter.post("/register", authcontroller.registerUser);

authRouter.post("/login", authcontroller.loginUser);

authRouter.post("/refresh", authcontroller.refreshToken);

authRouter.post("/logout", authcontroller.logoutUser);
authRouter.patch(
  "/change-password",
  authMiddleware,
  authcontroller.changePassword,
);
// An account from before email sign-in adds its email (password-confirmed).
authRouter.patch(
  "/email",
  authMiddleware,
  rateLimit({ windowMs: 15 * 60_000, max: 10, message: "Too many tries. Wait a few minutes.", key: (req) => String((req as any).user?.id) }),
  authcontroller.setEmail,
);
authRouter.delete("/account", authMiddleware, authcontroller.deleteAccount);
authRouter.post("/logout-all", authMiddleware, authcontroller.logoutAllDevices);

export default authRouter;
