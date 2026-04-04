import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import {
  DEFAULT_THEME_PREFERENCES,
  getThemeColorScheme,
  THEME_COLOR_STORAGE_KEY,
  THEME_LAYOUT_STORAGE_KEY,
  normalizeThemeColor,
  normalizeThemeLayout
} from "./app/theme-preferences";
import { readStorageItem } from "./lib/browser-storage";
import "./styles/global.css";

const initialThemeColor = normalizeThemeColor(readStorageItem(window.localStorage, THEME_COLOR_STORAGE_KEY));
const initialThemeLayout = normalizeThemeLayout(readStorageItem(window.localStorage, THEME_LAYOUT_STORAGE_KEY));

document.documentElement.dataset.themeColor = initialThemeColor ?? DEFAULT_THEME_PREFERENCES.themeColor;
document.documentElement.dataset.themeLayout = initialThemeLayout ?? DEFAULT_THEME_PREFERENCES.themeLayout;
document.documentElement.style.colorScheme = getThemeColorScheme(
  initialThemeColor ?? DEFAULT_THEME_PREFERENCES.themeColor
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
