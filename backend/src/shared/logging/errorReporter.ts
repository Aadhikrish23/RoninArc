import * as Sentry from "@sentry/node";
import { logger } from "./logger";
import { requestContext } from "./requestContext";

export const sentryEnabled = () => Boolean(process.env.SENTRY_DSN);

/**
 * Online error tracking. A no-op unless SENTRY_DSN is configured -- the JSON
 * log files are always the source of truth, Sentry is the remote copy.
 */
export function initSentry() {
  if (!sentryEnabled()) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.APP_VERSION,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    // Dedupe (on by default) drops an error identical to the previous one;
    // SENTRY_DEDUPE=false keeps every occurrence, e.g. for test runs.
    integrations: (defaults) =>
      process.env.SENTRY_DEDUPE === "false" ? defaults.filter((i) => i.name !== "Dedupe") : defaults,
    beforeSend(event) {
      // Never ship request bodies or auth headers off the machine.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers.authorization;
      }
      return event;
    },
  });
}

/** Log an unexpected error locally and, when configured, report it to Sentry. */
export function reportError(err: unknown, context: Record<string, unknown> = {}) {
  const ctx = requestContext.getStore();
  logger.error({ err, ...context }, err instanceof Error ? err.message : String(err));

  if (!sentryEnabled()) return;
  Sentry.withScope((scope) => {
    if (ctx?.requestId) scope.setTag("requestId", ctx.requestId);
    if (ctx?.userId) scope.setUser({ id: ctx.userId });
    for (const [key, value] of Object.entries(context)) scope.setExtra(key, value);
    Sentry.captureException(err);
  });
}

export async function flushErrorReporting(timeoutMs = 2000) {
  if (sentryEnabled()) await Sentry.flush(timeoutMs);
}
