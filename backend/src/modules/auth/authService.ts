import usermodel, { displayNameOf } from "./models/User";
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

/** Shortest password for a new account or a changed password. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Whether the typed password matches a stored hash. Passwords are used as typed; older accounts
 * stored them trimmed, so a version without the surrounding spaces is tried second.
 */
export async function passwordMatches(typed: string, hash: string): Promise<boolean> {
  if (typeof typed !== "string" || !hash) return false;
  if (await bcryptjs.compare(typed, hash)) return true;
  const trimmed = typed.trim();
  return trimmed !== typed && trimmed.length > 0 && (await bcryptjs.compare(trimmed, hash));
}

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

/** What the database keeps of a refresh token: its SHA-256, so a leaked copy of the data can't be used to sign in. */
export const hashRefreshToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * The stored values a presented token can match: its hash, and, only for the shape of an
 * older raw token (128 hex characters, issued before tokens were hashed), the token itself.
 * A stolen hash is 64 characters, so it can never be presented as a raw token.
 */
function storedForms(token: string): string[] {
  const forms = [hashRefreshToken(token)];
  if (/^[0-9a-f]{128}$/.test(token)) forms.push(token);
  return forms;
}

async function generateRefreshToken(userId: mongoose.Types.ObjectId) {
  const token = crypto.randomBytes(64).toString("hex");

  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await RefreshToken.create({
    userId,
    token: hashRefreshToken(token),
    expiresAt,
  });

  return token;
}

async function verifyRefreshToken(token: string) {
  const storedToken = await RefreshToken.findOne({
    token: { $in: storedForms(String(token ?? "")) },
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
    token: { $in: storedForms(String(token ?? "")) },
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

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The account with this email, ignoring case (older accounts may have stored it with capitals). */
export function findByEmail(email: string) {
  return usermodel.findOne({ email: new RegExp(`^${escapeRegex(email.trim())}$`, "i") });
}

/** What the apps get about the signed-in person. `name` is the display name. */
export function userdata(user: any) {
  const name = displayNameOf(user);
  return { name, displayName: name, email: user.email ?? null, updatedAt: user.updatedAt };
}

/**
 * A new internal handle: the email's local part, made unique. It's never typed or shown; it keeps
 * the unique `username` index (which sync and links key on) without anyone having to pick a name.
 */
async function newHandle(email: string, preferred?: string): Promise<string> {
  const ok = (h: string) => /^[a-z0-9][a-z0-9._-]{1,199}$/.test(h);
  const pref = (preferred ?? "").trim().toLowerCase();
  if (pref && ok(pref) && !(await usermodel.exists({ username: pref }))) return pref;
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+/, "").slice(0, 40);
  if (base.length < 3) base = `ronin${base}`;
  if (!(await usermodel.exists({ username: base }))) return base;
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${crypto.randomInt(1000, 100000)}`;
    if (!(await usermodel.exists({ username: candidate }))) return candidate;
  }
  return `${base}-${crypto.randomBytes(6).toString("hex")}`;
}

/** A valid email address, lower-cased. */
export function cleanEmail(raw: unknown): string {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || !EMAIL.test(email)) {
    throw new AppError("Enter a valid email address. You sign in with it, and it's how you reset a forgotten password.", 400);
  }
  return email;
}

async function registerUser(
  name: string,
  password: string,
  emailRaw?: string,
  options: { id?: string; passwordHash?: string; handle?: string } = {},
) {
  const plainPassword = typeof password === "string" ? password : "";
  const email = cleanEmail(emailRaw);
  const displayName = (name ?? "").trim().slice(0, 60) || email.split("@")[0];

  if (!options.passwordHash && plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }

  const existingUser = await findByEmail(email);

  if (existingUser) {
    // A repeat of a sign-up that just succeeded (a double click, a retry after a slow reply)
    // signs you in. Three playtesters got "already taken" for the account their first click
    // had created. Only for a just-made account with the same password.
    const justMade = Date.now() - new Date((existingUser as any).createdAt ?? 0).getTime() < 10 * 60 * 1000;
    // Only ever the same account: a PC creating its cloud account must never land in another one.
    const sameAccount = options.id === undefined || String(existingUser._id) === options.id;
    const samePassword = options.passwordHash
      ? options.passwordHash === existingUser.passwordHash
      : await passwordMatches(plainPassword, existingUser.passwordHash);
    if (justMade && sameAccount && samePassword) {
      return {
        userdata: userdata(existingUser),
        accessToken: generateAccessToken(existingUser._id, existingUser.username),
        refreshToken: await generateRefreshToken(existingUser._id),
      };
    }
    throw new AppError("An account with this email already exists. Sign in, or reset its password.", 409);
  }

  if (options.id !== undefined) {
    if (!mongoose.isValidObjectId(options.id) || (await usermodel.exists({ _id: options.id }))) {
      throw new AppError("This account can't be created with that id.", 409);
    }
  }

  const passwordHash = options.passwordHash ?? (await bcryptjs.hash(plainPassword, 11));

  let user: any;
  for (let attempt = 0; ; attempt++) {
    try {
      user = await usermodel.create({
        ...(options.id ? { _id: new mongoose.Types.ObjectId(options.id) } : {}),
        username: await newHandle(email, options.handle),
        displayName,
        email,
        passwordHash,
      });
      break;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const key = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0];
      // Two requests for one email got past the check above at the same moment: the second
      // is an ordinary "already exists", or, for the same fresh sign-up again, a sign-in.
      if (key === "email") {
        const winner = await findByEmail(email);
        if (winner && options.id === undefined) {
          const justMade = Date.now() - new Date((winner as any).createdAt ?? 0).getTime() < 10 * 60 * 1000;
          const samePassword = options.passwordHash ? options.passwordHash === winner.passwordHash : await passwordMatches(plainPassword, winner.passwordHash);
          if (justMade && samePassword) {
            return { userdata: userdata(winner), accessToken: generateAccessToken(winner._id, winner.username), refreshToken: await generateRefreshToken(winner._id) };
          }
        }
        throw new AppError("An account with this email already exists. Sign in, or reset its password.", 409);
      }
      // The internal handle is taken: a new handle, a few times, then give up.
      if (key === "username" && attempt < 3 && options.handle === undefined) continue;
      throw new AppError(key === "_id" ? "This account can't be created with that id." : "Couldn't create the account. Try again.", 409);
    }
  }

  return {
    userdata: userdata(user),
    accessToken: generateAccessToken(user._id, user.username),
    refreshToken: await generateRefreshToken(user._id),
  };
}

/* ============================
   LOGIN
============================ */

export const SIGN_IN_WITH_EMAIL = "Sign in with your email address and password.";

async function loginUser(identifier: string, password: string) {
  const typed = identifier.trim();
  if (typeof password !== "string") password = "";

  if (!typed || !password) throw new AppError(SIGN_IN_WITH_EMAIL, 400);

  let existingUser: any = null;
  if (EMAIL.test(typed)) {
    existingUser = await findByEmail(typed);
  } else {
    // One exception: on a PC, an account made before email sign-in that has no email yet still
    // signs in with its old name, and is then asked for an email. Everyone else uses email.
    const legacy = !isCloud() ? await usermodel.findOne({ username: typed.toLowerCase() }) : null;
    if (!legacy || legacy.email) throw new AppError(SIGN_IN_WITH_EMAIL, 400);
    existingUser = legacy;
  }

  let passwordMatch = !!existingUser && !!existingUser.passwordHash && (await passwordMatches(password, existingUser.passwordHash));

  // On a PC: the password may have changed in the cloud (a reset), or this is a new PC signing in
  // with a cloud account. The cloud decides; its password hash then comes down with the sync.
  if (!passwordMatch && !isCloud() && EMAIL.test(typed)) {
    const viaCloud = await localSync.signInThroughCloud(typed, password).catch(() => undefined);
    if (viaCloud) {
      existingUser = viaCloud;
      passwordMatch = true;
    }
  }

  if (!existingUser || !passwordMatch) {
    throw new AppError("Wrong email or password.", 401);
  }

  return {
    userdata: userdata(existingUser),
    accessToken: generateAccessToken(existingUser._id, existingUser.username),
    refreshToken: await generateRefreshToken(existingUser._id),
  };
}

/* ============================
   ADD AN EMAIL (accounts made before email sign-in)
============================ */

/**
 * An account from before email sign-in adds its email (the password confirms it). On a PC that
 * syncs, the cloud account takes it first, so the two never disagree about who owns an email.
 */
async function setEmail(userId: string, emailRaw: unknown, password: string) {
  const email = cleanEmail(emailRaw);
  const user = await usermodel.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (!password || !(await passwordMatches(password, user.passwordHash))) throw new AppError("Wrong password.", 401);
  const other = await findByEmail(email);
  if (other && String(other._id) !== String(user._id)) {
    throw new AppError("Another account already uses this email.", 409);
  }
  const link = isCloud() ? undefined : await localSync.cloudSession(userId);
  if (link) {
    try {
      await localSync.withCloud(link, (api) => api.patch("/auth/email", { email, password }));
    } catch (error) {
      throw localSync.cloudError(error, "RoninArc Cloud couldn't take that email.");
    }
  }
  user.email = email;
  await user.save();
  // A PC waiting to sync for want of an email can try again now.
  if (!isCloud()) void localSync.autoLinkIfWaiting(userId).catch(() => undefined);
  return userdata(user);
}

/* ============================
   REFRESH ACCESS TOKEN
============================ */

async function refreshAccessToken(refreshToken: string) {
  // One atomic step claims the token (and removes it), so two requests with the same token
  // can't both succeed. An older raw-stored token is consumed the same way; its replacement is hashed.
  const forms = storedForms(String(refreshToken ?? ""));
  const claimed = await RefreshToken.findOneAndDelete({ token: { $in: forms }, expiresAt: { $gt: new Date() } });

  if (!claimed) {
    // Say why, as before: gone (used, signed out) or past its date.
    const expired = await RefreshToken.exists({ token: { $in: forms } });
    throw new AppError(expired ? "Refresh token expired" : "Refresh token revoked", 401);
  }

  const user = await usermodel.findById(claimed.userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

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
    /** Internal handle; the apps show displayName. */
    username: user.username,
    displayName: displayNameOf(user),
    email: user.email ?? null,
    /** A PC account from before email sign-in: the app asks for one. */
    needsEmail: !user.email,
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

  const matches = await passwordMatches(currentPassword, user.passwordHash);

  if (!matches) {
    throw new AppError("Current password incorrect", 401);
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  }
  const samePassword = await passwordMatches(newPassword, user.passwordHash);

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

  const matches = await passwordMatches(password, user.passwordHash);

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
  logoutAllDevices,
  setEmail,
};
 

