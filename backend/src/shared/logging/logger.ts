import path from "node:path";
import util from "node:util";
import pino from "pino";
import { DailyFileStream } from "./dailyFileStream";
import { requestContext } from "./requestContext";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// backend/logs both from src/ (ts-node) and dist/ (compiled) -- the packaged
// desktop app overrides this with a folder under the user's app-data dir.
export const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, "../../../logs");

export const appLogFile = new DailyFileStream(
  LOG_DIR,
  "app",
  Number(process.env.LOG_RETENTION_DAYS) || 14,
);

const LEVEL_LABEL: Record<number, string> = { 10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL" };
const OMIT_FROM_CONSOLE = new Set(["level", "time", "msg", "service", "pid", "hostname"]);

// Human-readable single line on stdout (or raw JSON with LOG_FORMAT=json).
// Either way it contains the message text, which the desktop app relies on
// to detect "Server is up and running".
const consoleStream = {
  write(line: string) {
    if (process.env.LOG_FORMAT === "json") {
      process.stdout.write(line);
      return;
    }
    try {
      const entry = JSON.parse(line);
      const extras = Object.fromEntries(Object.entries(entry).filter(([k]) => !OMIT_FROM_CONSOLE.has(k)));
      const time = String(entry.time ?? "").slice(11, 19);
      const label = (LEVEL_LABEL[entry.level] ?? String(entry.level).toUpperCase()).padEnd(5);
      const tail = Object.keys(extras).length > 0 ? ` ${JSON.stringify(extras)}` : "";
      process.stdout.write(`${time} ${label} ${entry.msg ?? ""}${tail}\n`);
    } catch {
      process.stdout.write(line);
    }
  },
};

export const REDACT_PATHS = [
  "password",
  "*.password",
  "currentPassword",
  "*.currentPassword",
  "newPassword",
  "*.newPassword",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "*.headers.authorization",
  "authorizationCode",
  "*.authorizationCode",
  "openIdParams",
  "*.openIdParams",
];

export const logger = pino(
  {
    level,
    base: { service: "roninarc-backend" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    mixin() {
      const ctx = requestContext.getStore();
      return ctx ? { requestId: ctx.requestId, ...(ctx.userId ? { userId: ctx.userId } : {}) } : {};
    },
  },
  pino.multistream([
    { level: level as pino.Level, stream: appLogFile },
    { level: level as pino.Level, stream: consoleStream },
  ]),
);

export const moduleLogger = (module: string) => logger.child({ module });

/**
 * Routes legacy console.* calls (still used across older modules) into the
 * structured log, so nothing printed by the app is lost from the JSON files.
 */
export function bridgeConsole() {
  const consoleLogger = logger.child({ source: "console" });
  const forward = (method: "debug" | "info" | "warn" | "error") => (...args: unknown[]) =>
    consoleLogger[method](util.format(...args));
  console.log = forward("info");
  console.info = forward("info");
  console.debug = forward("debug");
  console.warn = forward("warn");
  console.error = forward("error");
}
