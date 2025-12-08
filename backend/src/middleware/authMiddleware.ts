import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError";

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log("---- AUTH MIDDLEWARE START ----");
  console.log("Authorization header:", req.headers.authorization);

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No valid Bearer token in header");
    return next(new AppError("Not authenticated", 401));
  }

  const token = authHeader.split(" ")[1];
  console.log("Extracted token:", token);

  const JWT_SECRET = process.env.JWT_SECRET;
  console.log("JWT_SECRET exists?", !!JWT_SECRET);

  if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing in env!");
    return next(new AppError("Server config error: JWT_SECRET missing", 500));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    console.log("Verified payload:", payload);

    const id = payload.id;
    const name = payload.name;

    (req as any).user = { id, name };
    console.log("req.user set to:", (req as any).user);

    console.log("---- AUTH MIDDLEWARE END (SUCCESS) ----");
    next();
  } catch (error) {
    console.error("JWT verify error:", error);
    return next(new AppError("Invalid or expired token", 401));
  }
};

export default authMiddleware;
