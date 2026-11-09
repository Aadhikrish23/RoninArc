import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "../../fixtures/test";
import { LOG_DIR } from "../../env";

// The AI assistant's per-request logs live next to the app's own logs (LOG_DIR/ai): in the
// packaged app that's the user's app-data folder, which survives reinstalling and goes into a
// problem report. Before 1.0.2 they sat in the install folder and every update wiped them.

const dayFolders = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);
const allFiles = (dir: string) => dayFolders(dir).flatMap((d) => fs.readdirSync(path.join(dir, d)).map((f) => path.join(dir, d, f)));

test.describe("AI request logs", () => {
  test("a chat request is logged under LOG_DIR/ai/<day>/ @positive", async ({ api }) => {
    const aiDir = path.join(LOG_DIR, "ai");
    const before = new Set(allFiles(aiDir));
    const res = await api.post("/ai/chat", { message: "recommend me something cozy" });
    expect(res.status()).toBe(200);
    await expect
      .poll(() => allFiles(aiDir).filter((f) => !before.has(f)).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const written = allFiles(aiDir).filter((f) => !before.has(f));
    expect(fs.readFileSync(written[0], "utf8")).toContain("recommend me something cozy");
  });

  test.describe("pruning", () => {
    let base: string;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const load = () => {
      process.env.LOG_DIR ??= LOG_DIR;
      return require("../../../backend/src/modules/ai/logging/AILogWriter") as typeof import("../../../backend/src/modules/ai/logging/AILogWriter");
    };
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const write = (folder: string, bytes = 10) => {
      fs.mkdirSync(path.join(base, folder), { recursive: true });
      fs.writeFileSync(path.join(base, folder, "x.log"), "a".repeat(bytes));
    };

    test.beforeEach(() => {
      base = fs.mkdtempSync(path.join(os.tmpdir(), "roninarc-ai-logs-"));
    });
    test.afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

    test("day folders older than the retention are deleted, recent ones kept @positive", () => {
      const { pruneAILogs } = load();
      const old = day(daysAgo(20));
      const recent = day(daysAgo(3));
      const today = day(new Date());
      for (const d of [old, recent, today]) write(d);
      expect(pruneAILogs(base)).toEqual([old]);
      expect(dayFolders(base).sort()).toEqual([recent, today].sort());
    });

    test("over the size cap, the oldest go first and today always stays @negative", () => {
      const { pruneAILogs } = load();
      const { LoggingConfig } = require("../../../backend/src/modules/ai/logging/LoggingConfig");
      const cap = LoggingConfig.MAX_TOTAL_BYTES;
      LoggingConfig.MAX_TOTAL_BYTES = 100;
      try {
        const a = day(daysAgo(3));
        const b = day(daysAgo(2));
        const today = day(new Date());
        write(a, 60);
        write(b, 60);
        write(today, 500);
        expect(pruneAILogs(base)).toEqual([a, b]);
        expect(dayFolders(base)).toEqual([today]);
      } finally {
        LoggingConfig.MAX_TOTAL_BYTES = cap;
      }
    });

    test("files that aren't day folders are left alone @negative", () => {
      const { pruneAILogs } = load();
      fs.writeFileSync(path.join(base, "notes.txt"), "keep");
      write(day(daysAgo(40)));
      pruneAILogs(base);
      expect(fs.existsSync(path.join(base, "notes.txt"))).toBe(true);
    });
  });

  test("a problem report includes the newest AI logs, with secrets scrubbed @positive", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collect } = require("../../../desktop/services/diagnostics");
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "roninarc-userdata-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "roninarc-staging-"));
    try {
      const dayDir = path.join(userData, "logs", "ai", "2026-11-09");
      fs.mkdirSync(dayDir, { recursive: true });
      fs.writeFileSync(path.join(userData, "logs", "app-2026-11-09.jsonl"), "{}\n");
      fs.writeFileSync(path.join(dayDir, "20261109_101500_abc_put_all_my_god.log"), 'User Request: put all my god of war games\n"accessToken": "eyJhbGciOiJIUzI1NiJ9.secret"\n');
      const files: string[] = collect(userData, staging, {});
      expect(files).toContain("ai-2026-11-09-20261109_101500_abc_put_all_my_god.log");
      const text = fs.readFileSync(path.join(staging, "ai-2026-11-09-20261109_101500_abc_put_all_my_god.log"), "utf8");
      expect(text).toContain("put all my god of war games");
      expect(text).not.toContain("secret");
    } finally {
      fs.rmSync(userData, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});
