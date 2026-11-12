import path from "node:path";
import { test, expect } from "@playwright/test";

// The desktop app's main process only does what its own window asks, and only with arguments
// that pass these checks (desktop/services/ipcGuards.js). They're pure functions, so no app or
// server is needed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const guards = require(path.resolve(__dirname, "../../../desktop/services/ipcGuards.js"));

const INDEX = String.raw`D:\games\RoninArc\resources\app.asar\frontend\index.html`;
const packaged = { indexHtmlPath: INDEX };
const dev = { indexHtmlPath: INDEX, devOrigin: "http://localhost:5173" };
const from = (url: unknown, extra: object = {}) => ({ senderFrame: { url, parent: null, ...extra } });

test.describe("who is asking (isTrustedSender)", () => {
  test("the packaged app's own page is trusted, whatever the hash route @positive", () => {
    for (const url of [
      "file:///D:/games/RoninArc/resources/app.asar/frontend/index.html",
      "file:///D:/games/RoninArc/resources/app.asar/frontend/index.html#/settings",
      "file:///d:/GAMES/roninarc/resources/app.asar/frontend/index.html#/library/browse",
      "file:///D:/games/RoninArc/resources/app.asar/frontend/../frontend/index.html",
    ]) {
      expect(guards.isTrustedSender(from(url), packaged), url).toBe(true);
    }
  });

  test("a path with spaces, as Windows writes it in a file URL @positive", () => {
    const policy = { indexHtmlPath: String.raw`C:\Program Files\RoninArc\resources\app.asar\frontend\index.html` };
    expect(guards.isTrustedSender(from("file:///C:/Program%20Files/RoninArc/resources/app.asar/frontend/index.html#/"), policy)).toBe(true);
  });

  test("the dev server is trusted only when the app is running in development @positive", () => {
    expect(guards.isTrustedSender(from("http://localhost:5173/#/dashboard"), dev)).toBe(true);
    expect(guards.isTrustedSender(from("http://localhost:5173/#/dashboard"), packaged)).toBe(false);
  });

  test("other pages, other files, other ports and other schemes are refused @negative", () => {
    for (const url of [
      "https://evil.test/",
      "http://localhost:5174/",
      "http://localhost:5000/api/docs",
      "https://localhost:5173/",
      "http://127.0.0.1:5173/",
      "http://localhost.evil.test:5173/",
      "http://localhost:5173@evil.test/",
      "file:///D:/games/RoninArc/resources/app.asar/frontend/other.html",
      "file:///D:/games/RoninArc/resources/app.asar/frontend/index.html.evil",
      "file:///C:/Users/someone/Downloads/index.html",
      "file://evil-server/share/frontend/index.html",
      "file:///",
      "about:blank",
      "data:text/html,<script>1</script>",
      "javascript:alert(1)",
      "not a url",
      "",
    ]) {
      expect(guards.isTrustedSender(from(url), dev), url).toBe(false);
    }
  });

  test("an iframe, a missing frame or a malformed event is refused @negative", () => {
    const page = "file:///D:/games/RoninArc/resources/app.asar/frontend/index.html";
    expect(guards.isTrustedSender(from(page, { parent: { url: page } }), packaged)).toBe(false);
    expect(guards.isTrustedSender({ senderFrame: null }, packaged)).toBe(false);
    expect(guards.isTrustedSender({}, packaged)).toBe(false);
    expect(guards.isTrustedSender(null, packaged)).toBe(false);
    expect(guards.isTrustedSender(undefined, packaged)).toBe(false);
    expect(guards.isTrustedSender(from(42), packaged)).toBe(false);
    expect(guards.isTrustedSender(from(page), {})).toBe(false);
  });

  test("the main window may only navigate to the app's own page @positive @negative", () => {
    expect(guards.isAppNavigation("http://localhost:5173/#/x", dev)).toBe(true);
    expect(guards.isAppNavigation("file:///D:/games/RoninArc/resources/app.asar/frontend/index.html#/x", packaged)).toBe(true);
    expect(guards.isAppNavigation("https://evil.test/", dev)).toBe(false);
    expect(guards.isAppNavigation("file:///C:/Windows/System32/drivers/etc/hosts", packaged)).toBe(false);
  });

  test("only web links open in the user's browser @positive @negative", () => {
    for (const url of ["https://www.igdb.com", "http://example.test/page?x=1"]) expect(guards.isExternalLinkAllowed(url), url).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "file:///C:/Windows/System32/calc.exe",
      "steam://rungameid/1",
      "ms-msdt://id/x",
      "data:text/html,hi",
      "https://user:pass@example.test/",
      "not a url",
      "",
    ]) {
      expect(guards.isExternalLinkAllowed(url), url).toBe(false);
    }
  });
});

test.describe("launching a game (validateLaunchTarget)", () => {
  const exists = { isFile: () => true };
  const missing = { isFile: () => false };

  test("an .exe at a drive path starts directly @positive", () => {
    for (const p of [
      String.raw`D:\Games\Hades\Hades.exe`,
      "D:/Games/Hades/Hades.exe",
      String.raw`C:\Program Files (x86)\Steam\steamapps\common\Elden Ring\Game\eldenring.EXE`,
      String.raw`E:\games\Ünïcödé Spiel\spiel.exe`,
    ]) {
      expect(guards.validateLaunchTarget(p, exists), p).toMatchObject({ ok: true, kind: "exe", target: p, shellSafe: true });
    }
  });

  test("a real file passes the existence check @positive", async () => {
    test.skip(process.platform !== "win32", "Windows paths");
    const notepad = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "notepad.exe");
    expect(guards.validateLaunchTarget(notepad)).toMatchObject({ ok: true, kind: "exe" });
  });

  test("a file that doesn't exist is refused @negative", () => {
    expect(guards.validateLaunchTarget(String.raw`D:\Games\Gone\gone.exe`, missing)).toMatchObject({ ok: false, reason: "no such file" });
    expect(guards.validateLaunchTarget(String.raw`D:\Games\Gone\gone.exe`)).toMatchObject({ ok: false });
  });

  test("& and % in a folder name still start directly, but can't fall back to the shell @positive", () => {
    for (const p of [String.raw`D:\Games\Rock & Roll Racing\rr.exe`, String.raw`D:\Games\100%\game.exe`, String.raw`D:\Games\a^b\game.exe`]) {
      expect(guards.validateLaunchTarget(p, exists), p).toMatchObject({ ok: true, kind: "exe", shellSafe: false });
    }
  });

  test("shortcuts are opened through the shell, so they can't carry shell characters @positive @negative", () => {
    expect(guards.validateLaunchTarget(String.raw`D:\Games\Hades.lnk`, exists)).toMatchObject({ ok: true, kind: "shell", shellSafe: true });
    expect(guards.validateLaunchTarget(String.raw`D:\Games\Hades.url`, exists)).toMatchObject({ ok: true, kind: "shell" });
    for (const p of [String.raw`D:\Games\a&b.lnk`, String.raw`D:\Games\%TEMP%.lnk`, String.raw`D:\Games\a^b.url`]) {
      expect(guards.validateLaunchTarget(p, exists), p).toMatchObject({ ok: false });
    }
  });

  test("shell injection through the path is refused @negative", () => {
    for (const p of [
      String.raw`D:\Games\x.exe" & calc & "y.exe`,
      String.raw`D:\Games\x.exe & calc`,
      String.raw`D:\Games\x.exe && calc.exe`,
      String.raw`D:\Games\x.exe | calc.exe`,
      String.raw`D:\Games\x.exe > out.exe`,
      String.raw`D:\Games\x.exe` + "\r\ncalc.exe",
      String.raw`D:\Games\x` + "\u0000.exe",
      "D:\\Games\\`calc`.exe",
      String.raw`D:\Games\x?.exe`,
      String.raw`D:\Games\*.exe`,
    ]) {
      // Refused, or (a strange but legal file name like "x.exe && calc.exe") started directly with
      // no shell and never handed to cmd.exe.
      const result = guards.validateLaunchTarget(p, exists);
      if (result.ok) expect(result, JSON.stringify(p)).toMatchObject({ kind: "exe", shellSafe: false });
      else expect(result.ok, JSON.stringify(p)).toBe(false);
    }
    expect(guards.validateLaunchTarget(String.raw`D:\Games\x.exe && calc.exe`, exists)).toMatchObject({ ok: true, kind: "exe", shellSafe: false });
    expect(guards.validateLaunchTarget(String.raw`D:\Games\x.exe & calc`, exists)).toMatchObject({ ok: false });
  });

  test("relative, network, device and traversal paths are refused @negative", () => {
    for (const p of [
      "game.exe",
      String.raw`.\game.exe`,
      String.raw`Games\game.exe`,
      "/usr/bin/game.exe",
      String.raw`\\evil-server\share\game.exe`,
      "//evil-server/share/game.exe",
      String.raw`\\?\C:\Games\game.exe`,
      String.raw`\\.\pipe\game.exe`,
      String.raw`C:game.exe`,
      String.raw`D:\Games\..\..\Windows\System32\cmd.exe`,
      String.raw`D:\Games\game.exe:hidden.exe`,
      String.raw`D:\Games\game.exe::$DATA`,
    ]) {
      expect(guards.validateLaunchTarget(p, exists), p).toMatchObject({ ok: false });
    }
  });

  test("only .exe, .lnk and .url files are started @negative", () => {
    for (const ext of ["bat", "cmd", "ps1", "vbs", "js", "msi", "com", "scr", "dll", "hta", "reg", "txt", "jar", ""]) {
      expect(guards.validateLaunchTarget(`D:\\Games\\file${ext ? "." + ext : ""}`, exists), ext).toMatchObject({ ok: false });
    }
  });

  test("odd values are refused @negative", () => {
    for (const v of [undefined, null, 42, {}, [], true, "", " ", "x".repeat(1025), String.raw`D:\Games\a.exe `, String.raw` D:\Games\a.exe`]) {
      expect(guards.validateLaunchTarget(v as any, exists), String(v)).toMatchObject({ ok: false });
    }
    expect(guards.validateLaunchTarget("D:\\" + "a".repeat(1000) + ".exe", exists)).toMatchObject({ ok: true });
    expect(guards.validateLaunchTarget("D:\\" + "a".repeat(1100) + ".exe", exists)).toMatchObject({ ok: false });
  });

  test("Steam and Epic launcher links, in the shapes the app builds, are allowed @positive", () => {
    for (const link of [
      "steam://rungameid/1593500",
      "steam://run/220",
      "com.epicgames.launcher://apps/4b3fa6ee6c1b4a3e8e9bd5f0cb3e1a6f?action=launch&silent=true",
      "com.epicgames.launcher://apps/Fortnite?action=launch&silent=true",
      "com.epicgames.launcher://apps/Salt",
    ]) {
      expect(guards.validateLaunchTarget(link), link).toMatchObject({ ok: true, kind: "uri", target: link });
    }
  });

  test("any other link, or a launcher link with extras, is refused @negative", () => {
    for (const link of [
      "steam://rungameid/abc",
      "steam://rungameid/1 & calc",
      "steam://rungameid/1%20calc",
      "steam://rungameid/",
      "steam://install/220",
      "steam://open/console",
      "steam://nav/games/details/1",
      "STEAM://RUNGAMEID/1",
      "com.epicgames.launcher://apps/x y",
      "com.epicgames.launcher://apps/x?action=launch&silent=true&x=%22",
      "com.epicgames.launcher://store/p/hades",
      "com.epicgames.launcher://apps/x/../../y",
      "http://evil.test/game.exe",
      "https://evil.test/",
      "file:///C:/Windows/System32/calc.exe",
      "ms-msdt://id/PCWDiagnostic",
      "ms-settings://network",
      "calculator://",
      "javascript:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,hi",
      "search-ms:query=x",
      "\\\\evil-server\\share",
    ]) {
      expect(guards.validateLaunchTarget(link, exists), link).toMatchObject({ ok: false });
    }
  });

  test("what may go inside `cmd /c start` is exactly what has no shell syntax @positive @negative", () => {
    expect(guards.isSafeForShell(String.raw`D:\Games (x86)\Hades 2\Hades.exe`)).toBe(true);
    for (const p of ['D:\\a"b', "D:\\a%b", "D:\\a^b", "D:\\a&b", "D:\\a|b", "D:\\a<b", "D:\\a>b", "D:\\a`b", "D:\\a!b", "D:\\a\nb", 5, null]) {
      expect(guards.isSafeForShell(p as any), String(p)).toBe(false);
    }
  });
});

test.describe("provider sign-in pages (validateLoginUrl)", () => {
  const epicReturn = "https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code";
  const epic = (redirect = epicReturn, base = "https://www.epicgames.com/id/login") => `${base}?redirectUrl=${encodeURIComponent(redirect)}`;
  const steamReturn = "http://localhost:5000/provider/steam/oauth/return";
  const steam = (returnTo = steamReturn, base = "https://steamcommunity.com/openid/login") =>
    `${base}?` +
    new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo,
      "openid.realm": returnTo,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }).toString();

  test("the URLs the backend builds are allowed @positive", () => {
    expect(guards.validateLoginUrl("epic", epic())).toEqual({ ok: true });
    expect(guards.validateLoginUrl("steam", steam())).toEqual({ ok: true });
    expect(guards.validateLoginUrl("steam", steam("http://127.0.0.1:5000/provider/steam/oauth/return"))).toEqual({ ok: true });
    expect(guards.validateLoginUrl("epic", epic(epicReturn, "https://accounts.epicgames.com/id/login"))).toEqual({ ok: true });
  });

  test("look-alike and foreign hosts are refused @negative", () => {
    for (const url of [
      epic(epicReturn, "https://www.epicgames.com.evil.test/id/login"),
      epic(epicReturn, "https://evil.test/id/login"),
      epic(epicReturn, "https://epicgames.com.evil.test/id/login"),
      epic(epicReturn, "https://evilepicgames.com/id/login"),
      epic(epicReturn, "https://www.epicgames.com@evil.test/id/login"),
      epic(epicReturn, "https://user:pw@www.epicgames.com/id/login"),
      epic(epicReturn, "https://www.epicgames.com:8443/id/login"),
      epic(epicReturn, "http://www.epicgames.com/id/login"),
      epic(epicReturn, "https://www.epicgames.com/login"),
      epic(epicReturn, "https://www.epicgames.com/store"),
    ]) {
      expect(guards.validateLoginUrl("epic", url), url).toMatchObject({ ok: false });
    }
    for (const url of [
      steam(steamReturn, "https://steamcommunity.com.evil.test/openid/login"),
      steam(steamReturn, "https://evil.test/openid/login"),
      steam(steamReturn, "https://steamcommunity.com@evil.test/openid/login"),
      steam(steamReturn, "http://steamcommunity.com/openid/login"),
      steam(steamReturn, "https://steamcommunity.com/openid/other"),
      steam(steamReturn, "https://steamcommunity.com:8443/openid/login"),
      steam(steamReturn, "https://store.steampowered.com/openid/login"),
    ]) {
      expect(guards.validateLoginUrl("steam", url), url).toMatchObject({ ok: false });
    }
  });

  test("a sign-in that would return the result somewhere else is refused @negative", () => {
    for (const back of [
      "https://evil.test/id/api/redirect",
      "https://www.epicgames.com.evil.test/id/api/redirect",
      "https://www.epicgames.com/somewhere/else",
      "javascript:alert(1)",
      "",
    ]) {
      expect(guards.validateLoginUrl("epic", epic(back)), back).toMatchObject({ ok: false });
    }
    expect(guards.validateLoginUrl("epic", "https://www.epicgames.com/id/login")).toMatchObject({ ok: false });
    for (const back of [
      "https://evil.test/provider/steam/oauth/return",
      "http://evil.test/provider/steam/oauth/return",
      "http://localhost.evil.test:5000/provider/steam/oauth/return",
      "http://localhost:5000/other",
      "http://localhost:5000/provider/steam/oauth/return/../../x",
      "",
    ]) {
      expect(guards.validateLoginUrl("steam", steam(back)), back).toMatchObject({ ok: false });
    }
    expect(guards.validateLoginUrl("steam", "https://steamcommunity.com/openid/login")).toMatchObject({ ok: false });
  });

  test("odd values and unknown providers are refused @negative", () => {
    for (const v of [undefined, null, 42, {}, [], "", "not a url", "javascript:alert(1)", "file:///C:/x", epic() + "&x=" + "a".repeat(2100)]) {
      expect(guards.validateLoginUrl("epic", v as any), String(v).slice(0, 40)).toMatchObject({ ok: false });
      expect(guards.validateLoginUrl("steam", v as any), String(v).slice(0, 40)).toMatchObject({ ok: false });
    }
    expect(guards.validateLoginUrl("gog", epic())).toMatchObject({ ok: false });
    expect(guards.validateLoginUrl("epic", steam())).toMatchObject({ ok: false });
    expect(guards.validateLoginUrl("steam", epic())).toMatchObject({ ok: false });
  });
});

test.describe("game ids and store-page requests", () => {
  test("ids as the library and the stores give them are allowed @positive", () => {
    for (const id of ["6af0b4037de83ce52bc05ef2", "1593500", "4b3fa6ee6c1b4a3e8e9bd5f0cb3e1a6f", "Fortnite", "a.b-c_d~e"]) {
      expect(guards.validateGameId(id), id).toBe(true);
    }
  });

  test("empty, long, spaced, punctuated and non-string ids are refused @negative", () => {
    for (const id of ["", "x".repeat(201), "a b", "a;b", "a&b", "../x", "a/b", "a\\b", 'a"b', "a\nb", 5, null, undefined, {}, []]) {
      expect(guards.validateGameId(id as any), String(id).slice(0, 20)).toBe(false);
    }
  });

  test("a store-page request names a known store and string ids @positive @negative", () => {
    expect(guards.validateGamePageRequest({ provider: "steam", gameId: "1593500" })).toEqual({ provider: "steam", gameId: "1593500", namespace: undefined });
    expect(guards.validateGamePageRequest({ provider: "epic", namespace: "abc123", gameId: null })).toEqual({ provider: "epic", gameId: undefined, namespace: "abc123" });
    for (const bad of [
      null,
      undefined,
      "steam",
      [],
      {},
      { provider: "gog", gameId: "1" },
      { provider: "steam", gameId: 1593500 },
      { provider: "epic", namespace: { $ne: 1 } },
      { provider: "epic", namespace: "x".repeat(201) },
      { provider: "steam", gameId: ["1"] },
    ]) {
      expect(guards.validateGamePageRequest(bad as any), JSON.stringify(bad)?.slice(0, 40)).toBeNull();
    }
  });
});
