// desktop/services/diagnostics.js
//
// "Create a problem report" in Settings: the logs a bug report needs, with anything secret
// scrubbed out, zipped onto the Desktop so a friend can just send one file.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");

const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
const LOG_FILES_KEPT = 3;

/** Tokens, keys and passwords never leave the PC in a report. */
function redact(text) {
  return text
    .replace(/kg_[A-Za-z0-9_-]{8,}/g, "kg_[redacted]")
    .replace(/nvapi-[A-Za-z0-9_-]{8,}/g, "nvapi-[redacted]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[redacted]")
    .replace(/([?&](?:key|api_key|token)=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/("(?:password|newPassword|currentPassword|token|accessToken|refreshToken|jwt|authorization|enrollKey)"\s*:\s*")[^"]*(")/gi, "$1[redacted]$2");
}

/** The end of a file (the most recent lines), at most `max` bytes. */
function tail(file, max = MAX_BYTES_PER_FILE) {
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, "r");
  try {
    const length = Math.min(size, max);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    // Don't start mid-line.
    return size > max ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    fs.closeSync(fd);
  }
}

/** Writes the report's files into `staging`; returns their names. */
function collect(userDataDir, staging, info) {
  fs.mkdirSync(staging, { recursive: true });
  const written = [];
  const add = (name, text) => {
    fs.writeFileSync(path.join(staging, name), redact(text), "utf8");
    written.push(name);
  };

  const startupLog = path.join(userDataDir, "startup.log");
  if (fs.existsSync(startupLog)) add("startup.log", tail(startupLog));

  const logDir = path.join(userDataDir, "logs");
  if (fs.existsSync(logDir)) {
    const newest = fs
      .readdirSync(logDir)
      .filter((f) => /\.(jsonl|log)$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(logDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(0, LOG_FILES_KEPT);
    for (const { f } of newest) add(`logs-${f}`, tail(path.join(logDir, f)));
  }

  add("info.json", JSON.stringify({ createdAt: new Date().toISOString(), os: `${os.type()} ${os.release()} ${os.arch()}`, ...info }, null, 2));
  return written;
}

/** Zips `staging` with Windows' own PowerShell (RoninArc is Windows-only), no extra dependency. */
function zipFolder(staging, zipPath) {
  return new Promise((resolve, reject) => {
    const script = `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Builds the report zip; returns its path. */
async function createReport({ userDataDir, outputDir, info, zip = zipFolder }) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "roninarc-report-"));
  try {
    collect(userDataDir, staging, info);
    fs.mkdirSync(outputDir, { recursive: true });
    const zipPath = path.join(outputDir, `RoninArc-report-${stamp()}.zip`);
    await zip(staging, zipPath);
    return zipPath;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

module.exports = { createReport, collect, redact, tail };
