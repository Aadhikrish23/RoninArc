import type {
  Request,
  Response,
  NextFunction,
} from "express";

import * as authServices from "./authService";

import AppError from "../../shared/errors/AppError";
import { isCloud } from "../../shared/runtimeMode";
import { markPhoneLinked } from "../sync/linkCodes";

/** The phone app says so in a header; the PC then stops offering "get your library on your phone". */
const fromPhone = (req: Request) => isCloud() && req.get("x-roninarc-client") === "phone";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Sign up: a name (shown in the app, not unique), an email (you sign in with it) and a password. */
const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Apps before 1.0.3 send the name as `username`.
    const name = str(req.body?.displayName) || str(req.body?.name) || str(req.body?.username);
    const email = str(req.body?.email);
    const password = str(req.body?.password);
    if (!email || !password) return next(new AppError("Email and password are required", 400));
    const data = await authServices.registerUser(name, password, email);
    if (fromPhone(req)) await markPhoneLinked(data.userdata.email).catch(() => undefined);
    return res.status(201).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

/** Sign in with an email and password. */
const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Apps before 1.0.3 send whatever was typed as `username`.
    const identifier = str(req.body?.email) || str(req.body?.username);
    const password = str(req.body?.password);
    if (!identifier || !password) return next(new AppError(authServices.SIGN_IN_WITH_EMAIL, 400));
    const data = await authServices.loginUser(identifier, password);
    if (fromPhone(req)) await markPhoneLinked(data.userdata.email).catch(() => undefined);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

/** An account from before email sign-in adds its email; the password confirms it. */
const setEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) return next(new AppError("Password is required", 400));
    const data = await authServices.setEmail(req.user.id, req.body?.email, password);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      refreshToken,
    } = req.body;

    if (!refreshToken) {
      return next(
        new AppError(
          "Refresh token is required",
          400
        )
      );
    }

    const data =
      await authServices.refreshAccessToken(
        refreshToken
      );

    return res.status(200).json({
      Status: "Success",
      Data: data,
    });
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      refreshToken,
    } = req.body;

    if (!refreshToken) {
      return next(
        new AppError(
          "Refresh token is required",
          400
        )
      );
    }

    await authServices.revokeRefreshToken(
      refreshToken
    );

    return res.status(200).json({
      Status: "Success",
      Message:
        "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
const getCurrentUser =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId =
        req.user.id;

      const data =
        await authServices.getCurrentUser(
          userId
        );

      return res.status(200).json({
        Status: "Success",
        Data: data,
      });
    } catch (error) {
      next(error);
    }
  };
  const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.user.id;

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (
      !currentPassword ||
      !newPassword
    ) {
      return next(
        new AppError(
          "Current password and new password are required",
          400
        )
      );
    }

    await authServices.changePassword(
      userId,
      currentPassword,
      newPassword
    );

    return res.status(200).json({
      Status: "Success",
      Message:
        "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.user.id;

    const { password } =
      req.body;

    if (!password) {
      return next(
        new AppError(
          "Password is required",
          400
        )
      );
    }

    await authServices.deleteAccount(
      userId,
      password
    );

    return res.status(200).json({
      Status: "Success",
      Message:
        "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
const logoutAllDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await authServices.logoutAllDevices(
      req.user.id
    );

    return res.status(200).json({
      Status: "Success",
      Message:
        "Logged out from all devices",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  registerUser,
  setEmail,
  changePassword,

  loginUser,

  refreshToken,
  getCurrentUser,

  logoutUser,
  logoutAllDevices,
  deleteAccount
};