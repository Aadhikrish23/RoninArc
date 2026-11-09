import crypto from "node:crypto";
import mongoose from "mongoose";
import AppError from "../../shared/errors/AppError";
import usermodel from "../auth/models/User";
import * as authServices from "../auth/authService";
import { findByEmail } from "../auth/authService";
import { LinkCode } from "./syncModels";

/** How long a code shown on the PC works. */
export const LINK_CODE_TTL_MS = 10 * 60_000;

/** Codes are kept as an HMAC under the server's secret, never as the digits themselves. */
function hashCode(code: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError("Server config error: JWT_SECRET missing", 500);
  return crypto.createHmac("sha256", secret).update(`link-code:${code}`).digest("hex");
}

/** "123 456", "123-456", "roninarc://link/123456": the six digits, or undefined. */
export function codeDigits(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : undefined;
}

/** A new code for this account; any older one stops working. */
export async function createLinkCode(userIdRaw: string): Promise<{ code: string; expiresAt: string }> {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await LinkCode.findOneAndUpdate({ userId }, { $set: { codeHash: hashCode(code), expiresAt } }, { upsert: true });
      return { code, expiresAt: expiresAt.toISOString() };
    } catch (error: any) {
      // Another account's live code has the same digits: draw again.
      if (error?.code !== 11000) throw error;
    }
  }
  throw new AppError("Couldn't make a code. Try again.", 503);
}

/** A phone trading a code for a session. Each code works once. */
export async function claimLinkCode(input: unknown) {
  const code = codeDigits(input);
  if (!code) throw new AppError("Enter the 6-digit code shown on your PC.", 400);
  const found = await LinkCode.findOneAndDelete({ codeHash: hashCode(code), expiresAt: { $gt: new Date() } }).lean();
  if (!found) throw new AppError("That code didn't work. Codes last 10 minutes and work once; make a new one on your PC.", 400);
  const user = await usermodel.findById(found.userId);
  if (!user) throw new AppError("That code didn't work. Make a new one on your PC.", 400);
  if (!user.phoneLinkedAt) await usermodel.updateOne({ _id: user._id }, { $set: { phoneLinkedAt: new Date() } });
  return {
    userdata: authServices.userdata(user),
    accessToken: authServices.generateAccessToken(user._id, user.username),
    refreshToken: await authServices.generateRefreshToken(user._id),
  };
}

/** A phone signed in (password or code): the PC stops offering "get your library on your phone". */
export async function markPhoneLinked(email: string | null | undefined) {
  if (!email) return;
  const user = await findByEmail(email);
  if (user && !user.phoneLinkedAt) await usermodel.updateOne({ _id: user._id }, { $set: { phoneLinkedAt: new Date() } });
}
