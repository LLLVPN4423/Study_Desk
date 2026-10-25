export const FREE_LIMITS = {
  maxWorkspaces: 1,
  /** Soft quota for desk binaries (PDF/audio/image). Browser localStorage may fill sooner (~5–10MB). */
  maxStorageBytes: 200 * 1024 * 1024,
  maxActivePaths: 1,
  dailySrsReviews: 20,
  dailyLookups: 30,
  maxFiles: 40,
  mocksPerMonth: 1,
  maxFolders: 12,
} as const;

export type Plan = "free" | "pro";

export function isPro(plan: Plan) {
  return plan === "pro";
}
