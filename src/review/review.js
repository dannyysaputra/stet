// The review page: the app under review on the left, findings on the right.
// Review checks every piece of text on the current screen, on the laptop only.
// Findings are numbered in screen order; the pins on the app and the list in the
// panel are both drawn from the same groups, so they always match.
import { KIND_NAMES, collectStrings, groupByKey } from "./collect.js";
import { ID_ACCURACY, PROBLEM_NAMES, cloudRewrite, cloudRewriteRequest, laptopModelStatus, modelCheck, newTextFor, quickCheck, translationCheck, warmUp } from "./check.js";
import { OPEN, canCheckText, projectMode, setProjectMode } from "../project.js";
import { configReady, configSource, cloudModel, dailyCloudCap, minSeverity, severityShown } from "../config.js";

configReady.then(() => {
  window.__config = { source: configSource(), cloudModel: cloudModel(), dailyCloudCap: dailyCloudCap(), minSeverity: minSeverity() };
});
import { buildFixPrompt, parseFixPrompt } from "./fix-prompt.js";
import { PATTERN_SCHEMA, patternPrompt } from "./pattern.js";
import { askJson } from "../ai.js";
import { onSeamChange } from "../seam.js";
import { MAX_GUIDE_CHARS, currentGuide, resetGuide, saveEditedGuide, writeGuideFromBrief } from "../guide.js";

const frame = document.getElementById("app");
const pinLayer = document.getElementById("pins");
const panel = document.querySelector(".panel");
const list = document.getElementById("strings");
const findingsList = document.getElementById("findings");
const findingsCount = document.getElementById("findings-count");
const textCount = document.getElementById("text-count");
const summary = document.getElementById("summary");
const reviewBtn = document.getElementById("review");
const stopBtn = document.getElementById("stop");
const progress = document.getElementById("progress");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

let groups = [];
let screen = "";
let run = 0; // bumped to stop a review in progress
let reviewing = false;

// Where the sample app keeps its text. The fix prompt names this file and key.
const SOURCE_FILE = "src/sample/strings.js";
const makeFixBtn = document.getElementById("make-fix");
const fixBox = document.getElementById("fix-prompt");
const fixStatus = document.getElementById("fix-status");

function screenName(doc) {
  return doc.getElementById("screen")?.dataset.screen || doc.location.hash.replace(/^#\//, "");
}

// A finding is shown when it is at least as serious as Remote Config's min_severity.
const isFinding = (g) => g.result?.finding.verdict === "problem" && severityShown(g.result.finding.severity);

// Group indexes with a finding, in screen order. Finding number = position + 1.
const findingIndexes = () => groups.flatMap((g, i) => (isFinding(g) ? [i] : []));

// Where a verdict came from. Rules and reused verdicts never leave the laptop.
function ranLabel(r) {
  if (r.source === "rule") return { where: "laptop", text: "On this laptop: plain rule" };
  if (r.source === "reused") return { where: "laptop", text: "On this laptop: same text checked earlier" };
  if (r.where === "laptop") return { where: "laptop", text: `On this laptop: ${secs(r.ms)}` };
  return { where: r.where, text: `Ran: ${r.where}` };
}

// ---------- all text (slice 1.2), with each verdict ----------

function verdictHtml(g) {
  if (g.pending) return `<span class="verdict dim">Checking...</span>`;
  if (g.error) return `<span class="verdict err">Not checked: ${esc(g.error)}</span>`;
  if (!g.result) return "";
  if (!isFinding(g)) return `<span class="verdict ok">OK <small>${esc(ranLabel(g.result).text)}</small></span>`;
  const f = g.result.finding;
  return `<span class="verdict problem" data-severity="${esc(f.severity)}"><b>${esc(PROBLEM_NAMES[f.problem] ?? "Problem")}</b>, ${esc(f.severity)}</span>`;
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

// ---------- findings and pins ----------

function findingHtml(i, n) {
  const g = groups[i];
  const f = g.result.finding;
  const ran = ranLabel(g.result);
  const fix =
    g.next !== undefined
      ? g.next
        ? `<span class="fix new">New: "${esc(g.next)}"</span>${g.nextProblem ? `<span class="fix warn">Check this: ${esc(g.nextProblem)}.</span>` : ""}`
        : `<span class="fix warn">No new text yet: write it in the fix prompt.</span>`
      : f.rewrite
        ? `<span class="fix">Try: "${esc(f.rewrite)}"</span>`
        : f.note
          ? `<span class="fix">${esc(f.note)}</span>`
          : "";
  return `<li data-i="${i}" data-severity="${esc(f.severity)}">
    <input type="checkbox" id="f-${i}" ${g.ticked ? "checked" : ""}>
    <label for="f-${i}">
      <span class="num">${n}</span>
      <b>${esc(PROBLEM_NAMES[f.problem] ?? "Problem")}</b>, ${esc(f.severity)}
      <span class="quote">"${esc(g.text)}" <span class="dim">(${esc(KIND_NAMES[g.kind] ?? g.kind)}${g.els.length > 1 ? `, x${g.els.length}` : ""})</span></span>
      ${fix}
      <span class="ran" data-where="${esc(ran.where)}">${esc(ran.text)}</span>
    </label>
    <div class="ask">${askHtml(g, i)}</div>
  </li>`;
}

// "Ask the cloud" (slice 3.5): first shows the exact text, then sends it on a second press.
function askHtml(g, i) {
  if (g.asking === "busy") return `<span class="dim">Asking the cloud...</span>`;
  if (g.asking === "confirm")
    return `<p class="dim">This exact text goes to the cloud model (${g.askRequest.length.toLocaleString("en")} characters, only this string from your app):</p>
      <pre class="payload">${esc(g.askRequest)}</pre>
      <button type="button" class="quiet" data-ask="send" data-i="${i}">Send it</button> <button type="button" class="quiet" data-ask="cancel" data-i="${i}">Cancel</button>`;
  if (g.askNote) return `<span class="dim">${esc(g.askNote)}</span>`;
  return `<button type="button" class="quiet small" data-ask="show" data-i="${i}">Ask the cloud for a better rewrite</button>`;
}

function renderFindings() {
  const idx = findingIndexes();
  const ticked = idx.filter((i) => groups[i].ticked).length;
  findingsCount.textContent = idx.length ? `${idx.length}, ${ticked} ticked` : "";
  makeFixBtn.disabled = ticked === 0 || reviewing;
  if (!fixBox.hidden) refreshFixPrompt();
  findingsList.innerHTML = idx.length
    ? idx.map((i, k) => findingHtml(i, k + 1)).join("")
    : `<li class="none dim">${groups.some((g) => g.result) ? "No findings on this screen." : "Press Review to check this screen."}</li>`;
  renderPins();
}

function renderPins() {
  pinLayer.innerHTML = findingIndexes()
    .map((i, k) =>
      groups[i].els
        .map(
          (_, e) =>
            `<button type="button" class="pin" data-i="${i}" data-e="${e}" data-ticked="${groups[i].ticked}" data-severity="${esc(groups[i].result.finding.severity)}"
              aria-label="Finding ${k + 1}: ${esc(PROBLEM_NAMES[groups[i].result.finding.problem] ?? "Problem")}">${k + 1}</button>`,
        )
        .join(""),
    )
    .join("");
  placePins();
}

// Pins sit at the top-left corner of their element, in the layer over the frame.
// A pin whose element is scrolled out of the frame, or not rendered, is hidden.
function placePins() {
  const layer = pinLayer.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  const ox = box.left - layer.left + frame.clientLeft;
  const oy = box.top - layer.top + frame.clientTop;
  for (const pin of pinLayer.children) {
    const el = groups[pin.dataset.i]?.els[pin.dataset.e];
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    const visible = r && r.width + r.height > 0 && r.bottom > 0 && r.top < frame.clientHeight && r.right > 0 && r.left < frame.clientWidth;
    pin.hidden = !visible;
    if (visible) {
      pin.style.left = `${ox + Math.max(r.left, 0) - 10}px`;
      pin.style.top = `${oy + Math.max(r.top, 0) - 10}px`;
    }
  }
}

let placing = 0;
const placeSoon = () => {
  cancelAnimationFrame(placing);
  placing = requestAnimationFrame(placePins);
};

findingsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-ask]");
  if (!btn) return;
  const g = groups[btn.dataset.i];
  const action = btn.dataset.ask;
  if (action === "show") {
    if (projectMode() !== OPEN) {
      g.askNote = "This project is Sealed: its text never goes to the cloud. Switch it to Open to ask the cloud.";
    } else {
      g.asking = "confirm";
      g.askRequest = cloudRewriteRequest(g, screen);
    }
  } else if (action === "cancel") {
    g.asking = null;
  } else if (action === "send") {
    g.asking = "busy";
    renderFindings();
    try {
      const r = await cloudRewrite(g, g.askRequest);
      g.next = r.text;
      g.nextProblem = undefined;
      g.cloudNext = true; // "Make fix prompt" keeps it
      g.askNote = `Rewrite from the cloud in ${secs(r.ms)} (ran: ${r.where}).`;
    } catch (err) {
      g.askNote = `No answer from the cloud: ${err.message ?? err}`;
    }
    g.asking = null;
  }
  renderFindings();
});

findingsList.addEventListener("change", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li || e.target.type !== "checkbox") return;
  groups[li.dataset.i].ticked = e.target.checked;
  renderFindings();
  document.getElementById(`f-${li.dataset.i}`)?.focus();
});

pinLayer.addEventListener("click", (e) => {
  const pin = e.target.closest(".pin");
  if (!pin) return;
  const box = document.getElementById(`f-${pin.dataset.i}`);
  box?.closest("li").scrollIntoView({ block: "nearest" });
  box?.focus();
});

// ---------- loading a screen ----------

function show() {
  const doc = frame.contentDocument;
  if (!doc) return;
  stop();
  const items = collectStrings(doc);
  groups = groupByKey(items);
  screen = screenName(doc);
  summary.textContent = `The "${screen}" screen: ${items.length} pieces of text, ${groups.length} different.`;
  textCount.textContent = groups.length;
  progress.textContent = "";
  list.innerHTML = groups.map(rowHtml).join("");
  hideFix();
  renderFindings();
  reviewBtn.disabled = !groups.length;
}

function stop() {
  run++;
  reviewing = false;
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  for (const [i, g] of groups.entries()) if (g.pending) (g.pending = false), renderRow(i);
}

// ---------- the review ----------

// The Indonesian check runs where Phase 0 decided (decision 2): in the cloud for
// an Open project, on text the user approves first; on the laptop for a Sealed one.
const approveBox = document.getElementById("approve-id");
function askApproval() {
  const pairs = groups.filter((g) => g.lang === "id" && !quickCheck(g));
  approveBox.hidden = false;
  approveBox.innerHTML = `<p><b>The Indonesian check runs in the cloud for this Open project.</b> These ${pairs.length} Indonesian strings and their English originals will be sent, one pair per call. Nothing else on the screen is sent.</p>
    <ul class="payload">${pairs.map((g) => `<li>"${esc(g.text)}" <span class="dim">for "${esc(g.original)}"</span></li>`).join("")}</ul>
    <div class="row"><button id="approve-send" type="button">Send these ${pairs.length} pairs</button><button id="approve-cancel" type="button" class="quiet">Cancel</button></div>`;
  document.getElementById("approve-send").onclick = () => {
    approveBox.hidden = true;
    review({ approved: true });
  };
  document.getElementById("approve-cancel").onclick = () => {
    approveBox.hidden = true;
    progress.textContent = "Not sent. Switch the project to Sealed to check Indonesian on the laptop instead.";
  };
}

async function review({ approved = false } = {}) {
  const status = await laptopModelStatus();
  const can = canCheckText(status);
  if (!can.ok) {
    progress.textContent = can.why;
    return;
  }
  const lang = groups[0]?.lang ?? "en";
  const idWhere = projectMode() === OPEN ? "cloud" : "laptop";
  if (lang === "id" && idWhere === "cloud" && !approved && groups.some((g) => !quickCheck(g))) {
    askApproval();
    return;
  }
  approveBox.hidden = true;
  const me = ++run;
  reviewing = true;
  hideFix();
  const started = performance.now();
  reviewBtn.disabled = true;
  stopBtn.hidden = false;
  const counts = { rule: 0, reused: 0, laptop: 0, cloud: 0, problems: 0, errors: 0 };
  const settle = (i) => {
    const g = groups[i];
    g.pending = false;
    if (g.error) counts.errors++;
    else {
      counts[g.result.source]++;
      if (isFinding(g)) {
        counts.problems++;
        g.ticked = true; // every new finding starts ticked
      }
    }
    renderRow(i);
  };
  const report = (done) => {
    const checked = counts.rule + counts.reused + counts.laptop + counts.cloud + counts.errors;
    progress.textContent =
      `${done ? "Done" : "Checking"}: ${checked} of ${groups.length} in ${secs(performance.now() - started)}. ` +
      `${counts.problems} findings. ${counts.rule} by plain rule, ${counts.reused} reused, ${counts.laptop} on the laptop model` +
      (counts.cloud ? `, ${counts.cloud} in the cloud` : "") +
      (counts.errors ? `, ${counts.errors} not checked.` : ".") +
      (lang === "id" ? (idWhere === "laptop" ? ` Indonesian checked on the laptop: ${ID_ACCURACY}` : " Indonesian checked in the cloud, as approved.") : ` Guide: ${guideName(guide)}.`);
  };
  const guide = currentGuide();

  // Rules and reused verdicts first: they cost nothing and show at once.
  const forModel = [];
  for (const [i, g] of groups.entries()) {
    g.result = g.error = null;
    g.next = g.nextProblem = undefined;
    g.asking = g.askNote = g.askRequest = g.cloudNext = undefined;
    g.ticked = false;
    const quick = quickCheck(g);
    if (quick) {
      g.result = quick;
      settle(i);
    } else {
      g.pending = true;
      forModel.push(i);
      renderRow(i);
    }
  }
  renderFindings();
  report(false);

  // Then the laptop model, one string at a time, in screen order.
  for (const i of forModel) {
    if (me !== run) return;
    const g = groups[i];
    const again = quickCheck(g); // the same text may have appeared earlier on this screen
    try {
      g.result = again ?? (g.lang === "id" ? await translationCheck(g, screen, { where: idWhere }) : await modelCheck(g, screen));
    } catch (e) {
      g.error = e.message ?? String(e);
    }
    if (me !== run) return;
    settle(i);
    renderFindings();
    report(false);
  }
  report(true);
  reviewing = false;
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  renderFindings();
  window.__lastReview = { screen, guideId: guide.id, ms: Math.round(performance.now() - started), counts, groups: groups.map(({ els, ...g }) => g) };
  if (recheck?.screen === screen && recheck.waiting) finishRecheck();
  else recordCounts(); // a re-check counts what is left after fixes, not what the agent wrote
}

reviewBtn.addEventListener("click", review);

// ---------- the fix prompt (slice 2.2) ----------

const fixLabel = document.getElementById("fix-label");
const fixActions = document.getElementById("fix-actions");
const copyStatus = document.getElementById("copy-status");

function hideFix() {
  fixBox.hidden = fixLabel.hidden = fixActions.hidden = true;
  fixStatus.textContent = copyStatus.textContent = "";
}

// The prompt is rebuilt from the ticked findings whenever a tick changes.
function refreshFixPrompt() {
  const items = findingIndexes()
    .filter((i) => groups[i].ticked)
    .map((i) => {
      const g = groups[i];
      return { key: g.key, kind: g.kind, screen, count: g.els.length, old: g.text, next: g.next ?? "", problem: PROBLEM_NAMES[g.result.finding.problem] ?? "Problem" };
    });
  const { text, missing } = buildFixPrompt({ app: "Lumbung", file: SOURCE_FILE, items, lang: groups[0]?.lang ?? "en" });
  fixBox.value = text;
  fixBox.rows = Math.min(18, items.length + 6);
  window.__fixPrompt = { text, lines: items.length, missing };
  return { lines: items.length, missing };
}

makeFixBtn.addEventListener("click", async () => {
  const me = run;
  const ticked = findingIndexes().filter((i) => groups[i].ticked);
  const others = groups.map((g) => g.text).filter(Boolean).slice(0, 25);
  const started = performance.now();
  makeFixBtn.disabled = reviewBtn.disabled = true;
  let written = 0;
  for (const [n, i] of ticked.entries()) {
    const g = groups[i];
    fixStatus.textContent = `New text ${n + 1} of ${ticked.length}...`;
    if (g.cloudNext) continue; // the user already asked the cloud for this one
    if (g.lang === "id") {
      // The translation check already gave a better translation.
      g.next = g.result.finding.rewrite ?? "";
      g.nextProblem = g.next ? undefined : "the check gave no better translation";
      continue;
    }
    try {
      const r = await newTextFor(g, screen, others);
      if (me !== run) return; // the screen changed
      if (r.source === "laptop") written++;
      g.next = r.problem && (!r.text || r.text.toLowerCase() === g.text.toLowerCase()) ? "" : r.text;
      g.nextProblem = r.problem;
    } catch (e) {
      if (me !== run) return;
      g.next = "";
      g.nextProblem = `the laptop model failed (${e.message ?? e})`;
    }
  }
  fixBox.hidden = fixLabel.hidden = fixActions.hidden = false;
  renderFindings();
  const { lines, missing } = refreshFixPrompt();
  const flagged = ticked.filter((i) => groups[i].next && groups[i].nextProblem).length;
  fixStatus.textContent =
    `${lines} lines in ${secs(performance.now() - started)}. ${written} new texts written on the laptop.` +
    (missing ? ` ${missing} still need your text: look for "(write the new text here)".` : "") +
    (flagged ? ` ${flagged} new text still fails a plain rule: check it before sending.` : "");
  makeFixBtn.disabled = reviewBtn.disabled = false;
});

// ---------- apply to the sample and re-check (slice 2.3) ----------
// "Apply to sample" does what a coding agent would do with the prompt: it reads
// the prompt as it stands in the box (edits included) and changes the sample's
// text. The sample keeps changed text by key in its own storage, in place of an
// edited src/sample/strings.js. Then Stet reviews the screen again and marks each
// earlier finding resolved or still open.

// The keys src/sample/app.js reads, one per language.
const sampleTextKey = () => ((groups[0]?.lang ?? "en") === "id" ? "lumbung.text.id" : "lumbung.text");
const recheckBox = document.getElementById("recheck");
let recheck = null; // { screen, before: [{ key, text, problem }], applied: Set, skipped, waiting }

function sampleText() {
  try {
    return JSON.parse(localStorage.getItem(sampleTextKey()) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

document.getElementById("apply-fix").addEventListener("click", () => {
  const { changes, skipped } = parseFixPrompt(fixBox.value);
  const current = new Map(groups.map((g) => [g.key, g.text]));
  const apply = [];
  const notFound = [];
  for (const c of changes) {
    // An agent finds the text by its old value: a line whose old text is not in the app is not applied.
    if (current.get(c.key) === c.old) apply.push(c);
    else notFound.push({ line: `${c.key}: "${c.old}"`, reason: current.has(c.key) ? "the old text is not what the app shows" : "no such key on this screen" });
  }
  const text = sampleText();
  for (const c of apply) text[c.key] = c.next;
  try {
    localStorage.setItem(sampleTextKey(), JSON.stringify(text));
  } catch {
    fixStatus.textContent = "Could not change the sample: this browser blocks storage for the page.";
    return;
  }
  recheck = {
    screen,
    before: findingIndexes().map((i) => ({ key: groups[i].key, text: groups[i].text, problem: groups[i].result.finding.problem })),
    applied: new Set(apply.map((c) => c.key)),
    skipped: [...skipped, ...notFound],
    waiting: true,
  };
  renderRecheck(`Applied ${apply.length} change${apply.length === 1 ? "" : "s"} to the sample. Reviewing the screen again...`);
  frame.contentWindow.location.reload(); // the load handler re-reads the screen and the review starts
});

document.getElementById("reset-sample").addEventListener("click", () => {
  try {
    // Both languages go back to src/sample/strings.js.
    localStorage.removeItem("lumbung.text");
    localStorage.removeItem("lumbung.text.id");
  } catch {
    // nothing stored
  }
  recheck = null;
  renderRecheck("");
  frame.contentWindow.location.reload();
});

// Each earlier finding, judged against the new review of the same screen.
function finishRecheck() {
  recheck.waiting = false;
  const now = new Map(groups.map((g) => [g.key, g]));
  recheck.results = recheck.before.map((b) => {
    const g = now.get(b.key);
    if (!g) return { ...b, status: "open", why: "no longer on the screen, so it could not be checked" };
    if (g.text === b.text) return { ...b, status: "open", why: recheck.applied.has(b.key) ? "the text did not change" : "not changed" };
    if (isFinding(g)) return { ...b, now: g.text, status: "open", why: `the new text is still a problem: ${PROBLEM_NAMES[g.result.finding.problem] ?? "problem"}` };
    if (g.error) return { ...b, now: g.text, status: "open", why: "the new text could not be checked" };
    return { ...b, now: g.text, status: "resolved" };
  });
  const resolved = recheck.results.filter((r) => r.status === "resolved").length;
  const fresh = findingIndexes().filter((i) => !recheck.before.some((b) => b.key === groups[i].key)).length;
  renderRecheck(
    `Re-check: ${resolved} of ${recheck.results.length} findings resolved, ${recheck.results.length - resolved} still open.` +
      (fresh ? ` ${fresh} new finding${fresh === 1 ? "" : "s"} on text that was fine before.` : "") +
      (recheck.skipped.length ? ` ${recheck.skipped.length} line${recheck.skipped.length === 1 ? "" : "s"} of the prompt not applied.` : ""),
  );
  window.__recheck = { resolved, open: recheck.results.length - resolved, fresh, results: recheck.results, skipped: recheck.skipped };
}

function renderRecheck(summaryText) {
  if (!summaryText) {
    recheckBox.hidden = true;
    recheckBox.innerHTML = "";
    return;
  }
  recheckBox.hidden = false;
  const rows = (recheck?.results ?? [])
    .map(
      (r) => `<li data-status="${r.status}"><b>${r.status === "resolved" ? "Resolved" : "Still open"}</b>: "${esc(r.text)}"${r.now ? ` -> "${esc(r.now)}"` : ""}
        <span class="dim">${esc(PROBLEM_NAMES[r.problem] ?? r.problem)}${r.why ? `; ${esc(r.why)}` : ""}</span></li>`,
    )
    .join("");
  const skipped = (recheck?.skipped ?? []).map((s) => `<li data-status="skipped">Not applied: ${esc(s.line)} <span class="dim">(${esc(s.reason)})</span></li>`).join("");
  recheckBox.innerHTML = `<p>${esc(summaryText)}</p>${rows || skipped ? `<ul>${rows}${skipped}</ul>` : ""}`;
}

// ---------- pattern and standing rule (slice 2.4) ----------
// Counts per problem kind from the latest first review of each screen. Only these
// numbers, inside a fixed template, go to the cloud; the text shown in
// #pattern-prompt is the exact prompt sent.

const screenCounts = new Map();
let pattern = null;

function recordCounts() {
  const c = {};
  for (const i of findingIndexes()) {
    const k = groups[i].result.finding.problem;
    c[k] = (c[k] ?? 0) + 1;
  }
  screenCounts.set(screen, c);
  showPattern();
}

function showPattern() {
  const total = {};
  for (const c of screenCounts.values()) for (const [k, n] of Object.entries(c)) total[k] = (total[k] ?? 0) + n;
  pattern = patternPrompt(total);
  const screens = [...screenCounts.keys()];
  document.getElementById("pattern-payload").textContent = screens.length
    ? `From ${screens.length} screen${screens.length === 1 ? "" : "s"} (${screens.join(", ")}):\n${JSON.stringify(pattern.payload, null, 2)}`
    : "Review a screen first.";
  document.getElementById("pattern-prompt").textContent = pattern.prompt;
  document.getElementById("pattern-chars").textContent = pattern.prompt.length.toLocaleString("en");
  document.getElementById("send-pattern").disabled = Object.keys(pattern.payload).length === 0;
}

document.getElementById("send-pattern").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  whenOnline(btn, document.getElementById("pattern-status"), "The counts", () => sendPattern(btn));
});
async function sendPattern(btn) {
  const status = document.getElementById("pattern-status");
  const sent = pattern;
  btn.disabled = true;
  status.textContent = "Sending the counts to the cloud model...";
  try {
    const r = await askJson(sent.prompt, PATTERN_SCHEMA, { mode: "ONLY_IN_CLOUD", purpose: "problem counts only" });
    document.getElementById("pattern-cause").textContent = r.data.cause ?? "";
    document.getElementById("pattern-rule").value = r.data.rule ?? "";
    document.getElementById("pattern-result").hidden = false;
    status.textContent = `Answered in ${secs(r.ms)} (ran: ${r.where}). Sent: ${sent.prompt.length.toLocaleString("en")} characters, the text shown above.`;
    window.__pattern = { sentChars: sent.prompt.length, sentPrompt: sent.prompt, payload: sent.payload, where: r.where, data: r.data };
  } catch (err) {
    status.textContent = `Not sent or no answer: ${cloudError(err)}`;
  } finally {
    btn.disabled = false;
  }
}

// ---------- offline (slice 2.5) ----------
// Laptop steps (review, fix prompt, apply, re-check) need no connection. A cloud
// step pressed without one waits, says so, and goes out when the connection is back.

const netState = document.getElementById("net-state");
function showNet() {
  netState.textContent = navigator.onLine ? "Online" : "Offline: laptop steps still work";
  netState.dataset.online = String(navigator.onLine);
}
addEventListener("online", showNet);
addEventListener("offline", showNet);
showNet();

function whenOnline(btn, statusEl, what, run) {
  if (navigator.onLine) return run();
  if (btn.dataset.waiting === "true") return;
  btn.dataset.waiting = "true";
  btn.disabled = true;
  statusEl.textContent = `No connection. ${what} will be sent when the connection is back. Laptop steps keep working meanwhile.`;
  addEventListener(
    "online",
    () => {
      btn.dataset.waiting = "false";
      btn.disabled = false;
      run();
    },
    { once: true },
  );
}

function cloudError(err) {
  const msg = err?.message ?? String(err);
  if (!navigator.onLine || /fetch|network|Failed to fetch/i.test(msg)) return "the cloud could not be reached. Try again when the connection is back.";
  return msg;
}

// The hosted build keeps its pages for offline use. Not in development, where it
// would fight the dev server's reloads.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Stet: offline copy not set up:", e.message));
}

document.getElementById("copy-rule").addEventListener("click", async () => {
  const box = document.getElementById("pattern-rule");
  const out = document.getElementById("rule-copy-status");
  try {
    await navigator.clipboard.writeText(box.value);
    out.textContent = "Copied.";
  } catch {
    box.select();
    out.textContent = document.execCommand("copy") ? "Copied." : "Select the text and copy it by hand.";
  }
});

document.getElementById("copy-fix").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(fixBox.value);
    copyStatus.textContent = "Copied.";
  } catch {
    fixBox.select();
    copyStatus.textContent = document.execCommand("copy") ? "Copied." : "Select the text and copy it by hand.";
  }
});
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
  panel.addEventListener(type, (e) => mark(e.target.closest("li[data-i]"), on));
}

// The app re-renders on every hash change. Its own listener was added first, so
// by the time this one runs the new screen is already in place.
function attach() {
  frame.contentWindow.addEventListener("hashchange", show);
  frame.contentWindow.addEventListener("lumbung:lang", show); // the sample switched language
  frame.contentWindow.addEventListener("scroll", placeSoon);
  frame.contentWindow.addEventListener("resize", placeSoon);
  show();
  // After "Apply to sample" the app reloads with its new text: review it again.
  if (recheck?.waiting && recheck.screen === screen) review();
}
frame.addEventListener("load", attach);
// The frame may have finished loading before this module ran.
if (frame.contentDocument?.getElementById("screen")?.dataset.screen) attach();
addEventListener("resize", placeSoon);

// ---------- the project setting (slice 3.4) ----------
for (const r of document.querySelectorAll('input[name="project"]')) {
  r.checked = r.value === projectMode();
  r.addEventListener("change", () => {
    setProjectMode(r.value);
    approveBox.hidden = true;
    // A note such as "this project is Sealed" no longer holds once the setting changes.
    for (const g of groups) g.askNote = g.asking = undefined;
    renderFindings();
    progress.textContent =
      r.value === OPEN
        ? "Open: the laptop model first, the cloud when it is missing; Indonesian is checked in the cloud after you approve the strings."
        : "Sealed: this project's text is only ever read by the laptop model.";
  });
}

// ---------- the wording guide ----------

function guideName(g) {
  const time = g.at ? new Date(g.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  if (g.source === "brief") return `written from your brief at ${time}`;
  if (g.source === "edited") return `edited at ${time}`;
  return "starter guide";
}

const briefBox = document.getElementById("brief");
const guideText = document.getElementById("guide-text");
const guideStatus = document.getElementById("guide-status");
const briefStatus = document.getElementById("brief-status");

function showGuide() {
  const g = currentGuide();
  document.getElementById("guide-name").textContent = guideName(g);
  guideText.value = g.markdown;
  if (g.brief) briefBox.value = g.brief;
  sizeNote();
}
function sizeNote() {
  const n = guideText.value.length;
  const size = document.getElementById("guide-size");
  size.textContent = `${n.toLocaleString("en")} of ${MAX_GUIDE_CHARS.toLocaleString("en")} characters. The whole guide is sent with every laptop check, so a longer guide is slower.`;
  size.classList.toggle("err", n > MAX_GUIDE_CHARS);
}
// A new guide makes the findings on screen out of date: clear them.
function guideChanged({ stored }, note) {
  showGuide();
  show();
  guideStatus.textContent = note + (stored ? "" : " It could not be saved in this browser, so it lasts until the page is closed.");
}

guideText.addEventListener("input", sizeNote);
// The button is taken here: e.currentTarget is null by the time a waiting step runs.
document.getElementById("write-guide").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  whenOnline(btn, briefStatus, "The brief", () => writeGuide(btn));
});
async function writeGuide(btn) {
  btn.disabled = true;
  briefStatus.textContent = "Sending the brief to the cloud model...";
  try {
    const r = await writeGuideFromBrief(briefBox.value);
    briefStatus.textContent = `Guide written in ${secs(r.ms)} (ran: ${r.where}).`;
    guideChanged(r, "New guide in use. Review again to check against it.");
  } catch (err) {
    briefStatus.textContent = `Not written: ${cloudError(err)}`;
  } finally {
    btn.disabled = false;
  }
}
document.getElementById("save-guide").addEventListener("click", () => {
  try {
    guideChanged(saveEditedGuide(guideText.value), "Edits saved and in use.");
  } catch (err) {
    guideStatus.textContent = `Not saved: ${err.message ?? err}`;
  }
});
document.getElementById("reset-guide").addEventListener("click", () => guideChanged(resetGuide(), "Back to the starter guide."));
showGuide();

// ---------- the seam: what has left this laptop ----------
// The count is the larger of what src/ai.js recorded and the model API requests
// the browser itself saw, so a call the ledger missed still counts.
onSeamChange(({ sent, modelApiRequests, otherRequests }) => {
  const left = Math.max(sent.length, modelApiRequests);
  const counter = document.getElementById("left-count");
  counter.textContent = `Left this laptop: ${left}`;
  counter.dataset.zero = String(left === 0);
  document.getElementById("sent-none").hidden = sent.length > 0;
  document.getElementById("sent").innerHTML = sent
    .map((s) => `<li>${esc(new Date(s.at).toLocaleTimeString("en-GB"))}:${esc(s.purpose)}, ${s.chars.toLocaleString("en")} characters${s.image ? " and an image" : ""}. Ran: ${esc(s.where)}.</li>`)
    .join("");
  const hosts = Object.entries(otherRequests).map(([h, n]) => `${h} x${n}`);
  document.getElementById("net").innerHTML =
    `Requests the browser saw from this page: ${modelApiRequests} to a cloud model API.` +
    (hosts.length ? ` Other outside hosts: ${esc(hosts.join(", "))}.` : " No other outside hosts.") +
    (modelApiRequests > sent.length ? ` <strong class="err">The browser saw more model API requests than were recorded.</strong>` : "");
  window.__seam = { left, sent: sent.length, modelApiRequests, otherRequests };
});

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
