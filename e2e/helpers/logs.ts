import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import { LOG_DIR, SENTRY_URL } from "../env";

export interface LogLine {
  level: number;
  time: string;
  msg: string;
  [key: string]: unknown;
}

/** Every structured log line the backend has written to its JSONL files. */
export function readLogLines(): LogLine[] {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .flatMap((f) => fs.readFileSync(path.join(LOG_DIR, f), "utf8").split("\n"))
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LogLine;
      } catch {
        return null;
      }
    })
    .filter((l): l is LogLine => l !== null);
}

export function rawLogText(): string {
  if (!fs.existsSync(LOG_DIR)) return "";
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => fs.readFileSync(path.join(LOG_DIR, f), "utf8"))
    .join("\n");
}

/** Waits (log writes are async) until a line matching `predicate` is on disk. */
export async function waitForLog(predicate: (line: LogLine) => boolean, timeout = 10_000): Promise<LogLine> {
  let found: LogLine | undefined;
  await expect
    .poll(
      () => {
        found = readLogLines().find(predicate);
        return Boolean(found);
      },
      { timeout, message: "expected log line was not written" },
    )
    .toBe(true);
  return found!;
}

export interface SentryEvent {
  project: string;
  message: string;
  type?: string;
  tags: Record<string, string>;
  platform?: string;
  environment?: string;
  hasStack: boolean;
  request: { headers?: Record<string, string>; data?: unknown } | null;
}

export async function sentryEvents(): Promise<SentryEvent[]> {
  const res = await fetch(`${SENTRY_URL}/__events`);
  return (await res.json()) as SentryEvent[];
}

export async function waitForSentryEvent(predicate: (e: SentryEvent) => boolean, timeout = 15_000): Promise<SentryEvent> {
  let found: SentryEvent | undefined;
  await expect
    .poll(
      async () => {
        found = (await sentryEvents()).find(predicate);
        return Boolean(found);
      },
      { timeout, message: "expected Sentry event was not received" },
    )
    .toBe(true);
  return found!;
}
