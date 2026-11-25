// Writes the Firebase web config into .env.local, using the Firebase CLI you are
// logged in to. Values are never printed. Lines already in .env.local that this
// script does not manage (such as the App Check debug token) are kept.
//
//   npm run setup:env             write .env.local
//   npm run setup:env -- --check  only report which values were found
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");
const project = JSON.parse(readFileSync(join(root, ".firebaserc"), "utf8")).projects.default;

const MAP = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};
const EXTRA = ["VITE_RECAPTCHA_ENTERPRISE_SITE_KEY", "VITE_APPCHECK_DEBUG_TOKEN", "VITE_CLOUD_MODEL"];

// The CLI's JSON shape has changed between versions, so look for the config object anywhere in it.
function findConfig(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.apiKey === "string" && typeof node.appId === "string") return node;
  for (const value of Object.values(node)) {
    const found = findConfig(typeof value === "string" && value.trim().startsWith("{") ? safeParse(value) : value);
    if (found) return found;
  }
  return null;
}
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let raw;
try {
  raw = execSync(`firebase apps:sdkconfig web --project ${project} --json`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error(`FAIL setup-env: the Firebase CLI could not read the web app config for ${project}. Run "firebase login" and try again.`);
  process.exit(1);
}
const config = findConfig(safeParse(raw));
if (!config) {
  console.error("FAIL setup-env: no web app config found in the Firebase CLI output.");
  process.exit(1);
}

const missing = Object.keys(MAP).filter((k) => !config[k]);
console.log(`Project: ${project}`);
for (const k of Object.keys(MAP)) console.log(`  ${MAP[k]}: ${config[k] ? "found" : "MISSING"}`);
if (missing.length) {
  console.error(`FAIL setup-env: the config is missing ${missing.join(", ")}.`);
  process.exit(1);
}
if (checkOnly) {
  console.log("OK setup-env: check only, nothing written.");
  process.exit(0);
}

const file = join(root, ".env.local");
const existing = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
const managed = new Set(Object.values(MAP));
const kept = existing.filter((line) => line.trim() && !managed.has(line.split("=")[0].trim()));
const keptKeys = new Set(kept.map((line) => line.split("=")[0].trim()));
const lines = [
  ...Object.entries(MAP).map(([k, name]) => `${name}=${config[k]}`),
  ...kept,
  ...EXTRA.filter((name) => !keptKeys.has(name)).map((name) => `${name}=`),
];
writeFileSync(file, lines.join("\n") + "\n");
console.log(`OK setup-env: wrote .env.local (${Object.keys(MAP).length} Firebase values; ${kept.length} existing line(s) kept).`);
