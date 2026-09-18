// Downloads a portable mongod.exe for the embedded local database. Runs
// automatically before packaging (see package.json's "predist" script).
// Skips the fetch entirely if mongod.exe is already present -- gitignored,
// so a fresh clone re-fetches it once, but repeated builds on the same
// machine don't re-download ~600MB every time.

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const MONGO_VERSION = "7.0.14";
const DOWNLOAD_URL = `https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${MONGO_VERSION}.zip`;
const BIN_DIR = path.join(__dirname, "..", "mongodb-bin");
const MONGOD_PATH = path.join(BIN_DIR, "mongod.exe");
const ZIP_PATH = path.join(BIN_DIR, "_download.zip");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  if (fs.existsSync(MONGOD_PATH)) {
    console.log("[fetch-mongod] mongod.exe already present, skipping download.");
    return;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });

  console.log(`[fetch-mongod] Downloading MongoDB ${MONGO_VERSION} (~600MB, this only happens once)...`);
  await download(DOWNLOAD_URL, ZIP_PATH);

  console.log("[fetch-mongod] Extracting mongod.exe...");
  const entry = `mongodb-win32-x86_64-windows-${MONGO_VERSION}/bin/mongod.exe`;
  execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$zip = [System.IO.Compression.ZipFile]::OpenRead('${ZIP_PATH}'); ` +
      `$entry = $zip.GetEntry('${entry}'); ` +
      `[System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '${MONGOD_PATH}', $true); ` +
      `$zip.Dispose();`,
  ]);

  fs.unlinkSync(ZIP_PATH);
  console.log("[fetch-mongod] Done:", MONGOD_PATH);
}

main().catch((err) => {
  console.error("[fetch-mongod] Failed:", err);
  process.exit(1);
});
