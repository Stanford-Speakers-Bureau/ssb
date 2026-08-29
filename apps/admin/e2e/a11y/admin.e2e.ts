import { test } from "../fixtures";
import { expectAccessible } from "../helpers/a11y";

for (const [name, path] of [
  ["dashboard", "/"],
  ["tickets", "/tickets"],
  ["check-in", "/check-in"],
] as const) {
  test(`${name} has no serious WCAG A/AA violations`, async ({
    superadminPage,
  }, testInfo) => {
    await superadminPage.goto(path);
    await expectAccessible(superadminPage, testInfo);
  });
}
