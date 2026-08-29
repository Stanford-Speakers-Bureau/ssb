import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function expectAccessible(page: Page, testInfo: TestInfo) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Motion components can otherwise be sampled while text is partially
  // transparent, producing transient contrast failures that users never see.
  await page.waitForTimeout(1_500);
  // The newsletter prompt is a separate, timed surface. Close it so each
  // assertion measures the route named by the test instead of an overlay that
  // may or may not have appeared by the time axe starts.
  const popupClose = page.getByRole("button", { name: "Close" });
  if (await popupClose.isVisible()) {
    await popupClose.click();
    await popupClose.waitFor({ state: "detached" });
  }
  await page.locator("canvas").evaluateAll((nodes) => {
    for (const node of nodes) node.remove();
  });
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
