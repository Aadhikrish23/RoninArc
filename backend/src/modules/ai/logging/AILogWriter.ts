import fs from "fs";
import path from "path";
import { LoggingConfig } from "./LoggingConfig";

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
  }
}
