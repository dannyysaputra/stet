// The review page: the app under review on the left, its text on the right.
// Slice 1.2 only collects and lists the text. Checking starts in slice 1.3.
import { KIND_NAMES, collectStrings, groupByKey } from "./collect.js";

const frame = document.getElementById("app");
const list = document.getElementById("strings");
const summary = document.getElementById("summary");

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let groups = [];

function screenName(doc) {
  return doc.getElementById("screen")?.dataset.screen ?? doc.location.hash.replace(/^#\//, "") ?? "";
}

function show() {
  const doc = frame.contentDocument;
  if (!doc) return;
  const items = collectStrings(doc);
  groups = groupByKey(items);
  const screen = screenName(doc);
  summary.textContent = `${items.length} pieces of text on the "${screen}" screen, ${groups.length} different.`;
  list.innerHTML = groups
    .map(
      (g, i) => `<li data-i="${i}" tabindex="0">
        <span class="kind" data-kind="${esc(g.kind)}">${esc(KIND_NAMES[g.kind] ?? g.kind)}</span>
        <span class="text">${g.text ? esc(g.text) : '<em class="dim">(empty)</em>'}</span>
        ${g.els.length > 1 ? `<span class="count">x${g.els.length}</span>` : ""}
        <code class="key">${esc(g.key)}</code>
      </li>`,
    )
    .join("");
}

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
// The frame may have finished loading before this module ran.
if (frame.contentDocument?.getElementById("screen")?.dataset.screen) attach();
