// The review page: the app under review on the left, findings on the right.
// Review checks every piece of text on the current screen, on the laptop only.
// Findings are numbered in screen order; the pins on the app and the list in the
// panel are both drawn from the same groups, so they always match.
import { KIND_NAMES, collectStrings, groupByKey } from "./collect.js";
import { PROBLEM_NAMES, laptopModelStatus, modelCheck, quickCheck, warmUp } from "./check.js";
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

function screenName(doc) {
  return doc.getElementById("screen")?.dataset.screen || doc.location.hash.replace(/^#\//, "");
}

const isFinding = (g) => g.result?.finding.verdict === "problem";

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
  const fix = f.rewrite ? `Try: "${esc(f.rewrite)}"` : f.note ? esc(f.note) : "";
  return `<li data-i="${i}" data-severity="${esc(f.severity)}">
    <input type="checkbox" id="f-${i}" ${g.ticked ? "checked" : ""}>
    <label for="f-${i}">
      <span class="num">${n}</span>
      <b>${esc(PROBLEM_NAMES[f.problem] ?? "Problem")}</b>, ${esc(f.severity)}
      <span class="quote">"${esc(g.text)}" <span class="dim">(${esc(KIND_NAMES[g.kind] ?? g.kind)}${g.els.length > 1 ? `, x${g.els.length}` : ""})</span></span>
      ${fix ? `<span class="fix">${fix}</span>` : ""}
      <span class="ran" data-where="${esc(ran.where)}">${esc(ran.text)}</span>
    </label>
  </li>`;
}

function renderFindings() {
  const idx = findingIndexes();
  const ticked = idx.filter((i) => groups[i].ticked).length;
  findingsCount.textContent = idx.length ? `${idx.length}, ${ticked} ticked` : "";
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
  renderFindings();
  reviewBtn.disabled = !groups.length;
}

function stop() {
  run++;
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  for (const [i, g] of groups.entries()) if (g.pending) (g.pending = false), renderRow(i);
}

// ---------- the review ----------

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
    const checked = counts.rule + counts.reused + counts.laptop + counts.errors;
    progress.textContent =
      `${done ? "Done" : "Checking"}: ${checked} of ${groups.length} in ${secs(performance.now() - started)}. ` +
      `${counts.problems} findings. ${counts.rule} by plain rule, ${counts.reused} reused, ${counts.laptop} on the laptop model` +
      (counts.errors ? `, ${counts.errors} not checked.` : ".") +
      ` Guide: ${guideName(guide)}.`;
  };
  const guide = currentGuide();

  // Rules and reused verdicts first: they cost nothing and show at once.
  const forModel = [];
  for (const [i, g] of groups.entries()) {
    g.result = g.error = null;
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
      g.result = again ?? (await modelCheck(g, screen));
    } catch (e) {
      g.error = e.message ?? String(e);
    }
    if (me !== run) return;
    settle(i);
    renderFindings();
    report(false);
  }
  report(true);
  stopBtn.hidden = true;
  reviewBtn.disabled = false;
  window.__lastReview = { screen, guideId: guide.id, ms: Math.round(performance.now() - started), counts, groups: groups.map(({ els, ...g }) => g) };
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
  panel.addEventListener(type, (e) => mark(e.target.closest("li[data-i]"), on));
}

// The app re-renders on every hash change. Its own listener was added first, so
// by the time this one runs the new screen is already in place.
function attach() {
  frame.contentWindow.addEventListener("hashchange", show);
  frame.contentWindow.addEventListener("scroll", placeSoon);
  frame.contentWindow.addEventListener("resize", placeSoon);
  show();
}
frame.addEventListener("load", attach);
// The frame may have finished loading before this module ran.
if (frame.contentDocument?.getElementById("screen")?.dataset.screen) attach();
addEventListener("resize", placeSoon);

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
document.getElementById("write-guide").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  briefStatus.textContent = "Sending the brief to the cloud model...";
  try {
    const r = await writeGuideFromBrief(briefBox.value);
    briefStatus.textContent = `Guide written in ${secs(r.ms)} (ran: ${r.where}).`;
    guideChanged(r, "New guide in use. Review again to check against it.");
  } catch (err) {
    briefStatus.textContent = `Not written: ${err.message ?? err}`;
  } finally {
    btn.disabled = false;
  }
});
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
