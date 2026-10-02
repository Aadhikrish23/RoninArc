import { test as base, expect, Page } from "@playwright/test";
import { Api, RegisteredUser, registerUser } from "../helpers/api";
import { API_URL } from "../env";

// 1x1 transparent PNG: game art points at fake/remote hosts, so serve it
// locally to keep UI tests offline and fast.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const IMAGE_HOSTS = /^https:\/\/(media\.example\.com|shared\.akamai\.steamstatic\.com|cdn\d*\.epicgames\.com)\//;

type Fixtures = {
  /** A freshly registered user (isolated per test, so tests can run in parallel). */
  user: RegisteredUser;
  /** API client authenticated as `user`. */
  api: Api;
  /** API client with no credentials. */
  anon: Api;
  /** A page already signed in as `user` (session seeded, onboarding dismissed). */
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await context.route(IMAGE_HOSTS, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
    await use(context);
  },
  user: async ({ request }, use) => {
    await use(await registerUser(request, API_URL));
  },
  api: async ({ request, user }, use) => {
    await use(new Api(request, API_URL, user.accessToken));
  },
  anon: async ({ request }, use) => {
    await use(new Api(request, API_URL));
  },
  authedPage: async ({ page, user }, use) => {
    await page.addInitScript(
      ({ userdata, accessToken, refreshToken }) => {
        // Init scripts re-run on every navigation; seed only once per tab so a
        // test that logs out isn't silently logged back in.
        if (sessionStorage.getItem("__e2e_seeded")) return;
        sessionStorage.setItem("__e2e_seeded", "1");
        localStorage.setItem("roninarc_user", JSON.stringify(userdata));
        localStorage.setItem("roninarc_token", accessToken);
        localStorage.setItem("roninarc_refresh_token", refreshToken);
        localStorage.setItem("roninarc_import_wizard_seen", "true");
      },
      { userdata: user.userdata, accessToken: user.accessToken, refreshToken: user.refreshToken },
    );
    await use(page);
  },
});

export { expect };
