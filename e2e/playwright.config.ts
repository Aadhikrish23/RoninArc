import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, MONGO_PORT, MONGO_URL, RAWG_PORT, WEB_PORT, WEB_URL } from "./env";

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
      env: { VITE_API_BASE_URL: API_URL },
    },
  ],
});
