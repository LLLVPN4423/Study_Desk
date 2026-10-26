/**
 * Freemium (Free vs Pro) is paused — limits unlocked so learning is not blocked.
 * Flip FREEMIUM_ENABLED to true when billing/plans ship.
 */
export const FREEMIUM_ENABLED = false;

const FREE_CAPS = {
  maxWorkspaces: 1,
  maxStorageBytes: 200 * 1024 * 1024,
  maxActivePaths: 1,
  dailySrsReviews: 40,
  dailyLookups: 30,
  maxFiles: 40,
  mocksPerMonth: 1,
  maxFolders: 12,
} as const;

const UNLOCKED = {
  maxWorkspaces: 99,
  maxStorageBytes: 200 * 1024 * 1024,
  maxActivePaths: 2,
  dailySrsReviews: 10_000,
  dailyLookups: 10_000,
  maxFiles: 500,
  mocksPerMonth: 10_000,
  maxFolders: 200,
} as const;

export const FREE_LIMITS = FREEMIUM_ENABLED ? FREE_CAPS : UNLOCKED;

export type Plan = "free" | "pro";

export function isPro(plan: Plan) {
  if (!FREEMIUM_ENABLED) return true;
  return plan === "pro";
}

/** When freemium is off, treat everyone as unlocked for path/SRS gates. */
export function freemiumUnlocked() {
  return !FREEMIUM_ENABLED;
}
