// Review your own text (slice 3.3): language files or a pasted list, with the
// same checks and fix prompt as the review of the sample. No pins here: the
// text is not on a screen, so findings are listed by file and key.
import { KIND_NAMES } from "../review/collect.js";
import { PROBLEM_NAMES, laptopModelStatus, modelCheck, newTextFor, quickCheck, translationCheck, ID_ACCURACY } from "../review/check.js";
import { buildFixPrompt } from "../review/fix-prompt.js";
import { acceptScan, pairFiles, parsePasted } from "./parse.js";
import { bookmarkletHref } from "../scan/bookmarklet.js";
import { OPEN, SEALED, canCheckText, projectMode, setProjectMode } from "../project.js";
import { onSeamChange } from "../seam.js";
import { severityShown } from "../config.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

let items = []; // [{ key, kind, en, id, context?, count? }]
let files = { en: "", id: "" };
let source = "keys"; // "keys": language files or a pasted list; "page": scanned from a running app
let screenName = "language file";
let groups = []; // one per check: { key, kind, lang, text, original?, file, result?, error?, ticked, next? }
let run = 0;

// ---------- loading text ----------

async function readJson(input) {
  const f = input.files?.[0];
  if (!f) return { name: "", json: null };
  try {
    return { name: f.name, json: JSON.parse(await f.text()) };
  } catch (e) {
    throw new Error(`${f.name} is not valid JSON (${e.message}).`);
  }
}

async function loadFiles() {
  try {
    const en = await readJson($("file-en"));
    const id = await readJson($("file-id"));
    $("file-en-name").textContent = en.name || "None chosen";
    $("file-id-name").textContent = id.name || "None chosen";
    if (!en.json && !id.json) return;
    const paired = pairFiles(en.json, id.json);
    items = paired.items;
    files = { en: en.name, id: id.name };
    source = "keys";
    screenName = "language file";
    const notes = [];
    if (paired.onlyEn.length) notes.push(`${paired.onlyEn.length} key${paired.onlyEn.length === 1 ? " has" : "s have"} no Indonesian`);
    if (paired.onlyId.length) notes.push(`${paired.onlyId.length} Indonesian key${paired.onlyId.length === 1 ? " has" : "s have"} no English`);
    loaded(`${items.length} keys loaded${notes.length ? ` (${notes.join("; ")})` : ""}.`);
  } catch (e) {
    loaded(e.message, true);
  }
}

function loaded(text, isError = false) {
  $("loaded").textContent = text;
  $("loaded").classList.toggle("err", isError);
  $("run").disabled = !items.length;
  $("run").textContent = items.length ? `Check ${items.length} piece${items.length === 1 ? "" : "s"} of text` : "Check the text";
  // Once a scan has arrived, the ways of getting text step aside for the next step.
  const scanned = source === "page" && items.length > 0;
  $("get-text").hidden = scanned;
  $("other-text").hidden = !scanned;
  groups = [];
  $("results").hidden = true;
  renderFindings();
}

$("file-en").addEventListener("change", loadFiles);
$("file-id").addEventListener("change", loadFiles);
$("use-pasted").addEventListener("click", () => {
  items = parsePasted($("pasted").value);
  files = { en: "the pasted list", id: "" };
  source = "keys";
  screenName = "language file";
  loaded(`${items.length} piece${items.length === 1 ? "" : "s"} of text from the pasted list.`);
});

// ---------- scanning a running app (slice 3.6) ----------

$("bookmarklet").href = bookmarkletHref(location.origin);
$("bookmarklet").addEventListener("click", (e) => {
  e.preventDefault();
  $("bookmarklet-note").textContent = "Drag this button to your bookmarks bar, then click it there while your app is open.";
});

// Opened by the bookmarklet: tell the page that opened this tab we are ready, and
// take its text once. Only that page's messages are read, and each is checked.
if (location.hash === "#scan" && window.opener) {
  const onScan = (e) => {
    if (e.source !== window.opener) return;
    if (!$("stop").hidden) return; // a review is running: its text is not swapped under it
    const scan = acceptScan(e.data);
    if (!scan) return;
    removeEventListener("message", onScan); // one scan per tab
    // The page's own claims (address, title) are shown next to the address the
    // browser vouches for, so a page cannot pass itself off as another.
    const host = new URL(e.origin).host;
    const sameHost = host === scan.page.split("/")[0];
    const from = sameHost ? scan.page : `${host} (says ${scan.page})`;
    if (scan.lang.toLowerCase().startsWith("id")) {
      items = [];
      loaded(`The page ${from} is in Indonesian. A scan checks English text for now; for Indonesian, use your language files above.`, true);
      return;
    }
    items = scan.items;
    files = { en: `page ${from}`, id: "" };
    source = "page";
    screenName = scan.title ? `page "${scan.title}" on ${host}` : `page ${from}`;
    if (sameHost && scan.title && $("app-name").value === "My app") $("app-name").value = scan.title;
    window.__scan = { page: scan.page, dropped: scan.dropped, truncated: scan.truncated, items: items.map((i) => `${i.kind}|${i.en}|${i.context}|${i.key}|${i.count}`) };
    const left = [scan.dropped && `${scan.dropped} left out: too long, too many or not text`, scan.truncated && `the screen has more text than the ${items.length} read`].filter(Boolean);
    loaded(
      `Got ${items.length} pieces of text from ${from}${left.length ? ` (${left.join("; ")})` : ""}. Names or other details shown as text on that screen are included. Nothing has been checked or sent yet.`,
    );
    $("scan").scrollIntoView({ block: "start" });
    $("run").focus({ preventScroll: true });
  };
  addEventListener("message", onScan);
  window.opener.postMessage({ type: "stet-ready" }, "*");
}

// ---------- project and laptop model ----------

// One tick box for the project setting (slice 3.4): ticked is a Sealed project
// (text read only by the laptop model), unticked an Open one (the cloud when the
// laptop model is missing, after approval).
const keep = $("keep-local");
keep.checked = projectMode() === SEALED;
keep.addEventListener("change", () => {
  setProjectMode(keep.checked ? SEALED : OPEN);
  showLaptopState();
});

// Why a check cannot run here, in plain words.
const noLaptopModel = (status) =>
  `The model built into Chrome is not ready on this computer (status: ${status}), and you asked to keep your text on this laptop. Download the model on the home page, or untick "Keep my text on this laptop" to use the cloud model after seeing exactly what is sent.`;

async function showLaptopState() {
  const status = await laptopModelStatus();
  const can = canCheckText(status);
  $("keep-note").hidden = keep.checked;
  $("laptop-state").innerHTML =
    status === "available"
      ? "The model built into Chrome is ready on this laptop."
      : can.ok
        ? `The model built into Chrome is not ready here (status: ${esc(status)}), so your text would go to the cloud model, one piece per call, after you agree to the list.`
        : `${esc(noLaptopModel(status))} <a href="/">Home page</a>`;
  $("laptop-state").classList.toggle("err", !can.ok);
}
showLaptopState();

// ---------- the review ----------

const isFinding = (g) => g.result?.finding.verdict === "problem" && severityShown(g.result.finding.severity);

// In an Open project, text goes to the cloud only after the user has seen exactly
// which strings will be sent: the Indonesian pairs always (decision 2), and the
// English strings too when the laptop model is missing.
function askApproval(toCloud) {
  const box = $("approve");
  box.hidden = false;
  box.innerHTML = `<p><b>These ${toCloud.length} pieces of text would go to the cloud model, one per call.</b> Each call also carries the app name ("${esc($("app-name").value.trim() || "An app")}"), the screen name (${esc(screenName)}), the element kind and the note in brackets. Nothing else from your app is sent.</p>
    <ul class="payload">${toCloud.map((g) => `<li>${g.lang.toUpperCase()} ${esc(g.key)}: "${esc(g.text)}"${g.original ? ` <span class="dim">for "${esc(g.original)}"</span>` : ""}${g.context ? ` <span class="dim">(${esc(g.context)})</span>` : ""}</li>`).join("")}</ul>
    <div class="row"><button id="approve-send" type="button">Send these ${toCloud.length}</button><button id="approve-cancel" type="button" class="quiet">Cancel</button></div>`;
  $("approve-send").onclick = () => {
    box.hidden = true;
    review({ approved: true });
  };
  $("approve-cancel").onclick = () => {
    box.hidden = true;
    $("progress").textContent = 'Not sent. Tick "Keep my text on this laptop" to check it here instead.';
  };
}

async function review({ approved = false } = {}) {
  const status = await laptopModelStatus();
  const can = canCheckText(status);
  if (!can.ok) {
    $("progress").textContent = noLaptopModel(status);
    return;
  }
  const app = $("app-name").value.trim() || "An app";
  const register = $("register").value;
  const all = [
    ...items.filter((i) => i.en).map((i) => ({ key: i.key, kind: i.kind, lang: "en", text: i.en, context: i.context ?? "", count: i.count ?? 1, file: files.en })),
    ...items.filter((i) => i.id && i.en).map((i) => ({ key: i.key, kind: i.kind, lang: "id", text: i.id, original: i.en, file: files.id })),
  ];
  if (projectMode() === OPEN && !approved) {
    const toCloud = all.filter((g) => !quickCheck(g, { app, register }) && (g.lang === "id" || can.viaCloud));
    if (toCloud.length) {
      askApproval(toCloud);
      return;
    }
  }
  $("approve").hidden = true;
  const me = ++run;
  const started = performance.now();
  groups = all;
  $("run").disabled = true;
  $("stop").hidden = false;
  $("make-fix").disabled = true;
  hideFix();
  let done = 0;
  $("results").hidden = false;
  const onLaptop = projectMode() === SEALED;
  const report = (end) => {
    const found = groups.filter(isFinding).length;
    const spent = performance.now() - started;
    // Time left, from the pace so far (plain rules and reused verdicts are instant).
    const left = done ? Math.round(((spent / done) * (groups.length - done)) / 1000) : null;
    const eta = left === null ? "" : left >= 90 ? `, about ${Math.round(left / 60)} min left` : left >= 5 ? `, about ${Math.ceil(left / 5) * 5} s left` : ", almost done";
    $("progress").textContent = `${
      end ? `Checked ${groups.length} of ${groups.length} in ${secs(spent)}${onLaptop ? ", all on your laptop" : ""}.` : `Checking ${done} of ${groups.length}${onLaptop ? " on your laptop" : ""}${eta}.`
    }${groups.some((g) => g.lang === "id") && onLaptop ? ` Indonesian checked on the laptop: ${ID_ACCURACY}` : ""}`;
    $("summary").textContent = end
      ? found
        ? `3. ${found} thing${found === 1 ? "" : "s"} to fix ${source === "page" ? "on this screen" : "in this text"}`
        : `3. Nothing to fix ${source === "page" ? "on this screen" : "in this text"}`
      : `3. What to fix (${found} so far)`;
    window.__filesProgress = { done, total: groups.length, found, end };
  };
  report(false);
  for (const g of groups) {
    if (me !== run) return;
    try {
      g.result =
        quickCheck(g, { app, register }) ??
        (g.lang === "id"
          ? await translationCheck(g, screenName, { app, register, where: projectMode() === OPEN ? "cloud" : "laptop" })
          : await modelCheck(g, screenName, { app }));
    } catch (e) {
      g.error = e.message ?? String(e);
    }
    if (me !== run) return;
    if (isFinding(g)) g.ticked = true;
    done++;
    renderFindings();
    report(false);
  }
  $("run").disabled = false;
  $("stop").hidden = true;
  report(true);
  renderFindings();
  $("results").scrollIntoView({ block: "start", behavior: "smooth" });
  window.__filesReview = { ms: Math.round(performance.now() - started), groups: groups.map((g) => ({ ...g })) };
}

$("run").addEventListener("click", () => review());
$("stop").addEventListener("click", () => {
  run++;
  $("run").disabled = false;
  $("stop").hidden = true;
  $("progress").textContent += " Stopped.";
  renderFindings();
});

// ---------- findings ----------

function renderFindings() {
  const found = groups.filter(isFinding);
  const ticked = found.filter((g) => g.ticked).length;
  $("findings-count").textContent = found.length ? `${ticked} of ${found.length} ticked. Untick anything you do not want changed.` : "";
  $("make-fix").disabled = ticked === 0 || !$("stop").hidden;
  $("findings").innerHTML = found.length
    ? found
        .map((g) => {
          const i = groups.indexOf(g);
          const f = g.result.finding;
          const r = g.result;
          const ran = r.source === "rule" ? "On this laptop: plain rule" : r.source === "reused" ? "On this laptop: same text checked earlier" : r.where === "laptop" ? `On this laptop: ${secs(r.ms)}` : `Ran: ${r.where}`;
          const next = g.next !== undefined ? (g.next ? `New: "${esc(g.next)}"` : "No new text yet: write it in the fix prompt.") : f.rewrite ? `Try: "${esc(f.rewrite)}"` : esc(f.note ?? "");
          return `<li data-i="${i}" data-severity="${esc(f.severity)}">
            <input type="checkbox" id="f-${i}" ${g.ticked ? "checked" : ""}>
            <label for="f-${i}">
              <span class="lang">${g.lang.toUpperCase()}</span><b>${esc(PROBLEM_NAMES[f.problem] ?? "Problem")}</b>, ${esc(f.severity)}
              <span class="quote">"${esc(g.text)}" <span class="dim">(${esc(g.file)}, ${esc(g.key)}, ${esc(KIND_NAMES[g.kind] ?? g.kind)})</span></span>
              ${g.original ? `<span class="fix dim">English: "${esc(g.original)}"</span>` : ""}
              ${f.note && g.lang === "id" ? `<span class="fix">${esc(f.note)}</span>` : ""}
              <span class="fix">${next}</span>
              <span class="ran" data-where="${esc(r.where ?? "laptop")}">${esc(ran)}</span>
            </label>
          </li>`;
        })
        .join("")
    : `<li class="none dim">${groups.length ? ($("stop").hidden ? "Nothing to fix." : "Nothing found yet.") : ""}</li>`;
  if (!$("fix-prompt").hidden) refreshFix();
}

$("findings").addEventListener("change", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  groups[li.dataset.i].ticked = e.target.checked;
  renderFindings();
});

// ---------- fix prompt ----------

function hideFix() {
  $("fix-prompt").hidden = $("fix-actions").hidden = $("fix-help").hidden = true;
  $("fix-status").textContent = $("copy-status").textContent = "";
}

// Copies the fix prompt. Returns true when it is on the clipboard.
async function copyFix() {
  try {
    await navigator.clipboard.writeText($("fix-prompt").value);
    return true;
  } catch {
    // No clipboard permission, or the tab lost focus while the new texts were written.
    $("fix-prompt").select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}
const COPIED = "Copied. Paste it into your coding agent.";
const NOT_COPIED = 'Ready below, but not copied yet: press "Copy again".';

function refreshFix() {
  const list = groups.filter((g) => isFinding(g) && g.ticked);
  const { text, missing } = buildFixPrompt({
    app: $("app-name").value.trim() || "the app",
    items: list.map((g) => ({ file: g.file, lang: g.lang, key: g.key, kind: g.kind, screen: "", count: g.count ?? 1, old: g.text, next: g.next ?? "", problem: PROBLEM_NAMES[g.result.finding.problem] ?? "Problem" })),
    file: source === "page" ? files.en : undefined,
    source,
  });
  $("fix-prompt").value = text;
  window.__filesFix = { text, lines: list.length, missing };
  return { lines: list.length, missing };
}

$("make-fix").addEventListener("click", async () => {
  const me = run;
  const started = performance.now();
  const list = groups.filter((g) => isFinding(g) && g.ticked);
  $("make-fix").disabled = true;
  $("copy-status").textContent = "";
  let written = 0;
  for (const [n, g] of list.entries()) {
    $("fix-status").textContent = `Writing the new text, ${n + 1} of ${list.length}...`;
    if (g.lang === "id") {
      g.next = g.result.finding.rewrite ?? ""; // the translation check's better version
      continue;
    }
    try {
      const others = groups.filter((x) => x.lang === "en").map((x) => x.text).slice(0, 25);
      const r = await newTextFor(g, screenName, others, { app: $("app-name").value.trim() });
      if (me !== run) return;
      if (r.source === "laptop") written++;
      g.next = r.problem && (!r.text || r.text.toLowerCase() === g.text.toLowerCase()) ? "" : r.text;
    } catch (e) {
      g.next = "";
    }
  }
  $("fix-prompt").hidden = $("fix-actions").hidden = $("fix-help").hidden = false;
  renderFindings();
  const { lines, missing } = refreshFix();
  $("fix-status").textContent = `${lines} change${lines === 1 ? "" : "s"}, ready in ${secs(performance.now() - started)}. ${written} new text${written === 1 ? "" : "s"} written on the laptop.${
    missing ? ` ${missing} still need${missing === 1 ? "s" : ""} your own words: look for "(write the new text here)" below.` : ""
  }`;
  const copied = await copyFix();
  $("copy-status").textContent = copied ? COPIED : NOT_COPIED;
  window.__filesFix.copied = copied;
  $("make-fix").disabled = false;
});

$("copy-fix").addEventListener("click", async () => {
  $("copy-status").textContent = (await copyFix()) ? COPIED : "Select the text below and copy it by hand.";
});

// ---------- the seam ----------

onSeamChange(({ sent, modelApiRequests, otherRequests }) => {
  const left = Math.max(sent.length, modelApiRequests);
  $("left-count").textContent = `Left this laptop: ${left}`;
  $("left-count").dataset.zero = String(left === 0);
  $("sent-none").hidden = sent.length > 0;
  $("sent").innerHTML = sent.map((s) => `<li>${esc(new Date(s.at).toLocaleTimeString("en-GB"))}: ${esc(s.purpose)}, ${s.chars.toLocaleString("en")} characters. Ran: ${esc(s.where)}.</li>`).join("");
  const hosts = Object.entries(otherRequests).map(([h, n]) => `${h} x${n}`);
  $("net").textContent = `Requests the browser saw from this page: ${modelApiRequests} to a cloud model API.${hosts.length ? ` Other outside hosts: ${hosts.join(", ")}.` : ""}`;
  window.__seam = { left, sent: sent.length, modelApiRequests };
});
const showNet = () => {
  $("net-state").textContent = navigator.onLine ? "Online" : "Offline: laptop steps still work";
  $("net-state").dataset.online = String(navigator.onLine);
};
addEventListener("online", showNet);
addEventListener("offline", showNet);
showNet();
