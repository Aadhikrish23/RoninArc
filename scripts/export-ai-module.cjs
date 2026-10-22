// Packs the AI module for another app (e.g. a books tracker): the reusable core, RoninArc's games
// pack as a reference, and the handoff docs, as handoff/roninarc-ai-module.zip.
//   node scripts/export-ai-module.cjs
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const ai = path.join(root, "backend", "src", "modules", "ai");
const out = path.join(root, "handoff", "ai-module-handoff");
const zip = path.join(root, "handoff", "roninarc-ai-module.zip");

fs.rmSync(path.join(root, "handoff"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const rel = path.relative(ai, src).replace(/\\/g, "/");
    if (skip(rel)) continue;
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyDir(src, dst, skip);
    } else if (/\.(ts|md)$/.test(entry.name)) {
      fs.copyFileSync(src, dst);
    }
  }
}

// The core: everything outside domains/. The composition root still names the games pack;
// the books app replaces that import (HANDOFF section 5).
copyDir(ai, path.join(out, "core"), (rel) => rel === "domains" || rel.startsWith("domains/"));
copyDir(path.join(ai, "domains", "games"), path.join(out, "reference", "games-pack"));
fs.mkdirSync(path.join(out, "shared", "errors"), { recursive: true });
fs.copyFileSync(path.join(root, "backend", "src", "shared", "errors", "AppError.ts"), path.join(out, "shared", "errors", "AppError.ts"));
// req.user = { id, name }: what the auth middleware sets and the AI routes read.
fs.mkdirSync(path.join(out, "shared", "types"), { recursive: true });
fs.copyFileSync(path.join(root, "backend", "src", "shared", "types", "express.d.ts"), path.join(out, "shared", "types", "express.d.ts"));
fs.copyFileSync(path.join(root, "e2e", "tests", "api", "ai-core-purity.spec.ts"), path.join(out, "reference", "ai-core-purity.spec.ts"));
for (const f of ["HANDOFF.md", "PROMPT.md"]) fs.copyFileSync(path.join(root, "docs", "ai-module", f), path.join(out, f));

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force`]);
console.log(`core: ${count(path.join(out, "core"))} files, games pack: ${count(path.join(out, "reference", "games-pack"))} files`);
console.log(`-> ${path.relative(root, zip)} (${Math.round(fs.statSync(zip).size / 1024)} KB)`);
