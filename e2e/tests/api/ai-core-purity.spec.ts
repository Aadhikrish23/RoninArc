import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// The AI module is a reusable core plus domain packs (domains/games for RoninArc). The core
// must reach a domain only through domainPack(), so another app (a books tracker...) can reuse
// it by writing its own pack. Only the composition root picks the pack.
const AI_DIR = path.resolve(__dirname, "../../../backend/src/modules/ai");
const COMPOSITION_ROOT = new Set(["aiController.ts", "aiRoutes.ts", "index.ts"]);
// Outside the AI module, core may only use shared infrastructure.
const ALLOWED_OUTSIDE = [/^shared\//];

function coreFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(AI_DIR, full) !== "domains") coreFiles(full, out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function importsOf(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/(?:from|import)\s*\(?\s*"(\.[^"]+)"/g)].map((m) => m[1]);
}

test.describe("AI core purity", () => {
  test("core files never import a domain pack or another app module @positive", () => {
    const files = coreFiles(AI_DIR).filter((f) => !COMPOSITION_ROOT.has(path.relative(AI_DIR, f)));
    expect(files.length).toBeGreaterThan(50);

    const violations: string[] = [];
    for (const file of files) {
      for (const spec of importsOf(file)) {
        const target = path.resolve(path.dirname(file), spec);
        const inAi = path.relative(AI_DIR, target).replace(/\\/g, "/");
        if (!inAi.startsWith("..")) {
          if (inAi === "domains" || inAi.startsWith("domains/")) violations.push(`${path.relative(AI_DIR, file)} -> ${spec}`);
          continue;
        }
        const inSrc = path.relative(path.resolve(AI_DIR, "../.."), target).replace(/\\/g, "/");
        if (!ALLOWED_OUTSIDE.some((re) => re.test(inSrc))) violations.push(`${path.relative(AI_DIR, file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("only the composition root selects a pack @positive", () => {
    const selecting = coreFiles(AI_DIR)
      .filter((f) => /setDomainPack\(/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(AI_DIR, f).replace(/\\/g, "/"))
      .filter((f) => f !== "domain/activeDomain.ts");
    expect(selecting).toEqual(["aiController.ts"]);
  });
});
