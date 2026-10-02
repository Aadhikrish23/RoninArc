import { test, expect } from "../../fixtures/test";

test.describe("Health & routing", () => {
  test("GET /health reports ok @positive", async ({ anon }) => {
    const res = await anon.get("/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ Status: "ok" });
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
