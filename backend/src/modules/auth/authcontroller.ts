import type {
  Request,
  Response,
  NextFunction,
} from "express";

import * as authServices from "./authService";

import AppError from "../../shared/errors/AppError";

const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let username =
      req.body.username;

    let password =
      req.body.password;

    let email =
      req.body.email;

    if (
      !username ||
      typeof username !==
        "string" ||
      username.trim() === "" ||
      !password ||
      typeof password !==
        "string" ||
      password.trim() === ""
    ) {
      return next(
        new AppError(
          "Username and password are required",
          400
        )
      );
    }

    username =
      username.trim();

    password =
      password.trim();

    email =
      email !== undefined
        ? email.trim()
        : "";

    const data =
      await authServices.registerUser(
        username,
        password,
        email
      );

    return res.status(201).json({
      Status: "Success",
      Data: data,
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let username =
      req.body.username;

    let password =
      req.body.password;

    if (
      !username ||
      typeof username !==
        "string" ||
      username.trim() === "" ||
      !password ||
      typeof password !==
        "string" ||
      password.trim() === ""
    ) {
      return next(
        new AppError(
          "Username and password are required",
          400
        )
      );
    }

    username =
      username.trim();

    password =
      password.trim();

    const data =
      await authServices.loginUser(
        username,
        password
      );

    return res.status(200).json({
      Status: "Success",
      Data: data,
    });
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
  changePassword,

  loginUser,

  refreshToken,
  getCurrentUser,

  logoutUser,
  logoutAllDevices,
  deleteAccount
};