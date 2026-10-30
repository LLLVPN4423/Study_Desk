import { expect, test } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Phase 6 smoke", () => {
  test("landing shows brand and auth CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Study/i);
    await expect(page.getByRole("link", { name: /Đăng nhập|Sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Bắt đầu|Start|free/i }).first()).toBeVisible();
  });

  test("auth sign-in lands on desk", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/Email/i).fill("phase6-signin@example.com");
    await page.getByLabel(/Password/i).fill("phase6-ok-pass");
    await page.getByRole("button", { name: /Sign in|Đăng nhập/i }).click();
    await expect(page).toHaveURL(/\/desk/);
    await expect(page.getByRole("navigation", { name: /Main/i })).toBeVisible();
  });

  test("authenticated shell pages render", async ({ page }) => {
    await seedSession(page);

    const routes: { path: string; heading: RegExp }[] = [
      { path: "/desk", heading: /Phase6/i },
      { path: "/learn", heading: /Lộ trình ngôn ngữ|Your language path/i },
      { path: "/culture", heading: /Di sản theo vùng|Heritage by region/i },
      { path: "/settings", heading: /Tài khoản|Account/i },
      { path: "/rooms", heading: /Phòng học|Study rooms/i },
    ];

    for (const { path, heading } of routes) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: /Main/i })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(heading);
    }
  });
});
