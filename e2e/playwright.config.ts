import { defineConfig, devices } from "@playwright/test";
import { CLOUD_AI_LIMIT, CLOUD_PORT, CLOUD_URL, RESEND_PORT, RESEND_URL } from "./env";
import { API_PORT, API_URL, BACKEND_SENTRY_DSN, BROWSER_SENTRY_DSN, LOG_DIR, MONGO_PORT, MONGO_URL, RAWG_PORT, SENTRY_PORT, WEB_PORT, WEB_URL } from "./env";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],

  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      use: { baseURL: API_URL },
    },
    {
      name: "ui",
      testDir: "./tests/ui",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
  ],

  webServer: [
    {
      name: "mongo",
      command: "node servers/start-mongod.mjs",
      port: MONGO_PORT,
      env: { E2E_MONGO_PORT: String(MONGO_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: "rawg-mock",
      command: "node servers/rawg-mock.mjs",
      port: RAWG_PORT,
      env: { E2E_RAWG_PORT: String(RAWG_PORT) },
      reuseExistingServer: false,
    },
    {
      name: "sentry-mock",
      command: "node servers/sentry-mock.mjs",
      port: SENTRY_PORT,
      env: { E2E_SENTRY_PORT: String(SENTRY_PORT) },
      reuseExistingServer: false,
    },
    {
      name: "resend-mock",
      command: "node servers/resend-mock.mjs",
      port: RESEND_PORT,
      env: { E2E_RESEND_PORT: String(RESEND_PORT) },
      reuseExistingServer: false,
    },
    {
      name: "backend",
      command: "npm run build && node dist/server.js",
      cwd: "../backend",
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      // Explicit env always beats backend/.env (dotenv never overrides), so the
      // suite is isolated from whatever the developer has configured locally.
      env: {
        PORT: String(API_PORT),
        MONGO_URI: `${MONGO_URL}/RoninArc_e2e`,
        // A second database on the same throwaway mongod stands in for Atlas,
        // so backup/restore get a real round-trip test.
        Atlas_URL: `${MONGO_URL}/RoninArc_atlas_e2e`,
        ALLOWED_ORIGIN: WEB_URL,
        JWT_SECRET: "roninarc-e2e-secret",
        RAWG_BASE_URL: `http://127.0.0.1:${RAWG_PORT}`,
        RAWG_API_KEY: "e2e-key",
        AI_PROVIDER: "ollama",
        MOCK_LLM: "true",
        // Unmatched mock queries fall through to a "live" call; make it fail fast.
        OLLAMA_BASE_URL: "http://127.0.0.1:9",
        OLLAMA_MODEL: "e2e-mock",
        OLLAMA_TIMEOUT: "3000",
        STEAM_API_KEY: "",
        // This "PC" can link to the suite's RoninArc Cloud below.
        CLOUD_API_URL: CLOUD_URL,
        LOG_DIR,
        LOG_LEVEL: "debug",
        SENTRY_DSN: BACKEND_SENTRY_DSN,
        SENTRY_ENVIRONMENT: "e2e",
        SENTRY_DEDUPE: "false",
        NODE_ENV: "test",
      },
    },
    {
      // RoninArc Cloud: the same build in cloud mode, with its own database and a mock email API.
      name: "cloud",
      command: `node ../e2e/servers/after.mjs ${API_URL}/health node dist/server.js`,
      cwd: "../backend",
      url: `${CLOUD_URL}/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        CLOUD_MODE: "true",
        PORT: String(CLOUD_PORT),
        MONGO_URI: `${MONGO_URL}/RoninArc_cloud_e2e`,
        PUBLIC_URL: CLOUD_URL,
        JWT_SECRET: "roninarc-cloud-e2e-secret",
        RESEND_API_KEY: "re_e2e",
        RESEND_BASE_URL: RESEND_URL,
        MAIL_FROM: "RoninArc <noreply@roninarc.test>",
        AI_DAILY_LIMIT_PER_USER: String(CLOUD_AI_LIMIT),
        // Every test call comes from one address; the limits stay testable at 20x.
        RATE_LIMIT_MULTIPLIER: "20",
        RAWG_BASE_URL: `http://127.0.0.1:${RAWG_PORT}`,
        RAWG_API_KEY: "e2e-key",
        AI_PROVIDER: "ollama",
        MOCK_LLM: "true",
        OLLAMA_BASE_URL: "http://127.0.0.1:9",
        OLLAMA_MODEL: "e2e-mock",
        OLLAMA_TIMEOUT: "3000",
        STEAM_API_KEY: "",
        LOG_DIR: `${LOG_DIR}-cloud`,
        LOG_LEVEL: "info",
        NODE_ENV: "test",
      },
    },
    {
      name: "frontend",
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "../frontend",
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: API_URL, VITE_SENTRY_DSN: BROWSER_SENTRY_DSN, VITE_SENTRY_ENVIRONMENT: "e2e" },
    },
  ],
});
