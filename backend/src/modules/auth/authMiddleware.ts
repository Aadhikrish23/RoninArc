import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../../shared/errors/AppError";
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
  console.log("AUTH HEADER:", req.headers.authorization);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
   

    const id = payload.id;
    const name = payload.name;

    req.user = { id, name };
    
    console.log("JWT VERIFIED");
    next();
  } catch (error) {
    console.log("JWT VERIFY FAILED", error);
    return next(new AppError("Invalid or expired token", 401));
  }
};

export default authMiddleware;
