// Bay Area Life 2.0 — Stage 1 test runner.
//
// Runs the four world2 test files with tsx (no test framework
// dependency — node:assert only) and prints one PASS/FAIL line per file
// plus a summary. Exits non-zero on any failure.
//
// Usage (from the repo root):
//   node client/src/world2/tests/run-tests.mjs
//
// It also works from any other cwd: all paths resolve from this file's
// location. It spawns standalone/node_modules/.bin/tsx per the slice
// layout (tsx lives in standalone/, the repo root uses bun).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..", "..", "..", "..");
const TSX_BIN = path.join(REPO_ROOT, "standalone", "node_modules", ".bin", "tsx");

const TEST_FILES = ["sliceCity.test.ts", "streaming.test.ts", "taskShop.test.ts", "character.test.ts"];

if (!existsSync(TSX_BIN)) {
  console.error(`FAIL: tsx not found at ${TSX_BIN}`);
  console.error("Run `npm install` (or `npm ci`) in standalone/ first.");
  process.exit(1);
}

let failures = 0;
for (const file of TEST_FILES) {
  const fullPath = path.join(TESTS_DIR, file);
  if (!existsSync(fullPath)) {
    console.log(`FAIL ${file} — test file missing`);
    failures++;
    continue;
  }
  const res = spawnSync(TSX_BIN, [fullPath], {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) {
    console.log(`FAIL ${file} — could not run tsx: ${res.error.message}`);
    failures++;
    continue;
  }
  if (res.status === 0) {
    console.log(`PASS ${file}`);
  } else {
    console.log(`FAIL ${file} (exit ${res.status})`);
    failures++;
  }
}

console.log(`\n${TEST_FILES.length - failures}/${TEST_FILES.length} test files passed`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
