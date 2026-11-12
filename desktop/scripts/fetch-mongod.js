// Downloads a portable mongod.exe for the embedded local database. Runs
// automatically before packaging (see package.json's "predist" script).
// Skips the fetch entirely if mongod.exe is already present -- gitignored,
// so a fresh clone re-fetches it once, but repeated builds on the same
// machine don't re-download ~600MB every time.

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const MONGO_VERSION = "7.0.14";
// SHA-256 of mongodb-windows-x86_64-7.0.14.zip, checked before anything is unpacked or run.
// MongoDB publishes it next to the download (the same address plus ".sha256"); copy it here once
// and review the change. TODO(release): not pinned yet. Until it is, the script warns loudly and
// carries on. Set MONGO_ZIP_SHA256 to pin it for one run, or REQUIRE_MONGO_CHECKSUM=1 (CI,
// release builds) to refuse to continue without one.
const MONGO_ZIP_SHA256 = "";
const DOWNLOAD_URL = `https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${MONGO_VERSION}.zip`;
const BIN_DIR = path.join(__dirname, "..", "mongodb-bin");
const MONGOD_PATH = path.join(BIN_DIR, "mongod.exe");
const ZIP_PATH = path.join(BIN_DIR, "_download.zip");

/** SHA-256 of a file, as lowercase hex. */
function sha256File(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

const isSha256 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/i.test(v.trim());

/**
 * Checks a downloaded file against a pinned SHA-256. Fails closed: a mismatch, a malformed pin
 * or (when required) a missing pin all throw, and the caller must not use the file.
 * Returns "verified" or "unpinned".
 */
function verifyChecksum(file, expected, { required = false, warn = console.warn } = {}) {
  const pin = (expected || "").trim();
  if (!pin) {
    if (required) throw new Error("No SHA-256 is pinned for the MongoDB download and REQUIRE_MONGO_CHECKSUM is set.");
    warn(
      "[fetch-mongod] WARNING: the MongoDB download is NOT verified: no SHA-256 is pinned (MONGO_ZIP_SHA256 in scripts/fetch-mongod.js). " +
        `Its checksum is ${sha256File(file)}. Compare it with the one MongoDB publishes, then pin it.`,
    );
    return "unpinned";
  }
  if (!isSha256(pin)) throw new Error("The pinned MongoDB SHA-256 is malformed (expected 64 hex characters).");
  const actual = sha256File(file);
  if (actual.toLowerCase() !== pin.toLowerCase()) {
    throw new Error(`MongoDB download failed its integrity check: expected ${pin.toLowerCase()}, got ${actual}. Nothing was unpacked.`);
  }
  return "verified";
}

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

  try {
    const outcome = verifyChecksum(ZIP_PATH, process.env.MONGO_ZIP_SHA256 || MONGO_ZIP_SHA256, {
      required: process.env.REQUIRE_MONGO_CHECKSUM === "1",
    });
    if (outcome === "verified") console.log("[fetch-mongod] Checksum verified.");
  } catch (err) {
    fs.rmSync(ZIP_PATH, { force: true });
    throw err;
  }

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

module.exports = { sha256File, verifyChecksum, MONGO_VERSION, DOWNLOAD_URL };

if (require.main === module) {
  main().catch((err) => {
    console.error("[fetch-mongod] Failed:", err);
    process.exit(1);
  });
}
