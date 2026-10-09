import { randomUUID } from "node:crypto";
import { test, expect } from "../../fixtures/test";
import { open } from "../../helpers/ui";
import { waitForLog, waitForSentryEvent } from "../../helpers/logs";

const QUEUE_KEY = "roninarc_log_queue";

const throwAsync = (page: any, message: string) =>
  page.evaluate((m: string) => {
    setTimeout(() => {
      throw new Error(m);
    }, 0);
  }, message);

test.describe("Error monitoring (frontend)", () => {
  test("an uncaught browser error lands in the backend log with stack, url and user @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
    const message = `ui-boom-${randomUUID()}`;
    await throwAsync(page, message);

    const line = await waitForLog((l) => l.msg === message);
    expect(line).toMatchObject({ source: "client", level: 50 });
    expect(String(line.stack)).toContain(message);
    expect(String(line.url)).toContain("#/");
    expect(line.userId).toEqual(expect.any(String));
    expect(line.sessionId).toEqual(expect.any(String));
    expect((line.context as any).source).toBe("window.onerror");
  });

  test("an unhandled promise rejection is captured too @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
    const message = `ui-reject-${randomUUID()}`;
    await page.evaluate((m) => {
      void Promise.reject(new Error(m));
    }, message);
    const line = await waitForLog((l) => l.msg === message);
    expect((line.context as any).source).toBe("unhandledrejection");
  });

  test("errors are also reported to Sentry from the browser @positive", async ({ authedPage: page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
    // Sentry's browser SDK loads lazily; give it a moment before throwing.
    await page.waitForTimeout(1500);
    const message = `ui-sentry-${randomUUID()}`;
    await throwAsync(page, message);
    const event = await waitForSentryEvent((e) => e.project === "2" && e.message === message);
    expect(event).toMatchObject({ environment: "e2e", platform: "javascript" });
  });

  test("while offline, errors queue locally and are delivered once back online @positive", async ({ authedPage: page, context }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();

    await context.setOffline(true);
    const message = `ui-offline-${randomUUID()}`;
    await throwAsync(page, message);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k) ?? "", QUEUE_KEY))
      .toContain(message);
    await page.waitForTimeout(1500);
    expect(await page.evaluate((k) => localStorage.getItem(k) ?? "", QUEUE_KEY)).toContain(message);

    const delivered = page.waitForResponse((r) => r.url().endsWith("/logs/client") && r.status() === 202);
    await context.setOffline(false);
    await delivered;
    await waitForLog((l) => l.msg === message);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k) ?? "[]", QUEUE_KEY))
      .not.toContain(message);
  });

  test("a queued error survives a reload and is sent on the next start @positive", async ({ authedPage: page, context }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
    await context.setOffline(true);
    const message = `ui-restart-${randomUUID()}`;
    await throwAsync(page, message);
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k) ?? "", QUEUE_KEY)).toContain(message);
    await context.setOffline(false);
    await page.reload();
    await waitForLog((l) => l.msg === message);
  });

  test("a failed API call is logged with the request id the backend saw @positive", async ({ authedPage: page }) => {
    let sentRequestId = "";
    await page.route("**/dashboard/overview", (route) => {
      sentRequestId = route.request().headers()["x-request-id"] ?? "";
      return route.fulfill({ status: 503, json: { Status: "Error", error: "Service Unavailable" } });
    });
    await open(page, "/dashboard");
    await expect.poll(() => sentRequestId).not.toBe("");
    const line = await waitForLog((l) => l.clientRequestId === sentRequestId);
    expect(line.msg).toBe("API 503 on GET /dashboard/overview");
    expect(line.level).toBe(50);
  });

  test("expected API errors (4xx) are not logged as client errors @negative", async ({ authedPage: page }) => {
    let sentRequestId = "";
    await page.route("**/dashboard/overview", (route) => {
      sentRequestId = route.request().headers()["x-request-id"] ?? "";
      return route.fulfill({ status: 404, json: { Status: "Fail", error: "Not found" } });
    });
    await open(page, "/dashboard");
    await expect.poll(() => sentRequestId).not.toBe("");
    await page.waitForTimeout(4500);
    const { readLogLines } = await import("../../helpers/logs");
    expect(readLogLines().some((l) => l.clientRequestId === sentRequestId)).toBe(false);
  });

  test("a render crash shows a recovery screen and is logged @negative", async ({ authedPage: page }) => {
    await page.route("**/dashboard/overview", (route) =>
      route.fulfill({ json: { Status: "Success", Data: { continuePlaying: [], playtime: null, backlog: null, recentActivity: [] } } }),
    );
    await open(page, "/dashboard");
    const fallback = page.getByRole("alert").filter({ hasText: "Something went wrong" });
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText("It has been logged so it can be fixed.");
    const line = await waitForLog((l) => (l.context as any)?.source === "react.errorBoundary" && String(l.url).includes("#/dashboard"));
    expect(String((line.context as any).componentStack)).toContain("Dashboard");

    await page.unroute("**/dashboard/overview");
    await fallback.getByRole("button", { name: "Go to Library" }).click();
    await expect(page.getByRole("heading", { name: "My Library" })).toBeVisible();
  });
});
