import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A plain static site: `npm run build` writes dist/, which any static host can serve.
export default defineConfig({
  plugins: [react()],
  base: "./",
  // host: true listens on every network interface, so other devices can open it by this PC's IP.
  server: { port: 5180, host: true },
  preview: { port: 5180, host: true },
});
