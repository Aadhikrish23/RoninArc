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

const regSteamPath = queryRegistry("HKCU\\Software\\Valve\\Steam", "SteamPath") || 
                     queryRegistry("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath") ||
                     queryRegistry("HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath");

const STEAM_PATH = regSteamPath ? path.resolve(regSteamPath) : "C:\\Program Files (x86)\\Steam";

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

// Executable names that are almost never the actual game binary
const EXE_BLACKLIST = /^(unins\d*|setup|install|update|crash|ue4prereqsetup|dxsetup|dxwebsetup|vcredist|dotnet|launcher|7z|winrar|uninstall|creationkit)\.exe$/i;
const EXE_DIR_BLACKLIST = /^(redist|_commonredist|directx|__installer|support|prerequisites|dotnet|_redist)/i;

function findExe(dir, folderName, maxDepth = 3) {
  const candidates = [];
  collectExes(dir, 0, maxDepth, candidates);

  if (candidates.length === 0) return null;

  const scored = candidates.map((cand) => {
    let score = 100;

    // Depth penalty: prefer root-level
    score -= cand.depth * 15;

    // Size bonus: prefer larger executables (up to +100 score)
    try {
      const stats = fs.statSync(cand.path);
      const sizeInMB = stats.size / (1024 * 1024);
      score += Math.min(100, Math.floor(sizeInMB));
    } catch (e) {
      // Ignore stat failures
    }

    if (folderName) {
      const normFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normName = cand.name.toLowerCase().replace(/\.exe$/, "").replace(/[^a-z0-9]/g, "");

      // exact or substring matches
      if (normName.includes(normFolder) || normFolder.includes(normName)) {
        score += 150;
      }

      // Initials match: e.g. "Half-Life 2" -> initials "hl2", matches "hl2.exe"
      const words = folderName.toLowerCase().split(/[^a-z0-9]+/);
      const initials = words.map((w) => w[0]).join("");
      if (initials && normName === initials) {
        score += 100;
      }
    }

    // Keyword preferences
    if (cand.name.toLowerCase().includes("shipping")) {
      score += 80;
    }
    if (cand.name.toLowerCase() === "launcher.exe") {
      score += 40;
    }

    // Heavy penalty for setup, uninstall, crash, redist, test, configs, etc.
    const AVOID_REGEX = /setup|install|update|crash|ue4prereq|dxsetup|vcredist|dotnet|7z|uninstall|creationkit|editor|repair|config|patch|tool|test/i;
    if (AVOID_REGEX.test(cand.name)) {
      score -= 300;
    }

    return { path: cand.path, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored[0].path;
}

function collectExes(dir, depth, maxDepth, results) {
  if (depth > maxDepth) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
        if (!EXE_BLACKLIST.test(entry.name)) {
          results.push({ path: fullPath, depth, name: entry.name });
        }
      } else if (entry.isDirectory() && !EXE_DIR_BLACKLIST.test(entry.name)) {
        collectExes(fullPath, depth + 1, maxDepth, results);
      }
    }
  } catch {
    // Permission denied or inaccessible directory
  }
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
                installPath,
                game.installDir
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