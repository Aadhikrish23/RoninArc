import express from "express";
import type { Request, Response, NextFunction } from "express";
import authcontroller from "../controllers/authcontroller";


const authRouter = express.Router();

authRouter.post("/signup",authcontroller.registerUser);
authRouter.post("/login",authcontroller.loginUser);

export default authRouter;


