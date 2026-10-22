import usermodel from "./models/User";
import RefreshToken from "./models/RefreshToken";

import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import AppError from "../../shared/errors/AppError";
import { deleteUserData } from "./userCleanupService";
import { isCloud } from "../../shared/runtimeMode";
import * as localSync from "../sync/localSync";
import { cutOffTokens } from "./tokenCutoff";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;

/* ============================
   ACCESS TOKEN
============================ */

function generateAccessToken(
  userId: mongoose.Types.ObjectId,
  username: string,
) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new AppError("JWT Secret is missing", 500);
  }

  return jwt.sign(
    {
      id: userId,
      name: username,
    },
    jwtSecret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    },
  );
}

/* ============================
   REFRESH TOKEN
============================ */

async function generateRefreshToken(userId: mongoose.Types.ObjectId) {
  const token = crypto.randomBytes(64).toString("hex");

  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await RefreshToken.create({
    userId,
    token,
    expiresAt,
  });

  return token;
}

async function verifyRefreshToken(token: string) {
  const storedToken = await RefreshToken.findOne({
    token,
  });

  if (!storedToken) {
    throw new AppError("Refresh token revoked", 401);
  }

  if (storedToken.expiresAt < new Date()) {
    throw new AppError("Refresh token expired", 401);
  }

  return {
    userId: storedToken.userId.toString(),
  };
}

async function revokeRefreshToken(token: string) {
  await RefreshToken.findOneAndDelete({
    token,
  });
}

async function revokeAllUserTokens(userId: mongoose.Types.ObjectId) {
  await RefreshToken.deleteMany({
    userId,
  });
}

/* ============================
   REGISTER
============================ */

async function registerUser(name: string, password: string, email?: string, options: { id?: string } = {}) {
  const username = name.trim().toLowerCase();

  const plainPassword = password.trim();

  email = email?.trim();

  if (username.length < 3 || plainPassword.length < 6) {
    throw new AppError("Invalid input", 400);
  }

  if (isCloud()) {
    if (!email || !EMAIL.test(email)) throw new AppError("Enter a valid email address. It's how you reset a forgotten password.", 400);
    email = email.toLowerCase();
  }

  const existingUser = await usermodel.findOne({
    username,
  });

  if (existingUser) {
    // A repeat of a sign-up that just succeeded (a double click, a retry after a slow reply)
    // signs you in. Three playtesters got "Username is already taken" for the account their
    // first click had created. Only for a just-made account with the same password.
    const justMade = Date.now() - new Date((existingUser as any).createdAt ?? 0).getTime() < 10 * 60 * 1000;
    // Only ever the same account: a PC creating its cloud account must never land in another one.
    const sameAccount = options.id === undefined || String(existingUser._id) === options.id;
    if (justMade && sameAccount && (await bcryptjs.compare(plainPassword, existingUser.passwordHash))) {
      return {
        userdata: { name: existingUser.username, email: existingUser.email, updatedAt: existingUser.updatedAt },
        accessToken: generateAccessToken(existingUser._id, existingUser.username),
        refreshToken: await generateRefreshToken(existingUser._id),
      };
    }
    throw new AppError("Username is already taken", 409);
  }

  if (isCloud() && (await usermodel.exists({ email }))) {
    throw new AppError("An account with this email already exists. Sign in, or reset its password.", 409);
  }
  if (options.id !== undefined) {
    if (!mongoose.isValidObjectId(options.id) || (await usermodel.exists({ _id: options.id }))) {
      throw new AppError("This account can't be created with that id.", 409);
    }
  }

  const passwordHash = await bcryptjs.hash(plainPassword, 11);

  const user = await usermodel.create({
    ...(options.id ? { _id: new mongoose.Types.ObjectId(options.id) } : {}),
    username,
    email,
    passwordHash,
  });

  const accessToken = generateAccessToken(user._id, user.username);

  const refreshToken = await generateRefreshToken(user._id);

  return {
    userdata: {
      name: user.username,
      email: user.email,
      updatedAt: user.updatedAt,
    },

    accessToken,

    refreshToken,
  };
}

/* ============================
   LOGIN
============================ */

async function loginUser(username: string, password: string) {
  username = username.trim().toLowerCase();

  password = password.trim();

  if (username.length < 3 || password.length < 6) {
    throw new AppError("Invalid input", 400);
  }

  let existingUser = await usermodel.findOne({
    username,
  });

  let passwordMatch = !!existingUser && !!existingUser.passwordHash && (await bcryptjs.compare(password, existingUser.passwordHash));

  // On a PC: the password may have changed in the cloud (a reset), or this is a new PC signing in
  // with a cloud account. The cloud decides; its password hash then comes down with the sync.
  if (!passwordMatch && !isCloud()) {
    const viaCloud = await localSync.signInThroughCloud(username, password).catch(() => undefined);
    if (viaCloud) {
      existingUser = viaCloud;
      passwordMatch = true;
    }
  }

  if (!existingUser || !passwordMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const accessToken = generateAccessToken(
    existingUser._id,
    existingUser.username,
  );

  const refreshToken = await generateRefreshToken(existingUser._id);

  return {
    userdata: {
      name: existingUser.username,
      email: existingUser.email,
      updatedAt: existingUser.updatedAt,
    },

    accessToken,

    refreshToken,
  };
}

/* ============================
   REFRESH ACCESS TOKEN
============================ */

async function refreshAccessToken(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken);

  const user = await usermodel.findById(payload.userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  await revokeRefreshToken(refreshToken);

  const newRefreshToken = await generateRefreshToken(user._id);

  const accessToken = generateAccessToken(user._id, user.username);

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}
async function getCurrentUser(userId: string) {
  const user = await usermodel.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await usermodel.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const matches = await bcryptjs.compare(currentPassword, user.passwordHash);

  if (!matches) {
    throw new AppError("Current password incorrect", 401);
  }
  if (newPassword.trim().length < 6) {
    throw new AppError("New password must be at least 6 characters", 400);
  }
  const samePassword = await bcryptjs.compare(newPassword, user.passwordHash);

  if (samePassword) {
    throw new AppError("New password must be different", 400);
  }
  const link = isCloud() ? undefined : await localSync.cloudSession(userId);
  if (link) {
    try {
      await localSync.withCloud(link, (api) => api.patch("/auth/change-password", { currentPassword, newPassword }));
      // The cloud signs every device out on a password change; this PC signs straight back in.
      await localSync.reconnect(userId, newPassword);
    } catch (error) {
      throw localSync.cloudError(error, "Couldn't change the password in RoninArc Cloud.");
    }
  }

  user.passwordHash = await bcryptjs.hash(newPassword, 11);

  await user.save();

  await revokeAllUserTokens(user._id);
  await cutOffTokens(String(user._id));
}

async function deleteAccount(userId: string, password: string) {
  const user = await usermodel.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const matches = await bcryptjs.compare(password, user.passwordHash);

  if (!matches) {
    throw new AppError("Invalid password", 401);
  }

  const link = isCloud() ? undefined : await localSync.cloudSession(userId);
  if (link) {
    try {
      await localSync.withCloud(link, (api) => api.delete("/auth/account", { data: { password } }));
    } catch (error) {
      throw localSync.cloudError(error, "Couldn't delete the RoninArc Cloud account. Nothing was deleted.");
    }
    await localSync.unlink(userId);
  }

  await deleteUserData(userId);

  await usermodel.findByIdAndDelete(userId);

  return {
    success: true,
  };
}
async function logoutAllDevices(
  userId: string
) {
  await revokeAllUserTokens(
    new mongoose.Types.ObjectId(userId)
  );
  await cutOffTokens(userId);
}
export {
  registerUser,
  loginUser,
  getCurrentUser,
  changePassword,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  deleteAccount,
  logoutAllDevices
};
 

