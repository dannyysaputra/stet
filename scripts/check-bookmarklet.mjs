// Gate for the "Scan with Stet" bookmarklet (slice 3.6). The bookmark's link is
// the scanner's own source text, so the scanner must run with nothing around it.
// This builds src/scan/bookmarklet.js with Vite's production minifier, takes the
// link the built code makes, and runs it in an empty sandbox with a small fake
// page. Any name from outside the function throws there. It also checks what the
// scan reads, what it leaves out, and that the text goes only to Stet's origin.
// Then it sends the review's marks back (option B) and checks they are heard only
// from Stet's tab and origin, drawn as text under one data-stet-ignore root, left
// out of a second scan, and removed whole by "Hide the marks".
//
// Limit: names are only caught on the paths this fake page drives.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "vite";
import { acceptScan, marksFor } from "../src/files/parse.js";

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

const root = resolve(import.meta.dirname, "..");
const out = await build({
  root,
  configFile: false,
  logLevel: "silent",
  // The same build as the app's (not library mode), with the exports kept.
  build: { write: false, minify: true, rollupOptions: { input: resolve(root, "src/scan/bookmarklet.js"), preserveEntrySignatures: "strict" } },
});
const code = (Array.isArray(out) ? out[0] : out).output.find((c) => c.type === "chunk").code;
if (code.includes("textOf")) fail("the build was not minified, so this gate would not test the real link");
const dir = mkdtempSync(join(tmpdir(), "stet-bm-"));
const file = join(dir, "bookmarklet.mjs");
writeFileSync(file, code);
const { bookmarkletHref } = await import(pathToFileURL(file).href);
rmSync(dir, { recursive: true, force: true });

const STET = "https://stet.example";
const href = bookmarkletHref(STET);
if (!href.startsWith("javascript:")) fail("the link does not start with javascript:");
const body = decodeURIComponent(href.slice("javascript:".length));

// ---------- a small fake page ----------

function matches(el, selector) {
  return selector.split(",").some((part) => {
    const m = part.trim().match(/^([a-z0-9]*)(?:\[([a-z-]+)(?:=['"]?([^'"\]]*)['"]?)?\])?$/i);
    if (!m) return false;
    const [, tag, attr, value] = m;
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    if (!attr) return !!tag;
    const v = el.getAttribute(attr);
    return v !== null && (value === undefined || v === value);
  });
}
class El {
  constructor(tag, attrs = {}, kids = []) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.childNodes = [];
    this.parentElement = null;
    this.labels = null;
    this.colSpan = 1;
    this.style = {};
    this.on = {};
    for (const k of kids) this.append(k);
  }
  append(...ks) {
    for (let k of ks) {
      if (typeof k === "string") k = { nodeType: 3, nodeValue: k, parentElement: this };
      else k.parentElement = this;
      this.childNodes.push(k);
    }
  }
  replaceChildren(...ks) {
    this.childNodes = [];
    this.append(...ks);
  }
  remove() {
    const p = this.parentElement;
    if (p) p.childNodes = p.childNodes.filter((c) => c !== this);
    this.parentElement = null;
  }
  getAttribute(n) {
    return n in this.attrs ? String(this.attrs[n]) : null;
  }
  setAttribute(n, v) {
    this.attrs[n] = String(v);
  }
  removeAttribute(n) {
    delete this.attrs[n];
  }
  get className() {
    return this.attrs.class ?? "";
  }
  set className(v) {
    this.attrs.class = String(v);
  }
  get textContent() {
    return [...this.texts()].map((t) => t.nodeValue).join("");
  }
  set textContent(v) {
    this.replaceChildren(String(v));
  }
  // A crude HTML parser, enough to show that markup set this way becomes elements.
  set innerHTML(v) {
    this.childNodes = [];
    for (const part of String(v).split(/(<[a-z]+[^>]*>)/i)) {
      const tag = part.match(/^<([a-z]+)/i);
      if (tag) this.append(new El(tag[1]));
      else if (part) this.append(part);
    }
  }
  addEventListener(type, fn) {
    (this.on[type] ??= []).push(fn);
  }
  click() {
    for (const fn of this.on.click ?? []) fn({ target: this });
  }
  getBoundingClientRect() {
    return { left: 40, top: 100, width: 80, height: 20 };
  }
  focus() {}
  get id() {
    return this.getAttribute("id") ?? "";
  }
  get href() {
    return new URL(this.getAttribute("href"), page.href).href;
  }
  matches(s) {
    return matches(this, s);
  }
  closest(s) {
    for (let e = this; e; e = e.parentElement) if (e.matches(s)) return e;
    return null;
  }
  getClientRects() {
    return [{}];
  }
  *texts() {
    for (const k of this.childNodes) {
      if (k.nodeType === 3) yield k;
      else yield* k.texts();
    }
  }
  *elements() {
    for (const k of this.childNodes) {
      if (k.nodeType === 3) continue;
      yield k;
      yield* k.elements();
    }
  }
}
const page = { href: "http://localhost:3000/reset/9f3a8c7d6e5f4a3b2c1d0e9f?token=secret#top", host: "localhost:3000", pathname: "/reset/9f3a8c7d6e5f4a3b2c1d0e9f", hash: "#top", origin: "http://localhost:3000" };
const input = new El("input", { id: "email", placeholder: "name@company.com" });
input.labels = [{ innerText: "Email" }];
const docBody = new El("body", {}, [
  new El("nav", {}, [new El("a", { href: "/invoices" }, ["Invoices"])]),
  new El("h1", {}, ["Unlock your journey"]),
  new El("p", {}, ["Signed in as jo@example.com"]),
  new El("a", { href: "/invoice/12345?token=abc" }, ["Click here"]),
  new El("a", { href: "/invoice/12345?token=abc" }, ["Click here"]), // same text twice: both get the mark
  new El("button", { id: "save" }, [new El("span", { "aria-hidden": "true" }, ["close"]), "Submit"]),
  new El("button", { id: "delete-48213" }, ["Delete"]),
  new El("table", {}, [new El("tr", {}, [new El("td", {}, ["Acme Ltd"])])]),
  new El("div", {}, ["No data"]),
  new El("span", {}, ["1,250.00"]),
  new El("p", {}, [String.fromCharCode(0x200b)]), // an "empty" paragraph from a page builder
  new El("p", {}, ["Learn" + String.fromCharCode(0x200b) + " more"]),
  new El("aside", { "data-stet-ignore": "" }, [new El("button", {}, ["Scan this screen with Stet"])]), // Stet's own bar on the example app
  input,
]);
const walker = (rootEl) => {
  const list = [...rootEl.texts()];
  let i = 0;
  return { nextNode: () => list[i++] ?? null };
};
const sent = [];
const listeners = [];
let focused = 0;
const tab = { postMessage: (data, origin) => sent.push({ data, origin }), focus: () => focused++, closed: false };
// Delivers a message event to the page's current "message" listeners.
const post = (ev) => {
  for (const l of [...listeners]) if (l.type === "message") l.fn(ev);
};
const sandbox = {
  document: {
    body: docBody,
    title: "Reset password",
    documentElement: { lang: "en" },
    createTreeWalker: (rootEl) => walker(rootEl),
    querySelectorAll: (s) => [...docBody.elements()].filter((e) => e.matches(s)),
    querySelector: (s) => [...docBody.elements()].find((e) => e.matches(s)) ?? null,
    createElement: (tag) => new El(tag),
  },
  location: page,
  NodeFilter: { SHOW_TEXT: 4 },
  CSS: { escape: (s) => s },
  URL,
  getComputedStyle: () => ({ visibility: "visible", display: "block" }),
  addEventListener: (type, fn) => listeners.push({ type, fn }),
  removeEventListener: (type, fn) => {
    const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
    if (i >= 0) listeners.splice(i, 1);
  },
  scrollX: 0,
  scrollY: 0,
  innerWidth: 375,
  setTimeout: () => 0,
  alert: () => fail("the scan alerted on a normal page"),
};
sandbox.window = { open: (url) => (url === `${STET}/files/#scan` ? tab : fail(`opened ${url}`)) };

const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(body, ctx, { timeout: 2000 });
  post({ source: { other: true }, origin: STET, data: { type: "stet-ready" } }); // another window: ignored
  post({ source: tab, origin: "https://evil.test", data: { type: "stet-ready" } }); // wrong origin: ignored
  if (sent.length) fail("the scan was sent before Stet's own tab asked for it");
  post({ source: tab, origin: STET, data: { type: "stet-ready" } });
} catch (e) {
  fail(`the minified bookmarklet threw in an empty sandbox: ${e.message}`);
}

const msg = sent[0];
if (sent.length !== 1 || msg.origin !== STET) fail(`expected one message to ${STET}, got ${JSON.stringify(sent.map((s) => s.origin))}`);
const items = msg?.data.items ?? [];
const has = (kind, text) => items.find((i) => i.kind === kind && i.text === text);
const want = [
  ["nav", "Invoices"],
  ["heading", "Unlock your journey"],
  ["link", "Click here"],
  ["button", "Submit"],
  ["button", "Delete"],
  ["text", "No data"],
  ["placeholder", "name@company.com"],
];
for (const [kind, text] of want) if (!has(kind, text)) fail(`missing ${kind} "${text}"`);
if (items.some((i) => /\p{Cf}/u.test(i.text) || !i.text.trim())) fail(`an invisible character or empty text was read: ${JSON.stringify(items.map((i) => i.text))}`);
if (!has("text", "Learn more")) fail('"Learn" + zero-width space + " more" should read as "Learn more"');
for (const leak of ["jo@example.com", "Acme Ltd", "1,250.00", "close", "Scan this screen"]) if (items.some((i) => i.text.includes(leak))) fail(`read data that is not interface text: "${leak}"`);
const all = JSON.stringify(msg?.data ?? {});
for (const secret of ["9f3a8c7d6e5f4a3b2c1d0e9f", "12345", "48213", "token", "secret"]) if (all.includes(secret)) fail(`an id or token reached the message: "${secret}"`);
if (has("link", "Click here")?.context !== "Link to /invoice/:id") fail(`link context: ${JSON.stringify(has("link", "Click here")?.context)}`);
if (msg?.data.page !== "localhost:3000/reset/:id") fail(`page: ${msg?.data.page}`);
if (has("button", "Submit")?.where !== "button#save") fail(`button element: ${has("button", "Submit")?.where}`);

// ---------- marks sent back after the review (option B) ----------

// Built with Stet's own code: the scan goes through acceptScan, the findings
// through marksFor, exactly as files.js does, so both ends are covered.
const XSS = '<img src=x onerror="alert(1)">';
const accepted = acceptScan(msg?.data)?.items ?? [];
const pick = (kind, text) => accepted.find((i) => i.kind === kind && i.en === text);
const marksMsg = {
  type: "stet-marks",
  v: 1,
  marks: marksFor(
    [
      [pick("heading", "Unlock your journey"), "Filler words", XSS],
      [pick("link", "Click here"), "Vague link", ""],
    ].map(([i, label, rewrite]) => ({ at: i?.at, kind: i?.kind, text: i?.en, label, rewrite })),
  ),
};
if (marksMsg.marks.length !== 2) fail(`marksFor kept ${marksMsg.marks.length} of 2 findings: "at" is lost between acceptScan and marksFor`);
const rootEl = () => [...docBody.elements()].find((e) => e.getAttribute("data-stet-marks") !== null) ?? null;
const markedEls = () => [...docBody.elements()].filter((e) => e.getAttribute("data-stet-mark") !== null);
const STET_WORDS = ["things to fix", "Back to Stet", "Hide the marks", "Filler words", "onerror", "fix message"];
let marksChecked = false;
try {
  post({ source: tab, origin: "https://evil.test", data: marksMsg });
  if (rootEl() || markedEls().length) fail("marks were drawn for a message from another origin");
  post({ source: { other: true }, origin: STET, data: marksMsg });
  if (rootEl() || markedEls().length) fail("marks were drawn for a message from another window");
  post({ source: tab, origin: STET, data: marksMsg });
  const root = rootEl();
  if (!root) fail("no marks were drawn for a valid message from Stet's tab and origin");
  else {
    if (root.getAttribute("data-stet-ignore") === null) fail("the marks root does not carry data-stet-ignore");
    if (root.parentElement !== docBody) fail("the marks root is not under the page body");
    const pins = [...root.elements()].filter((e) => e.className.split(" ").includes("stet-m-pin"));
    if (pins.map((p) => p.textContent).join(",") !== "1,2") fail(`pins: ${JSON.stringify(pins.map((p) => p.textContent))}`);
    const marked = markedEls().map((e) => e.textContent);
    if (marked.join("|") !== "Unlock your journey|Click here|Click here") fail(`underlined elements: ${JSON.stringify(marked)}`);
    if (!root.textContent.includes("things to fix on this screen")) fail(`the card does not say how many things to fix: ${JSON.stringify(root.textContent)}`);
    pins[0]?.click();
    if (!root.textContent.includes(XSS)) fail("the new text was not shown as text after clicking pin 1");
    if ([...root.elements()].some((e) => e.tagName === "IMG")) fail("markup in a mark's new text became an element");
    const back = [...root.elements()].find((e) => e.textContent === "Back to Stet to copy the fix");
    back?.click();
    if (focused !== 1) fail('"Back to Stet to copy the fix" did not focus Stet\'s tab');

    // A second scan of the same screen must not read Stet's own marks.
    const before = sent.length;
    vm.runInContext(body, ctx, { timeout: 2000 });
    post({ source: tab, origin: STET, data: { type: "stet-ready" } });
    const again = sent[before]?.data.items ?? [];
    if (sent.length !== before + 1) fail("the second scan was not sent");
    const leaked = STET_WORDS.filter((w) => again.some((i) => i.text.includes(w)));
    if (leaked.length) fail(`a second scan read Stet's own marks: ${JSON.stringify(leaked)}`);
    if (JSON.stringify(again.map((i) => i.text)) !== JSON.stringify(items.map((i) => i.text))) fail(`a second scan read different text: ${JSON.stringify(again.map((i) => i.text))}`);

    const hide = [...root.elements()].find((e) => e.textContent === "Hide the marks");
    if (!hide) fail('no "Hide the marks" button');
    hide?.click();
    if (rootEl()) fail('"Hide the marks" left the marks root on the page');
    if (markedEls().length) fail(`"Hide the marks" left ${markedEls().length} underlined element(s)`);
    if ([...docBody.elements()].some((e) => e.tagName === "STYLE")) fail('"Hide the marks" left a style element');
    if (listeners.some((l) => l.type === "resize")) fail('"Hide the marks" left a resize listener');
    marksChecked = true;
  }
} catch (e) {
  fail(`drawing the marks threw: ${e.message}`);
}

if (failed) {
  console.log(`FAIL check-bookmarklet: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-bookmarklet: the minified link (${href.length} characters) runs with no outside names, reads ${items.length} strings of ${want.length} kinds expected, leaves out data, ids and tokens, and sends only to Stet's tab. Marks: heard only from Stet's tab and origin, drawn as text under data-stet-ignore, left out of a second scan, removed by "Hide the marks"${marksChecked ? "" : " (NOT CHECKED)"}.`);
