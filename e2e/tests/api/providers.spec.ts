import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { API_URL } from "../../env";

test.describe("Providers API (/provider)", () => {
  test.describe("status", () => {
    for (const provider of ["steam", "epic"]) {
      test(`${provider}: a new user is not connected @positive`, async ({ api }) => {
        const res = await api.get(`/provider/${provider}/status`);
        expect(res.status()).toBe(200);
        expect((await json(res)).Data).toMatchObject({ connected: false });
      });
    }

    test("an unknown provider is rejected @negative", async ({ api }) => {
      const res = await api.get("/provider/gog/status");
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });

    test("an unknown provider returns 404 rather than 500 @negative", async ({ api }) => {
      test.fail(true, "Known bug: ProviderRegistry.get throws a plain Error, so unknown providers surface as 500");
      expect((await api.get("/provider/gog/status")).status()).toBe(404);
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.get("/provider/steam/status")).status()).toBe(401);
    });
  });

  test.describe("OAuth start", () => {
    test("steam returns an OpenID login URL that comes back to this backend @positive", async ({ api }) => {
      const res = await api.get("/provider/steam/oauth/start");
      expect(res.status()).toBe(200);
      const url = new URL((await json(res)).Data.loginUrl);
      expect(url.origin).toBe("https://steamcommunity.com");
      expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
      expect(url.searchParams.get("openid.return_to")).toBe(`${API_URL}/provider/steam/oauth/return`);
    });

    test("epic returns the Epic Games login URL @positive", async ({ api }) => {
      const res = await api.get("/provider/epic/oauth/start");
      expect(res.status()).toBe(200);
      expect((await json(res)).Data.loginUrl).toMatch(/^https:\/\/www\.epicgames\.com\/id\/login\?redirectUrl=/);
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.get("/provider/steam/oauth/start")).status()).toBe(401);
    });
  });

  test.describe("OAuth return page", () => {
    test("is reachable without auth and posts the params back to the opener @positive", async ({ anon }) => {
      const res = await anon.get("/provider/steam/oauth/return?openid.mode=id_res&openid.claimed_id=abc");
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/html");
      // helmet's same-origin COOP would sever window.opener for the popup.
      expect(res.headers()["cross-origin-opener-policy"]).toBe("unsafe-none");
      const html = await res.text();
      expect(html).toContain("roninarc-provider-oauth");
      expect(html).toContain("openid.mode=id_res");
    });

    test("cannot be used to inject script via the query string @negative", async ({ anon }) => {
      const payload = encodeURIComponent("</script><script>alert(1)</script>");
      const html = await (await anon.get(`/provider/steam/oauth/return?x=${payload}`)).text();
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html.match(/<\/script>/gi)).toHaveLength(1);
    });

    test("cannot be used to inject script via the provider id @negative", async ({ anon }) => {
      const html = await (await anon.get(`/provider/${encodeURIComponent('"</script><script>alert(1)//')}/oauth/return`)).text();
      // The id is embedded as a JS string with "</script" escaped, so the HTML
      // parser never sees a second closing tag and the payload stays inert data.
      expect(html.match(/<\/script>/gi)).toHaveLength(1);
      expect(html).toContain(String.raw`<\/script><script>alert(1)//`);
    });
  });

  test.describe("connect / resync / disconnect", () => {
    test("steam connect without the sign-in response is rejected with 400 @negative", async ({ api }) => {
      const res = await api.post("/provider/steam/connect", {});
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Missing Steam sign-in response. Please try connecting again.");
    });

    test("steam connect with an unverifiable sign-in response is rejected with 401 @negative", async ({ api }) => {
      const res = await api.post("/provider/steam/connect", { openIdParams: "openid.mode=cancel" });
      expect(res.status()).toBe(401);
      expect((await json(res)).error).toBe("Steam sign-in could not be verified. Please try again.");
      expect((await json(await api.get("/provider/steam/status"))).Data.connected).toBe(false);
    });

    test("steam resync when not connected asks the user to reconnect @negative", async ({ api }) => {
      const res = await api.post("/provider/steam/resync", {});
      expect(res.status()).toBe(400);
      expect((await json(res)).error).toBe("Steam account is not connected. Please reconnect.");
    });

    test("epic connect without an authorization code is rejected @negative", async ({ api }) => {
      const res = await api.post("/provider/epic/connect", {});
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect((await json(await api.get("/provider/epic/status"))).Data.connected).toBe(false);
    });

    test("epic connect without a code returns 400 rather than 500 @negative", async ({ api }) => {
      test.fail(true, "Known bug: epicProvider.connect throws a plain Error, so a missing code surfaces as 500");
      expect((await api.post("/provider/epic/connect", {})).status()).toBe(400);
    });

    test("disconnecting a provider that was never connected is a harmless no-op @positive", async ({ api }) => {
      for (const provider of ["steam", "epic"]) {
        const res = await api.delete(`/provider/${provider}/disconnect`);
        expect(res.status(), provider).toBe(200);
        expect((await json(await api.get(`/provider/${provider}/status`))).Data.connected).toBe(false);
      }
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.post("/provider/steam/connect", {})).status()).toBe(401);
      expect((await anon.post("/provider/steam/resync", {})).status()).toBe(401);
      expect((await anon.delete("/provider/steam/disconnect")).status()).toBe(401);
    });
  });

  test.describe("installation refresh", () => {
    test("an empty scan returns an empty report @positive", async ({ api }) => {
      const res = await api.post("/provider/installations/refresh", {});
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toEqual({});
    });

    test("installed Steam games found on disk are imported, then marked uninstalled when gone @positive", async ({ api }) => {
      const scan = { appId: 1145360, name: "Hades", installPath: "C:/Steam/common/Hades" };
      const res = await api.post("/provider/installations/refresh", { installations: { steam: [scan] } });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data.steam).toMatchObject({ installed: 1 });

      let library = (await json(await api.get("/game"))).Data;
      expect(library).toHaveLength(1);
      expect(library[0]).toMatchObject({ title: "Hades", progressStatus: "none" });
      expect(library[0].providers.steam).toMatchObject({ providerGameId: "1145360", installed: true, installPath: scan.installPath });

      // Rescanning the same disk is idempotent.
      await api.post("/provider/installations/refresh", { installations: { steam: [scan] } });
      expect((await json(await api.get("/game"))).Data).toHaveLength(1);

      const gone = await api.post("/provider/installations/refresh", { installations: { steam: [] } });
      expect((await json(gone)).Data.steam).toMatchObject({ removed: 1 });
      library = (await json(await api.get("/game"))).Data;
      expect(library[0].providers.steam.installed).toBe(false);
    });

    test("installed Epic games that are not owned in the library are not imported @negative", async ({ api }) => {
      const res = await api.post("/provider/installations/refresh", {
        installations: { epic: [{ catalogItemId: "abc123", appName: "Fortnite", displayName: "Fortnite", installLocation: "C:/Epic/Fortnite" }] },
      });
      expect(res.status()).toBe(200);
      expect((await json(await api.get("/game"))).Data).toEqual([]);
    });

    test("an unknown provider in the scan is skipped, not fatal @negative", async ({ api }) => {
      const res = await api.post("/provider/installations/refresh", { installations: { gog: [{ name: "x" }] } });
      expect(res.status()).toBe(200);
      expect((await json(res)).Data).toEqual({});
    });

    test("requires authentication @negative", async ({ anon }) => {
      expect((await anon.post("/provider/installations/refresh", {})).status()).toBe(401);
    });
  });
});
