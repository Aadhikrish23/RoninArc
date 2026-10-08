import express from "express";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../../shared/errors/AppError";
import { moduleLogger } from "../../shared/logging/logger";

const clientLogger = moduleLogger("client");

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

export const CLIENT_LOG_LIMITS = {
  entriesPerRequest: 50,
  messageLength: 2000,
  stackLength: 8000,
  contextBytes: 4000,
  entriesPerMinutePerIp: 300,
};

interface ClientLogEntry {
  level: Level;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  timestamp?: string;
  requestId?: string;
  sessionId?: string;
  release?: string;
}

// Small fixed-window limiter: the endpoint is reachable without auth (so a
// crash on the login page can still be reported), so cap what one IP can write.
const windows = new Map<string, { start: number; count: number }>();
function allow(ip: string, count: number): boolean {
  const now = Date.now();
  if (windows.size > 5000) {
    for (const [key, win] of windows) if (now - win.start > 60_000) windows.delete(key);
  }
  const w = windows.get(ip);
  if (!w || now - w.start > 60_000) {
    windows.set(ip, { start: now, count });
    return count <= CLIENT_LOG_LIMITS.entriesPerMinutePerIp;
  }
  w.count += count;
  return w.count <= CLIENT_LOG_LIMITS.entriesPerMinutePerIp;
}

function optionalUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ") || !process.env.JWT_SECRET) return undefined;
  try {
    return (jwt.verify(header.slice(7), process.env.JWT_SECRET) as { id: string }).id;
  } catch {
    return undefined;
  }
}

function validate(raw: unknown, index: number): ClientLogEntry {
  const fail = (why: string) => {
    throw new AppError(`entries[${index}]: ${why}`, 400);
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("must be an object");
  const e = raw as Record<string, unknown>;

  if (!LEVELS.includes(e.level as Level)) fail(`level must be one of ${LEVELS.join(", ")}`);
  if (typeof e.message !== "string" || !e.message.trim()) fail("message is required");
  if ((e.message as string).length > CLIENT_LOG_LIMITS.messageLength) fail(`message exceeds ${CLIENT_LOG_LIMITS.messageLength} characters`);
  if (e.stack !== undefined && (typeof e.stack !== "string" || e.stack.length > CLIENT_LOG_LIMITS.stackLength)) {
    fail(`stack must be text up to ${CLIENT_LOG_LIMITS.stackLength} characters`);
  }
  if (e.context !== undefined) {
    if (!e.context || typeof e.context !== "object" || Array.isArray(e.context)) fail("context must be an object");
    if (JSON.stringify(e.context).length > CLIENT_LOG_LIMITS.contextBytes) fail(`context exceeds ${CLIENT_LOG_LIMITS.contextBytes} bytes`);
  }
  for (const key of ["url", "timestamp", "requestId", "sessionId", "release"]) {
    if (e[key] !== undefined && (typeof e[key] !== "string" || (e[key] as string).length > 500)) fail(`${key} must be short text`);
  }
  return e as unknown as ClientLogEntry;
}

const ingest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return next(new AppError("entries must be a non-empty array", 400));
    }
    if (entries.length > CLIENT_LOG_LIMITS.entriesPerRequest) {
      return next(new AppError(`at most ${CLIENT_LOG_LIMITS.entriesPerRequest} entries per request`, 400));
    }
    const valid = entries.map(validate);

    // Signed-in users get their own budget; anonymous callers share one per IP.
    const userId = optionalUserId(req);
    if (!allow(userId ? `user:${userId}` : `ip:${req.ip || "unknown"}`, valid.length)) {
      return next(new AppError("Too many log entries, slow down", 429));
    }
    for (const entry of valid) {
      // The client's own requestId (of a failed API call) is kept separately so
      // it doesn't clobber this ingest request's id from the log context.
      const { level, message, requestId: clientRequestId, ...fields } = entry;
      clientLogger[level](
        { source: "client", ...fields, ...(clientRequestId ? { clientRequestId } : {}), ...(userId ? { userId } : {}) },
        message,
      );
    }
    return res.status(202).json({ Status: "Success", Data: { accepted: valid.length } });
  } catch (error) {
    next(error);
  }
};

const router = express.Router();
router.post("/client", express.json({ limit: "256kb" }), ingest);

export default router;
