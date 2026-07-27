import { describe, expect, test } from "bun:test";
import { unsealData } from "iron-session";

import {
  E2E_SESSION_SECRET,
  forgeSessionCookie,
  makeE2EUser,
} from "../../../e2e/helpers/session";

describe("E2E session forging", () => {
  test("uses the same shape, secret, cookie name, and TTL as the app", async () => {
    const user = makeE2EUser("session-compat@it.test");
    const cookie = await forgeSessionCookie(user);
    const payload = await unsealData<{ user: typeof user }>(cookie.value, {
      password: E2E_SESSION_SECRET,
      ttl: 60 * 60 * 8,
    });

    expect(cookie.name).toBe("ssb_session");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(payload.user).toEqual(user);
  });
});
