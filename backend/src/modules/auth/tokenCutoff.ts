import mongoose from "mongoose";
import usermodel from "./models/User";

/**
 * In the cloud, a password change or reset signs every device out at once: access tokens
 * issued before it stop working too, not just refresh tokens (a stolen token dies with the
 * reset). The cutoff is cached briefly per user; the cloud runs as one instance, so a change
 * here clears the cache straight away.
 */
const cache = new Map<string, { cutoff: number; until: number }>();
const TTL_MS = 60_000;

export async function tokensValidAfter(userId: string): Promise<number> {
  const hit = cache.get(userId);
  if (hit && hit.until > Date.now()) return hit.cutoff;
  const user: any = await usermodel.findById(userId).select("tokensValidAfter").lean();
  const cutoff = user?.tokensValidAfter ? new Date(user.tokensValidAfter).getTime() : 0;
  cache.set(userId, { cutoff, until: Date.now() + TTL_MS });
  return cutoff;
}

/** Every token issued before now stops working (password changed, reset, "log out everywhere"). */
export async function cutOffTokens(userId: string) {
  // Whole seconds, like a JWT's `iat`: a token issued in this same second still works.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  await usermodel.collection.updateOne({ _id: new mongoose.Types.ObjectId(String(userId)) }, { $set: { tokensValidAfter: now } });
  cache.delete(String(userId));
}
