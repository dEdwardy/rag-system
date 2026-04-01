import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { runBuiltApi } from "./run-built-api.mjs";

const apiRoot = resolve(import.meta.dirname, "..");

runBuild();
runBuiltApi({ apiRoot });

function runBuild() {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/c", "pnpm run build"], {
          cwd: apiRoot,
          stdio: "inherit"
        })
      : spawnSync("pnpm", ["run", "build"], {
          cwd: apiRoot,
          stdio: "inherit"
        });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}
