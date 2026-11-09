import path from "path";
import { LOG_DIR } from "../../../shared/logging/logger";

export const LoggingConfig = {
  // Next to the app's own logs (LOG_DIR): in the packaged app that's the user's app-data folder,
  // which survives reinstalling and is what a problem report collects. Before 1.0.2 these lived
  // in the install folder, so an update wiped them.
  LOGS_BASE_DIR: path.join(LOG_DIR, "ai"),

  // Older day folders are deleted, and the oldest go first once the folder passes the size cap.
  RETENTION_DAYS: Number(process.env.AI_LOG_RETENTION_DAYS) || Number(process.env.LOG_RETENTION_DAYS) || 14,
  MAX_TOTAL_BYTES: (Number(process.env.AI_LOG_MAX_MB) || 150) * 1024 * 1024,

  // Maximum length of the request text snippet allowed in the log filename
  MAX_FILENAME_REQUEST_LENGTH: 30,

  // Keep console tracing concise
  CONSOLE_CONCISE: true,
};
