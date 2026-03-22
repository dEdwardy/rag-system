import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import {
  DEFAULT_THEME_PREFERENCES,
  THEME_COLOR_STORAGE_KEY,
  THEME_LAYOUT_STORAGE_KEY,
  normalizeThemeColor,
  normalizeThemeLayout
} from "./app/theme-preferences";
import "./styles/global.css";

const initialThemeColor = normalizeThemeColor(window.localStorage.getItem(THEME_COLOR_STORAGE_KEY));
const initialThemeLayout = normalizeThemeLayout(window.localStorage.getItem(THEME_LAYOUT_STORAGE_KEY));

document.documentElement.dataset.themeColor = initialThemeColor ?? DEFAULT_THEME_PREFERENCES.themeColor;
document.documentElement.dataset.themeLayout = initialThemeLayout ?? DEFAULT_THEME_PREFERENCES.themeLayout;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
