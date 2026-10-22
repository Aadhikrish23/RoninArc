// A RoninArc Cloud on this PC for trying the phone app: the backend in cloud mode on :5056 with
// its own database. Reads backend/.env for the RAWG / AI keys like the normal dev server.
const path = require("node:path");
process.chdir(path.join(__dirname, ".."));
Object.assign(process.env, {
  CLOUD_MODE: "true",
  PORT: process.env.CLOUD_PORT || "5056",
  MONGO_URI: process.env.CLOUD_MONGO_URI || "mongodb://localhost:27017/RoninArc_cloud_dev",
  JWT_SECRET: "roninarc-cloud-dev-secret",
  PUBLIC_URL: process.env.PUBLIC_URL || "http://localhost:5056",
  // The mobile web preview (Expo, :8081) calls it from the browser.
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || "http://localhost:8081",
  LOG_DIR: path.join(__dirname, "..", "logs", "cloud-dev"),
});
require("ts-node").register({ transpileOnly: true });
require("../src/server.ts");
