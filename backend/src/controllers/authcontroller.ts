import type { Request, Response, NextFunction } from "express";
import * as authServices from "../services/authService";
import AppError from "../utils/AppError";

const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let username = req.body.username;
    let password = req.body.password;
    let email = req.body.email;

    if (
      !username ||
      typeof username !== "string" ||
      username.trim() === "" ||
      !password ||
      typeof password !== "string" ||
      password.trim() === ""
    ) {
      next(new AppError("Username and password are required", 400));
      return;
    }
    username = req.body.username.trim();
    password = req.body.password.trim();
    email = email !== undefined ? req.body.email.trim() : "";
    const data = await authServices.registerUser(username, password, email);

    return res.status(201).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let username = req.body.username;
    let password = req.body.password;

    if (
      !username ||
      typeof username !== "string" ||
      username.trim() === "" ||
      !password ||
      typeof password !== "string" ||
      password.trim() === ""
    ) {
      next(new AppError("Username and password are required", 400));
      return ;
    }
    username = req.body.username.trim();
    password = req.body.password.trim();

    const data = await authServices.loginuser(username, password);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

export default {
  registerUser,
  loginUser,
};
