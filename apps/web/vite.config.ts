import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appBasePath = normalizeAppBasePath(env.VITE_APP_BASE_PATH);

  return {
    base: appBasePath,
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, "")
        }
      }
    }
  };
});

function normalizeAppBasePath(value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "/";
  }

  const withLeadingSlash = trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}
