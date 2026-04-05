import { resolve } from "node:path";
import { runBuiltApi } from "./run-built-api.mjs";

const apiRoot = resolve(import.meta.dirname, "..");
runBuiltApi({ apiRoot });
