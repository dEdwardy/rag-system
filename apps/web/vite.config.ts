import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appBasePath = normalizeAppBasePath(env.VITE_APP_BASE_PATH);
  const isProduction = mode === "production";

  return {
    base: appBasePath,
    plugins: [react(), tailwindcss()],
    build: {
      target: "es2020",
      minify: "esbuild",
      cssMinify: true,
      sourcemap: !isProduction,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "mantine-vendor": ["@mantine/core", "@mantine/hooks"],
            "query-vendor": ["@tanstack/react-query"]
          }
        }
      }
    },
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, "")
        }
      }
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "@mantine/core", "@tanstack/react-query"]
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
