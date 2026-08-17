import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPlatform } from "./lib/platform";
import { applyCustomCss } from "./lib/customTheme";
import "katex/dist/katex.min.css";
import "./App.css";

initPlatform();
applyCustomCss();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
