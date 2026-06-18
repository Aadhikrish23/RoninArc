import express from "express";
import type { Request, Response, NextFunction } from "express";
import authcontroller from "./authcontroller";
import authMiddleware from "./authMiddleware";

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
authRouter.delete("/account", authMiddleware, authcontroller.deleteAccount);

export default authRouter;
