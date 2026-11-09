import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The version shown on the page comes from the desktop app's package.json at build time, so it
// can't be forgotten; the page also asks GitHub for the newest release when it loads (see
// src/useLatestVersion.ts), which covers releases made after the last deploy.
function desktopVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")).version ?? "";
  } catch {
    return "";
  }
}

// A plain static site: `npm run build` writes dist/, which any static host can serve.
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(desktopVersion()) },
  // host: true listens on every network interface, so other devices can open it by this PC's IP.
  server: { port: 5180, host: true },
  preview: { port: 5180, host: true },
});
