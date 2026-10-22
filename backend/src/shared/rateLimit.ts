import type { Request, Response, NextFunction } from "express";

/**
 * A small in-memory rate limiter (the cloud runs as one instance). `key` picks who is counted:
 * the caller's address by default, or e.g. the signed-in user. RATE_LIMIT_MULTIPLIER scales every
 * limit (the test suite sends everything from one address).
 */
export function rateLimit(options: { windowMs: number; max: number; message: string; key?: (req: Request) => string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(options.windowMs, 60_000)).unref();

  const max = options.max * Number(process.env.RATE_LIMIT_MULTIPLIER || 1);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.key ? options.key(req) : req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ Status: "Fail", error: options.message });
    }
    next();
  };
}
