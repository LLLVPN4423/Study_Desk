import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedSession } from "./helpers/session";

async function expectNoSeriousOrCritical(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking,
    blocking.map((v) => `${v.id}: ${v.help}`).join("\n") || "axe ok",
  ).toEqual([]);
}

test.describe("Phase 6 a11y (serious/critical)", () => {
  test("landing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("auth", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("desk", async ({ page }) => {
    await seedSession(page);
    await page.goto("/desk");
    await expect(page.getByRole("navigation", { name: /Main/i })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("settings", async ({ page }) => {
    await seedSession(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });
});
