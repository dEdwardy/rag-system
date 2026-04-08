import { resolve } from "node:path";
import { runBuiltApi } from "./run-built-api.mjs";

// Set production environment
process.env.NODE_ENV = 'production';

const apiRoot = resolve(import.meta.dirname, "..");
runBuiltApi({ apiRoot });
