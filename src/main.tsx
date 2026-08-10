import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { App } from "./app/App";
import { resolveTheme, type ResolvedTheme } from "./app/theme";
import "./app/global.css";
import { useSettingsStore } from "./state/settingsStore";

const appFontFamily = "'Noto Sans Thai', 'Segoe UI', sans-serif";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ThemedApp() {
  const mode = useSettingsStore((state) => state.settings.theme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const theme = resolveTheme(mode, systemTheme === "dark");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const fluentTheme = { ...(theme === "dark" ? webDarkTheme : webLightTheme), fontFamilyBase: appFontFamily };
  return <FluentProvider className="theme-provider" theme={fluentTheme}><App /></FluentProvider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>
);
