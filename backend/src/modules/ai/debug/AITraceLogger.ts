// TEMP DEBUG ONLY

import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "async_hooks";

export class AITraceLogger {
  private readonly logsDir = path.join(__dirname, "../../../../logs");
  private readonly filePath: string;
  private readonly startTime: Date;

  // Tracing statistics summary
  private user: string = "unknown";
  private request: string = "unknown";
  private status: string = "FAILED";
  private intentCount: number = 0;
  private resolvedCapabilities: string[] = [];
  private contextCategories: string[] = [];
  private executionStepsCount: number = 0;

  private constructor(public readonly requestId: string) {
    const now = new Date();
    this.startTime = now;
    const formatNum = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${formatNum(now.getMonth() + 1)}-${formatNum(now.getDate())}`;
    const timeStr = `${formatNum(now.getHours())}-${formatNum(now.getMinutes())}-${formatNum(now.getSeconds())}`;
    const shortId = requestId.substring(0, 4);

    const filename = `${dateStr}_${timeStr}_request-${shortId}.log`;
    this.filePath = path.join(this.logsDir, filename);

    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch {
      // Fail silently
    }
  }

  private static readonly storage = new AsyncLocalStorage<AITraceLogger>();

  /**
   * Starts a request-scoped trace session and executes the callback within its context.
   */
  static run<T>(requestId: string, callback: () => Promise<T>): Promise<T> {
    const instance = new AITraceLogger(requestId);
    return this.storage.run(instance, callback);
  }

  /**
   * Retrieves the current request's trace logger instance.
   */
  static current(): AITraceLogger | undefined {
    return this.storage.getStore();
  }

  /**
   * Updates trace summary statistics.
   */
  updateStats(stats: Partial<{
    user: string;
    request: string;
    status: string;
    intentCount: number;
    resolvedCapabilities: string[];
    contextCategories: string[];
    executionStepsCount: number;
  }>): void {
    if (stats.user !== undefined) this.user = stats.user;
    if (stats.request !== undefined) this.request = stats.request;
    if (stats.status !== undefined) this.status = stats.status;
    if (stats.intentCount !== undefined) this.intentCount = stats.intentCount;
    if (stats.resolvedCapabilities !== undefined) this.resolvedCapabilities = stats.resolvedCapabilities;
    if (stats.contextCategories !== undefined) this.contextCategories = stats.contextCategories;
    if (stats.executionStepsCount !== undefined) this.executionStepsCount = stats.executionStepsCount;
  }

  /**
   * Writes the starting trace header.
   */
  writeHeader(userId: string, request: string): void {
    try {
      this.user = userId;
      this.request = request;

      const header = `====================================================
RONINARC AI TRACE

Request ID:
${this.requestId}

Started:
${this.startTime.toISOString()}

User:
${userId}

Request:
${request}
====================================================\n\n`;
      fs.writeFileSync(this.filePath, header, "utf8");
    } catch {
      // Fail silently
    }
  }

  /**
   * Logs a successful operation event.
   */
  log(layer: string, event: string, payload: unknown, elapsedMs?: number): void {
    try {
      const timestamp = new Date().toISOString();
      const payloadStr = payload !== undefined ? JSON.stringify(payload, null, 4) : "";
      const durationStr = elapsedMs !== undefined ? `Duration:\n${elapsedMs} ms\n\n` : "";

      const entry = `---------------------------------------------------
[${timestamp}]

Layer:
${layer}

Event:
${event}

${durationStr}Payload:
${payloadStr}
---------------------------------------------------
\n`;
      fs.appendFileSync(this.filePath, entry, "utf8");
    } catch {
      // Fail silently
    }
  }

  /**
   * Logs a layer exception event.
   */
  error(layer: string, exception: any): void {
    try {
      const timestamp = new Date().toISOString();
      const entry = `---------------------------------------------------
[${timestamp}]

Layer:
${layer}

Event:
Exception

Message:
${exception.message || String(exception)}

Stack:
${exception.stack || "No stack trace available."}
---------------------------------------------------
\n`;
      fs.appendFileSync(this.filePath, entry, "utf8");
    } catch {
      // Fail silently
    }
  }

  /**
   * Closes/ends the trace and writes the summary.
   */
  end(): void {
    try {
      const elapsed = Date.now() - this.startTime.getTime();

      const summary = `====================================================
TRACE SUMMARY
====================================================

Request ID
${this.requestId}

User
${this.user}

Request
${this.request}

Status
${this.status}

Total Duration
${elapsed} ms

Intent Count
${this.intentCount}

Resolved Capabilities
${this.resolvedCapabilities.join(", ") || "None"}

Context Categories
${this.contextCategories.join(", ") || "None"}

Execution Steps
${this.executionStepsCount}
====================================================\n`;

      fs.appendFileSync(this.filePath, summary, "utf8");
    } catch {
      // Fail silently
    }
  }
}
export default AITraceLogger;
