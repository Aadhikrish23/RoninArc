const fs = require("fs");
const path = require("path");

const STEAM_PATH =
  "C:\\Program Files (x86)\\Steam";

function parseVdf(content) {
  const result = {};

  const lines = content.split("\n");

  let currentLibrary = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const libraryMatch =
      line.match(/^"(\d+)"$/);

    if (libraryMatch) {
      currentLibrary = {};
      result[libraryMatch[1]] =
        currentLibrary;
      continue;
    }

    const kvMatch =
      line.match(
        /^"([^"]+)"\s+"([^"]+)"$/
      );

    if (
      kvMatch &&
      currentLibrary
    ) {
      currentLibrary[
        kvMatch[1]
      ] = kvMatch[2];
    }
  }

  return result;
}

function getSteamLibraries() {
  const libraryFile =
    path.join(
      STEAM_PATH,
      "steamapps",
      "libraryfolders.vdf"
    );

  if (
    !fs.existsSync(
      libraryFile
    )
  ) {
    return [];
  }

  const content =
    fs.readFileSync(
      libraryFile,
      "utf8"
    );

  const libraries =
    parseVdf(content);

  return Object.values(
    libraries
  )
    .map((lib) => lib.path)
    .filter(Boolean);
}

function parseManifest(
  content
) {
  const name =
    content.match(
      /"name"\s+"([^"]+)"/
    );

  const appid =
    content.match(
      /"appid"\s+"([^"]+)"/
    );

  const installdir =
    content.match(
      /"installdir"\s+"([^"]+)"/
    );

  return {
    appId:
      appid?.[1] ?? "",
    name:
      name?.[1] ?? "",
    installDir:
      installdir?.[1] ?? "",
  };
}

function findExe(dir) {
  const entries =
    fs.readdirSync(dir, {
      withFileTypes: true,
    });

  for (const entry of entries) {
    const fullPath =
      path.join(
        dir,
        entry.name
      );

    if (
      entry.isFile() &&
      entry.name
        .toLowerCase()
        .endsWith(".exe")
    ) {
      return fullPath;
    }

    if (
      entry.isDirectory()
    ) {
      try {
        const found =
          findExe(fullPath);

        if (found)
          return found;
      } catch {}
    }
  }

  return null;
}

function scanSteamGames() {
  const libraries =
    getSteamLibraries();

  const games = [];

  for (const library of libraries) {
    const steamApps =
      path.join(
        library,
        "steamapps"
      );

    if (
      !fs.existsSync(
        steamApps
      )
    ) {
      continue;
    }

    const manifests =
      fs
        .readdirSync(
          steamApps
        )
        .filter((f) =>
          f.startsWith(
            "appmanifest_"
          )
        );

    for (const file of manifests) {
      try {
        const content =
          fs.readFileSync(
            path.join(
              steamApps,
              file
            ),
            "utf8"
          );

        const game =
          parseManifest(
            content
          );

        if (
          game.name.includes(
            "Steamworks"
          )
        ) {
          continue;
        }

        const installPath =
          path.join(
            steamApps,
            "common",
            game.installDir
          );

        const exe =
          fs.existsSync(
            installPath
          )
            ? findExe(
                installPath
              )
            : null;

        games.push({
          appId:
            game.appId,
          name:
            game.name,
          installPath,
          executable:
            exe ?? "",
        });
      } catch (err) {
        console.error(
          err
        );
      }
    }
  }

  return games;
}

module.exports = {
  scanSteamGames,
};