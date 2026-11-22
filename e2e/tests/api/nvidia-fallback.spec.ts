import { test, expect } from "@playwright/test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import AIConfig from "../../../backend/src/modules/ai/config/AIConfig";
import { NvidiaNimClient } from "../../../backend/src/modules/ai/clients/NvidiaNimClient";

// NVIDIA's shared API sometimes queues a model for a minute or more. The client gives the
// main model a short try, then moves to a fallback model, and skips the slow one for a while.
test.describe("NVIDIA model fallback", () => {
  let server: http.Server;
  const calls: string[] = [];

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const model = JSON.parse(body).model as string;
        calls.push(model);
        const reply = () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ choices: [{ message: { content: `answer from ${model}` } }] }));
        };
        if (model === "slow-model") setTimeout(reply, 3000);
        // NVIDIA's answer for a model that reached its end of life (2026-11-18: nemotron-3-super-120b, gpt-oss-20b).
        else if (model === "retired-model") {
          res.writeHead(410, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ title: "Gone", status: 410, detail: `The model '${model}' has reached its end of life and is no longer available.` }));
        } else if (model === "broken-model") {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end("{}");
        } else reply();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  test.afterAll(() => server.close());

  const client = (models: string[]) => {
    const port = (server.address() as AddressInfo).port;
    Object.assign(AIConfig, {
      nvidiaBaseUrl: `http://127.0.0.1:${port}`,
      nvidiaApiKey: "test",
      nvidiaModel: models[0],
      nvidiaFallbackModels: models.slice(1),
      nvidiaTimeout: 10000,
      nvidiaPrimaryTimeout: 500,
    });
    return new NvidiaNimClient();
  };

  test("a slow main model falls back to the next one, then is skipped @positive", async () => {
    calls.length = 0;
    const nim = client(["slow-model", "fast-model"]);
    const started = Date.now();
    expect(await nim.generate("hi")).toBe("answer from fast-model");
    expect(Date.now() - started).toBeLessThan(2500);
    expect(calls).toEqual(["slow-model", "fast-model"]);

    calls.length = 0;
    expect(await nim.generate("hi again")).toBe("answer from fast-model");
    expect(calls).toEqual(["fast-model"]);
  });

  // The fallback models were retired on 2026-11-18 and the app quietly had no fallback for days.
  test("a retired model (HTTP 410) falls through to the next and is never tried again @positive", async () => {
    calls.length = 0;
    const nim = client(["retired-model", "fast-model"]);
    expect(await nim.generate("hi")).toBe("answer from fast-model");
    expect(calls).toEqual(["retired-model", "fast-model"]);

    // Even after the "skip for a few minutes" timer would have run out, a retired model stays dropped.
    (nim as any).unhealthyUntil.clear();
    calls.length = 0;
    expect(await nim.generate("hi again")).toBe("answer from fast-model");
    expect(calls).toEqual(["fast-model"]);
  });

  test("a model that merely errors (HTTP 500) is tried again once its few minutes are up @negative", async () => {
    calls.length = 0;
    const nim = client(["broken-model", "fast-model"]);
    expect(await nim.generate("hi")).toBe("answer from fast-model");
    expect(calls).toEqual(["broken-model", "fast-model"]);

    (nim as any).unhealthyUntil.clear();
    calls.length = 0;
    expect(await nim.generate("hi again")).toBe("answer from fast-model");
    expect(calls).toEqual(["broken-model", "fast-model"]);
  });

  test("when every model is retired the error still says why, instead of looping silently @negative", async () => {
    calls.length = 0;
    const nim = client(["retired-model"]);
    await expect(nim.generate("hi")).rejects.toThrow(/410/);
    calls.length = 0;
    await expect(nim.generate("hi")).rejects.toThrow(/410/);
    expect(calls).toEqual(["retired-model"]);
  });

  test("a healthy main model is used directly @negative", async () => {
    calls.length = 0;
    const nim = client(["fast-model", "other-model"]);
    expect(await nim.generate("hi")).toBe("answer from fast-model");
    expect(calls).toEqual(["fast-model"]);
  });
});
