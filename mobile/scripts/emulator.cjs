// The app in an Android emulator on this PC, against the local cloud (backend/scripts/dev-cloud.cjs):
//   node scripts/emulator.cjs   then: adb reverse tcp:8083 tcp:8083 && adb reverse tcp:5056 tcp:5056
// and open exp://127.0.0.1:8083 in Expo Go on the emulator.
const { spawn } = require("node:child_process");
const path = require("node:path");
const child = spawn("npx", ["expo", "start", "--port", "8083"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    RONINARC_CLOUD_URL: process.env.RONINARC_CLOUD_URL || "http://localhost:5056",
    // The emulator reaches this PC through adb reverse on 127.0.0.1 (IPv4); --localhost made Metro
    // listen on ::1 only, so the bundle download was refused.
    REACT_NATIVE_PACKAGER_HOSTNAME: "127.0.0.1",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
