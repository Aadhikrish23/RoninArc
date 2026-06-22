const fs = require("fs");
const path = require("path");

const MANIFEST_DIR =
  "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests";

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
