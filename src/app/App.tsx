import { useEffect, useState } from "react";
import { CreateCopyPage } from "../pages/CreateCopy/CreateCopyPage";
import { SettingsPage } from "../pages/Settings/SettingsPage";
import { useSettingsStore } from "../state/settingsStore";
import { text } from "../i18n/localization";
import appIcon from "../assets/easysamnao-icon.png";

type Page = "create" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("create");
  const load = useSettingsStore((state) => state.load);
  const language = useSettingsStore((state) => state.settings.language);
  const t = text(language);
  useEffect(() => { load().catch(() => undefined); }, []);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><img className="brand-mark" src={appIcon} alt="" />EasySamnao</div><nav className="nav" aria-label="Main navigation"><button className={page === "create" ? "active" : ""} onClick={() => setPage("create")}>{t.createCopy}</button><button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}>{t.settings}</button></nav></aside>{page === "create" ? <CreateCopyPage /> : <SettingsPage />}</div>;
}
