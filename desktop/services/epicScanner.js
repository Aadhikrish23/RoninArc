const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function queryRegistry(key, value) {
  try {
    const output = cp.execSync(`reg query "${key}" /v "${value}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = output.split("\r\n");
    for (const line of lines) {
      if (line.includes(value)) {
        const index = line.indexOf("REG_SZ");
        if (index !== -1) {
          return line.substring(index + 6).trim();
        }
        const indexExpand = line.indexOf("REG_EXPAND_SZ");
        if (indexExpand !== -1) {
          return line.substring(indexExpand + 13).trim();
        }
      }
    }
  } catch (e) {
    // Registry query failed
  }
  return null;
}

const regEpicPath = queryRegistry("HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher", "AppDataPath") ||
                    queryRegistry("HKLM\\SOFTWARE\\Epic Games\\EpicGamesLauncher", "AppDataPath");

const MANIFEST_DIR = regEpicPath
  ? path.join(regEpicPath, "Manifests")
  : "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests";

function scanEpicGames() {
  try {
    const files = fs
      .readdirSync(MANIFEST_DIR)
      .filter((file) => file.endsWith(".item"));

    const games = [];

    for (const file of files) {
      try {
        const fullPath = path.join(MANIFEST_DIR, file);

        const content = fs.readFileSync(fullPath, "utf8");

        const manifest = JSON.parse(content);
        if (
          !manifest.LaunchExecutable ||
          !manifest.LaunchExecutable.endsWith(".exe")
        ) {
          continue;
        }

        games.push({
          name: manifest.DisplayName,
          installPath: manifest.InstallLocation,
          executable: path.join(
            manifest.InstallLocation,
            manifest.LaunchExecutable,
          ),
          epicId: manifest.InstallationGuid,
          catalogItemId: manifest.CatalogItemId,
          catalogNamespace: manifest.CatalogNamespace,
          appName: manifest.AppName,
        });
      } catch (err) {
        console.error("Failed parsing", file, err);
      }
    }

    return games;
  } catch (err) {
    console.error("Epic scan failed", err);

    return [];
  }
}

module.exports = {
  scanEpicGames,
};
