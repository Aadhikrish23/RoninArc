import { test, expect } from "../../fixtures/test";

test.describe("Health & routing", () => {
  test("GET /health reports ok @positive", async ({ anon }) => {
    const res = await anon.get("/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ Status: "ok" });
  });

  test("GET /health reports the backend's version, so a deploy can be checked from outside @positive", async ({ anon }) => {
    const body = await (await anon.get("/health")).json();
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("unknown route returns JSON 404 @negative", async ({ anon }) => {
    const res = await anon.get("/definitely/not/a/route");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ Status: "fail", error: "Route not found" });
  });

  test("Swagger UI is served @positive", async ({ anon }) => {
    const res = await anon.get("/api/docs/");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("swagger-ui");
  });
});
