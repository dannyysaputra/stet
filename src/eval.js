import { CHECKS, summarize } from "./eval-checks.js";
import { laptopModelStatus, prepareLaptopModel } from "./ai.js";
import { appCheckMode, missingConfig } from "./firebase.js";

const $ = (id) => document.getElementById(id);
const RUNNERS = [
  { mode: "ONLY_ON_DEVICE", label: "Laptop" },
  { mode: "ONLY_IN_CLOUD", label: "Cloud" },
];
const CLOUD_GAP_MS = 4500;
const QUOTA_WAIT_MS = 30000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopRequested = false;
let running = false;

$("appcheck").textContent = appCheckMode;
laptopModelStatus().then((s) => ($("status").textContent = s));
if (missingConfig.length) {
  $("config").hidden = false;
  $("config").textContent = `Firebase is not configured. Missing: ${missingConfig.join(", ")}.`;
}

$("grid").innerHTML = Object.entries(CHECKS)
  .map(
    ([key, c]) => `<article class="box">
      <h2>${c.label} <span class="dim">(${c.items().length} items)</span></h2>
      <div class="row">${RUNNERS.map((r) => `<button type="button" data-check="${key}" data-mode="${r.mode}">Run on ${r.label}</button>`).join("")}</div>
      <div class="out" id="out-${key}"></div>
    </article>`,
  )
  .join("");

$("prepare").addEventListener("click", async () => {
  $("prepare").disabled = true;
  try {
    await prepareLaptopModel((f) => ($("status").textContent = `downloading ${Math.round(f * 100)}%`));
  } catch (e) {
    $("status").textContent = `failed: ${e.message}`;
  }
  $("status").textContent = await laptopModelStatus();
  $("prepare").disabled = false;
});

$("stop").addEventListener("click", () => {
  stopRequested = true;
  $("progress").textContent = "Stopping after the current item...";
});

$("grid").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-check]");
  if (b && !running) runCheck(b.dataset.check, b.dataset.mode);
});

async function runCheck(checkKey, mode) {
  const check = CHECKS[checkKey];
  const limit = Number($("limit").value) || Infinity;
  const items = check.items().slice(0, limit);
  const label = `${check.label}, ${RUNNERS.find((r) => r.mode === mode).label}`;
  running = true;
  stopRequested = false;
  document.querySelectorAll("button[data-check]").forEach((b) => (b.disabled = true));
  $("stop").disabled = false;

  const results = [];
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  let lastStart = 0;
  let retries = 0;
  for (const [i, item] of items.entries()) {
    if (stopRequested) break;
    $("progress").textContent = `${label}: ${i + 1} of ${items.length}`;
    // The free Gemini tier allows only a few cloud requests a minute, so cloud
    // runs are spaced out, and a quota error (429) waits and tries again.
    let attempt = 0;
    for (;;) {
      if (mode === "ONLY_IN_CLOUD") {
        const wait = lastStart + CLOUD_GAP_MS - performance.now();
        if (wait > 0) await sleep(wait);
      }
      lastStart = performance.now();
      try {
        const r = await check.run(item, mode);
        results.push({ item: strip(item), where: r.where, ms: r.ms, attempts: attempt + 1, score: check.score(item, r.data) });
        break;
      } catch (err) {
        if (/\b429\b/.test(err.message) && attempt < 3 && !stopRequested) {
          attempt++;
          retries++;
          $("progress").textContent = `${label}: ${i + 1} of ${items.length} (quota limit, waiting ${QUOTA_WAIT_MS / 1000} s)`;
          await sleep(QUOTA_WAIT_MS);
          continue;
        }
        results.push({ item: strip(item), where: err.where ?? null, ms: err.ms ?? null, attempts: attempt + 1, error: `${err.name}: ${err.message}`.slice(0, 300) });
        break;
      }
    }
  }
  const wallMs = Math.round(performance.now() - t0);
  const summary = summarize(checkKey, results, wallMs);
  const run = {
    check: checkKey, mode, startedAt, wallMs,
    complete: results.length === check.items().length, stopped: stopRequested,
    quotaRetries: retries, cloudGapMs: mode === "ONLY_IN_CLOUD" ? CLOUD_GAP_MS : 0,
    note: mode === "ONLY_IN_CLOUD" ? "Cloud speed includes the deliberate gap between requests; use speed.medianMs for model latency." : undefined,
    appCheck: appCheckMode, userAgent: navigator.userAgent,
  };
  const file = { run, summary, results };

  $(`out-${checkKey}`).insertAdjacentHTML("beforeend", `<h3>${label}${run.complete ? "" : ` (${results.length} of ${check.items().length})`}</h3>`);
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(summary, null, 2);
  $(`out-${checkKey}`).append(pre);
  $("progress").textContent = `${label}: done. ${await save(file)}`;

  running = false;
  $("stop").disabled = true;
  document.querySelectorAll("button[data-check]").forEach((b) => (b.disabled = false));
  window.__lastEval = file;
}

// Keep the result file small: the item's own fields, without drawn screen rows.
function strip(item) {
  if (item.rows) return { id: item.id, name: item.name, texts: item.rows.map((r) => r.text) };
  return item;
}

async function save(file) {
  const name = `${file.run.check}-${file.run.mode === "ONLY_ON_DEVICE" ? "laptop" : "cloud"}-${file.run.startedAt.replace(/[:.]/g, "-")}.json`;
  const body = JSON.stringify(file, null, 2);
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/__eval-results?name=${encodeURIComponent(name)}`, { method: "POST", body });
      if (res.ok) return `Saved data/eval/results/${name}.`;
    } catch {
      /* fall through to a download */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = name;
  a.click();
  return `Downloaded ${name}.`;
}
