import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themePreferencesPath = new URL("../src/app/theme-preferences.ts", import.meta.url);

test("theme preferences default to creative-dark and workspace-app", async () => {
  const source = await readFile(themePreferencesPath, "utf8");

  assert.match(source, /export const DEFAULT_THEME_PREFERENCES[\s\S]*themeColor: "creative-dark"/);
  assert.match(source, /export const DEFAULT_THEME_PREFERENCES[\s\S]*themeLayout: "workspace-app"/);
});

test("theme preferences keep constrained-light and creative-dark as valid color modes", async () => {
  const source = await readFile(themePreferencesPath, "utf8");

  assert.match(source, /export type ThemeColorMode = "constrained-light" \| "creative-dark";/);
  assert.match(source, /return value === "constrained-light" \|\| value === "creative-dark"/);
});

test("theme preferences keep default-app and workspace-app as valid layout modes", async () => {
  const source = await readFile(themePreferencesPath, "utf8");

  assert.match(source, /export type ThemeLayoutMode = "default-app" \| "workspace-app";/);
  assert.match(source, /return value === "default-app" \|\| value === "workspace-app"/);
});

test("theme preferences expose stable storage keys and persistence helpers", async () => {
  const source = await readFile(themePreferencesPath, "utf8");

  assert.match(source, /export const THEME_COLOR_STORAGE_KEY = "rag-system-theme-color";/);
  assert.match(source, /export const THEME_LAYOUT_STORAGE_KEY = "rag-system-theme-layout";/);
  assert.match(source, /export function getStoredThemePreferences/);
  assert.match(source, /export function setStoredThemePreferences/);
  assert.match(source, /export function getDocumentThemeDataset/);
});
