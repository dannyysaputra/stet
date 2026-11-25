// The review page: the app under review on the left, its text on the right.
// Review checks every piece of text on the current screen, on the laptop only.
import { KIND_NAMES, collectStrings, groupByKey } from "./collect.js";
import { PROBLEM_NAMES, laptopModelStatus, modelCheck, quickCheck, warmUp } from "./check.js";

const frame = document.getElementById("app");
const list = document.getElementById("strings");
const summary = document.getElementById("summary");
const reviewBtn = document.getElementById("review");
const stopBtn = document.getElementById("stop");
const progress = document.getElementById("progress");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

let groups = [];
let screen = "";
let run = 0; // bumped to stop a review in progress

function screenName(doc) {
  return doc.getElementById("screen")?.dataset.screen || doc.location.hash.replace(/^#\//, "");
}

function verdictHtml(g) {
  if (g.pending) return `<span class="verdict dim">Checking...</span>`;
  if (g.error) return `<span class="verdict err">Not checked: ${esc(g.error)}</span>`;
  if (!g.result) return "";
  const { finding: f, source, where, ms } = g.result;
  const how =
    source === "rule" ? "plain rule, no model" : source === "reused" ? "same text checked earlier" : `${where === "laptop" ? "laptop" : `ran: ${where}`}, ${secs(ms)}`;
  if (f.verdict !== "problem") return `<span class="verdict ok">OK <small>${esc(how)}</small></span>`;
  return `<span class="verdict problem" data-severity="${esc(f.severity)}">
      <b>${esc(PROBLEM_NAMES[f.problem] ?? "Problem")}</b>, ${esc(f.severity)}
      ${f.rewrite ? `<span class="rewrite">Try: "${esc(f.rewrite)}"</span>` : f.note ? `<span class="rewrite">${esc(f.note)}</span>` : ""}
      <small>${esc(how)}</small></span>`;
}

function rowHtml(g, i) {
  return `<li data-i="${i}" tabindex="0">
    <span class="kind" data-kind="${esc(g.kind)}">${esc(KIND_NAMES[g.kind] ?? g.kind)}</span>
    <span class="text">${g.text ? esc(g.text) : '<em class="dim">(empty)</em>'}</span>
    ${g.els.length > 1 ? `<span class="count">x${g.els.length}</span>` : "<span></span>"}
    <code class="key">${esc(g.key)}</code>
    ${verdictHtml(g)}
  </li>`;
}

function renderRow(i) {
  const li = list.querySelector(`li[data-i="${i}"]`);
  if (li) li.outerHTML = rowHtml(groups[i], i);
}

function show() {
  const doc = frame.contentDocument;
  if (!doc) return;
  stop();
  const items = collectStrings(doc);
  groups = groupByKey(items);
  screen = screenName(doc);
  summary.textContent = `${items.length} pieces of text on the "${screen}" screen, ${groups.length} different.`;
  progress.textContent = "";
  list.innerHTML = groups.map(rowHtml).join("");
  reviewBtn.disabled = !groups.length;
}

function stop() {
  run++;
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  for (const [i, g] of groups.entries()) if (g.pending) (g.pending = false), renderRow(i);
}

async function review() {
  const status = await laptopModelStatus();
  if (status !== "available") {
    progress.textContent = `The laptop model is not ready (status: ${status}). Prepare it on the Hybrid check page first.`;
    return;
  }
  const me = ++run;
  const started = performance.now();
  reviewBtn.disabled = true;
  stopBtn.hidden = false;
  const counts = { rule: 0, reused: 0, laptop: 0, problems: 0, errors: 0 };
  const tally = (g) => {
    if (g.error) counts.errors++;
    else {
      counts[g.result.source]++;
      if (g.result.finding.verdict === "problem") counts.problems++;
    }
  };
  const report = (done) => {
    const checked = counts.rule + counts.reused + counts.laptop + counts.errors;
    progress.textContent =
      `${done ? "Done" : "Checking"}: ${checked} of ${groups.length} in ${secs(performance.now() - started)}. ` +
      `${counts.problems} problems. ${counts.rule} by plain rule, ${counts.reused} reused, ${counts.laptop} on the laptop` +
      (counts.errors ? `, ${counts.errors} not checked.` : ".");
  };

  // Rules and reused verdicts first: they cost nothing and show at once.
  const forModel = [];
  for (const [i, g] of groups.entries()) {
    g.result = g.error = null;
    const quick = quickCheck(g);
    if (quick) {
      g.result = quick;
      tally(g);
    } else {
      g.pending = true;
      forModel.push(i);
    }
    renderRow(i);
  }
  report(false);

  // Then the laptop model, one string at a time, in screen order.
  for (const i of forModel) {
    if (me !== run) return;
    const g = groups[i];
    const again = quickCheck(g); // the same text may have appeared earlier on this screen
    try {
      g.result = again ?? (await modelCheck(g, screen));
    } catch (e) {
      g.error = e.message ?? String(e);
    }
    if (me !== run) return;
    g.pending = false;
    tally(g);
    renderRow(i);
    report(false);
  }
  report(true);
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  window.__lastReview = { screen, ms: Math.round(performance.now() - started), counts, groups: groups.map(({ els, ...g }) => g) };
}

reviewBtn.addEventListener("click", review);
stopBtn.addEventListener("click", () => {
  stop();
  progress.textContent += " Stopped.";
});

// Outline the matching elements in the app while a row is pointed at or focused.
function mark(row, on) {
  const g = groups[row?.dataset.i];
  if (!g) return;
  for (const el of g.els) {
    el.style.outline = on ? "3px solid #f2c230" : "";
    el.style.outlineOffset = on ? "2px" : "";
  }
  if (on) g.els[0].scrollIntoView({ block: "nearest" });
}
for (const [type, on] of [["mouseover", true], ["mouseout", false], ["focusin", true], ["focusout", false]]) {
  list.addEventListener(type, (e) => mark(e.target.closest("li"), on));
}

// The app re-renders on every hash change. Its own listener was added first, so
// by the time this one runs the new screen is already in place.
function attach() {
  frame.contentWindow.addEventListener("hashchange", show);
  show();
}
frame.addEventListener("load", attach);

// Load the laptop model while the user looks at the screen. Never downloads it:
// only runs when Chrome already reports the model as available.
const warm = document.getElementById("warm");
laptopModelStatus().then(async (status) => {
  if (status !== "available") {
    warm.textContent = `Laptop model: ${status}. Prepare it on the Hybrid check page.`;
    return;
  }
  warm.textContent = "Laptop model: loading...";
  try {
    const r = await warmUp();
    warm.textContent = `Laptop model: ready (loaded in ${secs(r.ms)}, ran on: ${r.where}).`;
    window.__warm = r;
  } catch (e) {
    warm.textContent = `Laptop model: failed to load (${e.message ?? e}).`;
  }
});
// The frame may have finished loading before this module ran.
if (frame.contentDocument?.getElementById("screen")?.dataset.screen) attach();
