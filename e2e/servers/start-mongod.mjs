// Starts a throwaway mongod for the test run, on its own port and a fresh data
// directory, so tests never touch the dev database (27017) or the packaged
// app's embedded one (27018).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.E2E_MONGO_PORT || "27119";
const dataDir = path.join(os.tmpdir(), "roninarc-e2e-mongo");

const bundled = path.resolve(here, "../../desktop/mongodb-bin/mongod.exe");
const mongodPath = process.env.MONGOD_PATH || (existsSync(bundled) ? bundled : "mongod");

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const mongod = spawn(mongodPath, ["--port", port, "--bind_ip", "127.0.0.1", "--dbpath", dataDir, "--quiet"], {
  stdio: ["ignore", "ignore", "inherit"],
});

mongod.on("error", (err) => {
  console.error(
    `[e2e] Could not start mongod (${mongodPath}): ${err.message}\n` +
      "      Run `node desktop/scripts/fetch-mongod.js`, put mongod on PATH, or set MONGOD_PATH.",
  );
  process.exit(1);
});
mongod.on("exit", (code) => process.exit(code ?? 0));

const stop = () => mongod.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
