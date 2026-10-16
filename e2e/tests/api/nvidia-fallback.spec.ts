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
        else reply();
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

  test("a healthy main model is used directly @negative", async () => {
    calls.length = 0;
    const nim = client(["fast-model", "other-model"]);
    expect(await nim.generate("hi")).toBe("answer from fast-model");
    expect(calls).toEqual(["fast-model"]);
  });
});
