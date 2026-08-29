import React from "react";
import ReactDOM from "react-dom/client";
import { initPlatform } from "./lib/platform";
import { getLocale, setLocale } from "./lib/i18n";
import { applyEditorLayoutPrefs } from "./lib/preferences";
import { applyMarkdownTheme } from "./lib/markdownTheme";
import { apply as applyTheme, applyBootstrapTheme } from "./lib/theme";
import { initializeSettingsStore } from "./lib/settingsStore";
import "./App.css";

performance.mark("inknote:bootstrap-start");
initPlatform();
applyBootstrapTheme();

document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true },
);

async function bootstrap() {
  const [{ default: App }] = await Promise.all([
    import("./App"),
    initializeSettingsStore(),
  ]);
  performance.mark("inknote:settings-ready");
  initPlatform();
  setLocale(getLocale());
  applyTheme();
  applyEditorLayoutPrefs();
  applyMarkdownTheme();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  requestAnimationFrame(() => {
    performance.mark("inknote:app-rendered");
    performance.measure(
      "inknote:bootstrap-to-render",
      "inknote:bootstrap-start",
      "inknote:app-rendered",
    );
  });
}

void bootstrap();
