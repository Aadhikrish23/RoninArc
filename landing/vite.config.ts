import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A plain static site: `npm run build` writes dist/, which any static host can serve.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5180 },
});
