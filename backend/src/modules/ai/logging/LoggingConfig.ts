import path from "path";

export const LoggingConfig = {
  // Base directory where AI logs will be stored
  LOGS_BASE_DIR: path.join(__dirname, "../../../../logs/ai"),

  // Maximum length of the request text snippet allowed in the log filename
  MAX_FILENAME_REQUEST_LENGTH: 30,

  // Keep console tracing concise
  CONSOLE_CONCISE: true,
};
