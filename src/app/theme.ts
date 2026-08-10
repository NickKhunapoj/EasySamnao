import type { ThemeMode } from "../types";

export type ResolvedTheme = Exclude<ThemeMode, "system">;

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}
