import fs from "fs";
import path from "path";
import { LoggingConfig } from "./LoggingConfig";

const DAY_FOLDER = /^\d{4}-\d{2}-\d{2}$/;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
let lastPrune = 0;

/** Bytes in a folder (one level of files: a day folder holds only log files). */
function folderSize(dir: string): number {
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    try {
      const stat = fs.statSync(path.join(dir, name));
      if (stat.isFile()) total += stat.size;
    } catch {
      // gone meanwhile
    }
  }
  return total;
}

/**
 * Deletes day folders older than the retention, then the oldest remaining ones while the total
 * is over the size cap (today's folder always stays).
 */
export function pruneAILogs(baseDir = LoggingConfig.LOGS_BASE_DIR, now = new Date()): string[] {
  if (!fs.existsSync(baseDir)) return [];
  const removed: string[] = [];
  // Day folders are named by local date (AILogger), so compare in local dates too.
  const localDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = localDay(now);
  const cutoff = localDay(new Date(now.getTime() - LoggingConfig.RETENTION_DAYS * 24 * 60 * 60 * 1000));
  const days = fs
    .readdirSync(baseDir)
    .filter((name) => DAY_FOLDER.test(name))
    .sort();
  const remove = (day: string) => {
    fs.rmSync(path.join(baseDir, day), { recursive: true, force: true });
    removed.push(day);
  };

  const kept: { day: string; size: number }[] = [];
  for (const day of days) {
    if (day < cutoff && day !== today) remove(day);
    else kept.push({ day, size: folderSize(path.join(baseDir, day)) });
  }
  let total = kept.reduce((sum, d) => sum + d.size, 0);
  for (const { day, size } of kept) {
    if (total <= LoggingConfig.MAX_TOTAL_BYTES || day === today) break;
    remove(day);
    total -= size;
  }
  return removed;
}

export class AILogWriter {
  /**
   * Writes log content to a file inside the appropriate date directory.
   * Silently handles errors but prints to console on failure.
   */
  static writeLog(dateFolder: string, filename: string, content: string): void {
    const targetDir = path.join(LoggingConfig.LOGS_BASE_DIR, dateFolder);
    const targetPath = path.join(targetDir, filename);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content, "utf8");
    } catch (error) {
      console.error(`[AILogWriter] Failed to write log file to ${targetPath}:`, error);
    }

    // At most once an hour, so a busy chat doesn't scan the folder on every message.
    if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
      lastPrune = Date.now();
      try {
        pruneAILogs();
      } catch (error) {
        console.error("[AILogWriter] Failed to prune old AI logs:", error);
      }
    }
  }
}
