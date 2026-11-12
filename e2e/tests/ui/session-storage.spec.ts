import { test, expect } from "../../fixtures/test";
import { expectToast, fillLogin, open } from "../../helpers/ui";

// RA-013: the sign-in lives in one store ("Remember me" = localStorage, otherwise this tab's
// sessionStorage); an older sign-in left in the other store must not come back later.

const plant = (page: any, store: "localStorage" | "sessionStorage") =>
  page.evaluate((s: "localStorage" | "sessionStorage") => {
    window[s].setItem("roninarc_user", JSON.stringify({ name: "Old", email: "old@example.com" }));
    window[s].setItem("roninarc_token", "old-access");
    window[s].setItem("roninarc_refresh_token", "old-refresh");
  }, store);

const keys = (page: any) =>
  page.evaluate(() => ({
    local: localStorage.getItem("roninarc_token"),
    session: sessionStorage.getItem("roninarc_token"),
  }));

test.describe("Where the sign-in is kept", () => {
  test("signing in without 'Remember me' removes an older remembered sign-in @positive", async ({ page, user }) => {
    await open(page, "/login");
    await plant(page, "localStorage");
    await fillLogin(page, user.email, user.password, false);
    await expectToast(page, "Login successful");
    const { local, session } = await keys(page);
    expect(local).toBeNull();
    expect(session).toBeTruthy();
    expect(session).not.toBe("old-access");
  });

  test("signing in with 'Remember me' removes an older tab-only sign-in @positive", async ({ page, user }) => {
    await open(page, "/login");
    await plant(page, "sessionStorage");
    await fillLogin(page, user.email, user.password, true);
    await expectToast(page, "Login successful");
    const { local, session } = await keys(page);
    expect(session).toBeNull();
    expect(local).toBeTruthy();
    expect(local).not.toBe("old-access");
  });
});
