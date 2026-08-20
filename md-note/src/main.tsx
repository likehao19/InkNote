import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPlatform } from "./lib/platform";
import { getLocale, setLocale } from "./lib/i18n";
import { applyEditorLayoutPrefs } from "./lib/preferences";
import "katex/dist/katex.min.css";
import "./App.css";

initPlatform();
setLocale(getLocale());
applyEditorLayoutPrefs();

document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  { capture: true },
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
