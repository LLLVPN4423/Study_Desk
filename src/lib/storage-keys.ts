export const STORAGE_KEYS = {
  session: "studydesk.session",
  desk: "studydesk.desk",
  learn: "studydesk.learn",
  theme: "studydesk.theme",
} as const;

export type ThemeId = "paper" | "moss" | "night";
