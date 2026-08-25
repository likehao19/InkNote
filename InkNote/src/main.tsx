import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPlatform } from "./lib/platform";
import { getLocale, setLocale } from "./lib/i18n";
import { applyEditorLayoutPrefs } from "./lib/preferences";
import { applyMarkdownTheme } from "./lib/markdownTheme";
import { apply as applyTheme } from "./lib/theme";
import { initializeSettingsStore } from "./lib/settingsStore";
import "./App.css";

document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true },
);

async function bootstrap() {
  await initializeSettingsStore();
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
}

void bootstrap();
