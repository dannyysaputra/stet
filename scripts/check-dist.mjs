// Build gate: fails if development-only App Check code reached the hosted bundle.
// Runs after `vite build` (see package.json).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [
  "local-dev-placeholder", // the stand-in reCAPTCHA key
  "debug (saved token)", // debug-provider status labels
  "debug (new token",
];

const hits = (text) => FORBIDDEN.filter((needle) => text.includes(needle));

// Positive control: the scanner must flag a string it is meant to catch,
// and must pass a clean one. If it cannot, its "clean" result means nothing.
if (hits("x local-dev-placeholder x").length !== 1 || hits("clean bundle").length !== 0) {
  console.error("FAIL check-dist: the scanner failed its own control.");
  process.exit(2);
}

const dir = join(import.meta.dirname, "..", "dist", "assets");
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error(`FAIL check-dist: no bundles found in ${dir}.`);
  process.exit(2);
}

let bad = 0;
for (const file of files) {
  for (const needle of hits(readFileSync(join(dir, file), "utf8"))) {
    console.error(`FAIL check-dist: "${needle}" found in dist/assets/${file}`);
    bad++;
  }
}
if (bad) {
  console.error("The build contains development-only App Check code. Build with NODE_ENV unset or set to production.");
  process.exit(1);
}
console.log(`OK check-dist: ${files.length} bundle(s) scanned, no development-only App Check code.`);
