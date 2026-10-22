// desktop/services/keygate.js
//
// The packaged app ships no RAWG / NVIDIA / Steam keys. Game search, the AI and Steam sync go
// through keygate (a small proxy that holds the real keys) with this install's own token,
// which the app asks keygate for on first launch.
//
//   keygate.json (next to main.js, written at build time, never committed):
//     { "url": "https://keygate.<you>.workers.dev", "project": "roninarc", "enrollKey": "..." }
//
//   <userData>/keygate-token.json (per install, created on first launch):
//     { "url": "...", "project": "roninarc", "token": "kg_roninarc_...", "enrolledAt": "..." }

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TOKEN_FILE = "keygate-token.json";
// The app's AI models; keygate only forwards these (see keygate.config.ts).
const NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_FALLBACK_MODELS = "nvidia/nemotron-3-super-120b-a12b,openai/gpt-oss-20b";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** The build's keygate settings, or undefined when the build has none (online features then stay off). */
function loadBuildConfig(dir) {
  const config = readJson(path.join(dir, "keygate.json"));
  if (!config || typeof config.url !== "string" || typeof config.project !== "string" || typeof config.enrollKey !== "string") return undefined;
  return { url: config.url.replace(/\/+$/, ""), project: config.project, enrollKey: config.enrollKey };
}

/**
 * This install's token: the saved one, or a new one from keygate. Never throws -- offline or
 * refused just means no token this launch, and the next launch tries again.
 */
async function ensureToken(userDataDir, config, { fetchImpl = fetch, log = () => {}, label = os.hostname() } = {}) {
  const file = path.join(userDataDir, TOKEN_FILE);
  const saved = readJson(file);
  // A token from a different keygate (the proxy moved) or project isn't valid here.
  if (saved && saved.url === config.url && saved.project === config.project && typeof saved.token === "string") return saved.token;

  try {
    const res = await fetchImpl(`${config.url}/${config.project}/_enroll`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-keygate-enroll": config.enrollKey },
      body: JSON.stringify({ label: String(label || "").slice(0, 50) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status !== 201 || typeof data.token !== "string") {
      log("keygate: enrollment refused", res.status, data?.error?.code ?? "");
      return undefined;
    }
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ url: config.url, project: config.project, token: data.token, id: data.id, enrolledAt: new Date().toISOString() }, null, 2), "utf8");
    log("keygate: enrolled, token id", data.id);
    return data.token;
  } catch (err) {
    log("keygate: enrollment failed", err && err.message ? err.message : String(err));
    return undefined;
  }
}

/** Backend settings that send RAWG, the AI and Steam through keygate with this install's token. */
function backendEnv(config, token) {
  if (!config || !token) return {};
  const base = `${config.url}/${config.project}`;
  return {
    RAWG_BASE_URL: `${base}/rawg`,
    RAWG_API_KEY: token,
    AI_PROVIDER: "nvidia",
    NVIDIA_BASE_URL: `${base}/nvidia`,
    NVIDIA_API_KEY: token,
    NVIDIA_MODEL,
    NVIDIA_FALLBACK_MODELS,
    STEAM_API_BASE: `${base}/steam`,
    STEAM_API_KEY: token,
  };
}

module.exports = { loadBuildConfig, ensureToken, backendEnv, TOKEN_FILE };
