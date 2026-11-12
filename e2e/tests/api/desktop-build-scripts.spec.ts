import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";

// desktop/scripts/fetch-mongod.js downloads the embedded database's binary. It checks the
// download against a pinned SHA-256 before unpacking anything, and refuses on a mismatch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verifyChecksum, sha256File } = require(path.resolve(__dirname, "../../../desktop/scripts/fetch-mongod.js"));

test.describe("MongoDB download integrity (verifyChecksum)", () => {
  let dir: string;
  let file: string;
  const content = "pretend this is a MongoDB zip";
  const sha = crypto.createHash("sha256").update(content).digest("hex");

  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "roninarc-checksum-"));
    file = path.join(dir, "download.zip");
    fs.writeFileSync(file, content);
  });
  test.afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("hashes a file the same way as the standard SHA-256 @positive", () => {
    expect(sha256File(file)).toBe(sha);
    const big = path.join(dir, "big.bin");
    fs.writeFileSync(big, Buffer.alloc(3 * 1024 * 1024 + 17, 7));
    expect(sha256File(big)).toBe(crypto.createHash("sha256").update(fs.readFileSync(big)).digest("hex"));
  });

  test("a matching pinned checksum is verified, in any letter case or with spaces around it @positive", () => {
    expect(verifyChecksum(file, sha)).toBe("verified");
    expect(verifyChecksum(file, sha.toUpperCase())).toBe("verified");
    expect(verifyChecksum(file, `  ${sha}\n`)).toBe("verified");
  });

  test("a different file fails closed, and says nothing was unpacked @negative", () => {
    fs.writeFileSync(file, content + " tampered");
    expect(() => verifyChecksum(file, sha)).toThrow(/integrity check/);
    expect(() => verifyChecksum(file, sha)).toThrow(/Nothing was unpacked/);
  });

  test("a malformed pin is an error, not a pass @negative", () => {
    for (const pin of ["abc123", "z".repeat(64), `${sha}00`, sha.slice(1)]) {
      expect(() => verifyChecksum(file, pin), pin).toThrow(/malformed/);
    }
  });

  test("with no pin it warns loudly (with the file's checksum) and carries on, unless a pin is required @negative", () => {
    const warnings: string[] = [];
    expect(verifyChecksum(file, "", { warn: (m: string) => warnings.push(m) })).toBe("unpinned");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/NOT verified/);
    expect(warnings[0]).toContain(sha);
    expect(() => verifyChecksum(file, "", { required: true })).toThrow(/REQUIRE_MONGO_CHECKSUM/);
    expect(() => verifyChecksum(file, undefined, { required: true })).toThrow(/REQUIRE_MONGO_CHECKSUM/);
  });
});
