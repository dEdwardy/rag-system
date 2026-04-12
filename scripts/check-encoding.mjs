import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const decoder = new TextDecoder("utf-8", { fatal: true });

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const includeGenerated = args.has("--include-generated");

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".txt"
]);

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".pnpm-store",
  "coverage"
]);

const GENERATED_DIRS = new Set([
  ".playwright-cli",
  "output",
  "tmp",
  "storage"
]);

const WESTERN_MOJIBAKE_MARKERS = [
  "\u00C3",
  "\u00C2",
  "\u00E2\u20AC\u2122",
  "\u00E2\u20AC\u0153",
  "\u00E2\u20AC\u009D",
  "\u00E2\u20AC\u201C",
  "\u00E2\u20AC\u201D"
];

function shouldSkipDir(name) {
  if (DEFAULT_IGNORED_DIRS.has(name)) {
    return true;
  }

  return !includeGenerated && GENERATED_DIRS.has(name);
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function walk(dirPath, files) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        await walk(nextPath, files);
      }
      continue;
    }

    if (entry.isFile() && isTextFile(nextPath)) {
      files.push(nextPath);
    }
  }
}

function countOccurrences(text, marker) {
  let count = 0;
  let offset = 0;

  while (true) {
    const index = text.indexOf(marker, offset);
    if (index === -1) {
      return count;
    }
    count += 1;
    offset = index + marker.length;
  }
}

function scanTextContent(text) {
  const findings = [];

  if (text.includes("\uFFFD")) {
    findings.push({
      kind: "replacement-char",
      detail: "Contains the Unicode replacement character U+FFFD."
    });
  }

  for (const marker of WESTERN_MOJIBAKE_MARKERS) {
    const count = countOccurrences(text, marker);
    if (count > 0) {
      findings.push({
        kind: "mojibake-marker",
        detail: `Contains likely mojibake marker ${JSON.stringify(marker)} (${count} occurrence${count === 1 ? "" : "s"}).`
      });
    }
  }

  return findings;
}

async function main() {
  const files = [];
  await walk(ROOT, files);

  const findings = [];

  for (const filePath of files) {
    const relativePath = path.relative(ROOT, filePath);
    let buffer;

    try {
      buffer = await readFile(filePath);
    } catch (error) {
      findings.push({
        file: relativePath,
        kind: "read-error",
        detail: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    let text;
    try {
      text = decoder.decode(buffer);
    } catch (error) {
      findings.push({
        file: relativePath,
        kind: "invalid-utf8",
        detail: error instanceof Error ? error.message : "Failed to decode as UTF-8."
      });
      continue;
    }

    for (const finding of scanTextContent(text)) {
      findings.push({
        file: relativePath,
        ...finding
      });
    }
  }

  if (findings.length === 0) {
    console.log(
      `Encoding check passed. Scanned ${files.length} text files as UTF-8${includeGenerated ? " (including generated directories)." : "."}`
    );
    return;
  }

  console.error(
    `Encoding check found ${findings.length} issue${findings.length === 1 ? "" : "s"} across ${new Set(findings.map(item => item.file)).size} file(s).`
  );

  for (const finding of findings) {
    console.error(`- ${finding.file} [${finding.kind}] ${finding.detail}`);
  }

  process.exitCode = 1;
}

await main();
