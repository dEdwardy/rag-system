import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/app/theme-preferences.ts")
).href;

async function loadThemePreferences() {
  return import(helperModuleUrl);
}

test("theme preferences default to creative-dark and workspace-app", async () => {
  const { getInitialThemePreferences } = await loadThemePreferences();

  const result = getInitialThemePreferences();

  assert.equal(result.themeColor, "creative-dark");
  assert.equal(result.themeLayout, "workspace-app");
});

test("theme preferences normalize invalid stored values to defaults", async () => {
  const { getStoredThemePreferences, THEME_COLOR_STORAGE_KEY, THEME_LAYOUT_STORAGE_KEY } =
    await loadThemePreferences();

  const store = new Map([
    [THEME_COLOR_STORAGE_KEY, "bad-color"],
    [THEME_LAYOUT_STORAGE_KEY, "bad-layout"]
  ]);

  const result = getStoredThemePreferences({
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    }
  });

  assert.equal(result.themeColor, "creative-dark");
  assert.equal(result.themeLayout, "workspace-app");
});

test("theme preferences keep valid stored values", async () => {
  const { getStoredThemePreferences, THEME_COLOR_STORAGE_KEY, THEME_LAYOUT_STORAGE_KEY } =
    await loadThemePreferences();

  const store = new Map([
    [THEME_COLOR_STORAGE_KEY, "constrained-light"],
    [THEME_LAYOUT_STORAGE_KEY, "default-app"]
  ]);

  const result = getStoredThemePreferences({
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    }
  });

  assert.equal(result.themeColor, "constrained-light");
  assert.equal(result.themeLayout, "default-app");
});

test("theme preferences persist current values", async () => {
  const { setStoredThemePreferences, THEME_COLOR_STORAGE_KEY, THEME_LAYOUT_STORAGE_KEY } =
    await loadThemePreferences();

  const writes = new Map();

  setStoredThemePreferences(
    {
      setItem(key, value) {
        writes.set(key, value);
      }
    },
    {
      themeColor: "constrained-light",
      themeLayout: "default-app"
    }
  );

  assert.equal(writes.get(THEME_COLOR_STORAGE_KEY), "constrained-light");
  assert.equal(writes.get(THEME_LAYOUT_STORAGE_KEY), "default-app");
});

test("theme preferences build document dataset from stored values", async () => {
  const {
    getDocumentThemeDataset,
    THEME_COLOR_STORAGE_KEY,
    THEME_LAYOUT_STORAGE_KEY
  } = await loadThemePreferences();

  const store = new Map([
    [THEME_COLOR_STORAGE_KEY, "creative-dark"],
    [THEME_LAYOUT_STORAGE_KEY, "workspace-app"]
  ]);

  const result = getDocumentThemeDataset({
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    }
  });

  assert.deepEqual(result, {
    themeColor: "creative-dark",
    themeLayout: "workspace-app"
  });
});
