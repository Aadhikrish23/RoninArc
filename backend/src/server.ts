import "./instrument";
import app from "./app";
import mongoose from "mongoose";
import backupService from "./modules/backup/backupService";
import { startSyncScheduler } from "./modules/sync/localSync";
import { isCloud } from "./shared/runtimeMode";
import { logger, LOG_DIR, appLogFile } from "./shared/logging/logger";
import { flushErrorReporting, reportError, sentryEnabled } from "./shared/logging/errorReporter";

const log = logger.child({ module: "server" });

// MONGO_URI takes precedence when set -- this is how the packaged Electron
// app points the backend at its bundled, embedded mongod instance instead
// of the dev-time local server. LOCAL_URL_Mongo stays the normal dev default.
const MONGO_URI = process.env.MONGO_URI || process.env.LOCAL_URL_Mongo;
const PORT = process.env.PORT || 5000;

const AUTO_BACKUP_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

const connectDB = async () => {
  if (!MONGO_URI) {
    log.fatal("MongoDB URI is missing, check your env file");
    await shutdown(1);
  }
  try {
    await mongoose.connect(MONGO_URI as string);
    // Log the host only -- a full URI can embed credentials (e.g. Atlas).
    const host = (MONGO_URI as string).replace(/\/\/[^@/]*@/, "//***@");
    log.info({ mongo: host }, "MongoDB connected");
  } catch (error) {
    reportError(error, { phase: "mongo-connect" });
    await shutdown(1);
  }
};

function startAutoBackup() {
  // In the cloud, Atlas is the database itself; the mirror is for PCs.
  if (!process.env.Atlas_URL || isCloud()) {
    return;
  }

  setInterval(() => {
    backupService.backupAllUsers().catch((error: any) => {
      reportError(error, { phase: "auto-backup" });
    });
  }, AUTO_BACKUP_INTERVAL_MS);
}

async function shutdown(code: number) {
  await flushErrorReporting();
  appLogFile.end();
  process.exit(code);
}

process.on("unhandledRejection", (reason) => {
  reportError(reason, { phase: "unhandledRejection" });
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception -- shutting down");
  reportError(error, { phase: "uncaughtException" });
  void shutdown(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info({ signal }, "Shutting down");
    void shutdown(0);
  });
}

const startserver = async () => {
  await connectDB();
  startAutoBackup();
  // A PC linked to RoninArc Cloud syncs every minute (and soon after each change).
  startSyncScheduler();
  app.listen(PORT, () => {
    log.info({ port: Number(PORT), logDir: LOG_DIR, sentry: sentryEnabled() }, `Server is up and running on port:${PORT}`);
  });
};

startserver();
