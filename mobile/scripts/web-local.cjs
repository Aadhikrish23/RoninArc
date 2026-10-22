// The phone app in a browser, talking to the local cloud (backend/scripts/dev-cloud.cjs on :5056).
const { spawn } = require("node:child_process");
const path = require("node:path");
const child = spawn("npx", ["expo", "start", "--web", "--port", "8081"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RONINARC_CLOUD_URL: process.env.RONINARC_CLOUD_URL || "http://localhost:5056", BROWSER: "none" },
});
child.on("exit", (code) => process.exit(code ?? 0));
