export const FREE_LIMITS = {
  maxWorkspaces: 1,
  maxStorageBytes: 50 * 1024 * 1024,
  maxActivePaths: 1,
  dailySrsReviews: 20,
  dailyLookups: 30,
  maxFiles: 20,
  mocksPerMonth: 1,
  maxFolders: 8,
} as const;

export type Plan = "free" | "pro";

export function isPro(plan: Plan) {
  return plan === "pro";
}
