export const STORAGE_KEYS = {
  session: "studydesk.session",
  desk: "studydesk.desk",
  learn: "studydesk.learn",
  theme: "studydesk.theme",
  wallpaper: "studydesk.wallpaper",
  tourDone: "studydesk.tourDone",
} as const;

/** Legacy theme ids — still accepted on load and mapped to bgSolid. */
export type ThemeId = "paper" | "moss" | "night";

export type WallpaperId = "none" | "mist" | "grove" | "dusk" | "ocean" | "custom";

export type BgMode = "solid" | "gradient";

export type BgGradient = {
  a: string;
  b: string;
  /** Degrees, CSS linear-gradient angle */
  angle: number;
};

export const THEME_SOLID: Record<ThemeId, string> = {
  paper: "#e9eef1",
  moss: "#e8efe9",
  night: "#e4eaee",
};

export const WALLPAP_CUSTOM_KEY = "wallpaper:custom";
