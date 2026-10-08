import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../../shared/errors/AppError";
import { moduleLogger } from "../../shared/logging/logger";
import { attachUserToRequestContext } from "../../shared/logging/requestLogger";

const log = moduleLogger("auth");
interface JwtPayload {
  id: string;
  name: string;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
  
    return next(new AppError("Not authenticated", 401));
  }

  const token = authHeader.split(" ")[1];
 

  const JWT_SECRET = process.env.JWT_SECRET;
 

  if (!JWT_SECRET) {
    
    return next(new AppError("Server config error: JWT_SECRET missing", 500));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
   

    const id = payload.id;
    const name = payload.name;

    req.user = { id, name };
    attachUserToRequestContext(id);
    next();
  } catch (error) {
    log.debug({ reason: error instanceof Error ? error.name : "unknown" }, "JWT verification failed");
    return next(new AppError("Invalid or expired token", 401));
  }
};

export default authMiddleware;
