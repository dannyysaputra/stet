// The seam: what has left this laptop, counted two ways.
// 1. The ledger: src/ai.js records every call that did not run on the laptop,
//    and every failed call in a mode that could have used the cloud.
// 2. The network: every request this page made to another host, as the browser
//    itself reports it (Resource Timing). This does not trust src/ai.js, so a
//    model API request the ledger missed still shows up.
// Both are for this page session only.

// Hosts that receive model prompts (Firebase AI Logic and the Gemini APIs behind it).
const MODEL_API = /(^|\.)(firebasevertexai|generativelanguage|aiplatform)\.googleapis\.com$/;

const ledger = [];
const requests = [];
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(snapshot()));

/** Called by src/ai.js only. entry: { purpose, chars, where, mode }. */
export function recordSent(entry) {
  ledger.push({ at: new Date().toISOString(), ...entry });
  notify();
}

function watchNetwork() {
  if (!("PerformanceObserver" in self)) return;
  // The dev server loads hundreds of modules; keep the buffered entries from overflowing.
  performance.setResourceTimingBufferSize?.(10000);
  const take = (entries) => {
    let added = false;
    for (const e of entries) {
      let url;
      try {
        url = new URL(e.name);
      } catch {
        continue;
      }
      if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) continue;
      requests.push({ host: url.hostname, modelApi: MODEL_API.test(url.hostname), at: Math.round(e.startTime) });
      added = true;
    }
    if (added) notify();
  };
  new PerformanceObserver((list) => take(list.getEntries())).observe({ type: "resource", buffered: true });
}
watchNetwork();

/** { sent: ledger entries, modelApiRequests, otherRequests: { host: count } } */
export function snapshot() {
  const other = {};
  for (const r of requests) if (!r.modelApi) other[r.host] = (other[r.host] ?? 0) + 1;
  return { sent: [...ledger], modelApiRequests: requests.filter((r) => r.modelApi).length, otherRequests: other };
}

/** Calls fn now and on every change. Returns an unsubscribe function. */
export function onSeamChange(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}
