import type { Page } from "@playwright/test";

/** Matches `STORAGE_KEYS.session` / `SessionUser` in the app. */
export const E2E_SESSION = {
  id: "e2e-phase6-user",
  name: "Phase6 E2E",
  email: "phase6-e2e@example.com",
  plan: "free" as const,
};

/** Inject local session before any page script runs. */
export async function seedSession(page: Page) {
  await page.addInitScript((session) => {
    localStorage.setItem("studydesk.session", JSON.stringify(session));
    localStorage.setItem("studydesk.tourDone", "1");
  }, E2E_SESSION);
}
