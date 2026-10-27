// The app on a real phone through Expo Go, talking to the live RoninArc Cloud:
//   node scripts/phone.cjs   (then scan the QR code in Expo Go)
// Tunnel mode, so it works even when Windows Firewall blocks the phone from reaching this PC
// over Wi-Fi (a "Public" network). Your code changes still reload on the phone instantly.
const { spawn } = require("node:child_process");
const path = require("node:path");
const child = spawn("npx", ["expo", "start", "--tunnel", "ngrok", "--port", "8082"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RONINARC_CLOUD_URL: process.env.RONINARC_CLOUD_URL || "https://roninarc-cloud.onrender.com" },
});
child.on("exit", (code) => process.exit(code ?? 0));
