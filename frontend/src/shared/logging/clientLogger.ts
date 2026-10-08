import { API_BASE_URL } from "../api/config";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ClientLogEntry {
  level: LogLevel;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  timestamp: string;
  requestId?: string;
  sessionId: string;
  release?: string;
}

// Logs are queued in localStorage so nothing is lost while offline (or if the
// backend is briefly down); the queue drains to the backend's JSON log files
// as soon as it's reachable again.
const QUEUE_KEY = "roninarc_log_queue";
const MAX_QUEUE = 200;
const BATCH_SIZE = 50;
const FLUSH_DELAY_MS = 3000;
const LIMITS = { message: 2000, stack: 8000, context: 3500 };

const sessionId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
const release = import.meta.env.VITE_APP_VERSION as string | undefined;

type SentryLike = { captureException: (err: unknown, hint?: { extra?: Record<string, unknown> }) => unknown };
let sentry: SentryLike | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function readQueue(): ClientLogEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ClientLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: ClientLogEntry[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Storage full or blocked -- logging must never break the app.
  }
}

function clip(value: string | undefined, max: number) {
  return value && value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function safeContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  try {
    const json = JSON.stringify(context);
    return json.length > LIMITS.context ? { truncated: json.slice(0, LIMITS.context - 100) } : JSON.parse(json);
  } catch {
    return { unserializable: true };
  }
}

function authHeader(): Record<string, string> {
  const token = sessionStorage.getItem("roninarc_token") || localStorage.getItem("roninarc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function flushLogs(): Promise<void> {
  if (flushing || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  flushing = true;
  const batch = queue.slice(0, BATCH_SIZE);
  try {
    const res = await fetch(`${API_BASE_URL}/logs/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ entries: batch }),
      keepalive: true,
    });
    // 400 means this batch can never be accepted -- drop it rather than retry forever.
    if (res.ok || res.status === 400) {
      writeQueue(readQueue().slice(batch.length));
      if (readQueue().length > 0) scheduleFlush(0);
    }
  } catch {
    // Offline or backend down: keep the queue, the "online" listener retries.
  } finally {
    flushing = false;
  }
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushLogs();
  }, delay);
}

export function log(
  level: LogLevel,
  message: string,
  extra: { stack?: string; context?: Record<string, unknown>; requestId?: string } = {},
) {
  const entry: ClientLogEntry = {
    level,
    message: clip(message, LIMITS.message) || "(empty message)",
    stack: clip(extra.stack, LIMITS.stack),
    context: safeContext(extra.context),
    requestId: extra.requestId,
    url: typeof location !== "undefined" ? location.href.split("?")[0] : undefined,
    timestamp: new Date().toISOString(),
    sessionId,
    release,
  };
  writeQueue([...readQueue(), entry]);
  scheduleFlush(level === "error" ? 500 : FLUSH_DELAY_MS);
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  log("error", err.message, { stack: err.stack, context: { name: err.name, ...context } });
  sentry?.captureException(err, { extra: context });
}

/** Browser Sentry, only loaded (and only bundled into a chunk) when a DSN is set. */
async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
    release,
    beforeSend(event) {
      if (event.request?.headers) delete event.request.headers.Authorization;
      return event;
    },
  });
  sentry = Sentry;
}

let installed = false;
export function installErrorMonitoring() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    captureException(event.error ?? event.message, { source: "window.onerror", file: event.filename, line: event.lineno });
  });
  window.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason, { source: "unhandledrejection" });
  });
  window.addEventListener("online", () => void flushLogs());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushLogs();
  });

  void initSentry();
  // Anything queued while the app was last offline/closed goes out now.
  scheduleFlush(1000);
}
