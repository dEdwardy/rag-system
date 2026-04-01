import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const apiRoot = resolve(import.meta.dirname, "..");
const sharedDistPackageRoot = resolve(apiRoot, "dist", "packages", "shared");
const sharedDistPackageJson = resolve(sharedDistPackageRoot, "package.json");

mkdirSync(sharedDistPackageRoot, {
  recursive: true
});

writeFileSync(
  sharedDistPackageJson,
  `${JSON.stringify(
    {
      type: "module"
    },
    null,
    2
  )}\n`
);
