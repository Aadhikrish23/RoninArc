import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { moduleLogger } from "./logger";
import { requestContext } from "./requestContext";

const httpLogger = moduleLogger("http");
const VALID_INCOMING_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Tags every request with an id (reusing a well-formed incoming X-Request-Id
 * so the frontend can correlate) and logs one line per response. Query
 * strings are dropped -- they can carry search text or OAuth parameters.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  const requestId = incoming && VALID_INCOMING_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", requestId);
  const started = process.hrtime.bigint();
  const store = { requestId } as { requestId: string; userId?: string };

  res.on("finish", () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    const path = req.originalUrl.split("?")[0];
    const status = res.statusCode;
    const level = path === "/health" ? "debug" : status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    if (req.user?.id) store.userId = req.user.id;
    // Log inside the request's context so requestId/userId come from the mixin.
    requestContext.run(store, () =>
      httpLogger[level]({ type: "http", method: req.method, path, status, durationMs }, `${req.method} ${path} ${status} ${durationMs}ms`),
    );
  });

  requestContext.run(store, () => next());
}

/** Once auth has run, record who the request belongs to for later log lines. */
export function attachUserToRequestContext(userId: string) {
  const store = requestContext.getStore();
  if (store) store.userId = userId;
}
