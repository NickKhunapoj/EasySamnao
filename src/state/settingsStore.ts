import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ThemeMode } from "../types";

export const defaultSettings: AppSettings = {
  defaultTemplate: "classic-horizontal",
  defaultTextColor: "#000000",
  defaultLineColor: "#000000",
  defaultSignatureColor: "#1467c9",
  defaultOpacity: 1,
  defaultRotation: -30,
  defaultDateFormat: "thai-long",
  fontPath: null,
  fontName: null,
  language: "en",
  theme: "light"
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  setSettings: (patch: Partial<AppSettings>) => Promise<void>;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  async load() {
    const stored = await invoke<AppSettings | null>("load_settings");
    const migrated = stored ? { ...stored } : stored;
    let changed = false;
    // Migrate the original 92% factory default to the new fully opaque default.
    if (migrated?.defaultOpacity === 0.92) { migrated.defaultOpacity = 1; changed = true; }
    // Earlier versions saved an automatic Leelawadee/Tahoma fallback as an override.
    // Return those installations to the bundled TH Sarabun New default.
    if (migrated?.fontPath && /\\windows\\fonts\\/i.test(migrated.fontPath) && /^(leelawui|leelawuib|tahoma)$/i.test(migrated.fontName ?? "")) {
      migrated.fontPath = null; migrated.fontName = null; changed = true;
    }
    if (migrated && !isThemeMode(migrated.theme)) {
      migrated.theme = defaultSettings.theme; changed = true;
    }
    const settings = { ...defaultSettings, ...migrated };
    set({ settings, loaded: true });
    if (changed) await invoke("save_settings", { settings });
  },
  async setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await invoke("save_settings", { settings });
  }
}));
