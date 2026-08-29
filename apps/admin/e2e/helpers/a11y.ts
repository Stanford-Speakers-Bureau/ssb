import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function expectAccessible(page: Page, testInfo: TestInfo) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(1_500);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
  const advisory = results.violations.filter(
    (violation) =>
      violation.impact === "moderate" || violation.impact === "minor",
  );
  if (advisory.length) {
    await testInfo.attach("axe-advisory.json", {
      body: JSON.stringify(advisory, null, 2),
      contentType: "application/json",
    });
  }
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
