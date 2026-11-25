// Settings that can change without a new deploy (slice 4.2), from Firebase Remote
// Config, with defaults here so Stet works before any template is published and
// when it is offline:
//   cloud_model      the cloud model name used by Firebase AI Logic
//   daily_cloud_cap  cloud calls each browser may make per day
//   min_severity     the least serious finding shown: low, medium or high
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import { firebaseApp } from "./firebase.js";

export const DEFAULTS = {
  cloud_model: import.meta.env.VITE_CLOUD_MODEL || "gemini-3.5-flash-lite",
  daily_cloud_cap: 60,
  min_severity: "low",
};

let rc = null;
let source = "defaults in the code";
if (firebaseApp) {
  try {
    rc = getRemoteConfig(firebaseApp);
    rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
    rc.defaultConfig = { ...DEFAULTS };
  } catch (e) {
    console.warn("Stet: Remote Config not available, using defaults:", e.message);
    rc = null;
  }
}

/** Resolves once Remote Config has been fetched (or failed, keeping the defaults). */
export const configReady = rc
  ? fetchAndActivate(rc)
      .then(() => {
        source = "Remote Config";
      })
      .catch((e) => {
        source = `defaults in the code (Remote Config fetch failed: ${e.message})`;
      })
  : Promise.resolve();

const raw = (key) => (rc ? getValue(rc, key) : null);
export const configSource = () => source;

export function cloudModel() {
  return raw("cloud_model")?.asString() || DEFAULTS.cloud_model;
}

export function dailyCloudCap() {
  const n = raw("daily_cloud_cap")?.asNumber();
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULTS.daily_cloud_cap;
}

const RANK = { low: 1, medium: 2, high: 3 };
export function minSeverity() {
  const s = raw("min_severity")?.asString();
  return RANK[s] ? s : DEFAULTS.min_severity;
}
/** True if a finding of this seriousness is shown. */
export const severityShown = (severity) => (RANK[severity] ?? 2) >= RANK[minSeverity()];

// ---------- the daily cloud cap, counted in this browser ----------

const USE_KEY = "stet.cloudUse";
const today = () => new Date().toISOString().slice(0, 10);

export function cloudUsedToday() {
  try {
    const u = JSON.parse(localStorage.getItem(USE_KEY) ?? "null");
    return u?.day === today() ? u.n : 0;
  } catch {
    return 0;
  }
}

export function countCloudUse() {
  try {
    localStorage.setItem(USE_KEY, JSON.stringify({ day: today(), n: cloudUsedToday() + 1 }));
  } catch {
    // storage blocked: the cap cannot be kept in this browser
  }
}

export class CapReached extends Error {
  constructor(cap) {
    super(`Today's cloud limit for this browser is reached (${cap} calls). Laptop steps keep working; the cloud steps are back tomorrow.`);
    this.name = "CapReached";
  }
}
